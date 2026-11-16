-- REVIEW: install only with verified current backup and coordinated compatible frontend.
-- This blocks old Paneles close routes; do not install long before frontend is ready.
begin;
set local lock_timeout='5s';
do $guard$ begin
 if to_regnamespace('sgp_picking_audit_areas') is not null then raise exception 'AUDITORIA_AREAS_YA_EXISTE';end if;
 if md5(pg_get_functiondef('public.sgp_picking_auditoria_guardar(text,uuid,text,uuid,date,text,jsonb,jsonb,text)'::regprocedure))<>'c9270cabd220b3646c98c63c85be6670' then raise exception 'AUDITORIA_BASE_CAMBIO';end if;
 if md5(pg_get_functiondef('public.sgp_picking_auditoria_contexto(text,uuid)'::regprocedure))<>'bab3fe2c5271e33ede98f28b5d6c1249' then raise exception 'AUDITORIA_LECTOR_CAMBIO';end if;
end $guard$;
-- REVIEW ONLY. Private additive ledger. Existing operational history is never backfilled.
create schema sgp_picking_audit_areas;
revoke all on schema sgp_picking_audit_areas from public,anon,authenticated;
create table sgp_picking_audit_areas.configuracion(linea text primary key,areas jsonb not null,usuario text not null,actualizado_en timestamptz not null default clock_timestamp());
create table sgp_picking_audit_areas.config_historial(id bigint generated always as identity primary key,linea text not null,anterior jsonb,nuevo jsonb not null,usuario text not null,ejecutado_en timestamptz not null default clock_timestamp());
create table sgp_picking_audit_areas.lotes(id_entrega uuid primary key references public.sgp_picking_entregas,linea text not null,areas jsonb not null,creado_en timestamptz not null default clock_timestamp());
create table sgp_picking_audit_areas.revisiones(
 id_entrega uuid not null references sgp_picking_audit_areas.lotes,area text not null,solicitud uuid not null unique,
 payload jsonb not null,respuesta jsonb not null,usuario text not null,fecha date not null,turno text not null,
 resultado text not null check(resultado in ('SIN_FALTANTES','CON_FALTANTES')),ejecutado_en timestamptz not null default clock_timestamp(),primary key(id_entrega,area));
alter table sgp_picking_audit_areas.configuracion enable row level security;
alter table sgp_picking_audit_areas.config_historial enable row level security;
alter table sgp_picking_audit_areas.lotes enable row level security;
alter table sgp_picking_audit_areas.revisiones enable row level security;
insert into sgp_picking_audit_areas.configuracion(linea,areas,usuario) values('PANELES_2','[{"id":"VERTICALES","nombre":"Verticales"},{"id":"ZOCALERO","nombre":"Zocalero (top y bottom)"}]','INSTALACION_AUTORIZADA');
create function sgp_picking_audit_areas.linea(id uuid) returns text language plpgsql security definer set search_path='' as $$
declare ls text[];
begin
 select array_agg(distinct s.id_linea order by s.id_linea) into ls
 from public.sgp_picking_entregas e join public.sgp_mecanizado_programacion m on m.id_programacion=e.id_programacion
 join public.sgp_prioridades pr on pr.reserva=m.reserva
 join public.sgp_producciones s on s.key_produccion=pr.key_produccion and s.id_linea=pr.id_linea and s.produccion=e.produccion
 where e.id_entrega=$1 and (not exists(select 1 from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion)
 or s.key_produccion=(select pt.key_produccion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion));
 if cardinality(ls) is distinct from 1 then raise exception 'AUDITORIA_LINEA_NO_UNIVOCA';end if;
 return ls[1];
end $$;
create function sgp_picking_audit_areas.esquema(id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare l text;a jsonb;
begin
 select linea,areas into l,a from sgp_picking_audit_areas.lotes where id_entrega=id;
 if found then return jsonb_build_object('linea',l,'areas',a);end if;
 l:=sgp_picking_audit_areas.linea(id);
 select areas into a from sgp_picking_audit_areas.configuracion where linea=l for share;
 return jsonb_build_object('linea',l,'areas',coalesce(a,'[{"id":"GENERAL","nombre":"Recepción"}]'::jsonb));
end $$;
create function sgp_picking_audit_areas.resumen(id uuid) returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',a->>'id','nombre',a->>'nombre','revision',case when r.area is null then null else jsonb_build_object('usuario',r.usuario,'fecha',r.fecha,'turno',r.turno,'resultado',r.resultado,'registrado_en',r.ejecutado_en,'decisiones',r.payload->'decisiones','diferencias',r.payload->'diferencias') end) order by n),'[]'::jsonb)
 from jsonb_array_elements(sgp_picking_audit_areas.esquema(id)->'areas') with ordinality q(a,n)
 left join sgp_picking_audit_areas.revisiones r on r.id_entrega=id and r.area=a->>'id';
$$;
create function sgp_picking_audit_areas.version(id uuid) returns text language sql security definer set search_path='' as $$
 select md5(jsonb_build_object('snapshot',sgp_picking_audit.snapshot(id),'esquema',sgp_picking_audit_areas.esquema(id),'revisiones',sgp_picking_audit_areas.resumen(id))::text);
$$;
create function public.sgp_picking_auditoria_areas_contexto(p_token text,p_id_entrega uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb;e jsonb;
begin
 -- Reuse the installed authorized source reader, including its narrow PDT capability.
 s:=public.sgp_picking_auditoria_contexto(p_token,p_id_entrega);
 e:=sgp_picking_audit_areas.esquema(p_id_entrega);
 return s||e||jsonb_build_object('areas',sgp_picking_audit_areas.resumen(p_id_entrega),'version',sgp_picking_audit_areas.version(p_id_entrega),
 'revisados_ids',coalesce((select jsonb_agg(id_faltante order by id_faltante) from sgp_picking_audit.decisiones where id_entrega=p_id_entrega),'[]'::jsonb));
end $$;
create function public.sgp_picking_auditoria_areas_configuracion(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.sgp_pdt_validar_rol_real(p_token,array['ADMINISTRADOR']);
 return coalesce((select jsonb_agg(jsonb_build_object('linea',linea,'areas',areas) order by linea) from sgp_picking_audit_areas.configuracion),'[]'::jsonb);
end $$;
create function public.sgp_picking_auditoria_areas_configurar(p_token text,p_linea text,p_areas jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;old jsonb;
begin
 actor:=public.sgp_pdt_validar_rol_real(p_token,array['ADMINISTRADOR']);
 if p_linea is null or not exists(select 1 from public.sgp_producciones where id_linea=p_linea) then raise exception 'LINEA_INVALIDA';end if;
 if jsonb_typeof(p_areas) is distinct from 'array' or jsonb_array_length(p_areas) not between 1 and 8 then raise exception 'AREAS_INVALIDAS';end if;
 if exists(select 1 from jsonb_array_elements(p_areas) a where jsonb_typeof(a)<>'object' or a->>'id' is null or a->>'id' !~ '^[A-Z][A-Z0-9_]{0,39}$' or nullif(btrim(a->>'nombre'),'') is null or length(a->>'nombre')>80 or (a-'id'-'nombre')<>'{}'::jsonb)
 or (select count(distinct a->>'id') from jsonb_array_elements(p_areas) a)<>jsonb_array_length(p_areas) then raise exception 'AREAS_INVALIDAS';end if;
 perform pg_advisory_xact_lock(hashtextextended('AUDIT_CONFIG:'||p_linea,0));
 select areas into old from sgp_picking_audit_areas.configuracion where linea=p_linea for update;
 insert into sgp_picking_audit_areas.configuracion values(p_linea,p_areas,actor,clock_timestamp()) on conflict(linea) do update set areas=excluded.areas,usuario=excluded.usuario,actualizado_en=excluded.actualizado_en;
 insert into sgp_picking_audit_areas.config_historial(linea,anterior,nuevo,usuario) values(p_linea,old,p_areas,actor);
 return jsonb_build_object('ok',true,'linea',p_linea,'areas',p_areas,'aplica','NUEVAS_AUDITORIAS');
end $$;

-- Exact lookup shared by the audit reader/writer. Existing historical references are not revalidated.
create function sgp_picking_audit_areas.nc_resolver(p_referencia text) returns jsonb language plpgsql security definer set search_path='' as $$
declare ref text:=nullif(btrim(p_referencia),''); matches integer; snap jsonb;
begin
 if ref is null then return null;end if;
 if length(ref)>120 or ref~'[[:cntrl:]]' then raise exception 'AUDITORIA_NC_INVALIDA';end if;
 perform 1 from public.sgp_nc_aluminio where consecutivo=ref or cod_nc=ref for share;
 select count(distinct consecutivo) into matches from public.sgp_nc_aluminio where consecutivo=ref or cod_nc=ref;
 if matches>1 then raise exception 'AUDITORIA_NC_AMBIGUA';end if;
 if matches=0 then raise exception 'AUDITORIA_NC_NO_ENCONTRADA';end if;
 select to_jsonb(n) into snap from public.sgp_nc_aluminio n where consecutivo=ref or cod_nc=ref order by fecha_actualizacion desc nulls last,creacion desc nulls last limit 1;
 return snap;
end $$;
create function public.sgp_picking_auditoria_nc_consultar(p_token text,p_referencia text) returns jsonb language plpgsql security definer set search_path='' as $$
declare n jsonb;
begin
 perform public.sgp_pdt_validar_rol_real(p_token,array['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA','LIDER','RECEPCION']);
 if nullif(btrim(p_referencia),'') is null then raise exception 'AUDITORIA_NC_INVALIDA';end if;
 begin n:=sgp_picking_audit_areas.nc_resolver(p_referencia);exception when raise_exception then
  if sqlerrm='AUDITORIA_NC_NO_ENCONTRADA' then return jsonb_build_object('ok',true,'nc',null);else raise;end if;
 end;
 return jsonb_build_object('ok',true,'nc',jsonb_build_object('consecutivo',n->>'consecutivo','numero',n->>'cod_nc','estado',n->>'estado','reserva_solucion',coalesce(n->>'reserva_solucion',n->>'reserva_de_solucion'),'activo',n->'activo'));
end $$;

create function sgp_picking_audit_areas.procesar(p_token text,p_id_entrega uuid,p_version text,p_solicitud uuid,p_fecha date,p_turno text,p_decisiones jsonb,p_diferencias jsonb default '[]',p_observacion text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;e public.sgp_picking_entregas;f public.sgp_picking_faltantes;p public.sgp_aluminio_pendientes;
 d jsonb;src jsonb;sources jsonb;ctx jsonb;old jsonb;req jsonb;action text;reason text;pid uuid;n integer;
 nc_snap jsonb; nc_item jsonb; nc_ref text; saved sgp_picking_audit.eventos;result jsonb;ev uuid;ids jsonb;
begin
 actor:=public.sgp_pdt_validar_rol_real(p_token,array['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA','LIDER','RECEPCION']);
 if p_solicitud is null or p_fecha is null or p_turno is null or p_turno not in ('TURNO 1','TURNO 2') then raise exception 'FECHA_TURNO_REQUERIDOS';end if;
 req:=jsonb_build_object('version',p_version,'fecha',p_fecha,'turno',p_turno,'decisiones',p_decisiones,'diferencias',p_diferencias,'observacion',p_observacion);
 select * into strict e from public.sgp_picking_entregas where id_entrega=p_id_entrega for update;
 if e.estado<>'PENDIENTE_VALIDACION' then raise exception 'La entrega ya fue auditada';end if;
 for f in select * from public.sgp_picking_faltantes where id_entrega=p_id_entrega order by id_faltante for update loop
  pid:=sgp_picking_audit.pendiente(f);perform 1 from public.sgp_aluminio_pendientes where id_pendiente=pid for update;
 end loop;
 if md5(sgp_picking_audit.snapshot(p_id_entrega)::text) is distinct from p_version then raise exception 'AUDITORIA_CONFLICTO_RECARGAR';end if;
 if jsonb_typeof(p_decisiones) is distinct from 'array' or jsonb_typeof(p_diferencias) is distinct from 'array' then raise exception 'DECISIONES_INVALIDAS';end if;
 if (select count(distinct x->>'id_faltante') from jsonb_array_elements(p_decisiones) x)<>jsonb_array_length(p_decisiones) then raise exception 'DECIDIR_CADA_FALTANTE_UNA_VEZ';end if;
 if exists(select 1 from sgp_picking_audit.decisiones d where d.id_entrega=p_id_entrega and d.id_faltante in(select (x->>'id_faltante')::uuid from jsonb_array_elements(p_decisiones) x)) then raise exception 'FALTANTE_YA_REVISADO';end if;
 insert into sgp_picking_audit.contextos values(pg_current_xact_id()::text,actor);
 ctx:=jsonb_build_object('id_programacion',e.id_programacion,'produccion',e.produccion);
 sources:=sgp_pdt_multiorigen.fuentes(p_token,'PICKING',ctx);
 for d in select value from jsonb_array_elements(p_decisiones) loop
  select * into f from public.sgp_picking_faltantes where id_faltante=(d->>'id_faltante')::uuid and id_entrega=p_id_entrega;
  if not found then raise exception 'FALTANTE_AJENO_A_ENTREGA';end if;
  pid:=sgp_picking_audit.pendiente(f);select * into strict p from public.sgp_aluminio_pendientes where id_pendiente=pid;
  action:=d->>'accion';reason:=nullif(btrim(d->>'motivo'),'');old:=jsonb_build_object('faltante',to_jsonb(f),'pendiente',to_jsonb(p));
  if action is null or action not in ('ACEPTAR','MODIFICAR','ELIMINAR') then raise exception 'DECISION_REQUERIDA';end if;
  nc_ref:=nullif(btrim(d->>'nc'),'');
  if d ? 'nc' and jsonb_typeof(d->'nc') not in ('string','null') then raise exception 'AUDITORIA_NC_INVALIDA';end if;
  if d ? 'ncs' then raise exception 'AUDITORIA_NC_USAR_CAMPO_NC';end if;
  if action='ELIMINAR' and nc_ref is not null then raise exception 'AUDITORIA_NC_NO_APLICA_ELIMINAR';end if;
  nc_snap:=sgp_picking_audit_areas.nc_resolver(nc_ref);
  old:=old||jsonb_build_object('ncs',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.sgp_aluminio_pendiente_ncs x where x.id_pendiente=pid));
  if action<>'ACEPTAR' then
   if reason is null then raise exception 'MOTIVO_REQUERIDO';end if;
   if p.estado<>'PENDIENTE' or coalesce(p.estado_repo,'PENDIENTE')<>'PENDIENTE' or p.validacion_estado<>'POR_VALIDAR'
   or nullif(btrim(p.nc),'') is not null or nullif(btrim(f.nc),'') is not null
   or exists(select 1 from public.sgp_aluminio_pendiente_ncs x where x.id_pendiente=pid)
   or exists(select 1 from public.sgp_aluminio_pendiente_detalles x where x.id_pendiente=pid)
   or exists(select 1 from public.sgp_aluminio_pendiente_movimientos x where x.id_pendiente=pid)
   then raise exception 'PDT_CON_DEPENDENCIAS_NO_CORREGIBLE';end if;
  end if;
  if action='MODIFICAR' then
   perform 1 from public.sgp_aluminio where id_pieza=d->>'id_pieza' for share;
   sources:=sgp_pdt_multiorigen.fuentes(p_token,'PICKING',ctx);
   select count(*),jsonb_agg(x)->0 into n,src from jsonb_array_elements(sources) x where x->>'id_pieza'=d->>'id_pieza' and x->>'reserva'=d->>'reserva' and x->>'acabado'=d->>'acabado';
   if n<>1 then raise exception 'PIEZA_NO_CORRESPONDE_A_ORDEN';end if;
   if (d->>'cantidad')::numeric is null or (d->>'cantidad')::numeric<=0 or (d->>'cantidad')::numeric<>trunc((d->>'cantidad')::numeric)
   or (d->>'cantidad')::numeric>(select cantidad from public.sgp_aluminio where id_pieza=d->>'id_pieza')
   or (d->>'ventanas_afectadas')::integer is null or (d->>'ventanas_afectadas')::integer<1
   or (d->>'ventanas_afectadas')::integer>coalesce((select cantidad from sgp_mecanizado_parcial.partes where id_programacion=e.id_programacion),(select cantidad from public.sgp_producciones where key_produccion=src->>'key_produccion')) then raise exception 'CANTIDAD_INVALIDA';end if;
   insert into sgp_picking_audit.correcciones values(pid,pg_current_xact_id()::text,p.cantidad,(d->>'cantidad')::numeric);
   update public.sgp_aluminio_pendientes set reserva=src->>'reserva',acabado_pendiente=src->>'acabado',key_produccion=src->>'key_produccion',reserva_principal=src->>'reserva_principal',
   id_pieza=src->>'id_pieza',perfil=src->>'codigo_sap',marca=src->>'marca',fabricacion=src->>'fabricacion',longitud=(src->>'longitud')::numeric,cantidad=(d->>'cantidad')::numeric,ventanas_afectadas=(d->>'ventanas_afectadas')::integer,observacion=nullif(d->>'observacion','') where id_pendiente=pid;
   delete from sgp_picking_audit.correcciones where id_pendiente=pid;
   update sgp_pdt_multiorigen.detalles set fuente=public.sgp_pdt_contexto_internal_v3(src->>'reserva',src->>'codigo_sap',e.produccion,src->>'acabado',src->>'id_pieza',src->>'key_produccion',src->>'reserva_principal',(src->>'longitud')::numeric) where id_pendiente=pid;
   update public.sgp_picking_faltantes set reserva_pendiente=src->>'reserva',acabado_pendiente=src->>'acabado',id_pieza=src->>'id_pieza',perfil=src->>'codigo_sap',marca=src->>'marca',fabricacion=src->>'fabricacion',longitud=(src->>'longitud')::numeric,
   cantidad=(d->>'cantidad')::numeric,ventanas_afectadas=(d->>'ventanas_afectadas')::integer,observacion=nullif(d->>'observacion','') where id_faltante=f.id_faltante;
  elsif action='ELIMINAR' then
   update public.sgp_aluminio_pendientes set estado='ANULADO',auditado=true where id_pendiente=pid;
  end if;
  if nc_snap is not null then
   if p.estado<>'PENDIENTE' or p.fecha_cierre is not null or p.estado_repo='PICKING' then raise exception 'AUDITORIA_NC_PDT_NO_PENDIENTE';end if;
   insert into public.sgp_aluminio_pendiente_ncs(id_pendiente,consecutivo,enlazado_por,snapshot)
   values(pid,nc_snap->>'consecutivo',actor,nc_snap) on conflict(id_pendiente,consecutivo) do nothing;
   -- Append-only: preserve legacy primary reference and all prior links.
   update public.sgp_aluminio_pendientes set nc=coalesce(nullif(btrim(nc),''),nc_ref) where id_pendiente=pid;
   update public.sgp_picking_faltantes set nc=coalesce(nullif(btrim(nc),''),nc_ref) where id_faltante=f.id_faltante;
  end if;
  if action<>'ELIMINAR' then update public.sgp_aluminio_pendientes set auditado=true where id_pendiente=pid;end if;
  update public.sgp_picking_faltantes set auditado=true,usuario_auditoria=actor,fecha_auditoria=clock_timestamp() where id_faltante=f.id_faltante;
  insert into sgp_picking_audit.decisiones(id_faltante,id_pendiente,id_entrega,accion,motivo,anterior,nuevo,usuario,fecha_recepcion,turno_recepcion)
  select f.id_faltante,pid,p_id_entrega,action,reason,old,jsonb_build_object('faltante',(select to_jsonb(z) from public.sgp_picking_faltantes z where z.id_faltante=f.id_faltante),'pendiente',to_jsonb(x),'ncs',(select coalesce(jsonb_agg(to_jsonb(z)),'[]') from public.sgp_aluminio_pendiente_ncs z where z.id_pendiente=pid)),actor,p_fecha,p_turno from public.sgp_aluminio_pendientes x where x.id_pendiente=pid;
  insert into public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,estado_anterior,estado_nuevo,tipo_evento,observacion,datos_anteriores,datos_nuevos)
  select pid,actor,p.estado,x.estado,'AUDITORIA_PICKING_'||action,reason,old,to_jsonb(x) from public.sgp_aluminio_pendientes x where x.id_pendiente=pid;
 end loop;
 -- Identity uniqueness after all decisions also catches two edits to the same piece.
 if exists(select 1 from public.sgp_aluminio_pendientes x
 join sgp_mecanizado_parcial.contextos_pdt c on c.id_pendiente=x.id_pendiente
 where c.id_entrega=p_id_entrega and x.estado='PENDIENTE'
 group by x.id_pieza,x.reserva,x.acabado_pendiente having count(distinct x.id_pendiente)>1)
 then raise exception 'PENDIENTE_DUPLICADO_EN_ENTREGA';end if;
 for d in select value from jsonb_array_elements(p_diferencias) loop
  if d ? 'nc' and jsonb_typeof(d->'nc') not in ('string','null') then raise exception 'AUDITORIA_NC_INVALIDA';end if;
  perform sgp_picking_audit_areas.nc_resolver(d->>'nc');
  if d ? 'ncs' then
   if jsonb_typeof(d->'ncs') is distinct from 'array' then raise exception 'AUDITORIA_NC_INVALIDA';end if;
   for nc_item in select value from jsonb_array_elements(d->'ncs') loop
    if jsonb_typeof(nc_item)<>'string' or nullif(btrim(nc_item#>>'{}'),'') is null then raise exception 'AUDITORIA_NC_INVALIDA';end if;
    perform sgp_picking_audit_areas.nc_resolver(nc_item#>>'{}');
   end loop;
  end if;
  if (d->>'ventanas_afectadas')::integer is null or (d->>'ventanas_afectadas')::integer<1
   or (d->>'ventanas_afectadas')::integer>coalesce((select cantidad from sgp_mecanizado_parcial.partes where id_programacion=e.id_programacion),(select cantidad from public.sgp_producciones where key_produccion=d->>'key_produccion')) then raise exception 'VENTANAS_INVALIDAS';end if;
  if exists(select 1 from public.sgp_aluminio_pendientes x join sgp_mecanizado_parcial.contextos_pdt c on c.id_pendiente=x.id_pendiente where c.id_entrega=p_id_entrega and x.id_pieza=d->>'id_pieza' and x.reserva=d->>'reserva' and x.estado='PENDIENTE') then raise exception 'PENDIENTE_DUPLICADO_EN_ENTREGA';end if;
 end loop;
 if jsonb_array_length(p_diferencias)>0 then
  ev:=gen_random_uuid();insert into sgp_pdt_multiorigen.eventos(id_evento,usuario,solicitud,respuesta) values(ev,actor,req,'{}');
  result:=sgp_pdt_multiorigen.registrar(p_token,'PICKING',ctx,p_diferencias,ev,p_id_entrega);ids:=result->'ids_pendientes';
  insert into public.sgp_picking_auditoria_diferencias(id_entrega,id_pieza,perfil,marca,fabricacion,longitud,cantidad,ventanas_afectadas,observacion,usuario_auditoria,reserva_pendiente,acabado_pendiente)
  select p_id_entrega,x->>'id_pieza',x->>'perfil',x->>'marca',x->>'fabricacion',(x->>'longitud')::numeric,(x->>'cantidad')::numeric,(x->>'ventanas_afectadas')::integer,x->>'observacion',actor,x->>'reserva',x->>'acabado' from jsonb_array_elements(p_diferencias) x;
  update public.sgp_aluminio_pendientes x set origen='PICKING_AUDITORIA',causa='DIFERENCIA_AUDITORIA',auditado=true,
 ventanas_afectadas=(select (dif.value->>'ventanas_afectadas')::integer from jsonb_array_elements(p_diferencias) dif where dif.value->>'id_pieza'=x.id_pieza and dif.value->>'reserva'=x.reserva)
 where id_pendiente in(select value::uuid from jsonb_array_elements_text(ids));
 end if;
 result:=jsonb_build_object('ok',true,'id_entrega',p_id_entrega,'ids_nuevos',coalesce(ids,'[]'::jsonb));
 delete from sgp_picking_audit.contextos where transaccion=pg_current_xact_id()::text;return result;
end $$;

create function public.sgp_picking_auditoria_area_guardar(p_token text,p_id_entrega uuid,p_version text,p_solicitud uuid,p_fecha date,p_turno text,p_decisiones jsonb,p_diferencias jsonb,p_observacion text,p_area text,p_resultado text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;e public.sgp_picking_entregas;cfg jsonb;req jsonb;saved sgp_picking_audit_areas.revisiones;r jsonb;
 locked_f public.sgp_picking_faltantes;pid uuid;all_done boolean;dec jsonb;diff jsonb;obs text;has_missing boolean;rev jsonb;
begin
 actor:=public.sgp_pdt_validar_rol_real(p_token,array['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA','LIDER','RECEPCION']);
 if p_solicitud is null or p_fecha is null or p_turno is null or p_turno not in ('TURNO 1','TURNO 2') then raise exception 'FECHA_TURNO_REQUERIDOS';end if;
 if p_area is null or p_resultado is null or p_resultado not in ('SIN_FALTANTES','CON_FALTANTES') then raise exception 'RESULTADO_AREA_REQUERIDO';end if;
 if jsonb_typeof(p_decisiones) is distinct from 'array' or jsonb_typeof(p_diferencias) is distinct from 'array' then raise exception 'DECISIONES_INVALIDAS';end if;
 req:=jsonb_build_object('version',p_version,'fecha',p_fecha,'turno',p_turno,'decisiones',p_decisiones,'diferencias',p_diferencias,'observacion',p_observacion,'area',p_area,'resultado',p_resultado);
 select * into strict e from public.sgp_picking_entregas where id_entrega=p_id_entrega for update;
 select * into saved from sgp_picking_audit_areas.revisiones where id_entrega=p_id_entrega and area=p_area;
 if found then
  if saved.solicitud=p_solicitud and saved.payload=req and saved.usuario=actor then return saved.respuesta;end if;
  raise exception 'AREA_YA_AUDITADA';
 end if;
 if e.estado<>'PENDIENTE_VALIDACION' then raise exception 'La entrega ya fue auditada';end if;
 -- Lock the same operational rows in the same order as the installed writer before version comparison.
 for locked_f in select * from public.sgp_picking_faltantes where id_entrega=p_id_entrega order by id_faltante for update loop
  pid:=sgp_picking_audit.pendiente(locked_f);perform 1 from public.sgp_aluminio_pendientes where id_pendiente=pid for update;
 end loop;
 cfg:=sgp_picking_audit_areas.esquema(p_id_entrega);
 if not exists(select 1 from jsonb_array_elements(cfg->'areas') a where a->>'id'=p_area) then raise exception 'AREA_NO_REQUERIDA';end if;
 if sgp_picking_audit_areas.version(p_id_entrega) is distinct from p_version then raise exception 'AUDITORIA_CONFLICTO_RECARGAR';end if;
 has_missing:=jsonb_array_length(p_diferencias)>0 or exists(select 1 from jsonb_array_elements(p_decisiones) d where d->>'accion' in ('ACEPTAR','MODIFICAR'));
 if has_missing is distinct from (p_resultado='CON_FALTANTES') then raise exception 'RESULTADO_NO_COINCIDE_CON_FALTANTES';end if;
 insert into sgp_picking_audit_areas.lotes(id_entrega,linea,areas) values(p_id_entrega,cfg->>'linea',cfg->'areas') on conflict(id_entrega) do nothing;
 -- All installed PDT validations retained; writes are immediate, transactionally owned by this reviewer.
 r:=sgp_picking_audit_areas.procesar(p_token,p_id_entrega,md5(sgp_picking_audit.snapshot(p_id_entrega)::text),p_solicitud,p_fecha,p_turno,p_decisiones,p_diferencias,p_observacion);
 insert into sgp_picking_audit_areas.revisiones(id_entrega,area,solicitud,payload,respuesta,usuario,fecha,turno,resultado) values(p_id_entrega,p_area,p_solicitud,req,'{}',actor,p_fecha,p_turno,p_resultado);
 all_done:=not exists(select 1 from jsonb_array_elements(cfg->'areas') a where not exists(select 1 from sgp_picking_audit_areas.revisiones x where x.id_entrega=p_id_entrega and x.area=a->>'id'));
 if all_done then
  if exists(select 1 from public.sgp_picking_faltantes f where f.id_entrega=p_id_entrega and not exists(select 1 from sgp_picking_audit.decisiones d where d.id_faltante=f.id_faltante)) then raise exception 'FALTANTES_SIN_REVISAR';end if;
  select coalesce(jsonb_agg(d order by x.area,n),'[]'::jsonb) into dec from sgp_picking_audit_areas.revisiones x cross join lateral jsonb_array_elements(x.payload->'decisiones') with ordinality q(d,n) where x.id_entrega=p_id_entrega;
  select coalesce(jsonb_agg(d order by x.area,n),'[]'::jsonb) into diff from sgp_picking_audit_areas.revisiones x cross join lateral jsonb_array_elements(x.payload->'diferencias') with ordinality q(d,n) where x.id_entrega=p_id_entrega;
  select string_agg(x.area||': '||coalesce(nullif(x.payload->>'observacion',''),x.resultado),E'\n' order by x.area) into obs from sgp_picking_audit_areas.revisiones x where x.id_entrega=p_id_entrega;
  update public.sgp_picking_entregas set estado=case when jsonb_array_length(diff)>0 then 'AUDITADA_DIFERENCIA' else 'VALIDADA' end,usuario_validacion=actor,fecha_validacion=clock_timestamp(),observacion_validacion=obs where id_entrega=p_id_entrega;
  -- Exactly one receipt event. Existing reports retain one order, with snapshots per reviewer attached.
  insert into sgp_picking_audit.eventos(id_entrega,solicitud,payload,respuesta,usuario,fecha_recepcion,turno_recepcion,ejecutado_en)
  values(p_id_entrega,p_solicitud,jsonb_build_object('version',p_version,'fecha',p_fecha,'turno',p_turno,'decisiones',dec,'diferencias',diff,'observacion',obs,'areas',sgp_picking_audit_areas.resumen(p_id_entrega)),jsonb_build_object('ok',true,'id_entrega',p_id_entrega),actor,p_fecha,p_turno,clock_timestamp());
 end if;
 rev:=sgp_picking_audit_areas.resumen(p_id_entrega);
 r:=r||jsonb_build_object('area',p_area,'resultado',p_resultado,'finalizada',all_done,'areas',rev,'estado',case when all_done then (select estado from public.sgp_picking_entregas where id_entrega=p_id_entrega) else 'PENDIENTE_VALIDACION' end);
 update sgp_picking_audit_areas.revisiones set respuesta=r where id_entrega=p_id_entrega and area=p_area;
 return r;
end $$;
-- Guard all legacy closing routes, not only the UI's old RPC. No change to historical rows.
create function sgp_picking_audit_areas.proteger_cierre() returns trigger language plpgsql security definer set search_path='' as $$
declare a jsonb;
begin
 if old.estado='PENDIENTE_VALIDACION' and new.estado in ('VALIDADA','AUDITADA_DIFERENCIA') then
  a:=sgp_picking_audit_areas.esquema(old.id_entrega)->'areas';
  if jsonb_array_length(a)>1 or exists(select 1 from sgp_picking_audit_areas.lotes where id_entrega=old.id_entrega) then
   if exists(select 1 from jsonb_array_elements(a) x where not exists(select 1 from sgp_picking_audit_areas.revisiones r where r.id_entrega=old.id_entrega and r.area=x->>'id')) then raise exception 'AUDITORIA_AREAS_PENDIENTES';end if;
  end if;
 end if;
 return new;
end $$;
create trigger sgp_picking_audit_areas_cierre before update of estado on public.sgp_picking_entregas for each row execute function sgp_picking_audit_areas.proteger_cierre();
revoke all on all tables in schema sgp_picking_audit_areas from public,anon,authenticated;
revoke all on all functions in schema sgp_picking_audit_areas from public,anon,authenticated;
revoke all on function public.sgp_picking_auditoria_nc_consultar(text,text),public.sgp_picking_auditoria_areas_contexto(text,uuid),public.sgp_picking_auditoria_area_guardar(text,uuid,text,uuid,date,text,jsonb,jsonb,text,text,text),public.sgp_picking_auditoria_areas_configuracion(text),public.sgp_picking_auditoria_areas_configurar(text,text,jsonb) from public;
grant execute on function public.sgp_picking_auditoria_nc_consultar(text,text),public.sgp_picking_auditoria_areas_contexto(text,uuid),public.sgp_picking_auditoria_area_guardar(text,uuid,text,uuid,date,text,jsonb,jsonb,text,text,text),public.sgp_picking_auditoria_areas_configuracion(text),public.sgp_picking_auditoria_areas_configurar(text,text,jsonb) to anon,authenticated;

create or replace function public.sgp_picking_auditoria_guardar(p_token text,p_id_entrega uuid,p_version text,p_solicitud uuid,p_fecha date,p_turno text,p_decisiones jsonb,p_diferencias jsonb default '[]',p_observacion text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;e public.sgp_picking_entregas;f public.sgp_picking_faltantes;p public.sgp_aluminio_pendientes;
 d jsonb;src jsonb;sources jsonb;ctx jsonb;old jsonb;req jsonb;action text;reason text;pid uuid;n integer;
 saved sgp_picking_audit.eventos;result jsonb;ev uuid;ids jsonb;
begin
 actor:=public.sgp_pdt_validar_rol_real(p_token,array['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA','LIDER','RECEPCION']);
 if p_solicitud is null or p_fecha is null or p_turno is null or p_turno not in ('TURNO 1','TURNO 2') then raise exception 'FECHA_TURNO_REQUERIDOS';end if;
 req:=jsonb_build_object('version',p_version,'fecha',p_fecha,'turno',p_turno,'decisiones',p_decisiones,'diferencias',p_diferencias,'observacion',p_observacion);
 select * into strict e from public.sgp_picking_entregas where id_entrega=p_id_entrega for update;
 select * into saved from sgp_picking_audit.eventos where id_entrega=p_id_entrega;
 if found then
  if saved.solicitud=p_solicitud and saved.payload=req and saved.usuario=actor then return saved.respuesta;end if;
  raise exception 'AUDITORIA_CONFLICTO';
 end if;
 if e.estado='PENDIENTE_VALIDACION' and (jsonb_array_length(sgp_picking_audit_areas.esquema(p_id_entrega)->'areas')>1 or exists(select 1 from sgp_picking_audit_areas.lotes where id_entrega=p_id_entrega)) then raise exception 'AUDITORIA_POR_AREAS_REQUERIDA';end if;
 if e.estado<>'PENDIENTE_VALIDACION' then raise exception 'La entrega ya fue auditada';end if;
 for f in select * from public.sgp_picking_faltantes where id_entrega=p_id_entrega order by id_faltante for update loop
  pid:=sgp_picking_audit.pendiente(f);perform 1 from public.sgp_aluminio_pendientes where id_pendiente=pid for update;
 end loop;
 if md5(sgp_picking_audit.snapshot(p_id_entrega)::text) is distinct from p_version then raise exception 'AUDITORIA_CONFLICTO_RECARGAR';end if;
 if jsonb_typeof(p_decisiones) is distinct from 'array' or jsonb_typeof(p_diferencias) is distinct from 'array' then raise exception 'DECISIONES_INVALIDAS';end if;
 if (select count(*) from public.sgp_picking_faltantes where id_entrega=p_id_entrega)<>jsonb_array_length(p_decisiones)
 or (select count(distinct x->>'id_faltante') from jsonb_array_elements(p_decisiones) x)<>jsonb_array_length(p_decisiones) then raise exception 'DECIDIR_CADA_FALTANTE_UNA_VEZ';end if;
 insert into sgp_picking_audit.contextos values(pg_current_xact_id()::text,actor);
 ctx:=jsonb_build_object('id_programacion',e.id_programacion,'produccion',e.produccion);
 sources:=sgp_pdt_multiorigen.fuentes(p_token,'PICKING',ctx);
 for d in select value from jsonb_array_elements(p_decisiones) loop
  select * into f from public.sgp_picking_faltantes where id_faltante=(d->>'id_faltante')::uuid and id_entrega=p_id_entrega;
  if not found then raise exception 'FALTANTE_AJENO_A_ENTREGA';end if;
  pid:=sgp_picking_audit.pendiente(f);select * into strict p from public.sgp_aluminio_pendientes where id_pendiente=pid;
  action:=d->>'accion';reason:=nullif(btrim(d->>'motivo'),'');old:=jsonb_build_object('faltante',to_jsonb(f),'pendiente',to_jsonb(p));
  if action is null or action not in ('ACEPTAR','MODIFICAR','ELIMINAR') then raise exception 'DECISION_REQUERIDA';end if;
  if action<>'ACEPTAR' then
   if reason is null then raise exception 'MOTIVO_REQUERIDO';end if;
   if p.estado<>'PENDIENTE' or coalesce(p.estado_repo,'PENDIENTE')<>'PENDIENTE' or p.validacion_estado<>'POR_VALIDAR'
   or nullif(btrim(p.nc),'') is not null or nullif(btrim(f.nc),'') is not null
   or exists(select 1 from public.sgp_aluminio_pendiente_ncs x where x.id_pendiente=pid)
   or exists(select 1 from public.sgp_aluminio_pendiente_detalles x where x.id_pendiente=pid)
   or exists(select 1 from public.sgp_aluminio_pendiente_movimientos x where x.id_pendiente=pid)
   then raise exception 'PDT_CON_DEPENDENCIAS_NO_CORREGIBLE';end if;
  end if;
  if action='MODIFICAR' then
   perform 1 from public.sgp_aluminio where id_pieza=d->>'id_pieza' for share;
   sources:=sgp_pdt_multiorigen.fuentes(p_token,'PICKING',ctx);
   select count(*),jsonb_agg(x)->0 into n,src from jsonb_array_elements(sources) x where x->>'id_pieza'=d->>'id_pieza' and x->>'reserva'=d->>'reserva' and x->>'acabado'=d->>'acabado';
   if n<>1 then raise exception 'PIEZA_NO_CORRESPONDE_A_ORDEN';end if;
   if (d->>'cantidad')::numeric is null or (d->>'cantidad')::numeric<=0 or (d->>'cantidad')::numeric<>trunc((d->>'cantidad')::numeric)
   or (d->>'cantidad')::numeric>(select cantidad from public.sgp_aluminio where id_pieza=d->>'id_pieza')
   or (d->>'ventanas_afectadas')::integer is null or (d->>'ventanas_afectadas')::integer<1
   or (d->>'ventanas_afectadas')::integer>coalesce((select cantidad from sgp_mecanizado_parcial.partes where id_programacion=e.id_programacion),(select cantidad from public.sgp_producciones where key_produccion=src->>'key_produccion')) then raise exception 'CANTIDAD_INVALIDA';end if;
   insert into sgp_picking_audit.correcciones values(pid,pg_current_xact_id()::text,p.cantidad,(d->>'cantidad')::numeric);
   update public.sgp_aluminio_pendientes set reserva=src->>'reserva',acabado_pendiente=src->>'acabado',key_produccion=src->>'key_produccion',reserva_principal=src->>'reserva_principal',
   id_pieza=src->>'id_pieza',perfil=src->>'codigo_sap',marca=src->>'marca',fabricacion=src->>'fabricacion',longitud=(src->>'longitud')::numeric,cantidad=(d->>'cantidad')::numeric,ventanas_afectadas=(d->>'ventanas_afectadas')::integer,observacion=nullif(d->>'observacion','') where id_pendiente=pid;
   delete from sgp_picking_audit.correcciones where id_pendiente=pid;
   update sgp_pdt_multiorigen.detalles set fuente=public.sgp_pdt_contexto_internal_v3(src->>'reserva',src->>'codigo_sap',e.produccion,src->>'acabado',src->>'id_pieza',src->>'key_produccion',src->>'reserva_principal',(src->>'longitud')::numeric) where id_pendiente=pid;
   update public.sgp_picking_faltantes set reserva_pendiente=src->>'reserva',acabado_pendiente=src->>'acabado',id_pieza=src->>'id_pieza',perfil=src->>'codigo_sap',marca=src->>'marca',fabricacion=src->>'fabricacion',longitud=(src->>'longitud')::numeric,
   cantidad=(d->>'cantidad')::numeric,ventanas_afectadas=(d->>'ventanas_afectadas')::integer,observacion=nullif(d->>'observacion','') where id_faltante=f.id_faltante;
  elsif action='ELIMINAR' then
   update public.sgp_aluminio_pendientes set estado='ANULADO',auditado=true where id_pendiente=pid;
  end if;
  if action<>'ELIMINAR' then update public.sgp_aluminio_pendientes set auditado=true where id_pendiente=pid;end if;
  update public.sgp_picking_faltantes set auditado=true,usuario_auditoria=actor,fecha_auditoria=clock_timestamp() where id_faltante=f.id_faltante;
  insert into sgp_picking_audit.decisiones(id_faltante,id_pendiente,id_entrega,accion,motivo,anterior,nuevo,usuario,fecha_recepcion,turno_recepcion)
  select f.id_faltante,pid,p_id_entrega,action,reason,old,jsonb_build_object('faltante',(select to_jsonb(z) from public.sgp_picking_faltantes z where z.id_faltante=f.id_faltante),'pendiente',to_jsonb(x)),actor,p_fecha,p_turno from public.sgp_aluminio_pendientes x where x.id_pendiente=pid;
  insert into public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,estado_anterior,estado_nuevo,tipo_evento,observacion,datos_anteriores,datos_nuevos)
  select pid,actor,p.estado,x.estado,'AUDITORIA_PICKING_'||action,reason,old,to_jsonb(x) from public.sgp_aluminio_pendientes x where x.id_pendiente=pid;
 end loop;
 -- Identity uniqueness after all decisions also catches two edits to the same piece.
 if exists(select 1 from public.sgp_aluminio_pendientes x
 join sgp_mecanizado_parcial.contextos_pdt c on c.id_pendiente=x.id_pendiente
 where c.id_entrega=p_id_entrega and x.estado='PENDIENTE'
 group by x.id_pieza,x.reserva,x.acabado_pendiente having count(distinct x.id_pendiente)>1)
 then raise exception 'PENDIENTE_DUPLICADO_EN_ENTREGA';end if;
 for d in select value from jsonb_array_elements(p_diferencias) loop
  if (d->>'ventanas_afectadas')::integer is null or (d->>'ventanas_afectadas')::integer<1
   or (d->>'ventanas_afectadas')::integer>coalesce((select cantidad from sgp_mecanizado_parcial.partes where id_programacion=e.id_programacion),(select cantidad from public.sgp_producciones where key_produccion=d->>'key_produccion')) then raise exception 'VENTANAS_INVALIDAS';end if;
  if exists(select 1 from public.sgp_aluminio_pendientes x join sgp_mecanizado_parcial.contextos_pdt c on c.id_pendiente=x.id_pendiente where c.id_entrega=p_id_entrega and x.id_pieza=d->>'id_pieza' and x.reserva=d->>'reserva' and x.estado='PENDIENTE') then raise exception 'PENDIENTE_DUPLICADO_EN_ENTREGA';end if;
 end loop;
 if jsonb_array_length(p_diferencias)>0 then
  ev:=gen_random_uuid();insert into sgp_pdt_multiorigen.eventos(id_evento,usuario,solicitud,respuesta) values(ev,actor,req,'{}');
  result:=sgp_pdt_multiorigen.registrar(p_token,'PICKING',ctx,p_diferencias,ev,p_id_entrega);ids:=result->'ids_pendientes';
  insert into public.sgp_picking_auditoria_diferencias(id_entrega,id_pieza,perfil,marca,fabricacion,longitud,cantidad,ventanas_afectadas,observacion,usuario_auditoria,reserva_pendiente,acabado_pendiente)
  select p_id_entrega,x->>'id_pieza',x->>'perfil',x->>'marca',x->>'fabricacion',(x->>'longitud')::numeric,(x->>'cantidad')::numeric,(x->>'ventanas_afectadas')::integer,x->>'observacion',actor,x->>'reserva',x->>'acabado' from jsonb_array_elements(p_diferencias) x;
  update public.sgp_aluminio_pendientes x set origen='PICKING_AUDITORIA',causa='DIFERENCIA_AUDITORIA',auditado=true,
 ventanas_afectadas=(select (dif.value->>'ventanas_afectadas')::integer from jsonb_array_elements(p_diferencias) dif where dif.value->>'id_pieza'=x.id_pieza and dif.value->>'reserva'=x.reserva)
 where id_pendiente in(select value::uuid from jsonb_array_elements_text(ids));
 end if;
 update public.sgp_picking_entregas set estado=case when jsonb_array_length(p_diferencias)>0 then 'AUDITADA_DIFERENCIA' else 'VALIDADA' end,usuario_validacion=actor,fecha_validacion=clock_timestamp(),observacion_validacion=p_observacion where id_entrega=p_id_entrega;
 result:=jsonb_build_object('ok',true,'id_entrega',p_id_entrega,'ids_nuevos',coalesce(ids,'[]'::jsonb));
 insert into sgp_picking_audit.eventos values(p_id_entrega,p_solicitud,req,result,actor,p_fecha,p_turno,clock_timestamp());
 delete from sgp_picking_audit.contextos where transaccion=pg_current_xact_id()::text;return result;
end $$;

commit;

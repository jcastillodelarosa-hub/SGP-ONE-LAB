-- REVIEW ONLY: no installation authorized. Requires deployed partial/PDT V4 contracts.
begin;
create schema sgp_picking_audit;
revoke all on schema sgp_picking_audit from public,anon,authenticated;
create table sgp_picking_audit.eventos(
 id_entrega uuid primary key references public.sgp_picking_entregas,
 solicitud uuid not null unique,payload jsonb not null,respuesta jsonb not null,
 usuario text not null,fecha_recepcion date not null,turno_recepcion text not null,
 ejecutado_en timestamptz not null default clock_timestamp());
create table sgp_picking_audit.decisiones(
 id_faltante uuid primary key references public.sgp_picking_faltantes,
 id_pendiente uuid not null references public.sgp_aluminio_pendientes,
 id_entrega uuid not null references public.sgp_picking_entregas,
 accion text not null check(accion in ('ACEPTAR','MODIFICAR','ELIMINAR')),
 motivo text,anterior jsonb not null,nuevo jsonb not null,usuario text not null,
 fecha_recepcion date not null,turno_recepcion text not null,
 ejecutado_en timestamptz not null default clock_timestamp());
alter table sgp_picking_audit.eventos enable row level security;
alter table sgp_picking_audit.decisiones enable row level security;
-- Capability exists only inside an authorized audit RPC transaction.
create table sgp_picking_audit.contextos(transaccion text primary key,usuario text not null);
alter table sgp_picking_audit.contextos enable row level security;
create table sgp_picking_audit.correcciones(
 id_pendiente uuid primary key,transaccion text not null,anterior numeric not null,nueva numeric not null);
alter table sgp_picking_audit.correcciones enable row level security;
create function sgp_picking_audit.pendiente(f public.sgp_picking_faltantes) returns uuid
language plpgsql security definer set search_path='' as $$
declare ids uuid[];saved uuid;
begin
 select id_pendiente into saved from sgp_picking_audit.decisiones where id_faltante=f.id_faltante;
 if found then return saved;end if;
 select array_agg(p.id_pendiente order by p.id_pendiente) into ids from public.sgp_aluminio_pendientes p
 where p.id_pieza is not distinct from f.id_pieza and p.reserva=coalesce(f.reserva_pendiente,p.reserva)
 and exists(select 1 from sgp_mecanizado_parcial.contextos_pdt c where c.id_pendiente=p.id_pendiente and c.id_entrega=f.id_entrega);
 if cardinality(ids) is distinct from 1 then raise exception 'AUDITORIA_ORIGEN_NO_UNIVOCO'; end if;
 return ids[1];
end $$;
create function sgp_picking_audit.snapshot(id uuid) returns jsonb language sql security definer set search_path='' as $$
select jsonb_build_object('entrega',to_jsonb(e),'faltantes',coalesce((select jsonb_agg(to_jsonb(f)||jsonb_build_object('pendiente',to_jsonb(p)) order by f.id_faltante)
from public.sgp_picking_faltantes f join public.sgp_aluminio_pendientes p on p.id_pendiente=sgp_picking_audit.pendiente(f) where f.id_entrega=e.id_entrega),'[]'::jsonb))
from public.sgp_picking_entregas e where e.id_entrega=id;
$$;
create function public.sgp_picking_auditoria_contexto(p_token text,p_id_entrega uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s jsonb;actor text;fuentes jsonb;ent public.sgp_picking_entregas;
begin
 actor:=public.sgp_pdt_validar_rol_real(p_token,array['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA','LIDER','RECEPCION']);
 s:=sgp_picking_audit.snapshot(p_id_entrega);
 if s is null then raise exception 'Entrega no encontrada'; end if;
 select * into strict ent from public.sgp_picking_entregas where id_entrega=p_id_entrega;
 insert into sgp_picking_audit.contextos values(pg_current_xact_id()::text,actor);
 fuentes:=sgp_pdt_multiorigen.fuentes(p_token,'PICKING',jsonb_build_object('id_programacion',ent.id_programacion,'produccion',ent.produccion));
 delete from sgp_picking_audit.contextos where transaccion=pg_current_xact_id()::text;
 return s||jsonb_build_object('version',md5(s::text),'fuentes',fuentes);
end $$;
create function public.sgp_picking_auditoria_guardar(p_token text,p_id_entrega uuid,p_version text,p_solicitud uuid,p_fecha date,p_turno text,p_decisiones jsonb,p_diferencias jsonb default '[]',p_observacion text default null)
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
revoke all on all functions in schema sgp_picking_audit from public,anon,authenticated;
revoke all on function public.sgp_picking_auditoria_contexto(text,uuid) from public;
revoke all on function public.sgp_picking_auditoria_guardar(text,uuid,text,uuid,date,text,jsonb,jsonb,text) from public;
grant execute on function public.sgp_picking_auditoria_contexto(text,uuid),public.sgp_picking_auditoria_guardar(text,uuid,text,uuid,date,text,jsonb,jsonb,text) to anon,authenticated;
commit;

-- REVIEW ONLY: requires separate production authorization.
begin;
set local lock_timeout='5s';

do $guard$ begin if md5(pg_get_functiondef('sgp_mecanizado_prevenir_detalle_duplicado()'::regprocedure))<>'c7e4cdfd7e56868df45a5505f8b0fac2' then raise exception 'CATALOGO_CAMBIO: sgp_mecanizado_prevenir_detalle_duplicado()'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_mecanizado_ordenes_programacion(text,uuid)'::regprocedure))<>'edf9ed9cc5ac9ed1209f95a3b8b27e7b' then raise exception 'CATALOGO_CAMBIO: sgp_mecanizado_ordenes_programacion(text,uuid)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_mecanizado_cobertura_programacion(text,integer)'::regprocedure))<>'3dde4a98438bd014aa865430cfa512a0' then raise exception 'CATALOGO_CAMBIO: sgp_mecanizado_cobertura_programacion(text,integer)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_mecanizado_programacion_listar(text)'::regprocedure))<>'be701eb10edcdebe3c994f145bd9dfb2' then raise exception 'CATALOGO_CAMBIO: sgp_mecanizado_programacion_listar(text)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_mecanizado_pendientes_turno(text,date,text)'::regprocedure))<>'8a2d1514e00ff5e7f120617203aa5d68' then raise exception 'CATALOGO_CAMBIO: sgp_mecanizado_pendientes_turno(text,date,text)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_mecanizado_reprogramar_orden(text,uuid,text,date,text,integer,text)'::regprocedure))<>'d76a3feb1a4d61b57509fb90b9f77b6a' then raise exception 'CATALOGO_CAMBIO: sgp_mecanizado_reprogramar_orden(text,uuid,text,date,text,integer,text)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_mecanizado_guardar_estado_orden(text,uuid,text,text,text)'::regprocedure))<>'3c07b3149a3dddf1fe0f310a8d1da157' then raise exception 'CATALOGO_CAMBIO: sgp_mecanizado_guardar_estado_orden(text,uuid,text,text,text)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_picking_cola(text)'::regprocedure))<>'e3654ef341fc2732c2c14307179f245a' then raise exception 'CATALOGO_CAMBIO: sgp_picking_cola(text)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_mecanizado_cobertura_ordenes(text,integer)'::regprocedure))<>'7652d78f0b89527aa5787c5b63bcfbfd' then raise exception 'CATALOGO_CAMBIO: sgp_mecanizado_cobertura_ordenes(text,integer)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer)'::regprocedure))<>'e4805e8c77e01cf4d8d21b84710609c3' then raise exception 'CATALOGO_CAMBIO: sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_pdt_registrar_v4(text,text,jsonb,jsonb,uuid)'::regprocedure))<>'152180afe0b914cda3f594f0c74cbd1d' then raise exception 'CATALOGO_CAMBIO: sgp_pdt_registrar_v4(text,text,jsonb,jsonb,uuid)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_picking_rechazar_entrega_completa_duplicada()'::regprocedure))<>'c5e07e6cdbba51037c6d1dc0a5cac1b1' then raise exception 'CATALOGO_CAMBIO: sgp_picking_rechazar_entrega_completa_duplicada()'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_picking_recepcion_cola(text)'::regprocedure))<>'395480b2e636057719dfbb13ac2ea190' then raise exception 'CATALOGO_CAMBIO: sgp_picking_recepcion_cola(text)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_consultar_ensamble(text,integer,text)'::regprocedure))<>'5185549ea9c433bfe5f444034afc8e52' then raise exception 'CATALOGO_CAMBIO: sgp_consultar_ensamble(text,integer,text)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_picking_piezas_panel(text,uuid,text)'::regprocedure))<>'354d8705f6eddfb7902544b30e6a12dd' then raise exception 'CATALOGO_CAMBIO: sgp_picking_piezas_panel(text,uuid,text)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_pdt_multiorigen.fuentes(text,text,jsonb)'::regprocedure))<>'1d2661833973f1726a0219a55bdc4853' then raise exception 'CATALOGO_CAMBIO: sgp_pdt_multiorigen.fuentes(text,text,jsonb)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_pdt_multiorigen.nuevo_sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'::regprocedure))<>'29083f8c5b4db059f985531a20df394b' then raise exception 'CATALOGO_CAMBIO: sgp_pdt_multiorigen.nuevo_sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_pdt_multiorigen.grouped_nuevo_entrega(text,uuid,uuid,integer,uuid)'::regprocedure))<>'ddf725ca1b26ff5fead403b87ba41f29' then raise exception 'CATALOGO_CAMBIO: sgp_pdt_multiorigen.grouped_nuevo_entrega(text,uuid,uuid,integer,uuid)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_pdt_multiorigen.nuevo_sgp_pdt_cierre_acreditado(uuid)'::regprocedure))<>'fc13cb02bd2f3d9552eb01c61c6e0735' then raise exception 'CATALOGO_CAMBIO: sgp_pdt_multiorigen.nuevo_sgp_pdt_cierre_acreditado(uuid)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_pdt_multiorigen.grouped_nuevo_cierre_acreditado(uuid)'::regprocedure))<>'7e39661c15b7d2cd783bf2d3fe32e83c' then raise exception 'CATALOGO_CAMBIO: sgp_pdt_multiorigen.grouped_nuevo_cierre_acreditado(uuid)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_pdt_multiorigen.nuevo_sgp_pdt_picking_v2(text,uuid)'::regprocedure))<>'e12fb4920a844ba86edb2bebec4558e7' then raise exception 'CATALOGO_CAMBIO: sgp_pdt_multiorigen.nuevo_sgp_pdt_picking_v2(text,uuid)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_pdt_multiorigen.original_sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'::regprocedure))<>'bd77ebb40dac7a94091b0b740fc6eb7e' then raise exception 'CATALOGO_CAMBIO: sgp_pdt_multiorigen.original_sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_pdt_multiorigen.grouped_original_entrega(text,uuid,uuid,integer,uuid)'::regprocedure))<>'904d9fd8b666cd27f8db7a8b163822e8' then raise exception 'CATALOGO_CAMBIO: sgp_pdt_multiorigen.grouped_original_entrega(text,uuid,uuid,integer,uuid)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_pdt_multiorigen.original_sgp_pdt_cierre_acreditado(uuid)'::regprocedure))<>'92c4a0388a41614cfb53a52d126f6648' then raise exception 'CATALOGO_CAMBIO: sgp_pdt_multiorigen.original_sgp_pdt_cierre_acreditado(uuid)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_pdt_multiorigen.grouped_original_cierre_acreditado(uuid)'::regprocedure))<>'eb9f9b2304a5a76a7b0b0d25e6cfaff7' then raise exception 'CATALOGO_CAMBIO: sgp_pdt_multiorigen.grouped_original_cierre_acreditado(uuid)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_pdt_multiorigen.original_sgp_pdt_picking_v2(text,uuid)'::regprocedure))<>'961e56199d5261710bc1660501f3fdfb' then raise exception 'CATALOGO_CAMBIO: sgp_pdt_multiorigen.original_sgp_pdt_picking_v2(text,uuid)'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('sgp_picking_validar_recepcion(text,uuid,jsonb,jsonb,text)'::regprocedure))<>'ff5790e874d81b713d82f4b91cb3be08' then raise exception 'CATALOGO_CAMBIO: sgp_picking_validar_recepcion(text,uuid,jsonb,jsonb,text)'; end if; end $guard$;

-- REVIEW ONLY. Aggregate window parts, never aluminium-piece allocation.
create schema sgp_mecanizado_parcial;
revoke all on schema sgp_mecanizado_parcial from public,anon,authenticated;
create table sgp_mecanizado_parcial.partes (
 id_programacion uuid primary key references public.sgp_mecanizado_programacion(id_programacion),
 key_produccion text not null references public.sgp_producciones(key_produccion),
 numero integer not null check(numero>0),
 cantidad integer not null check(cantidad>0),
 creado_por text not null, creado_en timestamptz not null default now(),
 unique(key_produccion,numero)
);
create table sgp_mecanizado_parcial.solicitudes (
 clave uuid primary key, usuario text not null, payload jsonb not null, resultado jsonb not null
);
create table sgp_mecanizado_parcial.movimientos (
 id bigint generated always as identity primary key,
 id_programacion uuid not null references sgp_mecanizado_parcial.partes,
 tipo text not null, anterior jsonb, nuevo jsonb, usuario text not null,
 fecha timestamptz not null default now()
);
create index on sgp_mecanizado_parcial.movimientos(id_programacion,fecha);
create table sgp_mecanizado_parcial.entregas (
 id_entrega uuid primary key references public.sgp_picking_entregas,
 id_programacion uuid not null references sgp_mecanizado_parcial.partes,
 cantidad integer not null check(cantidad>=0)
);
create index on sgp_mecanizado_parcial.entregas(id_programacion);
create table sgp_mecanizado_parcial.origenes_pdt (
 id_pendiente uuid primary key references public.sgp_aluminio_pendientes,
 id_entrega uuid not null references public.sgp_picking_entregas
);
alter table sgp_mecanizado_parcial.origenes_pdt enable row level security;
alter table sgp_mecanizado_parcial.partes enable row level security;
alter table sgp_mecanizado_parcial.solicitudes enable row level security;
alter table sgp_mecanizado_parcial.movimientos enable row level security;
alter table sgp_mecanizado_parcial.entregas enable row level security;
revoke all on all tables in schema sgp_mecanizado_parcial from public,anon,authenticated;
revoke all on all sequences in schema sgp_mecanizado_parcial from public,anon,authenticated;

-- Used only by session-validating RPCs. Includes all reservations for the same key.
create function sgp_mecanizado_parcial.asignada(p_key text) returns integer
language sql stable set search_path='' as $$
 select coalesce(sum(case when pt.id_programacion is not null then pt.cantidad else d.cantidad_snapshot end),0)::integer
 from public.sgp_mecanizado_programacion_detalle d
 join public.sgp_mecanizado_programacion mp using(id_programacion)
 left join sgp_mecanizado_parcial.partes pt using(id_programacion)
 where d.key_produccion=p_key and mp.estado<>'CANCELADA'
 and not exists(select 1 from public.sgp_mecanizado_reprogramaciones r
                where r.id_origen=d.id_programacion and r.produccion=d.produccion_snapshot)
$$;

create function public.sgp_mecanizado_partes_consultar(p_token text,p_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare sp public.sgp_producciones%rowtype; capacidad numeric; asignada integer;
begin
 perform public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','CONSULTA','PICKING','PATINADOR','SUPERVISOR DE PICKING']);
 select * into strict sp from public.sgp_producciones where key_produccion=p_key;
 select coalesce((select capacidad_turno from public.sgp_capacidad_sistema
   where linea=replace(sp.id_linea,'_',' ') and proceso='MECANIZADO' and sistema=sp.sistema and activo),
   (select capacidad_turno from public.sgp_capacidad_linea
    where linea=replace(sp.id_linea,'_',' ') and proceso='MECANIZADO' and activo)) into capacidad;
 asignada:=sgp_mecanizado_parcial.asignada(p_key);
 return jsonb_build_object('key_produccion',p_key,'produccion',sp.produccion,'original',sp.cantidad,
 'programada',asignada,'disponible',greatest(sp.cantidad-asignada,0),
 'capacidad',case when capacidad>0 then floor(capacidad) else null end,
 'partes',coalesce((select jsonb_agg(to_jsonb(x) order by x.numero) from (
 select pt.*,sp.produccion||'-P'||pt.numero identificador,mp.fecha_programacion,mp.turno,mp.prioridad,
 mp.observacion,mp.fecha_actualizacion,coalesce(eo.usuario,mp.usuario_programa) usuario,
 case when mp.estado='CANCELADA' then 'CANCELADA' else coalesce(eo.estado,me.estado,'SIN INICIAR') end estado,
 case when mp.estado<>'CANCELADA' and coalesce(eo.estado,me.estado)='PROCESADO' then pt.cantidad else 0 end procesada,
 coalesce((select sum(en.cantidad) from sgp_mecanizado_parcial.entregas en
 join public.sgp_picking_entregas pe using(id_entrega) where en.id_programacion=pt.id_programacion
 and pe.estado in ('PENDIENTE_VALIDACION','VALIDADA','AUDITADA_DIFERENCIA')),0) entregada
 from sgp_mecanizado_parcial.partes pt join public.sgp_mecanizado_programacion mp using(id_programacion)
 left join public.sgp_mecanizado_ejecucion_orden eo on eo.id_programacion=pt.id_programacion and eo.produccion=sp.produccion
 left join public.sgp_mecanizado_ejecucion me on me.id_programacion=pt.id_programacion
 where pt.key_produccion=p_key) x),'[]'::jsonb));
end $$;

create function public.sgp_mecanizado_partes_programar(p_token text,p_key text,p_reserva text,p_partes jsonb,p_clave uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u text; sp public.sgp_producciones%rowtype; item jsonb; total numeric; qty integer;
 rid uuid; num integer; prioridad_semanal text; payload jsonb; prior sgp_mecanizado_parcial.solicitudes%rowtype;
 ids jsonb:='[]'; result jsonb;
begin
 u:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR']);
 if p_clave is null or p_key is null or p_reserva is null or jsonb_typeof(p_partes) is distinct from 'array'
 or jsonb_array_length(p_partes) not between 1 and 100 then raise exception 'PROPUESTA_INVALIDA'; end if;
 payload:=jsonb_build_array(p_key,p_reserva,p_partes);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_clave::text,741));
 select * into prior from sgp_mecanizado_parcial.solicitudes where clave=p_clave;
 if found then
  if prior.usuario<>u or prior.payload<>payload then raise exception 'CLAVE_REUTILIZADA_CON_OTROS_DATOS'; end if;
  return prior.resultado;
 end if;
 -- One lock domain for all parts, legacy detail guards and Export quantity changes.
 select * into strict sp from public.sgp_producciones where key_produccion=p_key for no key update;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key,742));
 if sp.id_linea<>'PANELES_2' or sp.activa<>'SI' or sp.cantidad is null or sp.cantidad<>trunc(sp.cantidad) then raise exception 'PRODUCCION_NO_PROGRAMABLE'; end if;
 select pr.prioridad into strict prioridad_semanal from public.sgp_prioridades pr
 where pr.key_produccion=p_key and pr.reserva=p_reserva and pr.id_linea=sp.id_linea
 and pr.anio=sp.anio and pr.semana=coalesce(sp.semana_actual,sp.semana_base);
 -- An unresolved historical header cannot be assigned to individual orders by subtraction.
 if exists(select 1 from public.sgp_mecanizado_programacion mp where mp.reserva=p_reserva
 and mp.estado<>'CANCELADA' and (mp.produccion is null or mp.produccion=sp.produccion)
 and not exists(select 1 from public.sgp_mecanizado_programacion_detalle d where d.id_programacion=mp.id_programacion)) then
  raise exception 'RECONCILIAR_PROGRAMACION_HISTORICA';
 end if;
 total:=0;
 for item in select value from jsonb_array_elements(p_partes) loop
  if jsonb_typeof(item->'cantidad') is distinct from 'number' or (item->>'cantidad')::numeric<=0
    or (item->>'cantidad')::numeric<>trunc((item->>'cantidad')::numeric)
    or nullif(item->>'fecha','') is null or item->>'turno' is null
    or item->>'turno' not in ('TURNO 1','TURNO 2')
    or jsonb_typeof(item->'prioridad') is distinct from 'number' or (item->>'prioridad')::numeric<1
    or (item->>'prioridad')::numeric<>trunc((item->>'prioridad')::numeric) then raise exception 'PARTE_INVALIDA'; end if;
  perform (item->>'fecha')::date;
  total:=total+(item->>'cantidad')::numeric;
 end loop;
 if total>sp.cantidad-sgp_mecanizado_parcial.asignada(p_key) then raise exception 'CANTIDAD_SUPERA_SALDO'; end if;
 select coalesce(max(numero),0) into num from sgp_mecanizado_parcial.partes where key_produccion=p_key;
 for item in select value from jsonb_array_elements(p_partes) loop
  qty:=(item->>'cantidad')::integer; num:=num+1;
  insert into public.sgp_mecanizado_programacion(reserva,produccion,cantidad_programada,fecha_programacion,turno,prioridad,
   prioridad_semanal,observacion,observacion_orden,sistema,acabado,usuario_programa)
  values(p_reserva,sp.produccion,qty,(item->>'fecha')::date,item->>'turno',(item->>'prioridad')::integer,
   prioridad_semanal,item->>'observacion',item->>'observacion_orden',sp.sistema,sp.acabado,u) returning id_programacion into rid;
  insert into sgp_mecanizado_parcial.partes values(rid,p_key,num,qty,u,now());
  insert into public.sgp_mecanizado_programacion_detalle(id_programacion,key_produccion,cantidad_snapshot,reserva_snapshot,
   prioridad_semanal_snapshot,produccion_snapshot,origen)
  values(rid,p_key,qty,p_reserva,prioridad_semanal,sp.produccion,'PARCIAL_AGREGADA');
  insert into sgp_mecanizado_parcial.movimientos(id_programacion,tipo,nuevo,usuario) values(rid,'CREACION',item,u);
  ids:=ids||jsonb_build_array(jsonb_build_object('id_programacion',rid,'identificador',sp.produccion||'-P'||num,'cantidad',qty));
 end loop;
 result:=jsonb_build_object('ok',true,'partes',ids,'disponible',sp.cantidad-sgp_mecanizado_parcial.asignada(p_key));
 insert into sgp_mecanizado_parcial.solicitudes values(p_clave,u,payload,result);
 return result;
end $$;

create function public.sgp_mecanizado_parte_mover(p_token text,p_id uuid,p_fecha date,p_turno text,p_prioridad integer,p_motivo text,p_cancelar boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare u text; pt sgp_mecanizado_parcial.partes%rowtype; mp public.sgp_mecanizado_programacion%rowtype;
begin
 u:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR']);
 select * into strict pt from sgp_mecanizado_parcial.partes where id_programacion=p_id;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pt.key_produccion,742));
 select * into strict mp from public.sgp_mecanizado_programacion where id_programacion=p_id for update;
 if mp.estado='CANCELADA' then raise exception 'PARTE_CANCELADA'; end if;
 if p_cancelar is null or length(trim(coalesce(p_motivo,'')))<5 then raise exception 'MOTIVO_REQUERIDO'; end if;
 if exists(select 1 from public.sgp_mecanizado_ejecucion_orden where id_programacion=p_id and estado<>'SIN INICIAR')
 or exists(select 1 from public.sgp_mecanizado_ejecucion where id_programacion=p_id and (estado<>'SIN INICIAR' or cantidad_procesada>0))
 or exists(select 1 from public.sgp_picking_entregas where id_programacion=p_id) then
  raise exception 'PARTE_CON_AVANCE_NO_SE_PUEDE_MOVER_O_CANCELAR'; end if;
 if not p_cancelar and (p_fecha is null or p_turno is null or p_turno not in ('TURNO 1','TURNO 2') or p_prioridad is null or p_prioridad<1) then raise exception 'DESTINO_INVALIDO'; end if;
 update public.sgp_mecanizado_programacion set fecha_programacion=case when p_cancelar then fecha_programacion else p_fecha end,
 turno=case when p_cancelar then turno else p_turno end, prioridad=case when p_cancelar then prioridad else p_prioridad end,
 estado=case when p_cancelar then 'CANCELADA' else estado end,fecha_actualizacion=now(),usuario_programa=u where id_programacion=p_id;
 insert into sgp_mecanizado_parcial.movimientos(id_programacion,tipo,anterior,nuevo,usuario)
 select p_id,case when p_cancelar then 'CANCELACION' else 'REPROGRAMACION' end,to_jsonb(mp),
 jsonb_build_object('fecha',p_fecha,'turno',p_turno,'prioridad',p_prioridad,'motivo',p_motivo),u;
 return p_id;
end $$;

-- Minimal identity predicate for invoker triggers; reveals only membership, never quantities.
create function public.sgp_mecanizado_es_parte(p_id uuid) returns boolean
language sql security definer stable set search_path='' as $$
 select exists(select 1 from sgp_mecanizado_parcial.partes where id_programacion=p_id)
$$;
revoke all on function public.sgp_mecanizado_es_parte(uuid) from public;
grant execute on function public.sgp_mecanizado_es_parte(uuid) to anon,authenticated;
-- INVOKER: direct browser table writes to a partial header/state are refused.
create function sgp_mecanizado_parcial.proteger() returns trigger language plpgsql set search_path='' as $$
declare pt sgp_mecanizado_parcial.partes%rowtype;
begin
 if not public.sgp_mecanizado_es_parte(coalesce(new.id_programacion,old.id_programacion)) then return coalesce(new,old); end if;
 if current_user<>'postgres' then raise exception 'USAR_RPC_DE_PARTES'; end if;
 select * into pt from sgp_mecanizado_parcial.partes where id_programacion=coalesce(new.id_programacion,old.id_programacion);
 if not found then return coalesce(new,old); end if;
 if tg_table_name='sgp_mecanizado_programacion' then
  if tg_op='DELETE' then raise exception 'IDENTIDAD_DE_PARTE_INMUTABLE'; end if;
  if (new.reserva,new.produccion,new.cantidad_programada,new.prioridad_semanal,new.sistema,new.acabado) is distinct from
     (old.reserva,old.produccion,old.cantidad_programada,old.prioridad_semanal,old.sistema,old.acabado) or
     (old.estado='CANCELADA' and new.estado<>'CANCELADA') then raise exception 'IDENTIDAD_DE_PARTE_INMUTABLE'; end if;
 else
  if tg_op='DELETE' then raise exception 'HISTORIAL_DE_PARTE_INMUTABLE'; end if;
  if new.produccion is distinct from (select produccion from public.sgp_producciones where key_produccion=pt.key_produccion) then raise exception 'PRODUCCION_AJENA_A_PARTE'; end if;
 end if;
 return coalesce(new,old);
end $$;
create trigger parcial_proteger_header before update or delete on public.sgp_mecanizado_programacion
for each row execute function sgp_mecanizado_parcial.proteger();
create trigger parcial_proteger_estado before insert or update or delete on public.sgp_mecanizado_ejecucion_orden
for each row execute function sgp_mecanizado_parcial.proteger();

create function sgp_mecanizado_parcial.proteger_total() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.produccion,new.id_linea,new.key_produccion) is distinct from (old.produccion,old.id_linea,old.key_produccion) and exists(select 1 from sgp_mecanizado_parcial.partes where key_produccion=old.key_produccion) then raise exception 'IDENTIDAD_DE_PRODUCCION_CON_PARTES_INMUTABLE'; end if;
 if new.cantidad is distinct from old.cantidad and exists(select 1 from sgp_mecanizado_parcial.partes where key_produccion=old.key_produccion) then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(old.key_produccion,742));
  if new.cantidad is null or new.cantidad<sgp_mecanizado_parcial.asignada(old.key_produccion) then raise exception 'TOTAL_INFERIOR_A_ASIGNADO'; end if;
 end if; return new;
end $$;
create trigger parcial_proteger_total before update of cantidad,produccion,id_linea,key_produccion on public.sgp_producciones
for each row execute function sgp_mecanizado_parcial.proteger_total();

create function public.sgp_mecanizado_parte_historial(p_token text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','CONSULTA','PICKING','SUPERVISOR DE PICKING']);
 return coalesce((select jsonb_agg(to_jsonb(m) order by m.fecha,m.id) from sgp_mecanizado_parcial.movimientos m where id_programacion=p_id),'[]');
end $$;

-- No direct privileges; each public RPC validates SGP session and functional role.
revoke all on all functions in schema sgp_mecanizado_parcial from public,anon,authenticated;
revoke all on function public.sgp_mecanizado_partes_consultar(text,text),public.sgp_mecanizado_partes_programar(text,text,text,jsonb,uuid),
 public.sgp_mecanizado_parte_mover(text,uuid,date,text,integer,text,boolean),public.sgp_mecanizado_parte_historial(text,uuid) from public;
grant execute on function public.sgp_mecanizado_partes_consultar(text,text),public.sgp_mecanizado_partes_programar(text,text,text,jsonb,uuid),
 public.sgp_mecanizado_parte_mover(text,uuid,date,text,integer,text,boolean),public.sgp_mecanizado_parte_historial(text,uuid) to anon,authenticated;

-- Both actual V4 registration and the legacy audit-difference writer retain their real paths.
create view sgp_mecanizado_parcial.contextos_pdt with (security_invoker=true) as
 select id_pendiente,id_entrega from sgp_pdt_multiorigen.detalles
 union all select id_pendiente,id_entrega from sgp_mecanizado_parcial.origenes_pdt;
revoke all on sgp_mecanizado_parcial.contextos_pdt from public,anon,authenticated;
-- Private predicate: preserve the historical finish rule, bind new part evidence to its key and origin.
create function sgp_mecanizado_parcial.material_pdt(p_pendiente uuid,p_entrega uuid,p_acabado text)
returns boolean language sql stable set search_path='' as $$
 select case when pt.id_programacion is null then upper(btrim(mp.acabado))=upper(btrim(p_acabado))
 else pt.key_produccion=p.key_produccion and mp.estado<>'CANCELADA'
  and exists(select 1 from public.sgp_produccion_reservas_v r
   where r.key_produccion=p.key_produccion and r.reserva=p.reserva and r.reserva_principal=mp.reserva
    and (r.acabado_reserva is null or upper(btrim(r.acabado_reserva))=upper(btrim(p_acabado))))
  and not exists(select 1 from sgp_mecanizado_parcial.contextos_pdt src
   join public.sgp_picking_entregas original on original.id_entrega=src.id_entrega
   join sgp_mecanizado_parcial.partes origen on origen.id_programacion=original.id_programacion
   where src.id_pendiente=p.id_pendiente
   and (original.id_entrega=p_entrega or origen.id_programacion<>pt.id_programacion))
 end
 from public.sgp_picking_entregas pe
 join public.sgp_mecanizado_programacion mp using(id_programacion)
 left join sgp_mecanizado_parcial.partes pt using(id_programacion)
 join public.sgp_aluminio_pendientes p on p.id_pendiente=p_pendiente
 where pe.id_entrega=p_entrega
$$;

create table sgp_mecanizado_parcial.respaldo_funciones(firma text primary key,definicion text not null,instalada text); alter table sgp_mecanizado_parcial.respaldo_funciones enable row level security; revoke all on sgp_mecanizado_parcial.respaldo_funciones from public,anon,authenticated;

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_mecanizado_prevenir_detalle_duplicado()',pg_get_functiondef('sgp_mecanizado_prevenir_detalle_duplicado()'::regprocedure),null);

CREATE OR REPLACE FUNCTION public.sgp_mecanizado_prevenir_detalle_duplicado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_reserva text;
begin

 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.key_produccion,742));
 if exists(select 1 from sgp_mecanizado_parcial.partes pt where pt.id_programacion=new.id_programacion) then
  if not exists(select 1 from sgp_mecanizado_parcial.partes pt
    join public.sgp_mecanizado_programacion mp using(id_programacion)
    join public.sgp_producciones sp on sp.key_produccion=pt.key_produccion
    where pt.id_programacion=new.id_programacion and pt.key_produccion=new.key_produccion
      and pt.cantidad=new.cantidad_snapshot and mp.cantidad_programada=pt.cantidad
      and new.reserva_snapshot=mp.reserva and new.produccion_snapshot=sp.produccion) then
   raise exception 'DETALLE_DE_PARTE_INCONSISTENTE'; end if;
  if new.cantidad_snapshot+sgp_mecanizado_parcial.asignada(new.key_produccion)>
   (select cantidad from public.sgp_producciones where key_produccion=new.key_produccion) then
   raise exception 'CANTIDAD_SUPERA_SALDO'; end if;
  return new;
 end if;
 if exists(select 1 from sgp_mecanizado_parcial.partes where key_produccion=new.key_produccion) then
  raise exception 'USAR_PROGRAMACION_POR_PARTES';
 end if;

 select p.reserva into v_reserva from public.sgp_mecanizado_programacion p where p.id_programacion=new.id_programacion;
 if v_reserva is null then raise exception 'Programación inexistente'; end if;
 if new.reserva_snapshot is distinct from v_reserva then raise exception 'Reserva de detalle no coincide con programación'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_reserva||'|'||new.key_produccion,0));
 if exists (
  select 1 from public.sgp_mecanizado_programacion_detalle d
  join public.sgp_mecanizado_programacion p on p.id_programacion=d.id_programacion
  where p.reserva=v_reserva and d.key_produccion=new.key_produccion
    and p.estado<>'CANCELADA'
 ) then
  raise exception 'La orden % ya está vinculada a una programación activa de la reserva %',new.key_produccion,v_reserva;
 end if;
 return new;
end $function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_mecanizado_prevenir_detalle_duplicado()'::regprocedure)) where firma='sgp_mecanizado_prevenir_detalle_duplicado()';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_mecanizado_ordenes_programacion(text,uuid)',pg_get_functiondef('sgp_mecanizado_ordenes_programacion(text,uuid)'::regprocedure),null);

CREATE OR REPLACE FUNCTION public.sgp_mecanizado_ordenes_programacion(p_token text, p_id_programacion uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_usuario text; v_mp public.sgp_mecanizado_programacion%rowtype; v_json jsonb; v_has_detail boolean;
begin
 v_usuario:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','CONSULTA']);
 select * into v_mp from public.sgp_mecanizado_programacion where id_programacion=p_id_programacion;
 if not found then return '[]'::jsonb; end if;
 select exists(select 1 from public.sgp_mecanizado_programacion_detalle d where d.id_programacion=p_id_programacion) into v_has_detail;
 if v_has_detail then
   return coalesce((
     select jsonb_agg(jsonb_build_object(
       'key_produccion',sp.key_produccion,'produccion',sp.produccion,'cantidad',coalesce((select cantidad from sgp_mecanizado_parcial.partes where id_programacion=d.id_programacion),sp.cantidad),
       'proyecto',sp.proyecto,'cliente',sp.cliente,'tipo',sp.tipo,'sistema',sp.sistema,'acabado',sp.acabado,
       'semana',coalesce(sp.semana_actual,sp.semana_base),
       'vidrio_preparado',coalesce(g.vidrio_preparado,0)::integer,
       'vidrio_novedad',coalesce(g.vidrio_novedad,0)::integer,
       'vidrio_traslado',coalesce(g.vidrio_traslado,0)::integer,
       'reserva_compartida',public.sgp_es_reserva_compartida(sp.key_produccion),
       'reservas_compartidas',public.sgp_reservas_por_produccion_json(sp.key_produccion)
     ) order by sp.produccion)
     from public.sgp_mecanizado_programacion_detalle d
     join public.sgp_producciones sp on sp.key_produccion=d.key_produccion
     left join public.sgp_vidrio_resumen_produccion g on g.key_produccion=sp.key_produccion
     where d.id_programacion=p_id_programacion
       and not exists(select 1 from public.sgp_mecanizado_reprogramaciones r where r.id_origen=p_id_programacion and r.produccion=sp.produccion)
   ),'[]'::jsonb);
 end if;
 select public.sgp_mecanizado_detalle_reserva(p_token,v_mp.reserva,v_mp.prioridad_semanal) into v_json;
 return coalesce((
   select jsonb_agg(o.value order by o.value->>'produccion')
   from jsonb_array_elements(coalesce(v_json,'[]'::jsonb)) o
   where (v_mp.produccion is null or o.value->>'produccion'=v_mp.produccion)
     and not exists(select 1 from public.sgp_mecanizado_reprogramaciones r where r.id_origen=p_id_programacion and r.produccion=o.value->>'produccion')
 ),'[]'::jsonb);
end $function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_mecanizado_ordenes_programacion(text,uuid)'::regprocedure)) where firma='sgp_mecanizado_ordenes_programacion(text,uuid)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_mecanizado_cobertura_programacion(text,integer)',pg_get_functiondef('sgp_mecanizado_cobertura_programacion(text,integer)'::regprocedure),null);

CREATE OR REPLACE FUNCTION public.sgp_mecanizado_cobertura_programacion(p_token text, p_semana integer DEFAULT NULL::integer)
 RETURNS TABLE(reserva text, prioridad_semanal text, cantidad_canonica integer, cantidad_cubierta integer, cantidad_pendiente integer, estado_cobertura text, programaciones integer, detalle_persistido boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','CONSULTA']);
 return query
 with actual as (
   select pr.reserva,pr.prioridad,
          sum(sp.cantidad)::int cantidad_canonica
   from public.sgp_prioridades pr
   join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion
   where pr.id_linea='PANELES_2' and sp.id_linea='PANELES_2'
     and (p_semana is null or coalesce(sp.semana_actual,sp.semana_base)=p_semana)
   group by pr.reserva,pr.prioridad
 ), sched as (
   select mp.reserva,mp.prioridad_semanal,
          count(*)::int programaciones,
          coalesce(sum(mp.cantidad_programada),0)::int snapshot_programado,
          bool_or(exists(select 1 from public.sgp_mecanizado_programacion_detalle d where d.id_programacion=mp.id_programacion)) tiene_detalle
   from public.sgp_mecanizado_programacion mp
   where mp.estado<>'CANCELADA'
   group by mp.reserva,mp.prioridad_semanal
 ), covered as (
   select mp.reserva,mp.prioridad_semanal,
          coalesce(sum(coalesce((select cantidad from sgp_mecanizado_parcial.partes where id_programacion=mp.id_programacion),sp.cantidad)),0)::int cantidad_cubierta
   from public.sgp_mecanizado_programacion mp
   join public.sgp_mecanizado_programacion_detalle d on d.id_programacion=mp.id_programacion
   join public.sgp_producciones sp on sp.key_produccion=d.key_produccion
   where mp.estado<>'CANCELADA'
   group by mp.reserva,mp.prioridad_semanal
 )
 select a.reserva,a.prioridad,a.cantidad_canonica,
        case
          when coalesce(s.tiene_detalle,false) then least(a.cantidad_canonica,coalesce(c.cantidad_cubierta,0))
          when coalesce(s.snapshot_programado,0)=a.cantidad_canonica then a.cantidad_canonica
          else least(a.cantidad_canonica,coalesce(s.snapshot_programado,0))
        end::int cantidad_cubierta,
        case
          when coalesce(s.tiene_detalle,false) then greatest(a.cantidad_canonica-coalesce(c.cantidad_cubierta,0),0)
          when coalesce(s.snapshot_programado,0)=a.cantidad_canonica then 0
          else greatest(a.cantidad_canonica-coalesce(s.snapshot_programado,0),0)
        end::int cantidad_pendiente,
        case
          when coalesce(s.programaciones,0)=0 then 'SIN_PROGRAMAR'
          when coalesce(s.tiene_detalle,false) and coalesce(c.cantidad_cubierta,0)>=a.cantidad_canonica then 'PROGRAMADA'
          when coalesce(s.tiene_detalle,false) then 'PARCIAL'
          when s.snapshot_programado=a.cantidad_canonica then 'PROGRAMADA_LEGACY'
          else 'LEGACY_REVISAR'
        end estado_cobertura,
        coalesce(s.programaciones,0)::int,
        coalesce(s.tiene_detalle,false)
 from actual a
 left join sched s on s.reserva=a.reserva and s.prioridad_semanal is not distinct from a.prioridad
 left join covered c on c.reserva=a.reserva and c.prioridad_semanal is not distinct from a.prioridad;
end $function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_mecanizado_cobertura_programacion(text,integer)'::regprocedure)) where firma='sgp_mecanizado_cobertura_programacion(text,integer)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_mecanizado_programacion_listar(text)',pg_get_functiondef('sgp_mecanizado_programacion_listar(text)'::regprocedure),null);

CREATE OR REPLACE FUNCTION public.sgp_mecanizado_programacion_listar(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE u text;
BEGIN
  u := sgp_validar_sesion_rol(p_token, ARRAY['ADMINISTRADOR','COORDINADOR','LIDER','LIDER MECANIZADO','CONSULTA']);
  RETURN COALESCE(
    (SELECT jsonb_agg(to_jsonb(p)||coalesce((select jsonb_build_object('parte_id',pt.id_programacion,'key_produccion',pt.key_produccion,'parte_numero',pt.numero,'identificador_parte',p.produccion||'-P'||pt.numero) from sgp_mecanizado_parcial.partes pt where pt.id_programacion=p.id_programacion),'{}'::jsonb) ORDER BY fecha_programacion,turno,prioridad)
     FROM sgp_mecanizado_programacion p),
    '[]'::jsonb
  );
END
$function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_mecanizado_programacion_listar(text)'::regprocedure)) where firma='sgp_mecanizado_programacion_listar(text)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_mecanizado_pendientes_turno(text,date,text)',pg_get_functiondef('sgp_mecanizado_pendientes_turno(text,date,text)'::regprocedure),null);

CREATE OR REPLACE FUNCTION public.sgp_mecanizado_pendientes_turno(p_token text, p_fecha date, p_turno text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_usuario text; v_inicio timestamptz; v_habilitado timestamptz; v_fin timestamptz; v_activado timestamptz; v_ahora timestamptz:=now();
begin
 v_usuario:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','CONSULTA']);
 if upper(trim(p_turno)) not in ('TURNO 1','TURNO 2') then raise exception 'Turno no válido'; end if;
 v_inicio:=(p_fecha::text||case when upper(trim(p_turno))='TURNO 1' then ' 07:00 America/Bogota' when extract(isodow from p_fecha)=7 then ' 18:00 America/Bogota' else ' 19:00 America/Bogota' end)::timestamptz;
 v_habilitado:=v_inicio+interval '5 minutes';
 -- End of the requested shift, including the different Sunday schedule.
 v_fin := case
   when upper(trim(p_turno))='TURNO 1' and extract(isodow from p_fecha)=7
     then (p_fecha::text||' 18:00 America/Bogota')::timestamptz
   when upper(trim(p_turno))='TURNO 1'
     then (p_fecha::text||' 19:00 America/Bogota')::timestamptz
   when extract(isodow from p_fecha)=7
     then ((p_fecha+1)::text||' 05:00 America/Bogota')::timestamptz
   else ((p_fecha+1)::text||' 07:00 America/Bogota')::timestamptz
 end;
 select activado_en into strict v_activado from public.sgp_mecanizado_arrastre_activacion where id=true;
 if v_ahora<v_habilitado then return '[]'::jsonb; end if;
 return coalesce((
 with legacy_scope as (
   select mp.id_programacion,sp.key_produccion
   from public.sgp_mecanizado_programacion mp
   join public.sgp_prioridades pr on pr.reserva=mp.reserva and pr.id_linea='PANELES_2'
     and (mp.prioridad_semanal is null or pr.prioridad=mp.prioridad_semanal)
   join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion and sp.id_linea='PANELES_2'
     and (mp.produccion is null or mp.produccion=sp.produccion)
   where not exists(select 1 from public.sgp_mecanizado_programacion_detalle d where d.id_programacion=mp.id_programacion)
 ), scope as (
   select d.id_programacion,d.key_produccion from public.sgp_mecanizado_programacion_detalle d
   union all
   select l.id_programacion,l.key_produccion from legacy_scope l
 ), base as (
  select mp.id_programacion,mp.reserva,coalesce(mp.prioridad_semanal,pr.prioridad) prioridad_semanal,mp.sistema,mp.acabado,mp.fecha_programacion,mp.turno,
   sp.key_produccion,sp.produccion,sp.proyecto,sp.cliente,sp.tipo,coalesce((select cantidad from sgp_mecanizado_parcial.partes where id_programacion=mp.id_programacion),round(coalesce(sp.cantidad,0)))::int cantidad,
   coalesce(sp.semana_actual,sp.semana_base)::int semana,
   public.sgp_es_reserva_compartida(sp.key_produccion) reserva_compartida,
   public.sgp_reservas_por_produccion_json(sp.key_produccion) reservas_compartidas,
   coalesce(eo.estado,me.estado,'SIN INICIAR') estado_actual,eo.observacion,
   (select max(h.fecha_evento) from public.sgp_mecanizado_historial_orden h where h.id_programacion=mp.id_programacion and h.produccion=sp.produccion and h.estado_nuevo='PROCESADO') procesado_en,
   (select max(h.fecha_evento) from public.sgp_mecanizado_historial_orden h where h.id_programacion=mp.id_programacion and h.produccion=sp.produccion and h.estado_nuevo='REPROGRAMADO') reprogramado_en,
   (select min(r.creado_en) from public.sgp_mecanizado_reprogramaciones r where r.id_origen=mp.id_programacion and r.produccion=sp.produccion) movido_en
  from public.sgp_mecanizado_programacion mp
  join scope sc on sc.id_programacion=mp.id_programacion
  join public.sgp_producciones sp on sp.key_produccion=sc.key_produccion
  left join public.sgp_prioridades pr on pr.key_produccion=sp.key_produccion and pr.reserva=mp.reserva and pr.id_linea='PANELES_2'
  left join public.sgp_mecanizado_ejecucion me on me.id_programacion=mp.id_programacion
  left join public.sgp_mecanizado_ejecucion_orden eo on eo.id_programacion=mp.id_programacion and eo.produccion=sp.produccion
  where (mp.fecha_programacion::text||case when upper(trim(mp.turno))='TURNO 1' then ' 07:00 America/Bogota' else ' 19:00 America/Bogota' end)::timestamptz < v_inicio
    and mp.estado<>'CANCELADA'
 ), eligible as (
  select *,row_number() over(partition by reserva,key_produccion,case when exists(select 1 from sgp_mecanizado_parcial.partes pt where pt.id_programacion=base.id_programacion) then id_programacion end order by fecha_programacion desc,case when upper(trim(turno))='TURNO 2' then 2 else 1 end desc,id_programacion desc) rn
  from base where (
      ((procesado_en is null and estado_actual<>'PROCESADO')
       and (movido_en is null or movido_en>=v_inicio)
       and (reprogramado_en is null or reprogramado_en>=v_inicio))
      or (procesado_en>=greatest(v_inicio,v_activado) and procesado_en<v_fin)
    )
 )
 select jsonb_agg(jsonb_build_object(
   'parte_id',(select pt.id_programacion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=eligible.id_programacion),'identificador_parte',(select produccion||'-P'||pt.numero from sgp_mecanizado_parcial.partes pt where pt.id_programacion=eligible.id_programacion),'id_programacion_origen',id_programacion,'reserva',reserva,'key_produccion',key_produccion,'produccion',produccion,
   'proyecto',coalesce(proyecto,cliente),'tipo',coalesce(tipo,''),'cantidad',cantidad,'semana',semana,
   'prioridad_semanal',prioridad_semanal,'sistema',sistema,'acabado',acabado,'estado',case when procesado_en>=greatest(v_inicio,v_activado) and procesado_en<v_fin then 'PROCESADO' else estado_actual end,'observacion',observacion,
   'reserva_compartida',reserva_compartida,'reservas_compartidas',reservas_compartidas,
   'turno_origen',turno,'fecha_origen',fecha_programacion,'arrastre',true,'culminado_en_turno',(procesado_en>=greatest(v_inicio,v_activado) and procesado_en<v_fin),'fecha_culminacion',case when procesado_en>=greatest(v_inicio,v_activado) and procesado_en<v_fin then procesado_en else null end
 ) order by fecha_programacion,turno,reserva,produccion)
 from eligible where rn=1
 ),'[]'::jsonb);
end $function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_mecanizado_pendientes_turno(text,date,text)'::regprocedure)) where firma='sgp_mecanizado_pendientes_turno(text,date,text)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_mecanizado_reprogramar_orden(text,uuid,text,date,text,integer,text)',pg_get_functiondef('sgp_mecanizado_reprogramar_orden(text,uuid,text,date,text,integer,text)'::regprocedure),null);

CREATE OR REPLACE FUNCTION public.sgp_mecanizado_reprogramar_orden(p_token text, p_id_programacion uuid, p_produccion text, p_fecha date, p_turno text, p_prioridad integer, p_motivo text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_usuario text; v_origen public.sgp_mecanizado_programacion%rowtype; v_destino uuid; v_cantidad integer; v_parte text; v_estado text; v_detalle_count integer; v_detalle_cantidad numeric; v_inserted integer;
begin

 if exists(select 1 from sgp_mecanizado_parcial.partes where id_programacion=p_id_programacion) then
  if p_produccion is distinct from (select produccion from public.sgp_mecanizado_programacion where id_programacion=p_id_programacion) then raise exception 'PRODUCCION_AJENA_A_PARTE'; end if;
  return public.sgp_mecanizado_parte_mover(p_token,p_id_programacion,p_fecha,p_turno,p_prioridad,p_motivo,false);
 end if;

 v_usuario:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR']);
 if p_fecha is null or p_turno not in ('TURNO 1','TURNO 2') or p_prioridad<1 or p_prioridad is null or length(trim(coalesce(p_motivo,'')))<5 then
   raise exception 'Indica fecha, turno, prioridad y motivo (mínimo 5 caracteres)';
 end if;
 select * into v_origen from public.sgp_mecanizado_programacion where id_programacion=p_id_programacion for update;
 if not found or v_origen.estado='CANCELADA' then raise exception 'Programación de origen no disponible'; end if;
 if (v_origen.fecha_programacion,v_origen.turno)=(p_fecha,p_turno) then raise exception 'Selecciona una fecha o turno diferente'; end if;
 if exists(select 1 from public.sgp_mecanizado_reprogramaciones where id_origen=p_id_programacion and produccion=p_produccion) then raise exception 'La orden ya fue reprogramada'; end if;
 if v_origen.produccion is not null and v_origen.produccion<>p_produccion then raise exception 'Orden no pertenece a esta programación'; end if;
 -- La composición canónica determina la producción, no un nombre potencialmente repetido.
 -- El join por key_produccion impide tomar cantidad/prioridad de otra reserva o sistema.
 select min(d.prioridad_semanal_snapshot),round(sum(d.cantidad_snapshot))::int into v_parte,v_cantidad
 from public.sgp_mecanizado_programacion_detalle d
 join public.sgp_producciones sp on sp.key_produccion=d.key_produccion
 where d.id_programacion=p_id_programacion
   and d.reserva_snapshot=v_origen.reserva
   and d.produccion_snapshot=p_produccion
   and sp.reserva_al=v_origen.reserva and sp.id_linea='PANELES_2'
   and sp.produccion=p_produccion
   and (v_origen.prioridad_semanal is null or d.prioridad_semanal_snapshot=v_origen.prioridad_semanal);
 if v_cantidad is null then raise exception 'Orden no pertenece a la reserva / parte'; end if;
 if v_cantidad>v_origen.cantidad_programada then raise exception 'La orden tiene % ventanas pero solo % programadas en el origen; no se permite mover parcialmente',v_cantidad,v_origen.cantidad_programada; end if;
 select eo.estado into v_estado from public.sgp_mecanizado_ejecucion_orden eo where eo.id_programacion=p_id_programacion and eo.produccion=p_produccion;
 if v_estado in ('PROCESADO','REPROGRAMADO') then raise exception 'No se puede reprogramar una orden procesada o ya reprogramada'; end if;

 -- Preflight canónico: no crear destinos sin key_produccion exacta.
 select count(*),coalesce(sum(d.cantidad_snapshot),0) into v_detalle_count,v_detalle_cantidad
 from public.sgp_mecanizado_programacion_detalle d
 where d.id_programacion=p_id_programacion
   and d.produccion_snapshot=p_produccion
   and d.reserva_snapshot=v_origen.reserva;
 if v_detalle_count=0 or v_detalle_cantidad<>v_cantidad then
   raise exception 'Composición de programación ausente o inconsistente para producción % (detalle %, cantidad %, esperada %)',
    p_produccion,v_detalle_count,v_detalle_cantidad,v_cantidad;
 end if;
 insert into public.sgp_mecanizado_programacion(reserva,produccion,cantidad_programada,fecha_programacion,turno,prioridad,prioridad_semanal,observacion,observacion_orden,sistema,acabado,porc_vidrio_snapshot,cant_vidrio_snapshot,usuario_programa)
 values(v_origen.reserva,p_produccion,v_cantidad,p_fecha,p_turno,p_prioridad,coalesce(v_origen.prioridad_semanal,v_parte),'Reprogramada desde '||v_origen.fecha_programacion||' '||v_origen.turno||'. Motivo: '||trim(p_motivo),v_origen.observacion_orden,v_origen.sistema,v_origen.acabado,v_origen.porc_vidrio_snapshot,v_origen.cant_vidrio_snapshot,v_usuario) returning id_programacion into v_destino;
 -- Transferencia atómica de identidad de producción, semana y vidrio.
 update public.sgp_mecanizado_programacion_detalle d
 set id_programacion=v_destino, origen='REPROGRAMACION'
 where d.id_programacion=p_id_programacion and d.produccion_snapshot=p_produccion
   and d.reserva_snapshot=v_origen.reserva;
 get diagnostics v_inserted=row_count;
 if v_inserted<>v_detalle_count then raise exception 'La composición de la reprogramación no coincide con el origen'; end if;
 insert into public.sgp_mecanizado_reprogramaciones(id_origen,id_destino,produccion,cantidad,motivo,usuario)
 values(p_id_programacion,v_destino,p_produccion,v_cantidad,trim(p_motivo),v_usuario);
 update public.sgp_mecanizado_programacion set cantidad_programada=cantidad_programada-v_cantidad,
 estado=case when cantidad_programada=v_cantidad then 'CANCELADA' else estado end,
 fecha_actualizacion=now() where id_programacion=p_id_programacion;
 perform public.sgp_mecanizado_guardar_estado_orden(p_token,p_id_programacion,p_produccion,'REPROGRAMADO','Reprogramada a '||p_fecha||' '||p_turno||'. '||trim(p_motivo));
 return v_destino;
end $function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_mecanizado_reprogramar_orden(text,uuid,text,date,text,integer,text)'::regprocedure)) where firma='sgp_mecanizado_reprogramar_orden(text,uuid,text,date,text,integer,text)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_mecanizado_guardar_estado_orden(text,uuid,text,text,text)',pg_get_functiondef('sgp_mecanizado_guardar_estado_orden(text,uuid,text,text,text)'::regprocedure),null);

CREATE OR REPLACE FUNCTION public.sgp_mecanizado_guardar_estado_orden(p_token text, p_id_programacion uuid, p_produccion text, p_estado text, p_observacion text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE u text; old_state text; new_state text;
BEGIN

 if exists(select 1 from sgp_mecanizado_parcial.partes where id_programacion=p_id_programacion) then
  perform public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA']);
  perform 1 from public.sgp_mecanizado_programacion where id_programacion=p_id_programacion for update;
  if p_produccion is distinct from (select produccion from public.sgp_mecanizado_programacion where id_programacion=p_id_programacion)
   or p_estado='REPROGRAMADO' then raise exception 'ESTADO_O_PRODUCCION_INVALIDA_PARA_PARTE'; end if;
  if exists(select 1 from public.sgp_picking_entregas where id_programacion=p_id_programacion) and p_estado<>'PROCESADO' then
   raise exception 'PARTE_CON_ENTREGAS_NO_PUEDE_RETROCEDER'; end if;
 end if;

 u:=sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA']);
 new_state:=upper(trim(coalesce(p_estado,'')));
 IF new_state NOT IN ('SIN INICIAR','CORTE','MECANIZADO','PROCESADO','REPROGRAMADO') THEN
  RAISE EXCEPTION 'Estado de mecanizado no permitido: %',p_estado;
 END IF;
 IF new_state='REPROGRAMADO' AND NOT EXISTS (
  SELECT 1 FROM sgp_mecanizado_reprogramaciones
  WHERE id_origen=p_id_programacion AND produccion=p_produccion
 ) THEN
  RAISE EXCEPTION 'REPROGRAMADO requiere vínculo de reprogramación';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM sgp_mecanizado_programacion
                WHERE id_programacion=p_id_programacion AND estado<>'CANCELADA') THEN
  IF new_state <> 'REPROGRAMADO' OR NOT EXISTS (SELECT 1 FROM sgp_mecanizado_reprogramaciones WHERE id_origen=p_id_programacion AND produccion=p_produccion) THEN
   RAISE EXCEPTION 'Programación inexistente o cancelada';
  END IF;
 END IF;
 SELECT estado INTO old_state FROM sgp_mecanizado_ejecucion_orden
 WHERE id_programacion=p_id_programacion AND produccion=p_produccion;
 INSERT INTO sgp_mecanizado_ejecucion_orden(id_programacion,produccion,estado,observacion,usuario,actualizado_en)
 VALUES(p_id_programacion,p_produccion,new_state,p_observacion,u,now())
 ON CONFLICT(id_programacion,produccion) DO UPDATE SET
 estado=excluded.estado,
 observacion=coalesce(excluded.observacion,sgp_mecanizado_ejecucion_orden.observacion),
 usuario=excluded.usuario,actualizado_en=now();
 IF old_state IS DISTINCT FROM new_state OR p_observacion IS NOT NULL THEN
  INSERT INTO sgp_mecanizado_historial_orden(id_programacion,produccion,estado_anterior,estado_nuevo,observacion,usuario)
  VALUES(p_id_programacion,p_produccion,old_state,new_state,p_observacion,u);
 END IF;

 if public.sgp_mecanizado_es_parte(p_id_programacion) then
  insert into public.sgp_mecanizado_ejecucion(id_programacion,estado,cantidad_procesada,observacion,usuario,actualizado_en)
  select p_id_programacion,new_state,case when new_state='PROCESADO' then cantidad else 0 end,p_observacion,u,now()
  from sgp_mecanizado_parcial.partes where id_programacion=p_id_programacion
  on conflict(id_programacion) do update set estado=excluded.estado,cantidad_procesada=excluded.cantidad_procesada,
  observacion=coalesce(excluded.observacion,public.sgp_mecanizado_ejecucion.observacion),usuario=u,actualizado_en=now();
 end if;
 RETURN true;

END $function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_mecanizado_guardar_estado_orden(text,uuid,text,text,text)'::regprocedure)) where firma='sgp_mecanizado_guardar_estado_orden(text,uuid,text,text,text)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_picking_cola(text)',pg_get_functiondef('sgp_picking_cola(text)'::regprocedure),null);

CREATE OR REPLACE FUNCTION public.sgp_picking_cola(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare u text;
begin
 u:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','PATINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA']);
 return coalesce((with base as (
   select p.*,e.estado estado_ejecucion
   from public.sgp_mecanizado_programacion p
   left join public.sgp_mecanizado_ejecucion e on e.id_programacion=p.id_programacion
   where p.estado<>'CANCELADA'
 ), partes as (
   select b.id_programacion,b.reserva,b.produccion,b.fecha_programacion,b.turno,b.prioridad,
          b.sistema,b.acabado,b.observacion,b.observacion_orden,b.estado_ejecucion,
          pr.prioridad parte,min(coalesce(sp.semana_actual,sp.semana_base))::int semana,sum(coalesce((select cantidad from sgp_mecanizado_parcial.partes where id_programacion=b.id_programacion),sp.cantidad))::int cantidad_ventanas
   from base b
   join public.sgp_prioridades pr on pr.reserva=b.reserva and pr.id_linea='PANELES_2'
      and (b.prioridad_semanal is null or pr.prioridad=b.prioridad_semanal)
   join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion and sp.id_linea='PANELES_2' and sp.activa='SI' and (not exists(select 1 from sgp_mecanizado_parcial.partes pt where pt.id_programacion=b.id_programacion) or sp.key_produccion=(select key_produccion from sgp_mecanizado_parcial.partes where id_programacion=b.id_programacion))
   group by b.id_programacion,b.reserva,b.produccion,b.fecha_programacion,b.turno,b.prioridad,b.sistema,b.acabado,b.observacion,b.observacion_orden,b.estado_ejecucion,pr.prioridad
 ), filas as (
   select (select count(*) from sgp_mecanizado_parcial.contextos_pdt src join public.sgp_aluminio_pendientes ap using(id_pendiente) join public.sgp_picking_entregas original on original.id_entrega=src.id_entrega where original.id_programacion=p.id_programacion and ap.estado='PENDIENTE') pdt_abiertos,coalesce((select sum(en.cantidad) from sgp_mecanizado_parcial.entregas en join public.sgp_picking_entregas pe using(id_entrega) where en.id_programacion=p.id_programacion and pe.estado in ('PENDIENTE_VALIDACION','VALIDADA','AUDITADA_DIFERENCIA')),0) cantidad_entregada,(select pt.id_programacion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=p.id_programacion) parte_id,(select p.produccion||'-P'||pt.numero from sgp_mecanizado_parcial.partes pt where pt.id_programacion=p.id_programacion) identificador_parte,p.id_programacion,p.reserva,p.parte,p.produccion,p.fecha_programacion,p.turno,p.prioridad,
          p.cantidad_ventanas,p.sistema,p.acabado,p.observacion,p.observacion_orden,
          coalesce(p.estado_ejecucion,'SIN INICIAR') estado,
          (select count(*) from public.sgp_mecanizado_novedades n where n.id_programacion=p.id_programacion and n.estado<>'RESUELTA') novedades,
          (select pe.estado from public.sgp_picking_entregas pe where pe.id_programacion=p.id_programacion order by pe.fecha_entrega desc limit 1) estado_entrega,
          case coalesce(p.estado_ejecucion,'SIN INICIAR') when 'PROCESADO' then 0 when 'MECANIZADO' then 1 when 'CORTE' then 2 when 'PROGRAMADA' then 3 when 'SIN INICIAR' then 3 else 4 end orden_estado,
          p.semana,case when p.parte ~ '^[0-9]+([.][0-9]+)?$' then p.parte::numeric when p.parte ~ '^[0-9]+([.][0-9]+){2}$' then (split_part(p.parte,'.',1)||'.'||split_part(p.parte,'.',2))::numeric else 999999::numeric end parte_num,
          coalesce((select jsonb_agg(jsonb_build_object(
             'key_produccion',z.key_produccion,'produccion',z.produccion,'proyecto',z.proyecto,'cantidad',z.cantidad,
             'observacion_mecanizado',z.observacion_mecanizado,'novedades',z.novedades,'entrega_estado',z.entrega_estado,
             'entrega_completa',z.entrega_completa,'fecha_entrega',z.fecha_entrega,'turno_entrega',z.turno_entrega,
             'estado_mecanizado',z.estado_mecanizado,'reserva_compartida',z.reserva_compartida,'reservas_compartidas',z.reservas_compartidas
           ) order by z.produccion)
           from (
             select distinct pr.key_produccion,sp.produccion,sp.proyecto,coalesce((select cantidad from sgp_mecanizado_parcial.partes where id_programacion=p.id_programacion),sp.cantidad) cantidad,coalesce(eo.observacion,'') observacion_mecanizado,
               (select count(*) from public.sgp_mecanizado_novedades n where n.id_programacion=p.id_programacion and n.produccion=sp.produccion and n.estado<>'RESUELTA') novedades,
               le.estado entrega_estado,le.completa entrega_completa,le.fecha_operativa fecha_entrega,le.turno_entrega,
               coalesce(eo.estado,coalesce(p.estado_ejecucion,'SIN INICIAR')) estado_mecanizado,
               public.sgp_es_reserva_compartida(pr.key_produccion) reserva_compartida,
               public.sgp_reservas_por_produccion_json(pr.key_produccion) reservas_compartidas
             from public.sgp_prioridades pr join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion
             left join public.sgp_mecanizado_ejecucion_orden eo on eo.id_programacion=p.id_programacion and eo.produccion=sp.produccion
             left join lateral (select pe.estado,pe.completa,pe.fecha_operativa,pe.turno_entrega from public.sgp_picking_entregas pe where pe.id_programacion=p.id_programacion and pe.produccion=sp.produccion order by pe.fecha_entrega desc limit 1) le on true
             where (not exists(select 1 from sgp_mecanizado_parcial.partes pt where pt.id_programacion=p.id_programacion) or sp.key_produccion=(select key_produccion from sgp_mecanizado_parcial.partes where id_programacion=p.id_programacion)) and pr.reserva=p.reserva and pr.id_linea='PANELES_2' and pr.prioridad=p.parte
           ) z),'[]'::jsonb) ordenes
   from partes p
 )
 select jsonb_agg(f order by f.orden_estado,f.reserva,lpad(coalesce(nullif(split_part(f.parte,'.',1),''),'999999'),12,'0'),lpad(coalesce(nullif(split_part(f.parte,'.',2),''),'0'),12,'0'),lpad(coalesce(nullif(split_part(f.parte,'.',3),''),'0'),12,'0'),f.fecha_programacion,f.prioridad) from filas f),'[]'::jsonb);
end $function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_picking_cola(text)'::regprocedure)) where firma='sgp_picking_cola(text)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_mecanizado_cobertura_ordenes(text,integer)',pg_get_functiondef('sgp_mecanizado_cobertura_ordenes(text,integer)'::regprocedure),null);

CREATE OR REPLACE FUNCTION sgp_mecanizado_parcial.cobertura_legacy(p_token text, p_semana integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','CONSULTA']);
 return coalesce((with a as (
  select pr.reserva,pr.prioridad,sp.key_produccion,sp.produccion,round(coalesce(sp.cantidad,0))::int cantidad
  from public.sgp_prioridades pr join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion
  where pr.id_linea='PANELES_2' and sp.id_linea='PANELES_2' and (p_semana is null or coalesce(sp.semana_actual,sp.semana_base)=p_semana)
 ), p as (
  select mp.reserva,mp.prioridad_semanal,count(*)::int n,
   count(*) filter(where exists(select 1 from public.sgp_mecanizado_programacion_detalle d where d.id_programacion=mp.id_programacion))::int nd,
   min(mp.id_programacion::text)::uuid legacy_id
  from public.sgp_mecanizado_programacion mp where mp.estado<>'CANCELADA' group by mp.reserva,mp.prioridad_semanal
 ), c as (
  select distinct mp.reserva,mp.prioridad_semanal,d.key_produccion,d.id_programacion,d.origen
  from public.sgp_mecanizado_programacion mp join public.sgp_mecanizado_programacion_detalle d on d.id_programacion=mp.id_programacion where mp.estado<>'CANCELADA'
 )
 select jsonb_agg(jsonb_build_object('reserva',a.reserva,'prioridad_semanal',a.prioridad,'key_produccion',a.key_produccion,'produccion',a.produccion,'cantidad',a.cantidad,
 'estado_orden',case when c.key_produccion is not null then 'PROGRAMADA' when coalesce(p.n,0)=0 or coalesce(p.nd,0)>0 then 'PENDIENTE' else 'REVISAR' end,
 'id_programacion',c.id_programacion,'origen_cobertura',c.origen,'id_programacion_legacy',case when coalesce(p.n,0)=1 and coalesce(p.nd,0)=0 then p.legacy_id else null end,
 'reconciliable',coalesce(p.n,0)=1 and coalesce(p.nd,0)=0) order by a.reserva,a.prioridad,a.produccion)
 from a left join p on p.reserva=a.reserva and p.prioridad_semanal is not distinct from a.prioridad
 left join c on c.reserva=a.reserva and c.prioridad_semanal is not distinct from a.prioridad and c.key_produccion=a.key_produccion),'[]'::jsonb);
end $function$
;

CREATE OR REPLACE FUNCTION public.sgp_mecanizado_cobertura_ordenes(p_token text,p_semana integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=sgp_mecanizado_parcial.cobertura_legacy(p_token,p_semana);
 return coalesce((select jsonb_agg(x) from (
 select value x from jsonb_array_elements(result) j where not exists(select 1 from sgp_mecanizado_parcial.partes pt where pt.key_produccion=j.value->>'key_produccion')
 union all
 select jsonb_build_object('reserva',pr.reserva,'prioridad_semanal',pr.prioridad,'key_produccion',sp.key_produccion,'produccion',sp.produccion,
 'cantidad',sp.cantidad,'cantidad_programada',sgp_mecanizado_parcial.asignada(sp.key_produccion),
 'cantidad_pendiente',greatest(sp.cantidad-sgp_mecanizado_parcial.asignada(sp.key_produccion),0),
 'estado_orden',case when sgp_mecanizado_parcial.asignada(sp.key_produccion)>=sp.cantidad then 'PROGRAMADA'
 when sgp_mecanizado_parcial.asignada(sp.key_produccion)>0 then 'PARCIAL' else 'PENDIENTE' end,'origen_cobertura','PARCIAL_AGREGADA')
 from public.sgp_prioridades pr join public.sgp_producciones sp using(key_produccion)
 where exists(select 1 from sgp_mecanizado_parcial.partes pt where pt.key_produccion=sp.key_produccion)
 and pr.id_linea='PANELES_2' and sp.id_linea='PANELES_2'
 and (p_semana is null or coalesce(sp.semana_actual,sp.semana_base)=p_semana)
 ) rows),'[]');
end $$;
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_mecanizado_cobertura_ordenes(text,integer)'::regprocedure)) where firma='sgp_mecanizado_cobertura_ordenes(text,integer)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer)',pg_get_functiondef('sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer)'::regprocedure),null);

CREATE OR REPLACE FUNCTION public.sgp_picking_reporte_entregas_v1(p_token text, p_fecha_inicio date, p_fecha_fin date, p_turno text DEFAULT NULL::text, p_sistema text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_user text; v_total bigint; v_summary jsonb; v_systems jsonb; v_rows jsonb;
BEGIN
 v_user := public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING']);
 IF p_fecha_inicio IS NULL OR p_fecha_fin IS NULL OR p_fecha_fin<p_fecha_inicio OR p_fecha_fin-p_fecha_inicio>30 THEN
  RAISE EXCEPTION 'RANGO_FECHAS_INVALIDO';
 END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>500 OR p_offset IS NULL OR p_offset<0 THEN
  RAISE EXCEPTION 'PAGINACION_INVALIDA';
 END IF;
 IF p_turno IS NOT NULL AND p_turno NOT IN ('TURNO 1','TURNO 2') THEN
  RAISE EXCEPTION 'TURNO_INVALIDO';
 END IF;
 SELECT count(*) INTO v_total
 FROM public.sgp_picking_entregas e
 JOIN public.sgp_mecanizado_programacion p ON p.id_programacion=e.id_programacion
 WHERE e.fecha_operativa BETWEEN p_fecha_inicio AND p_fecha_fin
   AND (p_turno IS NULL OR e.turno_entrega=p_turno)
   AND (p_sistema IS NULL OR p.sistema=p_sistema);
 -- Repeating CTEs is deliberate: aggregate across ALL matching events, never just the page.
 SELECT jsonb_build_object(
  'movimientos',count(*),
  'producciones_unicas',count(DISTINCT (coalesce((select pt.key_produccion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion),e.id_programacion::text||'|'||e.produccion),p.sistema)),
  'completas',count(*) FILTER (WHERE e.completa IS TRUE),
  'parciales',count(*) FILTER (WHERE e.completa IS FALSE),
  'filas_faltantes',coalesce(sum((SELECT count(*) FROM public.sgp_picking_faltantes f WHERE f.id_entrega=e.id_entrega)),0),
  'cantidad_piezas_faltantes',coalesce(sum((SELECT sum(f.cantidad) FROM public.sgp_picking_faltantes f WHERE f.id_entrega=e.id_entrega)),0)
 ) INTO v_summary
 FROM public.sgp_picking_entregas e JOIN public.sgp_mecanizado_programacion p ON p.id_programacion=e.id_programacion
 WHERE e.fecha_operativa BETWEEN p_fecha_inicio AND p_fecha_fin
   AND (p_turno IS NULL OR e.turno_entrega=p_turno)
   AND (p_sistema IS NULL OR p.sistema=p_sistema);
 SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.sistema),'[]'::jsonb) INTO v_systems FROM (
  SELECT p.sistema,count(*) movimientos,
   count(DISTINCT (coalesce((select pt.key_produccion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion),e.id_programacion::text||'|'||e.produccion),p.sistema)) producciones_unicas,
   count(*) FILTER (WHERE e.completa IS TRUE) completas,
   count(*) FILTER (WHERE e.completa IS FALSE) parciales,
   coalesce(sum((SELECT count(*) FROM public.sgp_picking_faltantes f WHERE f.id_entrega=e.id_entrega)),0) filas_faltantes
  FROM public.sgp_picking_entregas e JOIN public.sgp_mecanizado_programacion p ON p.id_programacion=e.id_programacion
  WHERE e.fecha_operativa BETWEEN p_fecha_inicio AND p_fecha_fin
    AND (p_turno IS NULL OR e.turno_entrega=p_turno)
    AND (p_sistema IS NULL OR p.sistema=p_sistema)
  GROUP BY p.sistema
 ) s;
 SELECT coalesce(jsonb_agg(to_jsonb(z) ORDER BY z.fecha_entrega,z.id_entrega),'[]'::jsonb) INTO v_rows FROM (
  SELECT (select pt.key_produccion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion) key_produccion_parte,
   (select pt.id_programacion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion) parte_id,
   (select e.produccion||'-P'||pt.numero from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion) identificador_parte,
   (select en.cantidad from sgp_mecanizado_parcial.entregas en where en.id_entrega=e.id_entrega) cantidad_ventanas_entregadas,
   e.id_entrega,e.id_programacion,e.produccion,e.completa,e.estado,e.observacion,
   e.usuario_entrega,(SELECT u.nombre FROM public.sgp_usuarios u WHERE u.usuario=e.usuario_entrega LIMIT 1) AS nombre_responsable,e.fecha_entrega,e.fecha_operativa,e.turno_entrega,
   e.usuario_validacion,e.fecha_validacion,p.reserva,p.prioridad_semanal AS parte,p.sistema,p.acabado,p.cantidad_programada,
   coalesce((SELECT jsonb_agg(jsonb_build_object('id_faltante',f.id_faltante,'perfil',f.perfil,'marca',f.marca,'fabricacion',f.fabricacion,'longitud',f.longitud,'cantidad',f.cantidad,'observacion',f.observacion,'nc',f.nc,'reserva_pendiente',f.reserva_pendiente,'acabado_pendiente',f.acabado_pendiente,'ventanas_afectadas',f.ventanas_afectadas) ORDER BY f.id_faltante) FROM public.sgp_picking_faltantes f WHERE f.id_entrega=e.id_entrega),'[]'::jsonb) faltantes
  FROM public.sgp_picking_entregas e JOIN public.sgp_mecanizado_programacion p ON p.id_programacion=e.id_programacion
  WHERE e.fecha_operativa BETWEEN p_fecha_inicio AND p_fecha_fin
   AND (p_turno IS NULL OR e.turno_entrega=p_turno)
   AND (p_sistema IS NULL OR p.sistema=p_sistema)
  ORDER BY e.fecha_entrega,e.id_entrega LIMIT p_limit OFFSET p_offset
 ) z;
 RETURN jsonb_build_object('ok',true,'filters',jsonb_build_object('fecha_inicio',p_fecha_inicio,'fecha_fin',p_fecha_fin,'turno',p_turno,'sistema',p_sistema),'summary',v_summary,'por_sistema',v_systems,'total_rows',v_total,'limit',p_limit,'offset',p_offset,'rows',v_rows);
END $function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer)'::regprocedure)) where firma='sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_pdt_registrar_v4(text,text,jsonb,jsonb,uuid)',pg_get_functiondef('sgp_pdt_registrar_v4(text,text,jsonb,jsonb,uuid)'::regprocedure),null);

CREATE OR REPLACE FUNCTION sgp_mecanizado_parcial.registro_legacy(p_token text, p_origen text, p_contexto jsonb, p_piezas jsonb, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor text; request jsonb; prior sgp_pdt_multiorigen.eventos%rowtype; result jsonb; delivery uuid; program public.sgp_mecanizado_programacion%rowtype; row jsonb; complete boolean;
BEGIN
 actor:=sgp_pdt_multiorigen.actor(p_token,p_origen);
 IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'PDT_EVENTO_REQUERIDO'; END IF;
 request:=jsonb_build_object('origen',p_origen,'contexto',p_contexto,'piezas',p_piezas);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key::text,0));
 SELECT * INTO prior FROM sgp_pdt_multiorigen.eventos WHERE id_evento=p_idempotency_key;
 IF FOUND THEN
 IF prior.usuario IS DISTINCT FROM actor OR prior.solicitud IS DISTINCT FROM request THEN RAISE EXCEPTION 'PDT_IDEMPOTENCIA_REUTILIZADA'; END IF;
 RETURN prior.respuesta||jsonb_build_object('duplicado',true);
 END IF;
 IF p_origen='PICKING' THEN
 SELECT * INTO STRICT program FROM public.sgp_mecanizado_programacion WHERE id_programacion=(p_contexto->>'id_programacion')::uuid AND estado<>'CANCELADA' FOR UPDATE;
 IF nullif(p_contexto->>'produccion','') IS NULL OR p_contexto->>'completa' NOT IN ('true','false') OR p_contexto->>'completa' IS NULL THEN RAISE EXCEPTION 'PDT_ENTREGA_INVALIDA'; END IF;
 IF p_contexto->>'turno' NOT IN ('TURNO 1','TURNO 2') OR p_contexto->>'turno' IS NULL OR nullif(p_contexto->>'fecha_entrega','') IS NULL THEN RAISE EXCEPTION 'PDT_FECHA_TURNO_REQUERIDOS'; END IF;
 complete:=(p_contexto->>'completa')::boolean;
 IF complete THEN
 IF p_piezas IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION 'PDT_ENTREGA_COMPLETA_CON_FALTANTES'; END IF;
 -- Preserve installed complete-delivery behavior and its duplicate trigger.
 result:=sgp_pdt_compat_91.sgp_picking_entrega_orden(p_token,program.id_programacion,p_contexto->>'produccion',true,p_contexto->>'observacion','[]'::jsonb,(p_contexto->>'fecha_entrega')::date,p_contexto->>'turno');
 ELSE
 delivery:=gen_random_uuid();
 INSERT INTO public.sgp_picking_entregas(id_entrega,id_programacion,produccion,completa,estado,observacion,usuario_entrega,fecha_entrega,fecha_operativa,turno_entrega)
 VALUES(delivery,program.id_programacion,p_contexto->>'produccion',false,'PENDIENTE_VALIDACION',nullif(btrim(p_contexto->>'observacion'),''),actor,now(),(p_contexto->>'fecha_entrega')::date,p_contexto->>'turno');
 result:=sgp_pdt_multiorigen.registrar(p_token,p_origen,p_contexto,p_piezas,p_idempotency_key,delivery);
 FOR row IN SELECT value FROM jsonb_array_elements(p_piezas) LOOP
 INSERT INTO public.sgp_picking_faltantes(id_entrega,id_pieza,produccion,perfil,marca,fabricacion,longitud,cantidad,observacion,nc,reserva_pendiente,acabado_pendiente)
 VALUES(delivery,row->>'id_pieza',p_contexto->>'produccion',row->>'perfil',row->>'marca',row->>'fabricacion',(row->>'longitud')::numeric,(row->>'cantidad')::numeric,nullif(btrim(row->>'observacion'),''),nullif(btrim(row->>'nc'),''),row->>'reserva',row->>'acabado');
 END LOOP;
 result:=result||jsonb_build_object('id_entrega',delivery,'estado','PENDIENTE_VALIDACION');
 END IF;
 ELSE
 result:=sgp_pdt_multiorigen.registrar(p_token,p_origen,p_contexto,p_piezas,p_idempotency_key);
 END IF;
 INSERT INTO sgp_pdt_multiorigen.eventos VALUES(p_idempotency_key,actor,request,result,now());
 RETURN result;
END $function$
;
create or replace function public.sgp_pdt_registrar_v4(p_token text,p_origen text,p_contexto jsonb,p_piezas jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u text; pt sgp_mecanizado_parcial.partes%rowtype; mp public.sgp_mecanizado_programacion%rowtype;
 prior sgp_mecanizado_parcial.solicitudes%rowtype; payload jsonb; result jsonb; qty integer; used integer; gate text;
begin
 if p_origen<>'PICKING' or not public.sgp_mecanizado_es_parte((p_contexto->>'id_programacion')::uuid) then
  return sgp_mecanizado_parcial.registro_legacy(p_token,p_origen,p_contexto,p_piezas,p_idempotency_key);
 end if;
 u:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','PATINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA']);
 if p_idempotency_key is null then raise exception 'CLAVE_REQUERIDA'; end if;
 payload:=jsonb_build_array('PICKING_PARTE',p_contexto,p_piezas);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key::text,741));
 select * into prior from sgp_mecanizado_parcial.solicitudes where clave=p_idempotency_key;
 if found then
  if prior.usuario<>u or prior.payload<>payload then raise exception 'CLAVE_REUTILIZADA_CON_OTROS_DATOS'; end if;
  return prior.resultado;
 end if;
 select * into strict pt from sgp_mecanizado_parcial.partes where id_programacion=(p_contexto->>'id_programacion')::uuid;
 select * into strict mp from public.sgp_mecanizado_programacion where id_programacion=pt.id_programacion for update;
 if mp.estado='CANCELADA' or p_contexto->>'produccion' is distinct from mp.produccion then raise exception 'PARTE_NO_ENTREGABLE'; end if;
 if not exists(select 1 from public.sgp_mecanizado_ejecucion_orden where id_programacion=pt.id_programacion and estado='PROCESADO') then raise exception 'PARTE_NO_PROCESADA'; end if;
 if jsonb_typeof(p_contexto->'cantidad_ventanas') is distinct from 'number'
 or (p_contexto->>'cantidad_ventanas')::numeric<>trunc((p_contexto->>'cantidad_ventanas')::numeric) then raise exception 'CANTIDAD_VENTANAS_REQUERIDA'; end if;
 qty:=(p_contexto->>'cantidad_ventanas')::integer;
 select coalesce(sum(en.cantidad),0) into used from sgp_mecanizado_parcial.entregas en join public.sgp_picking_entregas pe using(id_entrega)
 where en.id_programacion=pt.id_programacion and pe.estado in ('PENDIENTE_VALIDACION','VALIDADA','AUDITADA_DIFERENCIA');
 if qty<0 or qty>pt.cantidad-used then raise exception 'CANTIDAD_SUPERA_SALDO_ENTREGA'; end if;
 if qty=0 and coalesce(p_contexto->>'completa','true')<>'false' and not exists(
  select 1 from sgp_mecanizado_parcial.contextos_pdt src
  join public.sgp_aluminio_pendientes ap using(id_pendiente)
  join public.sgp_picking_entregas original on original.id_entrega=src.id_entrega
  where original.id_programacion=pt.id_programacion and ap.key_produccion=pt.key_produccion
  and ap.estado='PENDIENTE' and ap.validacion_estado='VALIDADO' and ap.estado_repo='PROCESADO'
 ) then raise exception 'REPOSICION_SIN_PDT_PROCESADO'; end if;
 gate:=current_setting('sgp.parte_entrega',true);
 perform pg_catalog.set_config('sgp.parte_entrega',pt.id_programacion::text,true);
 result:=sgp_mecanizado_parcial.registro_legacy(p_token,p_origen,p_contexto,p_piezas,p_idempotency_key);
 perform pg_catalog.set_config('sgp.parte_entrega',coalesce(gate,''),true);
 insert into sgp_mecanizado_parcial.entregas values((result->>'id_entrega')::uuid,pt.id_programacion,qty);
 insert into sgp_mecanizado_parcial.solicitudes values(p_idempotency_key,u,payload,result);
 insert into sgp_mecanizado_parcial.movimientos(id_programacion,tipo,nuevo,usuario)
 values(pt.id_programacion,'ENTREGA',jsonb_build_object('cantidad',qty,'id_entrega',result->>'id_entrega'),u);
 return result;
end $$;
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_pdt_registrar_v4(text,text,jsonb,jsonb,uuid)'::regprocedure)) where firma='sgp_pdt_registrar_v4(text,text,jsonb,jsonb,uuid)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_picking_rechazar_entrega_completa_duplicada()',pg_get_functiondef('sgp_picking_rechazar_entrega_completa_duplicada()'::regprocedure),null);

CREATE OR REPLACE FUNCTION public.sgp_picking_rechazar_entrega_completa_duplicada()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
if public.sgp_mecanizado_es_parte(new.id_programacion) then return new; end if;
  if new.completa is distinct from true then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.id_programacion::text || '|' || new.produccion, 0));
  if exists (
    select 1 from public.sgp_picking_entregas e
    where e.id_programacion = new.id_programacion
      and e.produccion = new.produccion
      and e.completa is true
      and e.estado in ('PENDIENTE_VALIDACION','VALIDADA','AUDITADA_DIFERENCIA')
  ) then
    raise exception 'ENTREGA_COMPLETA_YA_REGISTRADA: la producción ya tiene una entrega completa activa'
      using errcode = '23505';
  end if;
  return new;
end;
$function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_picking_rechazar_entrega_completa_duplicada()'::regprocedure)) where firma='sgp_picking_rechazar_entrega_completa_duplicada()';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_picking_recepcion_cola(text)',pg_get_functiondef('sgp_picking_recepcion_cola(text)'::regprocedure),null);

CREATE OR REPLACE FUNCTION public.sgp_picking_recepcion_cola(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare u text;
begin
 u:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA','LIDER']);
 return coalesce((select jsonb_agg(jsonb_build_object(
  'parte_id',(select id_programacion from sgp_mecanizado_parcial.partes where id_programacion=pe.id_programacion),'identificador_parte',(select pe.produccion||'-P'||numero from sgp_mecanizado_parcial.partes where id_programacion=pe.id_programacion),'id_entrega',pe.id_entrega,'id_programacion',pe.id_programacion,'produccion',pe.produccion,'completa',pe.completa,'estado',pe.estado,
  'observacion',pe.observacion,'usuario_entrega',pe.usuario_entrega,'fecha_entrega',pe.fecha_operativa,'turno_entrega',pe.turno_entrega,
  'reserva',mp.reserva,'parte',mp.prioridad_semanal,'sistema',mp.sistema,'acabado',mp.acabado,
  'cantidad_ventanas',coalesce((select en.cantidad from sgp_mecanizado_parcial.entregas en where en.id_entrega=pe.id_entrega),sp.cantidad,0),'proyecto',sp.proyecto,'key_produccion',sp.key_produccion,
  'reserva_compartida',public.sgp_es_reserva_compartida(sp.key_produccion),
  'reservas_compartidas',public.sgp_reservas_por_produccion_json(sp.key_produccion),
  'faltantes',coalesce((select jsonb_agg(jsonb_build_object(
    'id_faltante',pf.id_faltante,'id_pieza',pf.id_pieza,'perfil',pf.perfil,'marca',pf.marca,'fabricacion',pf.fabricacion,
    'longitud',pf.longitud,'cantidad',pf.cantidad,'observacion',pf.observacion,'nc',pf.nc,'ventanas_afectadas',pf.ventanas_afectadas,
    'reserva',pf.reserva_pendiente,'acabado',pf.acabado_pendiente
  ) order by pf.perfil,pf.fabricacion,pf.longitud) from public.sgp_picking_faltantes pf where pf.id_entrega=pe.id_entrega),'[]'::jsonb)
 ) order by pe.fecha_entrega)
 from public.sgp_picking_entregas pe
 join public.sgp_mecanizado_programacion mp on mp.id_programacion=pe.id_programacion
 left join lateral (
   select s.key_produccion,s.proyecto,s.cantidad
   from public.sgp_producciones s
   join public.sgp_prioridades pr on pr.key_produccion=s.key_produccion and pr.reserva=mp.reserva and pr.id_linea='PANELES_2'
   where s.produccion=pe.produccion and s.id_linea='PANELES_2' and (not public.sgp_mecanizado_es_parte(pe.id_programacion) or s.key_produccion=(select key_produccion from sgp_mecanizado_parcial.partes where id_programacion=pe.id_programacion))
   order by coalesce(s.semana_actual,s.semana_base) desc limit 1
 ) sp on true
 where pe.estado='PENDIENTE_VALIDACION'),'[]'::jsonb);
end $function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_picking_recepcion_cola(text)'::regprocedure)) where firma='sgp_picking_recepcion_cola(text)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_consultar_ensamble(text,integer,text)',pg_get_functiondef('sgp_consultar_ensamble(text,integer,text)'::regprocedure),null);

CREATE OR REPLACE FUNCTION public.sgp_consultar_ensamble(p_token text, p_semana integer DEFAULT NULL::integer, p_linea text DEFAULT 'PANELES_2'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_user text;
begin
 v_user:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER','LIDER MECANIZADO','CONSULTA']);
 return jsonb_build_object('usuario',v_user,'filas',coalesce((
   select jsonb_agg(to_jsonb(q) order by q.semana_actual,q.prioridad nulls last,q.id) from(
    select p.*,pr.prioridad,coalesce(g.tipo_vidrio,'—') tipo_vidrio,coalesce(g.medidas,'—') medidas,coalesce(u.ubicacion,'—') ubicacion_vidrio,
      coalesce(mo.estado,'—') estado_mecanizado,coalesce(mo.observacion,'') observacion_mecanizado,
      coalesce(pd.pendientes_mecanizado,'') pendientes_mecanizado,coalesce(pd.pdt_repo_ok,false) pdt_repo_ok,
      coalesce(pd.pdt_por_validar,false) pdt_por_validar,
      public.sgp_es_reserva_compartida(p.key_produccion) reserva_compartida,
      public.sgp_reservas_por_produccion_json(p.key_produccion) reservas_compartidas
    from public.sgp_producciones p
    left join public.sgp_prioridades pr on pr.anio=p.anio and pr.semana=coalesce(p.semana_actual,p.semana_base) and pr.id_linea=p.id_linea and pr.key_produccion=p.key_produccion
    left join lateral(select string_agg(distinct nullif(v.datos_origen->>'Tipo V',''),' · ') tipo_vidrio,string_agg(distinct nullif(v.datos_origen->>'Cant y Tamaño',''),' · ') medidas from public.sgp_vidrio v where v.key_produccion=p.key_produccion and v.activo='SI')g on true
    left join lateral(select string_agg(format('(%s) %s · %s',trim(to_char(sumx,'FM999999990.##')),posicion,estado_orden),' | ' order by ord,posicion) ubicacion from(select uv.posicion,min(uv.estado_orden) estado_orden,sum(coalesce(uv.disponible,0)) sumx,case when lower(min(coalesce(uv.estado_orden,''))) like 'preparado%' then 1 when lower(min(coalesce(uv.estado_orden,''))) like 'novedad%' then 2 else 3 end ord from public.sgp_ubicacion_vidrio_actual uv where uv.key_produccion=p.key_produccion and uv.activo=true group by uv.posicion)z)u on true
    left join lateral(
      select eo.estado,eo.observacion from (select eo.* from public.sgp_mecanizado_ejecucion_orden eo where eo.produccion=p.produccion and not exists(select 1 from sgp_mecanizado_parcial.partes pt where pt.id_programacion=eo.id_programacion) order by eo.actualizado_en desc nulls last limit 1) eo
      where eo.produccion=p.produccion and not exists(select 1 from sgp_mecanizado_parcial.partes where key_produccion=p.key_produccion)
      union all
      select case when sum(case when eo.estado='PROCESADO' then pt.cantidad else 0 end)>=p.cantidad then 'PROCESADO'
        when bool_or(eo.estado in ('MECANIZADO','PROCESADO')) then 'MECANIZADO'
        when bool_or(eo.estado='CORTE') then 'CORTE' else 'SIN INICIAR' end,
        string_agg(p.produccion||'-P'||pt.numero||': '||coalesce(eo.observacion,''),' | ' order by pt.numero)
      from sgp_mecanizado_parcial.partes pt join public.sgp_mecanizado_programacion mp using(id_programacion)
      left join public.sgp_mecanizado_ejecucion_orden eo on eo.id_programacion=pt.id_programacion and eo.produccion=mp.produccion
      where pt.key_produccion=p.key_produccion and mp.estado<>'CANCELADA'
      having count(*)>0
    )mo on true
    left join lateral(
      select
        string_agg('PDT '||trim(to_char(ap.cantidad,'FM999999990.##'))||' '||coalesce(regexp_replace(ap.perfil,'^.*-',''),'—')||case when ap.nc is not null then ' NC '||ap.nc else '' end,' · ' order by ap.fecha_reporte) pendientes_mecanizado,
        bool_or(ap.estado_repo='REPO_OK' and coalesce(ap.validacion_estado,'POR_VALIDAR')='VALIDADO') pdt_repo_ok,
        bool_or(coalesce(ap.validacion_estado,'POR_VALIDAR')='POR_VALIDAR') pdt_por_validar
      from public.sgp_aluminio_pendientes ap
      where ap.produccion=p.produccion and ap.estado='PENDIENTE' and coalesce(ap.estado_repo,'PENDIENTE')<>'PICKING'
    )pd on true
    where p.id_linea=p_linea and p.activa='SI' and(p_semana is null or coalesce(p.semana_actual,p.semana_base)=p_semana)
   )q
 ),'[]'::jsonb));
end $function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_consultar_ensamble(text,integer,text)'::regprocedure)) where firma='sgp_consultar_ensamble(text,integer,text)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_picking_piezas_panel(text,uuid,text)',pg_get_functiondef('sgp_picking_piezas_panel(text,uuid,text)'::regprocedure),null);

CREATE OR REPLACE FUNCTION public.sgp_picking_piezas_panel(p_token text, p_id_programacion uuid, p_produccion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_sistema text;
  v_acabado text;
  v_reserva text;
  v_multi boolean:=false;
begin
 if exists(select 1 from sgp_mecanizado_parcial.partes where id_programacion=p_id_programacion) then
  perform public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','PATINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA']);
  if p_produccion is not null and p_produccion is distinct from
   (select produccion from public.sgp_mecanizado_programacion where id_programacion=p_id_programacion and estado<>'CANCELADA') then
   raise exception 'PRODUCCION_AJENA_A_PARTE'; end if;
  return coalesce((select jsonb_agg(q.pieza) from (
   select distinct to_jsonb(a)||jsonb_build_object('key_produccion',pt.key_produccion,'perfil',a.codigo_sap,'ambito','REFERENCIA_PRODUCCION') pieza
   from sgp_mecanizado_parcial.partes pt
   join public.sgp_mecanizado_programacion mp using(id_programacion)
   join public.sgp_produccion_reservas_v r on r.key_produccion=pt.key_produccion and r.reserva_principal=mp.reserva
   cross join lateral public.sgp_pdt_origenes_internal_v3(r.reserva,null,mp.produccion,null,null) x
   join public.sgp_aluminio a on a.id_pieza=x->>'id_pieza'
   where pt.id_programacion=p_id_programacion and mp.estado<>'CANCELADA'
    and x->>'key_produccion'=pt.key_produccion and x->>'tipo_pieza'='PANEL' and x->>'id_linea'='PANELES_2'
    and upper(btrim(x->>'sistema'))=upper(btrim(mp.sistema))
  ) q),'[]'::jsonb);
 end if;

  select sistema,acabado,reserva into v_sistema,v_acabado,v_reserva
  from public.sgp_mecanizado_programacion
  where id_programacion=p_id_programacion;

  if p_produccion is not null then
    select coalesce(count(distinct v.reserva)>1,false) into v_multi
    from public.sgp_produccion_reservas_v v
    where v.produccion=p_produccion and v.reserva_principal=v_reserva;
  else
    select exists(
      select 1
      from public.sgp_prioridades pr
      join public.sgp_produccion_reservas_v v on v.key_produccion=pr.key_produccion
      join public.sgp_mecanizado_programacion mp on mp.id_programacion=p_id_programacion
      where pr.reserva=mp.reserva and pr.id_linea='PANELES_2'
        and (mp.prioridad_semanal is null or pr.prioridad=mp.prioridad_semanal)
      group by v.key_produccion
      having count(distinct v.reserva)>1
    ) into v_multi;
  end if;

  return coalesce((
    select jsonb_agg(x)
    from jsonb_array_elements(
      public.sgp_picking_piezas(p_token,p_id_programacion,p_produccion)
    ) x
    join public.sgp_maestro_piezas m
      on trim(m.codigo_sap)=trim(coalesce(x->>'codigo_sap',x->>'perfil'))
     and m.activo='SI'
     and m.tipo_pieza='PANEL'
    where (v_sistema is null or trim(v_sistema)='' or upper(trim(coalesce(x->>'sistema','')))=upper(trim(v_sistema)))
      and (
        v_multi
        or v_acabado is null
        or trim(v_acabado)=''
        or upper(trim(coalesce(x->>'acabado','')))=upper(trim(v_acabado))
      )
  ),'[]'::jsonb);
end
$function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_picking_piezas_panel(text,uuid,text)'::regprocedure)) where firma='sgp_picking_piezas_panel(text,uuid,text)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_pdt_multiorigen.fuentes(text,text,jsonb)',pg_get_functiondef('sgp_pdt_multiorigen.fuentes(text,text,jsonb)'::regprocedure),null);

CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.fuentes(p_token text, p_origen text, p_contexto jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE program public.sgp_mecanizado_programacion%rowtype; allowed jsonb; result jsonb;
BEGIN
 PERFORM sgp_pdt_multiorigen.actor(p_token,p_origen);
 IF nullif(btrim(p_contexto->>'produccion'),'') IS NULL THEN RAISE EXCEPTION 'PDT_PRODUCCION_REQUERIDA'; END IF;
 IF p_origen='PICKING' THEN
 SELECT * INTO STRICT program FROM public.sgp_mecanizado_programacion WHERE id_programacion=(p_contexto->>'id_programacion')::uuid AND estado<>'CANCELADA' FOR SHARE;
 allowed:=public.sgp_picking_piezas_panel(p_token,program.id_programacion,p_contexto->>'produccion');
 ELSE
 IF nullif(p_contexto->>'key_produccion','') IS NULL THEN RAISE EXCEPTION 'PDT_CLAVE_REQUERIDA'; END IF;
 END IF;
 SELECT coalesce(jsonb_agg(x ORDER BY x->>'codigo_sap',x->>'fabricacion',x->>'longitud',x->>'id_pieza'),'[]'::jsonb) INTO result
 FROM (SELECT DISTINCT x||jsonb_build_object('id_carga',a.id_carga,'fila_origen',a.fila_origen) AS x FROM public.sgp_produccion_reservas_v r
 CROSS JOIN LATERAL public.sgp_pdt_origenes_internal_v3(r.reserva,NULL,p_contexto->>'produccion',NULL,NULL) x
 JOIN public.sgp_aluminio a ON a.id_pieza=x->>'id_pieza'
 WHERE r.produccion=p_contexto->>'produccion' AND r.key_produccion=x->>'key_produccion' AND r.reserva=x->>'reserva'
 AND (p_origen<>'PICKING' OR NOT public.sgp_mecanizado_es_parte(program.id_programacion) OR x->>'key_produccion'=(SELECT key_produccion FROM sgp_mecanizado_parcial.partes WHERE id_programacion=program.id_programacion)) AND x->>'tipo_pieza'='PANEL' AND x->>'id_linea'='PANELES_2'
 AND (nullif(p_contexto->>'reserva','') IS NULL OR x->>'reserva'=p_contexto->>'reserva')
 AND (nullif(p_contexto->>'key_produccion','') IS NULL OR x->>'key_produccion'=p_contexto->>'key_produccion')
 AND (p_origen<>'PICKING' OR (
 coalesce(x->>'reserva_principal',x->>'reserva')=program.reserva
 AND upper(btrim(x->>'sistema'))=upper(btrim(program.sistema))
 AND (public.sgp_mecanizado_es_parte(program.id_programacion) OR upper(btrim(x->>'acabado'))=upper(btrim(program.acabado)))
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(allowed) a WHERE a->>'id_pieza'=x->>'id_pieza')))) q;
 IF jsonb_array_length(result)>1000 THEN RAISE EXCEPTION 'PDT_FUENTES_EXCEDEN_LIMITE'; END IF;
 RETURN result;
END $function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_pdt_multiorigen.fuentes(text,text,jsonb)'::regprocedure)) where firma='sgp_pdt_multiorigen.fuentes(text,text,jsonb)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_pdt_multiorigen.nuevo_sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)',pg_get_functiondef('sgp_pdt_multiorigen.nuevo_sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'::regprocedure),null);

CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.nuevo_sgp_pdt_entrega_registrar_v2(p_token text, p_detalle uuid, p_entrega uuid, p_cantidad integer, p_clave uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE d public.sgp_aluminio_pendiente_detalles%rowtype; p public.sgp_aluminio_pendientes%rowtype;
 e public.sgp_pdt_entrega_lineas%rowtype; u text; nuevo uuid; neto bigint;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING']);
 IF p_cantidad IS NULL OR p_cantidad<=0 OR p_clave IS NULL THEN RAISE EXCEPTION 'Cantidad/clave inválida'; END IF;
 SELECT * INTO STRICT d FROM public.sgp_aluminio_pendiente_detalles WHERE id_detalle=p_detalle;
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=d.id_pendiente FOR UPDATE;
 PERFORM public.sgp_pdt_exigir_panel_v3(p.id_pendiente);
 SELECT * INTO e FROM public.sgp_pdt_entrega_lineas WHERE clave=p_clave;
 IF FOUND THEN
  IF e.id_detalle<>p_detalle OR e.id_entrega<>p_entrega OR e.cantidad<>p_cantidad THEN RAISE EXCEPTION 'Clave reutilizada'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicado',true,'id_linea',e.id_linea);
 END IF;
 IF p.contrato_pdt<>'V2' OR p.estado<>'PENDIENTE' OR p.validacion_estado<>'VALIDADO' THEN RAISE EXCEPTION 'PDT no apto'; END IF;
 PERFORM 1 FROM public.sgp_picking_entregas WHERE id_entrega=p_entrega FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Entrega inexistente'; END IF;
 PERFORM 1 FROM public.sgp_mecanizado_programacion mp JOIN public.sgp_picking_entregas pe_lock USING(id_programacion) WHERE pe_lock.id_entrega=p_entrega FOR UPDATE OF mp;
 -- Explicit event identity, not global order status or missing quantities.
 PERFORM 1 FROM public.sgp_picking_entregas pe
 JOIN public.sgp_mecanizado_programacion mp ON mp.id_programacion=pe.id_programacion
 JOIN public.sgp_producciones prod ON prod.key_produccion=p.key_produccion
 WHERE pe.id_entrega=p_entrega AND pe.produccion=prod.produccion
 AND upper(btrim(mp.sistema))=upper(btrim(prod.sistema))
 AND (mp.reserva=p.reserva OR (mp.reserva=p.reserva_principal AND EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v rel WHERE rel.key_produccion=p.key_produccion AND rel.reserva=p.reserva AND rel.reserva_principal=mp.reserva))) AND sgp_mecanizado_parcial.material_pdt(p.id_pendiente,pe.id_entrega,d.acabado)
 AND EXISTS(SELECT 1 FROM public.sgp_pdt_fuentes f WHERE f.id_detalle=d.id_detalle
 AND upper(btrim(f.snapshot->>'sistema'))=upper(btrim(mp.sistema))
 AND EXISTS(SELECT 1 FROM public.sgp_pdt_origenes_internal_v3(p.reserva,p.perfil,p.produccion,p.acabado_pendiente,d.id_pieza) x
 WHERE x->>'key_produccion'=p.key_produccion AND x->>'tipo_pieza'='PANEL' AND x->>'id_linea'='PANELES_2'
 AND f.snapshot->>'id_pieza'=x->>'id_pieza'
 AND (SELECT to_jsonb(a)-'cantidad' FROM public.sgp_aluminio a WHERE a.id_pieza=d.id_pieza)=f.snapshot-'cantidad'));
 IF NOT FOUND THEN RAISE EXCEPTION 'Entrega ajena o identidad incompleta'; END IF;
 SELECT coalesce(sum(CASE WHEN tipo='AVANCE' THEN cantidad ELSE -cantidad END),0) INTO neto
 FROM public.sgp_aluminio_pendiente_movimientos WHERE id_detalle=p_detalle;
 IF p_cantidad+coalesce((SELECT sum(cantidad) FROM public.sgp_pdt_entrega_lineas WHERE id_detalle=p_detalle AND estado<>'ANULADA'),0)>neto
 THEN RAISE EXCEPTION 'Entrega supera procesado'; END IF;
 INSERT INTO public.sgp_pdt_entrega_lineas(id_entrega,id_detalle,id_pieza,cantidad,clave,registrado_por)
 VALUES(p_entrega,p_detalle,d.id_pieza,p_cantidad,p_clave,u) RETURNING id_linea INTO nuevo;
 RETURN jsonb_build_object('ok',true,'id_linea',nuevo);
END $function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_pdt_multiorigen.nuevo_sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'::regprocedure)) where firma='sgp_pdt_multiorigen.nuevo_sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_pdt_multiorigen.grouped_nuevo_entrega(text,uuid,uuid,integer,uuid)',pg_get_functiondef('sgp_pdt_multiorigen.grouped_nuevo_entrega(text,uuid,uuid,integer,uuid)'::regprocedure),null);

CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.grouped_nuevo_entrega(p_token text, p_detalle uuid, p_entrega uuid, p_cantidad integer, p_clave uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE d public.sgp_aluminio_pendiente_detalles%rowtype; p public.sgp_aluminio_pendientes%rowtype;
 e public.sgp_pdt_entrega_lineas%rowtype; u text; nuevo uuid; neto bigint;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING']);
 IF p_cantidad IS NULL OR p_cantidad<=0 OR p_clave IS NULL THEN RAISE EXCEPTION 'Cantidad/clave inválida'; END IF;
 SELECT * INTO STRICT d FROM public.sgp_aluminio_pendiente_detalles WHERE id_detalle=p_detalle;
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=d.id_pendiente FOR UPDATE;
 PERFORM public.sgp_pdt_exigir_panel_v3(p.id_pendiente);
 SELECT * INTO e FROM public.sgp_pdt_entrega_lineas WHERE clave=p_clave;
 IF FOUND THEN
  IF e.id_detalle<>p_detalle OR e.id_entrega<>p_entrega OR e.cantidad<>p_cantidad THEN RAISE EXCEPTION 'Clave reutilizada'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicado',true,'id_linea',e.id_linea);
 END IF;
 IF p.contrato_pdt<>'V2' OR p.estado<>'PENDIENTE' OR p.validacion_estado<>'VALIDADO' THEN RAISE EXCEPTION 'PDT no apto'; END IF;
 PERFORM 1 FROM public.sgp_picking_entregas WHERE id_entrega=p_entrega FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Entrega inexistente'; END IF;
 PERFORM 1 FROM public.sgp_mecanizado_programacion mp JOIN public.sgp_picking_entregas pe_lock USING(id_programacion) WHERE pe_lock.id_entrega=p_entrega FOR UPDATE OF mp;
 -- Explicit event identity, not global order status or missing quantities.
 PERFORM 1 FROM public.sgp_picking_entregas pe
 JOIN public.sgp_mecanizado_programacion mp ON mp.id_programacion=pe.id_programacion
 JOIN public.sgp_producciones prod ON prod.key_produccion=p.key_produccion
 WHERE pe.id_entrega=p_entrega AND pe.produccion=prod.produccion
 AND upper(btrim(mp.sistema))=upper(btrim(prod.sistema))
 AND (mp.reserva=p.reserva OR (mp.reserva=p.reserva_principal AND EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v rel WHERE rel.key_produccion=p.key_produccion AND rel.reserva=p.reserva AND rel.reserva_principal=mp.reserva))) AND sgp_mecanizado_parcial.material_pdt(p.id_pendiente,pe.id_entrega,d.acabado)
 AND EXISTS(SELECT 1 FROM public.sgp_pdt_fuentes f WHERE f.id_detalle=d.id_detalle
 AND upper(btrim(f.snapshot->>'sistema'))=upper(btrim(mp.sistema))
 AND EXISTS(SELECT 1 FROM public.sgp_pdt_origenes_internal_v3(p.reserva,p.perfil,p.produccion,p.acabado_pendiente,f.id_pieza) x
 WHERE x->>'key_produccion'=p.key_produccion AND x->>'tipo_pieza'='PANEL' AND x->>'id_linea'='PANELES_2'
 AND f.snapshot->>'id_pieza'=x->>'id_pieza'
 AND (SELECT to_jsonb(a)-'cantidad' FROM public.sgp_aluminio a WHERE a.id_pieza=f.id_pieza)=f.snapshot-'cantidad'));
 IF NOT FOUND THEN RAISE EXCEPTION 'Entrega ajena o identidad incompleta'; END IF;
 SELECT coalesce(sum(CASE WHEN tipo='AVANCE' THEN cantidad ELSE -cantidad END),0) INTO neto
 FROM public.sgp_aluminio_pendiente_movimientos WHERE id_detalle=p_detalle;
 IF p_cantidad+coalesce((SELECT sum(cantidad) FROM public.sgp_pdt_entrega_lineas WHERE id_detalle=p_detalle AND estado<>'ANULADA'),0)>neto
 THEN RAISE EXCEPTION 'Entrega supera procesado'; END IF;
 INSERT INTO public.sgp_pdt_entrega_lineas(id_entrega,id_detalle,id_pieza,cantidad,clave,registrado_por)
 VALUES(p_entrega,p_detalle,'',p_cantidad,p_clave,u) RETURNING id_linea INTO nuevo;
 RETURN jsonb_build_object('ok',true,'id_linea',nuevo);
END $function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_pdt_multiorigen.grouped_nuevo_entrega(text,uuid,uuid,integer,uuid)'::regprocedure)) where firma='sgp_pdt_multiorigen.grouped_nuevo_entrega(text,uuid,uuid,integer,uuid)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_pdt_multiorigen.nuevo_sgp_pdt_cierre_acreditado(uuid)',pg_get_functiondef('sgp_pdt_multiorigen.nuevo_sgp_pdt_cierre_acreditado(uuid)'::regprocedure),null);

CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.nuevo_sgp_pdt_cierre_acreditado(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.sgp_pdt_cierres WHERE id_pendiente=p_id)
 AND EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=p_id)
 AND NOT EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d WHERE d.id_pendiente=p_id AND (
 d.cantidad_validada<>(SELECT coalesce(sum(CASE WHEN m.tipo='AVANCE' THEN m.cantidad ELSE -m.cantidad END),0) FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_detalle=d.id_detalle)
 OR d.cantidad_validada<>(SELECT coalesce(sum(a.cantidad),0) FROM public.sgp_pdt_asignaciones a
 JOIN public.sgp_pdt_entrega_lineas l USING(id_linea) JOIN public.sgp_picking_entregas e ON e.id_entrega=l.id_entrega
 JOIN public.sgp_mecanizado_programacion mp ON mp.id_programacion=e.id_programacion
 JOIN public.sgp_pdt_fuentes f ON f.id_detalle=a.id_detalle
 JOIN public.sgp_aluminio_pendientes p ON p.id_pendiente=d.id_pendiente
 WHERE a.id_detalle=d.id_detalle AND l.estado='VALIDADA' AND e.estado='VALIDADA'
 AND e.produccion=p.produccion AND (mp.reserva=p.reserva OR (mp.reserva=p.reserva_principal AND EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v rel WHERE rel.key_produccion=p.key_produccion AND rel.reserva=p.reserva AND rel.reserva_principal=mp.reserva)))
 AND upper(btrim(mp.sistema))=upper(btrim(f.snapshot->>'sistema'))
 AND sgp_mecanizado_parcial.material_pdt(p.id_pendiente,e.id_entrega,d.acabado))));
$function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_pdt_multiorigen.nuevo_sgp_pdt_cierre_acreditado(uuid)'::regprocedure)) where firma='sgp_pdt_multiorigen.nuevo_sgp_pdt_cierre_acreditado(uuid)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_pdt_multiorigen.grouped_nuevo_cierre_acreditado(uuid)',pg_get_functiondef('sgp_pdt_multiorigen.grouped_nuevo_cierre_acreditado(uuid)'::regprocedure),null);

CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.grouped_nuevo_cierre_acreditado(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.sgp_pdt_cierres WHERE id_pendiente=p_id)
 AND EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=p_id)
 AND NOT EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d WHERE d.id_pendiente=p_id AND (
 d.cantidad_validada<>(SELECT coalesce(sum(CASE WHEN m.tipo='AVANCE' THEN m.cantidad ELSE -m.cantidad END),0) FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_detalle=d.id_detalle)
 OR d.cantidad_validada<>(SELECT coalesce(sum(a.cantidad),0) FROM public.sgp_pdt_asignaciones a
 JOIN public.sgp_pdt_entrega_lineas l USING(id_linea) JOIN public.sgp_picking_entregas e ON e.id_entrega=l.id_entrega
 JOIN public.sgp_mecanizado_programacion mp ON mp.id_programacion=e.id_programacion

 JOIN public.sgp_aluminio_pendientes p ON p.id_pendiente=d.id_pendiente
 WHERE a.id_detalle=d.id_detalle AND l.estado='VALIDADA' AND e.estado='VALIDADA'
 AND e.produccion=p.produccion AND (mp.reserva=p.reserva OR (mp.reserva=p.reserva_principal AND EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v rel WHERE rel.key_produccion=p.key_produccion AND rel.reserva=p.reserva AND rel.reserva_principal=mp.reserva)))
 AND EXISTS(SELECT 1 FROM public.sgp_pdt_fuentes f WHERE f.id_detalle=a.id_detalle AND upper(btrim(mp.sistema))=upper(btrim(f.snapshot->>'sistema')))
 AND sgp_mecanizado_parcial.material_pdt(p.id_pendiente,e.id_entrega,d.acabado))));
$function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_pdt_multiorigen.grouped_nuevo_cierre_acreditado(uuid)'::regprocedure)) where firma='sgp_pdt_multiorigen.grouped_nuevo_cierre_acreditado(uuid)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_pdt_multiorigen.nuevo_sgp_pdt_picking_v2(text,uuid)',pg_get_functiondef('sgp_pdt_multiorigen.nuevo_sgp_pdt_picking_v2(text,uuid)'::regprocedure),null);

CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.nuevo_sgp_pdt_picking_v2(p_token text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE p public.sgp_aluminio_pendientes%rowtype;
BEGIN
 PERFORM public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION','PICKING','SUPERVISOR DE PICKING','LIDER MECANIZADO','LIDER']);
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id;
 IF p.contrato_pdt<>'V2' THEN RAISE EXCEPTION 'PDT no V2'; END IF;
 RETURN jsonb_build_object('ok',true,'entregas',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (
  SELECT pe.id_entrega,pe.estado,pe.completa,pe.produccion FROM public.sgp_picking_entregas pe
  JOIN public.sgp_mecanizado_programacion mp USING(id_programacion)
  JOIN public.sgp_producciones prod ON prod.key_produccion=p.key_produccion
  WHERE pe.produccion=prod.produccion AND upper(btrim(mp.sistema))=upper(btrim(prod.sistema))
  AND (mp.reserva=p.reserva OR (mp.reserva=p.reserva_principal AND EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v rel WHERE rel.key_produccion=p.key_produccion AND rel.reserva=p.reserva AND rel.reserva_principal=mp.reserva))) AND sgp_mecanizado_parcial.material_pdt(p.id_pendiente,pe.id_entrega,p.acabado_pendiente)
 )x),'[]'::jsonb),'lineas',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('asignada',EXISTS(
 SELECT 1 FROM public.sgp_pdt_asignaciones a WHERE a.id_linea=l.id_linea)))
 FROM public.sgp_pdt_entrega_lineas l JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle)
 WHERE d.id_pendiente=p_id),'[]'::jsonb));
END $function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_pdt_multiorigen.nuevo_sgp_pdt_picking_v2(text,uuid)'::regprocedure)) where firma='sgp_pdt_multiorigen.nuevo_sgp_pdt_picking_v2(text,uuid)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_pdt_multiorigen.original_sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)',pg_get_functiondef('sgp_pdt_multiorigen.original_sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'::regprocedure),null);

CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.original_sgp_pdt_entrega_registrar_v2(p_token text, p_detalle uuid, p_entrega uuid, p_cantidad integer, p_clave uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE d public.sgp_aluminio_pendiente_detalles%rowtype; p public.sgp_aluminio_pendientes%rowtype;
 e public.sgp_pdt_entrega_lineas%rowtype; u text; nuevo uuid; neto bigint;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING']);
 IF p_cantidad IS NULL OR p_cantidad<=0 OR p_clave IS NULL THEN RAISE EXCEPTION 'Cantidad/clave inválida'; END IF;
 SELECT * INTO STRICT d FROM public.sgp_aluminio_pendiente_detalles WHERE id_detalle=p_detalle;
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=d.id_pendiente FOR UPDATE;
 PERFORM public.sgp_pdt_exigir_panel_v3(p.id_pendiente);
 SELECT * INTO e FROM public.sgp_pdt_entrega_lineas WHERE clave=p_clave;
 IF FOUND THEN
  IF e.id_detalle<>p_detalle OR e.id_entrega<>p_entrega OR e.cantidad<>p_cantidad THEN RAISE EXCEPTION 'Clave reutilizada'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicado',true,'id_linea',e.id_linea);
 END IF;
 IF p.contrato_pdt<>'V2' OR p.estado<>'PENDIENTE' OR p.validacion_estado<>'VALIDADO' THEN RAISE EXCEPTION 'PDT no apto'; END IF;
 PERFORM 1 FROM public.sgp_picking_entregas WHERE id_entrega=p_entrega FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Entrega inexistente'; END IF;
 PERFORM 1 FROM public.sgp_mecanizado_programacion mp JOIN public.sgp_picking_entregas pe_lock USING(id_programacion) WHERE pe_lock.id_entrega=p_entrega FOR UPDATE OF mp;
 -- Explicit event identity, not global order status or missing quantities.
 PERFORM 1 FROM public.sgp_picking_entregas pe
 JOIN public.sgp_mecanizado_programacion mp ON mp.id_programacion=pe.id_programacion
 JOIN public.sgp_producciones prod ON prod.key_produccion=p.key_produccion
 WHERE pe.id_entrega=p_entrega AND pe.produccion=prod.produccion
 AND upper(btrim(mp.sistema))=upper(btrim(prod.sistema))
 AND (mp.reserva=p.reserva OR public.sgp_mecanizado_es_parte(mp.id_programacion)) AND sgp_mecanizado_parcial.material_pdt(p.id_pendiente,pe.id_entrega,d.acabado)
 AND EXISTS(SELECT 1 FROM public.sgp_pdt_fuentes f WHERE f.id_detalle=d.id_detalle
 AND upper(btrim(f.snapshot->>'sistema'))=upper(btrim(mp.sistema))
 AND f.snapshot->>'key_produccion'=p.key_produccion);
 IF NOT FOUND THEN RAISE EXCEPTION 'Entrega ajena o identidad incompleta'; END IF;
 SELECT coalesce(sum(CASE WHEN tipo='AVANCE' THEN cantidad ELSE -cantidad END),0) INTO neto
 FROM public.sgp_aluminio_pendiente_movimientos WHERE id_detalle=p_detalle;
 IF p_cantidad+coalesce((SELECT sum(cantidad) FROM public.sgp_pdt_entrega_lineas WHERE id_detalle=p_detalle AND estado<>'ANULADA'),0)>neto
 THEN RAISE EXCEPTION 'Entrega supera procesado'; END IF;
 INSERT INTO public.sgp_pdt_entrega_lineas(id_entrega,id_detalle,id_pieza,cantidad,clave,registrado_por)
 VALUES(p_entrega,p_detalle,d.id_pieza,p_cantidad,p_clave,u) RETURNING id_linea INTO nuevo;
 RETURN jsonb_build_object('ok',true,'id_linea',nuevo);
END $function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_pdt_multiorigen.original_sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'::regprocedure)) where firma='sgp_pdt_multiorigen.original_sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_pdt_multiorigen.grouped_original_entrega(text,uuid,uuid,integer,uuid)',pg_get_functiondef('sgp_pdt_multiorigen.grouped_original_entrega(text,uuid,uuid,integer,uuid)'::regprocedure),null);

CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.grouped_original_entrega(p_token text, p_detalle uuid, p_entrega uuid, p_cantidad integer, p_clave uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE d public.sgp_aluminio_pendiente_detalles%rowtype; p public.sgp_aluminio_pendientes%rowtype;
 e public.sgp_pdt_entrega_lineas%rowtype; u text; nuevo uuid; neto bigint;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING']);
 IF p_cantidad IS NULL OR p_cantidad<=0 OR p_clave IS NULL THEN RAISE EXCEPTION 'Cantidad/clave inválida'; END IF;
 SELECT * INTO STRICT d FROM public.sgp_aluminio_pendiente_detalles WHERE id_detalle=p_detalle;
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=d.id_pendiente FOR UPDATE;
 PERFORM public.sgp_pdt_exigir_panel_v3(p.id_pendiente);
 SELECT * INTO e FROM public.sgp_pdt_entrega_lineas WHERE clave=p_clave;
 IF FOUND THEN
  IF e.id_detalle<>p_detalle OR e.id_entrega<>p_entrega OR e.cantidad<>p_cantidad THEN RAISE EXCEPTION 'Clave reutilizada'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicado',true,'id_linea',e.id_linea);
 END IF;
 IF p.contrato_pdt<>'V2' OR p.estado<>'PENDIENTE' OR p.validacion_estado<>'VALIDADO' THEN RAISE EXCEPTION 'PDT no apto'; END IF;
 PERFORM 1 FROM public.sgp_picking_entregas WHERE id_entrega=p_entrega FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Entrega inexistente'; END IF;
 PERFORM 1 FROM public.sgp_mecanizado_programacion mp JOIN public.sgp_picking_entregas pe_lock USING(id_programacion) WHERE pe_lock.id_entrega=p_entrega FOR UPDATE OF mp;
 -- Explicit event identity, not global order status or missing quantities.
 PERFORM 1 FROM public.sgp_picking_entregas pe
 JOIN public.sgp_mecanizado_programacion mp ON mp.id_programacion=pe.id_programacion
 JOIN public.sgp_producciones prod ON prod.key_produccion=p.key_produccion
 WHERE pe.id_entrega=p_entrega AND pe.produccion=prod.produccion
 AND upper(btrim(mp.sistema))=upper(btrim(prod.sistema))
 AND (mp.reserva=p.reserva OR public.sgp_mecanizado_es_parte(mp.id_programacion)) AND sgp_mecanizado_parcial.material_pdt(p.id_pendiente,pe.id_entrega,d.acabado)
 AND EXISTS(SELECT 1 FROM public.sgp_pdt_fuentes f WHERE f.id_detalle=d.id_detalle
 AND upper(btrim(f.snapshot->>'sistema'))=upper(btrim(mp.sistema))
 AND f.snapshot->>'key_produccion'=p.key_produccion);
 IF NOT FOUND THEN RAISE EXCEPTION 'Entrega ajena o identidad incompleta'; END IF;
 SELECT coalesce(sum(CASE WHEN tipo='AVANCE' THEN cantidad ELSE -cantidad END),0) INTO neto
 FROM public.sgp_aluminio_pendiente_movimientos WHERE id_detalle=p_detalle;
 IF p_cantidad+coalesce((SELECT sum(cantidad) FROM public.sgp_pdt_entrega_lineas WHERE id_detalle=p_detalle AND estado<>'ANULADA'),0)>neto
 THEN RAISE EXCEPTION 'Entrega supera procesado'; END IF;
 INSERT INTO public.sgp_pdt_entrega_lineas(id_entrega,id_detalle,id_pieza,cantidad,clave,registrado_por)
 VALUES(p_entrega,p_detalle,'',p_cantidad,p_clave,u) RETURNING id_linea INTO nuevo;
 RETURN jsonb_build_object('ok',true,'id_linea',nuevo);
END $function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_pdt_multiorigen.grouped_original_entrega(text,uuid,uuid,integer,uuid)'::regprocedure)) where firma='sgp_pdt_multiorigen.grouped_original_entrega(text,uuid,uuid,integer,uuid)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_pdt_multiorigen.original_sgp_pdt_cierre_acreditado(uuid)',pg_get_functiondef('sgp_pdt_multiorigen.original_sgp_pdt_cierre_acreditado(uuid)'::regprocedure),null);

CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.original_sgp_pdt_cierre_acreditado(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.sgp_pdt_cierres WHERE id_pendiente=p_id)
 AND EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=p_id)
 AND NOT EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d WHERE d.id_pendiente=p_id AND (
 d.cantidad_validada<>(SELECT coalesce(sum(CASE WHEN m.tipo='AVANCE' THEN m.cantidad ELSE -m.cantidad END),0) FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_detalle=d.id_detalle)
 OR d.cantidad_validada<>(SELECT coalesce(sum(a.cantidad),0) FROM public.sgp_pdt_asignaciones a
 JOIN public.sgp_pdt_entrega_lineas l USING(id_linea) JOIN public.sgp_picking_entregas e ON e.id_entrega=l.id_entrega
 JOIN public.sgp_mecanizado_programacion mp ON mp.id_programacion=e.id_programacion
 JOIN public.sgp_pdt_fuentes f ON f.id_detalle=a.id_detalle
 JOIN public.sgp_aluminio_pendientes p ON p.id_pendiente=d.id_pendiente
 WHERE a.id_detalle=d.id_detalle AND l.estado='VALIDADA' AND e.estado='VALIDADA'
 AND e.produccion=p.produccion AND (mp.reserva=p.reserva OR public.sgp_mecanizado_es_parte(mp.id_programacion))
 AND upper(btrim(mp.sistema))=upper(btrim(f.snapshot->>'sistema'))
 AND sgp_mecanizado_parcial.material_pdt(p.id_pendiente,e.id_entrega,d.acabado))));
$function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_pdt_multiorigen.original_sgp_pdt_cierre_acreditado(uuid)'::regprocedure)) where firma='sgp_pdt_multiorigen.original_sgp_pdt_cierre_acreditado(uuid)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_pdt_multiorigen.grouped_original_cierre_acreditado(uuid)',pg_get_functiondef('sgp_pdt_multiorigen.grouped_original_cierre_acreditado(uuid)'::regprocedure),null);

CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.grouped_original_cierre_acreditado(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.sgp_pdt_cierres WHERE id_pendiente=p_id)
 AND EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=p_id)
 AND NOT EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d WHERE d.id_pendiente=p_id AND (
 d.cantidad_validada<>(SELECT coalesce(sum(CASE WHEN m.tipo='AVANCE' THEN m.cantidad ELSE -m.cantidad END),0) FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_detalle=d.id_detalle)
 OR d.cantidad_validada<>(SELECT coalesce(sum(a.cantidad),0) FROM public.sgp_pdt_asignaciones a
 JOIN public.sgp_pdt_entrega_lineas l USING(id_linea) JOIN public.sgp_picking_entregas e ON e.id_entrega=l.id_entrega
 JOIN public.sgp_mecanizado_programacion mp ON mp.id_programacion=e.id_programacion

 JOIN public.sgp_aluminio_pendientes p ON p.id_pendiente=d.id_pendiente
 WHERE a.id_detalle=d.id_detalle AND l.estado='VALIDADA' AND e.estado='VALIDADA'
 AND e.produccion=p.produccion AND (mp.reserva=p.reserva OR public.sgp_mecanizado_es_parte(mp.id_programacion))
 AND EXISTS(SELECT 1 FROM public.sgp_pdt_fuentes f WHERE f.id_detalle=a.id_detalle AND upper(btrim(mp.sistema))=upper(btrim(f.snapshot->>'sistema')))
 AND sgp_mecanizado_parcial.material_pdt(p.id_pendiente,e.id_entrega,d.acabado))));
$function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_pdt_multiorigen.grouped_original_cierre_acreditado(uuid)'::regprocedure)) where firma='sgp_pdt_multiorigen.grouped_original_cierre_acreditado(uuid)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_pdt_multiorigen.original_sgp_pdt_picking_v2(text,uuid)',pg_get_functiondef('sgp_pdt_multiorigen.original_sgp_pdt_picking_v2(text,uuid)'::regprocedure),null);

CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.original_sgp_pdt_picking_v2(p_token text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE p public.sgp_aluminio_pendientes%rowtype;
BEGIN
 PERFORM public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION','PICKING','SUPERVISOR DE PICKING','LIDER MECANIZADO','LIDER']);
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id;
 IF p.contrato_pdt<>'V2' THEN RAISE EXCEPTION 'PDT no V2'; END IF;
 RETURN jsonb_build_object('ok',true,'entregas',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (
  SELECT pe.id_entrega,pe.estado,pe.completa,pe.produccion FROM public.sgp_picking_entregas pe
  JOIN public.sgp_mecanizado_programacion mp USING(id_programacion)
  JOIN public.sgp_producciones prod ON prod.key_produccion=p.key_produccion
  WHERE pe.produccion=prod.produccion AND upper(btrim(mp.sistema))=upper(btrim(prod.sistema))
  AND (mp.reserva=p.reserva OR public.sgp_mecanizado_es_parte(mp.id_programacion)) AND sgp_mecanizado_parcial.material_pdt(p.id_pendiente,pe.id_entrega,p.acabado_pendiente)
 )x),'[]'::jsonb),'lineas',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('asignada',EXISTS(
 SELECT 1 FROM public.sgp_pdt_asignaciones a WHERE a.id_linea=l.id_linea)))
 FROM public.sgp_pdt_entrega_lineas l JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle)
 WHERE d.id_pendiente=p_id),'[]'::jsonb));
END $function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_pdt_multiorigen.original_sgp_pdt_picking_v2(text,uuid)'::regprocedure)) where firma='sgp_pdt_multiorigen.original_sgp_pdt_picking_v2(text,uuid)';

insert into sgp_mecanizado_parcial.respaldo_funciones values('sgp_picking_validar_recepcion(text,uuid,jsonb,jsonb,text)',pg_get_functiondef('sgp_picking_validar_recepcion(text,uuid,jsonb,jsonb,text)'::regprocedure),null);

CREATE OR REPLACE FUNCTION public.sgp_picking_validar_recepcion(p_token text, p_id_entrega uuid, p_faltantes jsonb DEFAULT '[]'::jsonb, p_diferencias jsonb DEFAULT '[]'::jsonb, p_observacion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare u text; e record; f jsonb; d jsonb; v_diff boolean:=false; v_key text; v_shared boolean:=false; v_principal text; v_pending_res text; v_finish text; v_nuevo uuid;
begin
 u:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA','LIDER']);
 select pe.*,mp.reserva into e from public.sgp_picking_entregas pe join public.sgp_mecanizado_programacion mp on mp.id_programacion=pe.id_programacion where pe.id_entrega=p_id_entrega for update;
 if e.id_entrega is null then raise exception 'Entrega no encontrada'; end if;
 if e.estado<>'PENDIENTE_VALIDACION' then raise exception 'La entrega ya fue auditada'; end if;
 select v.key_produccion,v.reserva_principal,bool_or(v.es_reserva_compartida)
 into v_key,v_principal,v_shared
 from public.sgp_produccion_reservas_v v
 where v.produccion=e.produccion and v.reserva_principal=e.reserva
 group by v.key_produccion,v.reserva_principal
 order by max(v.semana_produccion) desc limit 1;
 v_principal:=coalesce(v_principal,e.reserva);v_shared:=coalesce(v_shared,false);

 if public.sgp_mecanizado_es_parte(e.id_programacion) then
  select pt.key_produccion,mp.reserva,public.sgp_es_reserva_compartida(pt.key_produccion)
  into strict v_key,v_principal,v_shared from sgp_mecanizado_parcial.partes pt
  join public.sgp_mecanizado_programacion mp using(id_programacion) where pt.id_programacion=e.id_programacion;
 end if;
 for f in select value from jsonb_array_elements(coalesce(p_faltantes,'[]')) loop
  if public.sgp_mecanizado_es_parte(e.id_programacion) and (f->>'ventanas_afectadas')::integer>(select cantidad from sgp_mecanizado_parcial.partes where id_programacion=e.id_programacion) then raise exception 'VENTANAS_AFECTADAS_SUPERAN_PARTE'; end if;
  if public.sgp_mecanizado_es_parte(e.id_programacion) and not exists(
   select 1 from public.sgp_picking_faltantes pf where pf.id_faltante=(f->>'id_faltante')::uuid
   and pf.id_entrega=p_id_entrega and pf.id_pieza is not distinct from nullif(f->>'id_pieza','')
  ) then raise exception 'FALTANTE_AJENO_A_ENTREGA'; end if;
  if coalesce((f->>'ventanas_afectadas')::int,0)<1 then raise exception 'Indique las ventanas afectadas de cada faltante'; end if;
  update public.sgp_picking_faltantes set ventanas_afectadas=(f->>'ventanas_afectadas')::int,auditado=true,usuario_auditoria=u,fecha_auditoria=now()
   where id_faltante=(f->>'id_faltante')::uuid and id_entrega=p_id_entrega;
  update public.sgp_aluminio_pendientes set ventanas_afectadas=(f->>'ventanas_afectadas')::int,auditado=true
   where produccion=e.produccion and id_pieza is not distinct from nullif(f->>'id_pieza','') and estado='PENDIENTE'
     and (reserva=e.reserva or reserva=(select pf.reserva_pendiente from public.sgp_picking_faltantes pf where pf.id_faltante=(f->>'id_faltante')::uuid)) and (not public.sgp_mecanizado_es_parte(e.id_programacion) or exists(select 1 from sgp_mecanizado_parcial.contextos_pdt src where src.id_pendiente=public.sgp_aluminio_pendientes.id_pendiente and src.id_entrega=p_id_entrega));
 end loop;
 for d in select value from jsonb_array_elements(coalesce(p_diferencias,'[]')) loop
  if public.sgp_mecanizado_es_parte(e.id_programacion) and (nullif(d->>'id_pieza','') is null or (d->>'cantidad') is null or (d->>'cantidad')::numeric<=0 or (d->>'cantidad')::numeric<>trunc((d->>'cantidad')::numeric) or (d->>'cantidad')::numeric>(select cantidad from public.sgp_aluminio where id_pieza=d->>'id_pieza')) then raise exception 'CANTIDAD_MATERIAL_INVALIDA'; end if;
  if public.sgp_mecanizado_es_parte(e.id_programacion) and coalesce((d->>'ventanas_afectadas')::integer,1)>(select cantidad from sgp_mecanizado_parcial.partes where id_programacion=e.id_programacion) then raise exception 'VENTANAS_AFECTADAS_SUPERAN_PARTE'; end if;
  v_diff:=true;
  v_pending_res:=coalesce(nullif(trim(d->>'reserva'),''),e.reserva);
  if v_key is not null and not exists(select 1 from public.sgp_produccion_reservas_v v where v.key_produccion=v_key and v.reserva=v_pending_res) then
    raise exception 'Seleccione una reserva válida para la diferencia de la orden con reserva compartida';
  end if;
  select v.acabado_reserva into v_finish from public.sgp_produccion_reservas_v v where v.key_produccion=v_key and v.reserva=v_pending_res limit 1;
  v_finish:=coalesce(nullif(trim(d->>'acabado'),''),v_finish);
  insert into public.sgp_picking_auditoria_diferencias(id_entrega,id_pieza,perfil,marca,fabricacion,longitud,cantidad,ventanas_afectadas,observacion,usuario_auditoria,reserva_pendiente,acabado_pendiente)
  values(p_id_entrega,nullif(d->>'id_pieza',''),d->>'perfil',nullif(d->>'marca',''),nullif(d->>'fabricacion',''),nullif(d->>'longitud','')::numeric,
         greatest(coalesce((d->>'cantidad')::numeric,1),1),greatest(coalesce((d->>'ventanas_afectadas')::int,1),1),nullif(d->>'observacion',''),u,v_pending_res,v_finish);
  insert into public.sgp_aluminio_pendientes(
    reserva,reserva_principal,key_produccion,es_reserva_compartida,acabado_pendiente,
    produccion,perfil,cantidad,longitud,origen,causa,observacion,estado,usuario_reporte,id_pieza,marca,fabricacion,estado_repo,ventanas_afectadas,auditado
  ) values(
    v_pending_res,v_principal,v_key,v_shared,v_finish,e.produccion,d->>'perfil',
    greatest(coalesce((d->>'cantidad')::numeric,1),1),nullif(d->>'longitud','')::numeric,
    'PICKING_AUDITORIA','DIFERENCIA_AUDITORIA',nullif(d->>'observacion',''),'PENDIENTE',u,
    nullif(d->>'id_pieza',''),nullif(d->>'marca',''),nullif(d->>'fabricacion',''),'PENDIENTE',
    greatest(coalesce((d->>'ventanas_afectadas')::int,1),1),true
  ) returning id_pendiente into v_nuevo;
  if public.sgp_mecanizado_es_parte(e.id_programacion) then insert into sgp_mecanizado_parcial.origenes_pdt values(v_nuevo,p_id_entrega); end if;
 end loop;
 update public.sgp_picking_entregas set estado=case when v_diff then 'AUDITADA_DIFERENCIA' else 'VALIDADA' end,usuario_validacion=u,fecha_validacion=now(),
  observacion_validacion=nullif(trim(coalesce(p_observacion,'')),'') where id_entrega=p_id_entrega;
 return jsonb_build_object('ok',true,'estado',case when v_diff then 'AUDITADA_DIFERENCIA' else 'VALIDADA' end);
end $function$
;

update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('sgp_picking_validar_recepcion(text,uuid,jsonb,jsonb,text)'::regprocedure)) where firma='sgp_picking_validar_recepcion(text,uuid,jsonb,jsonb,text)';

create function sgp_mecanizado_parcial.auditar_estado() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from sgp_mecanizado_parcial.partes where id_programacion=new.id_programacion) then
  insert into sgp_mecanizado_parcial.movimientos(id_programacion,tipo,anterior,nuevo,usuario)
  values(new.id_programacion,'ESTADO',case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new),new.usuario);
 end if; return new;
end $$;
create trigger parcial_auditar_estado after insert or update on public.sgp_mecanizado_ejecucion_orden
for each row execute function sgp_mecanizado_parcial.auditar_estado();

-- Legacy reprogramming cannot transfer/delete the immutable detail of a new part.
create function sgp_mecanizado_parcial.proteger_detalle() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from sgp_mecanizado_parcial.partes where id_programacion=old.id_programacion) then
  raise exception 'DETALLE_DE_PARTE_INMUTABLE'; end if;
 return coalesce(new,old);
end $$;
create trigger parcial_proteger_detalle before update or delete on public.sgp_mecanizado_programacion_detalle
for each row execute function sgp_mecanizado_parcial.proteger_detalle();

create function sgp_mecanizado_parcial.proteger_agregado() returns trigger language plpgsql set search_path='' as $$
begin
 if not public.sgp_mecanizado_es_parte(coalesce(new.id_programacion,old.id_programacion)) then return coalesce(new,old); end if;
 if current_user<>'postgres' then raise exception 'USAR_RPC_DE_PARTES'; end if;
 if tg_op='DELETE' then raise exception 'HISTORIAL_DE_PARTE_INMUTABLE'; end if;
 if new.estado is distinct from (select estado from public.sgp_mecanizado_ejecucion_orden where id_programacion=new.id_programacion)
 or new.cantidad_procesada is distinct from (select case when new.estado='PROCESADO' then pt.cantidad else 0 end from sgp_mecanizado_parcial.partes pt where pt.id_programacion=new.id_programacion) then
  raise exception 'AVANCE_AGREGADO_DE_PARTE_INCONSISTENTE'; end if;
 return new;
end $$;
create trigger parcial_proteger_agregado before insert or update or delete on public.sgp_mecanizado_ejecucion
for each row execute function sgp_mecanizado_parcial.proteger_agregado();

-- Guard old Picking entry points and direct writes. The V4 wrapper supplies the gate.
create function sgp_mecanizado_parcial.proteger_entrega() returns trigger language plpgsql set search_path='' as $$
begin
 if not public.sgp_mecanizado_es_parte(coalesce(new.id_programacion,old.id_programacion)) then return coalesce(new,old); end if;
 if current_user<>'postgres' then raise exception 'USAR_RPC_DE_PARTES'; end if;
 if tg_op='INSERT' then
  if current_setting('sgp.parte_entrega',true) is distinct from new.id_programacion::text then raise exception 'INDICAR_CANTIDAD_DE_VENTANAS_ENTREGADAS'; end if;
 elsif tg_op='DELETE' then raise exception 'HISTORIAL_DE_ENTREGA_INMUTABLE';
 elsif (new.id_programacion,new.produccion,new.completa) is distinct from (old.id_programacion,old.produccion,old.completa) then
  raise exception 'IDENTIDAD_DE_ENTREGA_INMUTABLE';
 end if;
 return coalesce(new,old);
end $$;
create trigger parcial_proteger_entrega before insert or update or delete on public.sgp_picking_entregas
for each row execute function sgp_mecanizado_parcial.proteger_entrega();

create function public.sgp_mecanizado_partes_resumen(p_token text,p_desde date,p_hasta date)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','CONSULTA','PICKING','SUPERVISOR DE PICKING']);
 if p_desde is null or p_hasta is null or p_hasta<p_desde or p_hasta-p_desde>366 then raise exception 'RANGO_INVALIDO'; end if;
 return coalesce((select jsonb_agg(to_jsonb(t)) from (
 select mp.fecha_programacion fecha,mp.turno,count(distinct pt.key_produccion) producciones,count(*) partes,
 sum(pt.cantidad) programadas,sum(case when coalesce(eo.estado,me.estado)='PROCESADO' then pt.cantidad else 0 end) procesadas,
 sum(case when coalesce(eo.estado,me.estado,'SIN INICIAR')<>'PROCESADO' then pt.cantidad else 0 end) pendientes,
 sum(coalesce((select sum(en.cantidad) from sgp_mecanizado_parcial.entregas en join public.sgp_picking_entregas pe using(id_entrega)
 where en.id_programacion=pt.id_programacion and pe.estado='VALIDADA'),0)) entregadas_validadas
 from sgp_mecanizado_parcial.partes pt join public.sgp_mecanizado_programacion mp using(id_programacion)
 left join public.sgp_mecanizado_ejecucion_orden eo on eo.id_programacion=pt.id_programacion and eo.produccion=mp.produccion
 left join public.sgp_mecanizado_ejecucion me on me.id_programacion=pt.id_programacion
 where mp.estado<>'CANCELADA' and mp.fecha_programacion between p_desde and p_hasta
 group by mp.fecha_programacion,mp.turno order by mp.fecha_programacion,mp.turno
 ) t),'[]');
end $$;
revoke all on function public.sgp_mecanizado_partes_resumen(text,date,date) from public;
grant execute on function public.sgp_mecanizado_partes_resumen(text,date,date) to anon,authenticated;

revoke all on all functions in schema sgp_mecanizado_parcial from public,anon,authenticated;
notify pgrst,'reload schema';
commit;

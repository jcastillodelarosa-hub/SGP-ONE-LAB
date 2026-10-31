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

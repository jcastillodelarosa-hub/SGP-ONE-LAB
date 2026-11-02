-- REVIEW ONLY. Never run automatically; production requires an approved window.
-- Canonical ownership: first token of sgp_producciones.reserva_al owns 100%.
-- CREATE OR REPLACE retains each installed function's owner and EXECUTE grants.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $preflight$
BEGIN
 IF md5(pg_get_functiondef('public.sgp_mecanizado_disponibles(text,integer)'::regprocedure)) <> '1f2ffd91589d99a08834e772a938788d' THEN
   RAISE EXCEPTION 'CATALOGO_CAMBIO: sgp_mecanizado_disponibles(text,integer)';
 END IF;
 IF md5(pg_get_functiondef('public.sgp_mecanizado_programar(text,text,text,integer,date,text,integer,text,text,text)'::regprocedure)) <> '4c70cdd648bb5036dfe8e75c4985ade8' THEN
   RAISE EXCEPTION 'CATALOGO_CAMBIO: sgp_mecanizado_programar 10 parametros';
 END IF;
 IF to_regprocedure('public.sgp_mecanizado_partes_programar(text,text,text,jsonb,uuid)') IS NOT NULL
    AND md5(pg_get_functiondef(to_regprocedure('public.sgp_mecanizado_partes_programar(text,text,text,jsonb,uuid)'))) <> 'ad42a437d5e8e0618af660ea8e67274c' THEN
   RAISE EXCEPTION 'CATALOGO_CAMBIO: sgp_mecanizado_partes_programar';
 END IF;
END $preflight$;

CREATE OR REPLACE FUNCTION public.sgp_mecanizado_disponibles(p_token text, p_semana integer DEFAULT NULL::integer)
 RETURNS TABLE(reserva text, semana integer, sistema text, acabado text, cantidad integer, vidrio_cant numeric, vidrio_pct numeric, ordenes jsonb, prioridades_semanales jsonb, partes jsonb, grupo integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
begin
 perform public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER','CONSULTA']);
 return query
 with prog as (
  select sp.*,pr.prioridad prioridad_semanal,
         nullif(trim(split_part(coalesce(sp.reserva_al,''),',',1)), '') reserva_principal
  from public.sgp_producciones sp
  left join public.sgp_prioridades pr on pr.key_produccion=sp.key_produccion
       and pr.id_linea='PANELES_2'
       and pr.semana=coalesce(sp.semana_actual,sp.semana_base)
       and pr.reserva=nullif(trim(split_part(coalesce(sp.reserva_al,''),',',1)), '')
  where sp.id_linea='PANELES_2' and coalesce(sp.reserva_al,'')<>''
    and (p_semana is null or coalesce(sp.semana_actual,sp.semana_base)=p_semana)
 ), f as (
  select p.*,s.estado_reserva_fuente,
   public.sgp_vidrio_cant_actual(p.key_produccion,p.cantidad,s.vent_cant_vidrio) vent_cant_vidrio,
   public.sgp_vidrio_pct_actual(p.key_produccion,s.porcentaje_vidrio) porcentaje_vidrio,s.tipo_orden,
   coalesce((select string_agg(distinct nullif(trim(v.datos_origen->>'Tipo V'),''),' / ' order by nullif(trim(v.datos_origen->>'Tipo V'),''))
             from public.sgp_vidrio v where v.key_produccion=p.key_produccion and coalesce(v.activo,'SI')='SI'),'—') tipo_vidrio,
   public.sgp_reservas_por_produccion_json(p.key_produccion) reservas_compartidas
  from prog p
  left join public.sgp_seguimiento_aluminio s on s.id=p.id and s.reserva=p.reserva_principal
       and coalesce(s.activo,'SI')='SI' and s.linea_prog='PANELES 2'
 ), parts as (
  select z.reserva_principal,z.prioridad_semanal,sum(z.cantidad)::int cantidad,
   round(sum(least(coalesce(z.vent_cant_vidrio,0),z.cantidad)),1) vidrio_cant,
   case when sum(z.cantidad)>0 then round(100*sum(least(coalesce(z.vent_cant_vidrio,0),z.cantidad))/sum(z.cantidad),1) else 0 end vidrio_pct,
   jsonb_agg(jsonb_build_object(
      'produccion',z.produccion,'key',z.id,'key_produccion',z.key_produccion,'cantidad',z.cantidad::int,
      'vidrio_cant',round(coalesce(z.vent_cant_vidrio,0),1),'vidrio_pct',coalesce(z.porcentaje_vidrio,0),
      'tipo_vidrio',z.tipo_vidrio,'prioridad_semanal',z.prioridad_semanal,
      'reserva_compartida',public.sgp_es_reserva_compartida(z.key_produccion),
      'reservas_compartidas',z.reservas_compartidas
   ) order by z.produccion) ordenes
  from f z where z.prioridad_semanal is not null
  group by z.reserva_principal,z.prioridad_semanal
 ), agg as (
  select z.reserva_principal,min(coalesce(z.semana_actual,z.semana_base))::int semana,case when count(distinct z.sistema)=1 then min(z.sistema) else 'MIXTO' end sistema,case when count(distinct z.acabado)=1 then min(z.acabado) else 'MIXTO' end acabado,sum(z.cantidad)::int cantidad,
   round(sum(least(coalesce(z.vent_cant_vidrio,0),z.cantidad)),1) vidrio_cant,
   case when sum(z.cantidad)>0 then round(100*sum(least(coalesce(z.vent_cant_vidrio,0),z.cantidad))/sum(z.cantidad),1) else 0 end vidrio_pct,
   jsonb_agg(jsonb_build_object(
      'produccion',z.produccion,'key',z.id,'key_produccion',z.key_produccion,'cantidad',z.cantidad::int,
      'vidrio_cant',round(coalesce(z.vent_cant_vidrio,0),1),'vidrio_pct',coalesce(z.porcentaje_vidrio,0),
      'tipo_vidrio',z.tipo_vidrio,'estado',z.estado_reserva_fuente,'tipo',coalesce(z.tipo_orden,z.tipo),
      'prioridad_semanal',z.prioridad_semanal,
      'reserva_compartida',public.sgp_es_reserva_compartida(z.key_produccion),
      'reservas_compartidas',z.reservas_compartidas
   ) order by split_part(z.prioridad_semanal,'.',1)::numeric,coalesce(nullif(split_part(z.prioridad_semanal,'.',2),''),'0')::numeric,coalesce(nullif(split_part(z.prioridad_semanal,'.',3),''),'0')::numeric,z.produccion) ordenes,
   coalesce(jsonb_agg(distinct z.prioridad_semanal) filter(where z.prioridad_semanal is not null),'[]'::jsonb) prioridades,
   coalesce((select jsonb_agg(jsonb_build_object('prioridad',x.prioridad_semanal,'cantidad',x.cantidad,'vidrio_cant',x.vidrio_cant,'vidrio_pct',x.vidrio_pct,'ordenes',x.ordenes)
               order by split_part(x.prioridad_semanal,'.',1)::numeric,coalesce(nullif(split_part(x.prioridad_semanal,'.',2),''),'0')::numeric,coalesce(nullif(split_part(x.prioridad_semanal,'.',3),''),'0')::numeric)
             from parts x where x.reserva_principal=z.reserva_principal),'[]'::jsonb) partes,
   case when bool_or(public.sgp_estado_operativo_aluminio(z.reserva_principal,z.estado_reserva_fuente)='OK / ENTREGADA EN SISTEMA') then 1
        when bool_or(public.sgp_estado_operativo_aluminio(z.reserva_principal,z.estado_reserva_fuente)='RECIBIDA SIN LEGALIZAR') then 2
        when bool_or(public.sgp_estado_operativo_aluminio(z.reserva_principal,z.estado_reserva_fuente)='PENDIENTE BODEGA') then 3
        when bool_or(public.sgp_estado_operativo_aluminio(z.reserva_principal,z.estado_reserva_fuente)='PENDIENTE ABASTECIMIENTO') then 4
        else 5 end grupo
  from f z group by z.reserva_principal
 )
 select a.reserva_principal,a.semana,a.sistema,a.acabado,a.cantidad,a.vidrio_cant,a.vidrio_pct,a.ordenes,a.prioridades,a.partes,a.grupo from agg a;
end $function$;

CREATE OR REPLACE FUNCTION public.sgp_mecanizado_programar(p_token text, p_reserva text, p_produccion text, p_cantidad integer, p_fecha date, p_turno text, p_prioridad integer, p_observacion text, p_observacion_orden text, p_prioridad_semanal text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 u text; rid uuid; v_sistema text; v_acabado text; v_pct numeric; v_vidrio numeric;
 total_disponible integer; total_cubierto integer; v_scope_qty integer; v_key text;
begin
 u:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR']);
 -- Coordinate with partial programming and the detail trigger, before computing any saldo.
 -- Sorted keys make concurrent group requests acquire locks in a stable order.
 for v_key in
   select distinct sp.key_produccion
   from public.sgp_prioridades pr
   join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion
   where pr.reserva=p_reserva and pr.id_linea='PANELES_2' and sp.id_linea='PANELES_2'
     and nullif(trim(split_part(coalesce(sp.reserva_al,''),',',1)), '')=p_reserva
     and (p_prioridad_semanal is null or pr.prioridad=p_prioridad_semanal)
     and (p_produccion is null or sp.produccion=p_produccion)
   order by sp.key_produccion
 loop
   perform 1 from public.sgp_producciones where key_produccion=v_key for no key update;
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key,742));
 end loop;


 with scope as (
   select sp.*
   from public.sgp_prioridades pr
   join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion
   where pr.reserva=p_reserva and pr.id_linea='PANELES_2' and sp.id_linea='PANELES_2'
     and nullif(trim(split_part(coalesce(sp.reserva_al,''),',',1)), '')=p_reserva
     and (p_prioridad_semanal is null or pr.prioridad=p_prioridad_semanal)
     and (p_produccion is null or sp.produccion=p_produccion)
 ), covered_keys as (
   select distinct d.key_produccion
   from public.sgp_mecanizado_programacion mp
   join public.sgp_mecanizado_programacion_detalle d on d.id_programacion=mp.id_programacion
   where mp.estado<>'CANCELADA'

 )
 select coalesce(sum(s.cantidad),0)::int,
        coalesce(sum(s.cantidad) filter(where ck.key_produccion is not null),0)::int
 into total_disponible,total_cubierto
 from scope s left join covered_keys ck on ck.key_produccion=s.key_produccion;

 if total_cubierto=0 then
   select coalesce(sum(mp.cantidad_programada),0)::int into total_cubierto
   from public.sgp_mecanizado_programacion mp
   where mp.reserva=p_reserva and mp.estado<>'CANCELADA'
     and mp.prioridad_semanal is not distinct from p_prioridad_semanal
     and (p_produccion is null or mp.produccion=p_produccion);
 end if;

 if p_cantidad<1 or p_cantidad>greatest(total_disponible-total_cubierto,0) then
   raise exception 'Cantidad supera el saldo pendiente por programar (% ventanas)',greatest(total_disponible-total_cubierto,0);
 end if;

 select sp.sistema,sp.acabado,
   case when sum(sp.cantidad)>0 then round(100*sum(least(coalesce(sa.vent_cant_vidrio,0),sp.cantidad))/sum(sp.cantidad),1) else 0 end,
   sum(least(coalesce(sa.vent_cant_vidrio,0),sp.cantidad))
 into v_sistema,v_acabado,v_pct,v_vidrio
 from public.sgp_prioridades pr
 join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion
 left join public.sgp_seguimiento_aluminio sa on sa.id=sp.id and sa.reserva=p_reserva and coalesce(sa.activo,'SI')='SI' and sa.linea_prog='PANELES 2'
 where pr.reserva=p_reserva and pr.id_linea='PANELES_2' and sp.id_linea='PANELES_2'
     and nullif(trim(split_part(coalesce(sp.reserva_al,''),',',1)), '')=p_reserva
   and (p_prioridad_semanal is null or pr.prioridad=p_prioridad_semanal)
   and (p_produccion is null or sp.produccion=p_produccion)
 group by sp.sistema,sp.acabado order by count(*) desc limit 1;

 insert into public.sgp_mecanizado_programacion(
   reserva,produccion,cantidad_programada,fecha_programacion,turno,prioridad,prioridad_semanal,
   observacion,observacion_orden,sistema,acabado,porc_vidrio_snapshot,cant_vidrio_snapshot,usuario_programa
 ) values(
   p_reserva,p_produccion,p_cantidad,p_fecha,p_turno,p_prioridad,p_prioridad_semanal,
   p_observacion,p_observacion_orden,v_sistema,v_acabado,v_pct,v_vidrio,u
 ) returning id_programacion into rid;

 with already as (
   select distinct d.key_produccion
   from public.sgp_mecanizado_programacion mp
   join public.sgp_mecanizado_programacion_detalle d on d.id_programacion=mp.id_programacion
   where mp.id_programacion<>rid and mp.estado<>'CANCELADA'

 ), scope as (
   select sp.key_produccion,sp.cantidad,sp.produccion
   from public.sgp_prioridades pr
   join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion
   left join already a on a.key_produccion=sp.key_produccion
   where pr.reserva=p_reserva and pr.id_linea='PANELES_2' and sp.id_linea='PANELES_2'
     and nullif(trim(split_part(coalesce(sp.reserva_al,''),',',1)), '')=p_reserva
     and (p_prioridad_semanal is null or pr.prioridad=p_prioridad_semanal)
     and (p_produccion is null or sp.produccion=p_produccion)
     and a.key_produccion is null
 )
 select coalesce(sum(cantidad),0)::int into v_scope_qty from scope;

 if v_scope_qty=p_cantidad then
   insert into public.sgp_mecanizado_programacion_detalle(
     id_programacion,key_produccion,cantidad_snapshot,reserva_snapshot,prioridad_semanal_snapshot,produccion_snapshot
   )
   with already as (
   select distinct d.key_produccion
   from public.sgp_mecanizado_programacion mp
   join public.sgp_mecanizado_programacion_detalle d on d.id_programacion=mp.id_programacion
   where mp.id_programacion<>rid and mp.estado<>'CANCELADA'

 ), scope as (
   select sp.key_produccion,sp.cantidad,sp.produccion
   from public.sgp_prioridades pr
   join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion
   left join already a on a.key_produccion=sp.key_produccion
   where pr.reserva=p_reserva and pr.id_linea='PANELES_2' and sp.id_linea='PANELES_2'
     and nullif(trim(split_part(coalesce(sp.reserva_al,''),',',1)), '')=p_reserva
     and (p_prioridad_semanal is null or pr.prioridad=p_prioridad_semanal)
     and (p_produccion is null or sp.produccion=p_produccion)
     and a.key_produccion is null
 )

   select rid,key_produccion,cantidad,p_reserva,p_prioridad_semanal,produccion from scope;
 else
   delete from public.sgp_mecanizado_programacion where id_programacion=rid;
   raise exception 'La composición canónica pendiente suma % ventanas y no coincide con la cantidad solicitada %. Recargue Programación antes de guardar.',v_scope_qty,p_cantidad;
 end if;

 return rid;
end $function$;

-- The partial RPC is optional in an older installation. If present, keep its
-- current contract but reject a secondary reservation before any insert.
DO $partial$
BEGIN
 IF to_regprocedure('public.sgp_mecanizado_partes_programar(text,text,text,jsonb,uuid)') IS NOT NULL THEN
   EXECUTE $definition$create or replace function public.sgp_mecanizado_partes_programar(p_token text,p_key text,p_reserva text,p_partes jsonb,p_clave uuid)
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
 if nullif(trim(split_part(coalesce(sp.reserva_al,''),',',1)), '') is distinct from p_reserva then raise exception 'RESERVA_NO_PRINCIPAL'; end if;
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
end $$;$definition$;
 END IF;
END $partial$;
COMMIT;

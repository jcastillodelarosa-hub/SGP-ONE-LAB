-- LAB v310 — PROPUESTA NO APLICADA: requiere autorización expresa para Supabase.
-- Origen: definiciones actuales consultadas en SGP-ONE-LAB el 2026-10-20.
-- Objetivo: ordenar 3.1.1 en Mecanizado y Picking, validar jerarquía y
-- bloquear la reasignación de reservas con programación activa.
-- NO ALTERA tablas, RLS, GRANT, sesiones ni identidades de programación.
-- PRECONDICIÓN: ejecutar pruebas en transacción con ROLLBACK y verificar
-- roles autorizados/no autorizados antes de aplicar en producción.
-- Rollback: restaurar las definiciones previas conservadas en el historial de Supabase.
BEGIN;
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
         coalesce(pr.reserva,nullif(trim(split_part(coalesce(sp.reserva_al,''),',',1)),'')) reserva_principal
  from public.sgp_producciones sp
  left join public.sgp_prioridades pr on pr.key_produccion=sp.key_produccion
       and pr.id_linea='PANELES_2'
       and pr.semana=coalesce(sp.semana_actual,sp.semana_base)
  where sp.id_linea='PANELES_2' and coalesce(sp.reserva_al,'')<>''
    and (p_semana is null or coalesce(sp.semana_actual,sp.semana_base)=p_semana)
 ), principal as (
  select distinct on(q.reserva_principal) q.reserva_principal,q.sistema,q.acabado
  from prog q
  where q.reserva_principal is not null
  group by q.reserva_principal,q.sistema,q.acabado
  order by q.reserva_principal,count(*) desc
 ), f as (
  select p.*,s.estado_reserva_fuente,
   public.sgp_vidrio_cant_actual(p.key_produccion,p.cantidad,s.vent_cant_vidrio) vent_cant_vidrio,
   public.sgp_vidrio_pct_actual(p.key_produccion,s.porcentaje_vidrio) porcentaje_vidrio,s.tipo_orden,
   coalesce((select string_agg(distinct nullif(trim(v.datos_origen->>'Tipo V'),''),' / ' order by nullif(trim(v.datos_origen->>'Tipo V'),''))
             from public.sgp_vidrio v where v.key_produccion=p.key_produccion and coalesce(v.activo,'SI')='SI'),'—') tipo_vidrio,
   public.sgp_reservas_por_produccion_json(p.key_produccion) reservas_compartidas
  from prog p
  join principal x on x.reserva_principal=p.reserva_principal and x.sistema=p.sistema and x.acabado=p.acabado
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
  select z.reserva_principal,min(coalesce(z.semana_actual,z.semana_base))::int semana,min(z.sistema) sistema,min(z.acabado) acabado,sum(z.cantidad)::int cantidad,
   round(sum(least(coalesce(z.vent_cant_vidrio,0),z.cantidad)),1) vidrio_cant,
   case when sum(z.cantidad)>0 then round(100*sum(least(coalesce(z.vent_cant_vidrio,0),z.cantidad))/sum(z.cantidad),1) else 0 end vidrio_pct,
   jsonb_agg(jsonb_build_object(
      'produccion',z.produccion,'key',z.id,'key_produccion',z.key_produccion,'cantidad',z.cantidad::int,
      'vidrio_cant',round(coalesce(z.vent_cant_vidrio,0),1),'vidrio_pct',coalesce(z.porcentaje_vidrio,0),
      'tipo_vidrio',z.tipo_vidrio,'estado',z.estado_reserva_fuente,'tipo',coalesce(z.tipo_orden,z.tipo),
      'prioridad_semanal',z.prioridad_semanal,
      'reserva_compartida',public.sgp_es_reserva_compartida(z.key_produccion),
      'reservas_compartidas',z.reservas_compartidas
   ) order by z.prioridad_semanal,z.produccion) ordenes,
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
end $function$
;
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
          pr.prioridad parte,min(coalesce(sp.semana_actual,sp.semana_base))::int semana,sum(sp.cantidad)::int cantidad_ventanas
   from base b
   join public.sgp_prioridades pr on pr.reserva=b.reserva and pr.id_linea='PANELES_2'
      and (b.prioridad_semanal is null or pr.prioridad=b.prioridad_semanal)
   join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion and sp.id_linea='PANELES_2' and sp.activa='SI'
   group by b.id_programacion,b.reserva,b.produccion,b.fecha_programacion,b.turno,b.prioridad,b.sistema,b.acabado,b.observacion,b.observacion_orden,b.estado_ejecucion,pr.prioridad
 ), filas as (
   select p.id_programacion,p.reserva,p.parte,p.produccion,p.fecha_programacion,p.turno,p.prioridad,
          p.cantidad_ventanas,p.sistema,p.acabado,p.observacion,p.observacion_orden,
          coalesce(p.estado_ejecucion,'PROGRAMADA') estado,
          (select count(*) from public.sgp_mecanizado_novedades n where n.id_programacion=p.id_programacion and n.estado<>'RESUELTA') novedades,
          (select pe.estado from public.sgp_picking_entregas pe where pe.id_programacion=p.id_programacion order by pe.fecha_entrega desc limit 1) estado_entrega,
          case coalesce(p.estado_ejecucion,'PROGRAMADA') when 'PROCESADO' then 0 when 'MECANIZADO' then 1 when 'CORTE' then 2 when 'PROGRAMADA' then 3 else 4 end orden_estado,
          p.semana,(lpad(coalesce(nullif(split_part(p.parte,'.',1),''),'999999'),9,'0')||'.'||lpad(coalesce(nullif(split_part(p.parte,'.',2),''),'0'),9,'0')||'.'||lpad(coalesce(nullif(split_part(p.parte,'.',3),''),'0'),9,'0')) parte_num,
          coalesce((select jsonb_agg(jsonb_build_object(
             'key_produccion',z.key_produccion,'produccion',z.produccion,'proyecto',z.proyecto,'cantidad',z.cantidad,
             'observacion_mecanizado',z.observacion_mecanizado,'novedades',z.novedades,'entrega_estado',z.entrega_estado,
             'entrega_completa',z.entrega_completa,'fecha_entrega',z.fecha_entrega,'turno_entrega',z.turno_entrega,
             'estado_mecanizado',z.estado_mecanizado,'reserva_compartida',z.reserva_compartida,'reservas_compartidas',z.reservas_compartidas
           ) order by z.produccion)
           from (
             select distinct pr.key_produccion,sp.produccion,sp.proyecto,sp.cantidad,coalesce(eo.observacion,'') observacion_mecanizado,
               (select count(*) from public.sgp_mecanizado_novedades n where n.id_programacion=p.id_programacion and n.produccion=sp.produccion and n.estado<>'RESUELTA') novedades,
               le.estado entrega_estado,le.completa entrega_completa,le.fecha_operativa fecha_entrega,le.turno_entrega,
               coalesce(eo.estado,coalesce(p.estado_ejecucion,'PROGRAMADA')) estado_mecanizado,
               public.sgp_es_reserva_compartida(pr.key_produccion) reserva_compartida,
               public.sgp_reservas_por_produccion_json(pr.key_produccion) reservas_compartidas
             from public.sgp_prioridades pr join public.sgp_producciones sp on sp.key_produccion=pr.key_produccion
             left join public.sgp_mecanizado_ejecucion_orden eo on eo.id_programacion=p.id_programacion and eo.produccion=sp.produccion
             left join lateral (select pe.estado,pe.completa,pe.fecha_operativa,pe.turno_entrega from public.sgp_picking_entregas pe where pe.id_programacion=p.id_programacion and pe.produccion=sp.produccion order by pe.fecha_entrega desc limit 1) le on true
             where pr.reserva=p.reserva and pr.id_linea='PANELES_2' and pr.prioridad=p.parte
           ) z),'[]'::jsonb) ordenes
   from partes p
 )
 select jsonb_agg(f order by f.orden_estado,f.reserva,f.parte_num,f.fecha_programacion,f.prioridad) from filas f),'[]'::jsonb);
end $function$
;
CREATE OR REPLACE FUNCTION public.sgp_guardar_prioridad(p_token text, p_anio integer, p_semana integer, p_linea text, p_reserva text, p_asignaciones jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare u text;t text;bad int;begin u:=sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR']);
select max(upper(coalesce(tipo,''))) into t from sgp_producciones where anio=p_anio and semana_actual=p_semana and id_linea=p_linea and trim(split_part(coalesce(reserva_al,''),',',1))=p_reserva;
if t like '%PROYECTO%' and exists(select 1 from jsonb_array_elements(p_asignaciones)a where a->>'prioridad' like '%.%') then raise exception 'Las reservas de Proyecto no pueden dividirse';end if;
select count(*) into bad from jsonb_array_elements(p_asignaciones)a where not exists(select 1 from sgp_producciones p where p.key_produccion=a->>'key_produccion' and p.anio=p_anio and p.semana_actual=p_semana and p.id_linea=p_linea and trim(split_part(coalesce(p.reserva_al,''),',',1))=p_reserva);
if bad>0 then raise exception 'Hay producciones que no pertenecen a la reserva principal seleccionada';end if;
-- LAB v310: validación jerárquica y protección transaccional de programaciones.
if exists(select 1 from jsonb_array_elements(p_asignaciones) a
          where coalesce(a->>'prioridad','') !~ '^[1-9][0-9]*([.][1-9][0-9]*){0,2}
insert into sgp_prioridades(anio,semana,id_linea,reserva,key_produccion,prioridad,usuario)
select p_anio,p_semana,p_linea,p_reserva,a->>'key_produccion',a->>'prioridad',u from jsonb_array_elements(p_asignaciones)a
on conflict(anio,semana,id_linea,key_produccion) do update set reserva=excluded.reserva,prioridad=excluded.prioridad,usuario=excluded.usuario,fecha_actualizacion=now();
return jsonb_build_object('ok',true,'guardadas',jsonb_array_length(p_asignaciones));end $function$
)
then raise exception 'Prioridad inválida: se permiten máximo tres niveles'; end if;
if exists(select 1 from public.sgp_mecanizado_programacion mp
          where mp.reserva=p_reserva and mp.estado<>'CANCELADA'
            and exists(select 1 from jsonb_array_elements(p_asignaciones) a
                       left join public.sgp_prioridades pr
                         on pr.anio=p_anio and pr.semana=p_semana and pr.id_linea=p_linea
                        and pr.reserva=p_reserva and pr.key_produccion=a->>'key_produccion'
                       where pr.prioridad is distinct from a->>'prioridad'
                         and (mp.prioridad_semanal is null or mp.prioridad_semanal=pr.prioridad)))
then raise exception 'No se puede modificar una parte con programación activa'; end if;
delete from sgp_prioridades where anio=p_anio and semana=p_semana and id_linea=p_linea and reserva=p_reserva;
insert into sgp_prioridades(anio,semana,id_linea,reserva,key_produccion,prioridad,usuario)
select p_anio,p_semana,p_linea,p_reserva,a->>'key_produccion',a->>'prioridad',u from jsonb_array_elements(p_asignaciones)a
on conflict(anio,semana,id_linea,key_produccion) do update set reserva=excluded.reserva,prioridad=excluded.prioridad,usuario=excluded.usuario,fecha_actualizacion=now();
return jsonb_build_object('ok',true,'guardadas',jsonb_array_length(p_asignaciones));end $function$
;
COMMIT;

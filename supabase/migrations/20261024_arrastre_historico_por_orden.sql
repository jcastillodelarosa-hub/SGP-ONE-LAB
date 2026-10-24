-- STAGED ONLY. Requires transactional QA and authorization before execution.
-- Restores processed items in the actual destination shift while preserving the original identity.
CREATE OR REPLACE FUNCTION public.sgp_mecanizado_pendientes_turno(p_token text, p_fecha date, p_turno text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_usuario text; v_inicio timestamptz; v_habilitado timestamptz; v_ahora timestamptz:=now();
begin
 v_usuario:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','CONSULTA']);
 if upper(trim(p_turno)) not in ('TURNO 1','TURNO 2') then raise exception 'Turno no válido'; end if;
 v_inicio:=(p_fecha::text||case when upper(trim(p_turno))='TURNO 1' then ' 07:00 America/Bogota' else ' 19:00 America/Bogota' end)::timestamptz;
 v_habilitado:=v_inicio+interval '5 minutes';
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
   sp.key_produccion,sp.produccion,sp.proyecto,sp.cliente,sp.tipo,round(coalesce(sp.cantidad,0))::int cantidad,
   coalesce(sp.semana_actual,sp.semana_base)::int semana,
   public.sgp_es_reserva_compartida(sp.key_produccion) reserva_compartida,
   public.sgp_reservas_por_produccion_json(sp.key_produccion) reservas_compartidas,
   coalesce(eo.estado,me.estado,'PROGRAMADA') estado_actual,eo.observacion,
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
  select *,row_number() over(partition by reserva,key_produccion order by fecha_programacion desc,case when upper(trim(turno))='TURNO 2' then 2 else 1 end desc,id_programacion desc) rn
  from base where ((procesado_en is null and estado_actual<>'PROCESADO') or procesado_en>=v_inicio)
    and (movido_en is null or movido_en>=v_inicio) and (reprogramado_en is null or reprogramado_en>=v_inicio)
 )
 select jsonb_agg(jsonb_build_object(
   'id_programacion_origen',id_programacion,'reserva',reserva,'key_produccion',key_produccion,'produccion',produccion,
   'proyecto',coalesce(proyecto,cliente),'tipo',coalesce(tipo,''),'cantidad',cantidad,'semana',semana,
   'prioridad_semanal',prioridad_semanal,'sistema',sistema,'acabado',acabado,'estado',case when procesado_en>=v_inicio and procesado_en<v_inicio+interval '12 hours' then 'PROCESADO' when procesado_en>=v_inicio then 'MECANIZADO' else estado_actual end,'observacion',observacion,
   'reserva_compartida',reserva_compartida,'reservas_compartidas',reservas_compartidas,
   'turno_origen',turno,'fecha_origen',fecha_programacion,'arrastre',true,'culminado_en_turno',(procesado_en>=v_inicio and procesado_en<v_inicio+interval '12 hours'),'fecha_culminacion',case when procesado_en>=v_inicio and procesado_en<v_inicio+interval '12 hours' then procesado_en else null end
 ) order by fecha_programacion,turno,reserva,produccion)
 from eligible where rn=1
 ),'[]'::jsonb);
end $function$
;

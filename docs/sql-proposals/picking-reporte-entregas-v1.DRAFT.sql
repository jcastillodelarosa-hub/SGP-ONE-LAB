-- Reviewed RPC SQL; user explicitly authorized creation of this RPC only. No table/RLS changes.
-- Contract: picking delivery history v1. Review grants and role policy before activation.
CREATE OR REPLACE FUNCTION public.sgp_picking_reporte_entregas_v1(
 p_token text, p_fecha_inicio date, p_fecha_fin date,
 p_turno text DEFAULT NULL, p_sistema text DEFAULT NULL,
 p_limit integer DEFAULT 100, p_offset integer DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
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
  'producciones_unicas',count(DISTINCT (e.id_programacion,e.produccion,p.sistema)),
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
   count(DISTINCT (e.id_programacion,e.produccion,p.sistema)) producciones_unicas,
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
  SELECT e.id_entrega,e.id_programacion,e.produccion,e.completa,e.estado,e.observacion,
   e.usuario_entrega,e.fecha_entrega,e.fecha_operativa,e.turno_entrega,
   e.usuario_validacion,e.fecha_validacion,p.reserva,p.prioridad_semanal AS parte,p.sistema,p.acabado,
   coalesce((SELECT jsonb_agg(jsonb_build_object('id_faltante',f.id_faltante,'perfil',f.perfil,'marca',f.marca,'fabricacion',f.fabricacion,'longitud',f.longitud,'cantidad',f.cantidad,'observacion',f.observacion,'nc',f.nc,'reserva_pendiente',f.reserva_pendiente,'acabado_pendiente',f.acabado_pendiente,'ventanas_afectadas',f.ventanas_afectadas) ORDER BY f.id_faltante) FROM public.sgp_picking_faltantes f WHERE f.id_entrega=e.id_entrega),'[]'::jsonb) faltantes
  FROM public.sgp_picking_entregas e JOIN public.sgp_mecanizado_programacion p ON p.id_programacion=e.id_programacion
  WHERE e.fecha_operativa BETWEEN p_fecha_inicio AND p_fecha_fin
   AND (p_turno IS NULL OR e.turno_entrega=p_turno)
   AND (p_sistema IS NULL OR p.sistema=p_sistema)
  ORDER BY e.fecha_entrega,e.id_entrega LIMIT p_limit OFFSET p_offset
 ) z;
 RETURN jsonb_build_object('ok',true,'filters',jsonb_build_object('fecha_inicio',p_fecha_inicio,'fecha_fin',p_fecha_fin,'turno',p_turno,'sistema',p_sistema),'summary',v_summary,'por_sistema',v_systems,'total_rows',v_total,'limit',p_limit,'offset',p_offset,'rows',v_rows);
END $fn$;
REVOKE ALL ON FUNCTION public.sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer) FROM anon;
REVOKE ALL ON FUNCTION public.sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer) TO anon,authenticated;
-- All callers must pass a valid SGP app session token; sgp_validar_sesion_rol enforces app roles.

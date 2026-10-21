-- LAB v316 · REPARACIÓN HISTÓRICA MANUAL. NO EJECUTAR SIN AUTORIZACIÓN EXPLÍCITA.
-- Alcance cerrado: 3 destinos de reprogramación validados 2026-10-21.
-- Las otras 9 programaciones sin detalle NO se tocan.
-- Verifica origen, producción, cantidad y ausencia de detalle antes de insertar.
BEGIN;
DO $repair$
DECLARE v_validos integer;
BEGIN
 WITH candidatos AS (
  SELECT r.id_destino,r.id_origen,r.produccion,r.cantidad,o.reserva,
   count(d.key_produccion) FILTER (WHERE d.produccion_snapshot=r.produccion AND d.reserva_snapshot=o.reserva) n_keys,
   coalesce(sum(d.cantidad_snapshot) FILTER (WHERE d.produccion_snapshot=r.produccion AND d.reserva_snapshot=o.reserva),0) total
  FROM public.sgp_mecanizado_reprogramaciones r
  JOIN public.sgp_mecanizado_programacion o ON o.id_programacion=r.id_origen
  JOIN public.sgp_mecanizado_programacion destino ON destino.id_programacion=r.id_destino AND destino.reserva=o.reserva AND destino.produccion=r.produccion AND destino.cantidad_programada=r.cantidad
  LEFT JOIN public.sgp_mecanizado_programacion_detalle d ON d.id_programacion=r.id_origen
  WHERE r.id_destino IN ('169ce156-5726-4965-8c03-98c2ac4204fb'::uuid,'63a5685f-46e6-4052-9ab7-5796a8791b04'::uuid,'c432eff2-873f-4979-ac3f-76d1ee094974'::uuid)
    AND NOT EXISTS(SELECT 1 FROM public.sgp_mecanizado_programacion_detalle existing WHERE existing.id_programacion=r.id_destino)
  GROUP BY r.id_destino,r.id_origen,r.produccion,r.cantidad,o.reserva
 ) SELECT count(*) INTO v_validos FROM candidatos WHERE n_keys=1 AND total=cantidad;
 IF v_validos<>3 THEN RAISE EXCEPTION 'Reparación detenida: se esperaban 3 destinos únicos, completos y sin detalle; válidos=%',v_validos; END IF;
 INSERT INTO public.sgp_mecanizado_programacion_detalle
  (id_programacion,key_produccion,cantidad_snapshot,reserva_snapshot,prioridad_semanal_snapshot,produccion_snapshot,origen)
 SELECT r.id_destino,d.key_produccion,d.cantidad_snapshot,d.reserva_snapshot,d.prioridad_semanal_snapshot,d.produccion_snapshot,'REPARACION_REPROGRAMACION'
 FROM public.sgp_mecanizado_reprogramaciones r
 JOIN public.sgp_mecanizado_programacion o ON o.id_programacion=r.id_origen
 JOIN public.sgp_mecanizado_programacion_detalle d ON d.id_programacion=r.id_origen AND d.produccion_snapshot=r.produccion AND d.reserva_snapshot=o.reserva
 WHERE r.id_destino IN ('169ce156-5726-4965-8c03-98c2ac4204fb'::uuid,'63a5685f-46e6-4052-9ab7-5796a8791b04'::uuid,'c432eff2-873f-4979-ac3f-76d1ee094974'::uuid);
 IF (SELECT count(*) FROM public.sgp_mecanizado_programacion_detalle WHERE id_programacion IN ('169ce156-5726-4965-8c03-98c2ac4204fb'::uuid,'63a5685f-46e6-4052-9ab7-5796a8791b04'::uuid,'c432eff2-873f-4979-ac3f-76d1ee094974'::uuid) AND origen='REPARACION_REPROGRAMACION')<>3 THEN
  RAISE EXCEPTION 'Reparación incompleta, se revierte transacción';
 END IF;
END $repair$;
COMMIT;
-- Validación posterior: consultar sgp_mecanizado_semanas_programacion y vidrio por key_produccion.

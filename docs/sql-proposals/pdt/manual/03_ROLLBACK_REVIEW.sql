-- REVIEW ONLY. Revert Phase 3 only before any manual delivery line is registered.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$ BEGIN
 IF to_regclass('sgp_pdt_manual.entregas') IS NULL THEN RAISE EXCEPTION 'PDT_MANUAL_PHASE3_NOT_INSTALLED'; END IF;
 IF EXISTS(SELECT 1 FROM sgp_pdt_manual.entregas) THEN
  RAISE EXCEPTION 'PDT_MANUAL_DELIVERIES_EXIST_REQUIRES_FORWARD_REPAIR'; END IF;
 IF EXISTS(SELECT 1 FROM public.sgp_pdt_cierres c JOIN sgp_pdt_manual.detalles d USING(id_pendiente)) THEN
  RAISE EXCEPTION 'PDT_MANUAL_CLOSURES_EXIST_REQUIRES_FORWARD_REPAIR'; END IF;
END $guard$;
DO $restore$ DECLARE definition text; signature text; BEGIN
 FOREACH signature IN ARRAY ARRAY[
  'public.sgp_pdt_cierre_acreditado(uuid)', 'public.sgp_pdt_comprometido(uuid)',
  'public.sgp_pdt_estado_v2(text,uuid,text)', 'public.sgp_pdt_cerrar_v2(text,uuid,uuid)',
  'public.sgp_aluminio_pendiente_registrar_avance_v1(text,uuid,uuid,integer,text,date,uuid,text)'] LOOP
  SELECT definicion INTO STRICT definition FROM sgp_pdt_manual.funcion_previa WHERE firma=signature;
  EXECUTE definition;
 END LOOP;
END $restore$;
DROP TRIGGER trg_pdt_manual_entrega_origen ON public.sgp_picking_entregas;
DROP FUNCTION sgp_pdt_manual.proteger_entrega_origen();
DROP TRIGGER trg_pdt_manual_programacion_origen ON public.sgp_mecanizado_programacion;
DROP FUNCTION sgp_pdt_manual.proteger_programacion_origen();
DROP FUNCTION public.sgp_pdt_manual_cerrar_v1(text,uuid,uuid);
DROP FUNCTION public.sgp_pdt_manual_entrega_anular_v1(text,uuid,text);
DROP FUNCTION public.sgp_pdt_manual_asignar_v1(text,uuid,uuid);
DROP FUNCTION public.sgp_pdt_manual_entrega_validar_v1(text,uuid);
DROP FUNCTION public.sgp_pdt_manual_entrega_registrar_v1(text,uuid,uuid,integer,uuid);
DROP FUNCTION public.sgp_pdt_manual_picking_v1(text,uuid);
DROP FUNCTION public.sgp_pdt_manual_listar_v1(text);
DROP FUNCTION sgp_pdt_manual.cierre_acreditado(uuid);
DROP FUNCTION sgp_pdt_manual.original_cierre_acreditado(uuid);
DROP FUNCTION sgp_pdt_manual.original_comprometido(uuid);
DROP FUNCTION sgp_pdt_manual.original_estado_v2(text,uuid,text);
DROP FUNCTION sgp_pdt_manual.original_cerrar_v2(text,uuid,uuid);
DROP FUNCTION sgp_pdt_manual.original_avance(text,uuid,uuid,integer,text,date,uuid,text);
DROP TABLE sgp_pdt_manual.entregas;
DELETE FROM sgp_pdt_manual.funcion_previa WHERE firma IN (
 'public.sgp_pdt_cierre_acreditado(uuid)','public.sgp_pdt_comprometido(uuid)',
 'public.sgp_pdt_estado_v2(text,uuid,text)','public.sgp_pdt_cerrar_v2(text,uuid,uuid)',
 'public.sgp_aluminio_pendiente_registrar_avance_v1(text,uuid,uuid,integer,text,date,uuid,text)');
NOTIFY pgrst,'reload schema';
COMMIT;

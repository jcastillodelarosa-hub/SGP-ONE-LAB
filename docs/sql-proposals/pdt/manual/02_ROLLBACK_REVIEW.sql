-- REVIEW ONLY. Reverts Phase 2 only when no manual PDT has been validated.
-- Never restore a full database over later production writes.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$ BEGIN
 IF to_regclass('sgp_pdt_manual.funcion_previa') IS NULL THEN RAISE EXCEPTION 'PDT_MANUAL_PHASE2_NOT_INSTALLED'; END IF;
 IF EXISTS(SELECT 1 FROM sgp_pdt_manual.detalles md JOIN public.sgp_aluminio_pendientes p USING(id_pendiente)
  WHERE p.validacion_estado='VALIDADO' OR EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d WHERE d.id_pendiente=md.id_pendiente))
 THEN RAISE EXCEPTION 'PDT_MANUAL_VALIDATIONS_EXIST_REQUIRES_FORWARD_REPAIR'; END IF;
END $guard$;
DO $restore$ DECLARE definition text; BEGIN
 SELECT definicion INTO STRICT definition FROM sgp_pdt_manual.funcion_previa
 WHERE firma='public.sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)';
 EXECUTE definition;
END $restore$;
DROP FUNCTION public.sgp_pdt_manual_ids_v1(text);
DROP FUNCTION public.sgp_pdt_manual_fuentes_validacion_v1(text,uuid);
DROP FUNCTION sgp_pdt_manual.validar(text,uuid,jsonb,text,text);
DROP FUNCTION sgp_pdt_manual.original_validar(text,uuid,jsonb,text,text);
DROP TRIGGER trg_pdt_manual_report_original ON sgp_pdt_manual.reportes;
DROP TRIGGER trg_pdt_manual_detail_original ON sgp_pdt_manual.detalles;
DROP TRIGGER trg_pdt_manual_source_original ON sgp_pdt_manual.fuentes;
DROP FUNCTION sgp_pdt_manual.proteger_original();
DROP TABLE sgp_pdt_manual.fuentes_validadas;
DROP TABLE sgp_pdt_manual.funcion_previa;
NOTIFY pgrst,'reload schema';
COMMIT;

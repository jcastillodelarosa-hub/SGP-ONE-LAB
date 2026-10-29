-- REVIEW ONLY. Remove the observer without deleting its audit trail.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$ BEGIN
 IF to_regclass('sgp_pdt_manual.programacion_cambios') IS NULL
 THEN RAISE EXCEPTION 'PDT_MANUAL_PHASE4_NOT_INSTALLED'; END IF;
END $guard$;
DROP TRIGGER trg_pdt_manual_auditar_programacion ON public.sgp_producciones;
DROP FUNCTION sgp_pdt_manual.auditar_programacion();
-- Keep programacion_cambios and public history; dropping them would erase evidence.
COMMIT;

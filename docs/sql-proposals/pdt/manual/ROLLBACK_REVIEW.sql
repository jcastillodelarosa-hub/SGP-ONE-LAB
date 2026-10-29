-- REVIEW ONLY. Safe only before any manual report is registered.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$ BEGIN
 IF to_regclass('sgp_pdt_manual.reportes') IS NULL THEN RAISE EXCEPTION 'PDT_MANUAL_NOT_INSTALLED'; END IF;
 IF EXISTS(SELECT 1 FROM sgp_pdt_manual.reportes) THEN RAISE EXCEPTION 'PDT_MANUAL_REPORTS_EXIST_REQUIRES_CONCILIATION'; END IF;
END $guard$;
DROP FUNCTION public.sgp_pdt_manual_registrar_v1(text,text,jsonb,jsonb,text,uuid);
DROP FUNCTION public.sgp_pdt_manual_nc_consultar_v1(text,text);
DROP FUNCTION public.sgp_pdt_manual_fuentes_v1(text,text,text);
DROP FUNCTION public.sgp_pdt_manual_catalogo_v1(text);
DROP SCHEMA sgp_pdt_manual CASCADE;
NOTIFY pgrst,'reload schema';
COMMIT;

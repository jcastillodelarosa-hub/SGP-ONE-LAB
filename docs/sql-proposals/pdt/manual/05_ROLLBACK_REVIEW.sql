-- REVIEW ONLY. Restore the installed Export writer; do not reverse audited year
-- changes or erase imports. Requires reconciliation if later imports occurred.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $restore$ DECLARE definition text; BEGIN
 SELECT definicion INTO STRICT definition FROM sgp_pdt_manual.funcion_previa
 WHERE firma='public.sgp_aplicar_export_diario(text,text,text,jsonb)';
 EXECUTE definition;
END $restore$;
DROP FUNCTION sgp_pdt_manual.original_aplicar_export_diario(text,text,text,jsonb);
DELETE FROM sgp_pdt_manual.funcion_previa
WHERE firma='public.sgp_aplicar_export_diario(text,text,text,jsonb)';
NOTIFY pgrst,'reload schema';
COMMIT;

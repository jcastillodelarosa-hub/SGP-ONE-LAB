-- REVIEW ONLY. Before activation only; never silently expose historical PDT.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM sgp_pdt_manual.corte_operativo)
 THEN RAISE EXCEPTION 'PDT_CUTOVER_ACTIVE_REQUIRES_CONTROLLED_FORWARD_REPAIR'; END IF;
END $guard$;
DROP FUNCTION public.sgp_pdt_corte_operativo_v1(text);
DROP TABLE sgp_pdt_manual.corte_operativo;
NOTIFY pgrst,'reload schema';
COMMIT;

-- Reviewed containment preserves every recorded cut. No destructive rollback.
BEGIN;
UPDATE sgp_opt_shared.config SET enabled=false;
REVOKE ALL ON FUNCTION public.sgp_opt_cortes_estado_v2(text,text,jsonb),public.sgp_opt_cortes_registrar_v2(text,text,uuid[],uuid,jsonb),public.sgp_opt_cortes_reporte_v2(text,jsonb,text[]) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;

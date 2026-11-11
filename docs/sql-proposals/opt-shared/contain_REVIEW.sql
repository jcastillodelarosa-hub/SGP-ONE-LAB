-- Reviewed containment preserves every recorded cut. No destructive rollback.
BEGIN;
UPDATE sgp_opt_shared.config SET enabled=false;
REVOKE ALL ON FUNCTION public.sgp_opt_cortes_estado_v2(text,text,jsonb),public.sgp_opt_cortes_registrar_v2(text,text,uuid[],uuid,jsonb),public.sgp_opt_cortes_reporte_v2(text,jsonb,text[]) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.sgp_opt_catalogo_v2(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.sgp_opt_import_contexto_v1(text,jsonb,text[]),
 public.sgp_opt_importar_validado_v1(text,bytea,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;

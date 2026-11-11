-- Explicit OPT activation approved for existing SGP users in these three roles.
-- No SGP user/role/access records are added or changed. No document/cut is created.
-- Apply only after base/catalog/context/import installation and JWT endpoint checks.
BEGIN;
DO $$ BEGIN
 IF (SELECT count(*) FROM sgp_opt_shared.config)<>1
 OR NOT EXISTS(SELECT 1 FROM sgp_opt_shared.config WHERE singleton AND NOT enabled
 AND access_window IS NULL AND read_roles='{}'::text[] AND write_roles='{}'::text[])
 THEN RAISE EXCEPTION 'OPT_ACTIVATION_STATE_CHANGED'; END IF;
END $$;
UPDATE sgp_opt_shared.config SET enabled=true,access_window='mecanizado',
 read_roles=ARRAY['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO'],
 write_roles=ARRAY['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO'] WHERE singleton;
-- The browser uses the existing public application identity plus a real SGP token.
-- Every RPC checks the private config, real session/role and existing Mecanizado access.
GRANT EXECUTE ON FUNCTION public.sgp_opt_cortes_estado_v2(text,text,jsonb),
 public.sgp_opt_cortes_registrar_v2(text,text,uuid[],uuid,jsonb),
 public.sgp_opt_cortes_reporte_v2(text,jsonb,text[]),
 public.sgp_opt_catalogo_v2(text,jsonb) TO anon,authenticated;
COMMIT;

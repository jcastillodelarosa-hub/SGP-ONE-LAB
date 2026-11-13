-- Separate activation proposal. Apply only with explicit backend authorization.
BEGIN;
DO $$ BEGIN
 IF NOT has_function_privilege('anon','public.sgp_opt_catalogo_v2(text,jsonb)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.sgp_opt_catalogo_v2(text,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'OPT_CATALOG_ACCESS_CHANGED'; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.sgp_opt_referencias_documentales_v1(text,jsonb,text,text),public.sgp_opt_esquema_documental_v2(text,jsonb,text,text,uuid,text) TO anon,authenticated;
COMMIT;
-- Containment: REVOKE EXECUTE on these two functions FROM anon,authenticated.
-- Existing v2 cut state/register, assignments, roles and scope checks stay unchanged.

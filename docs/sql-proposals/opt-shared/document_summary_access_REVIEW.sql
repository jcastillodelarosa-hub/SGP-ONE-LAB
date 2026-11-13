-- LOCAL PROPOSAL ONLY. Mirror existing catalogue access without changing SGP roles.
-- Run only after summary RPC review and existing actor/in_scope verification.
BEGIN;
DO $$
DECLARE r text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM sgp_opt_shared.config WHERE singleton AND enabled)
 THEN RAISE EXCEPTION 'OPT_NO_HABILITADO'; END IF;
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  -- No grant if that application identity cannot already read the catalogue.
  IF NOT has_function_privilege(r,'public.sgp_opt_catalogo_v2(text,jsonb)','EXECUTE')
  THEN RAISE EXCEPTION 'OPT_CATALOG_ACCESS_CHANGED'; END IF;
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.sgp_opt_resumen_documental_v1(text,jsonb,text,text) TO anon,authenticated;
-- Public execution is transport only: every invocation still requires a valid SGP
-- token, existing configured read role/Mecanizado access and in-scope assignment.
COMMIT;
-- Rollback: REVOKE EXECUTE ON FUNCTION public.sgp_opt_resumen_documental_v1(text,jsonb,text,text) FROM anon,authenticated;

-- LOCAL REVIEW ONLY. Pause the separate V4 endpoint before applying.
-- Revoke V4 execution without deleting documents, approvals, cuts, or prior contracts.
-- An uncertain request is not certified rolled back by this permissions change.
-- Resolve each uncertain attempt through its original authorized protocol.
BEGIN;
DO $$
BEGIN
 IF to_regprocedure('public.sgp_opt_importar_retail_validado_v4(text,bytea,jsonb,jsonb,jsonb)') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION public.sgp_opt_importar_retail_validado_v4(text,bytea,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
 END IF;
 IF to_regprocedure('public.sgp_opt_import_contexto_retail_v4(text,jsonb,text,jsonb,text[])') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION public.sgp_opt_import_contexto_retail_v4(text,jsonb,text,jsonb,text[]) FROM PUBLIC,anon,authenticated,service_role;
 END IF;
END $$;
COMMIT;

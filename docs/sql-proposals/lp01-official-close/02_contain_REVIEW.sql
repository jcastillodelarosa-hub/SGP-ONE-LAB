-- REVIEW ONLY. Non-destructive containment of this new service, never global ACL.
BEGIN;
SET LOCAL lock_timeout='5s';
UPDATE sgp_lp_official.config SET enabled=false WHERE id;
REVOKE ALL ON FUNCTION public.sgp_lp_official_read_v1(text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sgp_lp_official_context_v1(text,jsonb,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sgp_lp_official_commit_v1(text,jsonb,uuid,text,text,bigint,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF to_regprocedure('public.sgp_lp_official_open_due_v1(text,text,text)') IS NOT NULL THEN EXECUTE 'REVOKE ALL ON FUNCTION public.sgp_lp_official_open_due_v1(text,text,text) FROM PUBLIC,anon,authenticated';END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.sgp_lp_official_read_v1(text,jsonb) FROM service_role';
  IF to_regprocedure('public.sgp_lp_official_open_due_v1(text,text,text)') IS NOT NULL THEN EXECUTE 'REVOKE ALL ON FUNCTION public.sgp_lp_official_open_due_v1(text,text,text) FROM service_role';END IF;
  EXECUTE 'REVOKE ALL ON FUNCTION public.sgp_lp_official_context_v1(text,jsonb,uuid,text) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.sgp_lp_official_commit_v1(text,jsonb,uuid,text,text,bigint,jsonb,jsonb,jsonb) FROM service_role';
 END IF;
END $$;
-- Retain ledger, original files, receipts and versioned closures for recovery.
COMMIT;

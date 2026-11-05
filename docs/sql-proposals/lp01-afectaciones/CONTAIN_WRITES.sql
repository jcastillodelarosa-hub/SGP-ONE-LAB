-- Recovery containment only; preserve all business records, audit and read access.
-- Does NOT reverse the shared optional-NC PDT contract or change existing PDT ACL.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='sgp_lp_afectaciones') IS DISTINCT FROM current_user THEN RAISE EXCEPTION 'OWNER_REQUIRED';END IF;
END $$;
UPDATE sgp_lp_afectaciones.config SET writes=false,physical=false,pdt_links=false,atomic_pdt=false WHERE id;
COMMIT;

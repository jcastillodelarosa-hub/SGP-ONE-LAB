-- Execute ONLY in isolated restored QA with a valid QA session token, after installing baseline.sql.
-- psql -v token='QA_TOKEN' -f equality-isolated.sql; no production tokens or data in repository.
BEGIN;
CREATE TEMP TABLE pdt_before AS SELECT jsonb_array_elements(public.sgp_pdt_listar_baseline_20261028(:'token',false)) row;
CREATE TEMP TABLE pdt_after AS SELECT jsonb_array_elements(public.sgp_aluminio_pendientes_listar(:'token',false)) row;
DO $$ BEGIN
 IF (SELECT count(*) FROM pdt_before)<>(SELECT count(*) FROM pdt_after) OR
 EXISTS((SELECT row FROM pdt_before EXCEPT ALL SELECT row FROM pdt_after)
 UNION ALL (SELECT row FROM pdt_after EXCEPT ALL SELECT row FROM pdt_before))
 THEN RAISE EXCEPTION 'PDT_LIST_RESULT_CHANGED'; END IF;
END $$;
-- Repeat for open-only contract.
CREATE TEMP TABLE pdt_before_open AS SELECT jsonb_array_elements(public.sgp_pdt_listar_baseline_20261028(:'token',true)) row;
CREATE TEMP TABLE pdt_after_open AS SELECT jsonb_array_elements(public.sgp_aluminio_pendientes_listar(:'token',true)) row;
DO $$ BEGIN
 IF EXISTS((SELECT row FROM pdt_before_open EXCEPT ALL SELECT row FROM pdt_after_open)
 UNION ALL (SELECT row FROM pdt_after_open EXCEPT ALL SELECT row FROM pdt_before_open))
 THEN RAISE EXCEPTION 'PDT_OPEN_RESULT_CHANGED'; END IF;
END $$;
ROLLBACK;

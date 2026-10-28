-- Only isolated restored QA, with a valid QA session token. Never use a production token here.
-- Compare complete JSON arrays: element order, row count, all fields and NC state.
BEGIN;
DO $check$
DECLARE before_all jsonb; after_all jsonb; before_open jsonb; after_open jsonb;
BEGIN
 before_all:=public.sgp_pdt_listar_baseline_20261028(:'token',false);
 after_all:=public.sgp_aluminio_pendientes_listar(:'token',false);
 before_open:=public.sgp_pdt_listar_baseline_20261028(:'token',true);
 after_open:=public.sgp_aluminio_pendientes_listar(:'token',true);
 IF before_all IS DISTINCT FROM after_all THEN RAISE EXCEPTION 'PDT_FULL_ORDER_OR_FIELD_CHANGED'; END IF;
 IF before_open IS DISTINCT FROM after_open THEN RAISE EXCEPTION 'PDT_OPEN_ORDER_OR_FIELD_CHANGED'; END IF;
END $check$;
ROLLBACK;

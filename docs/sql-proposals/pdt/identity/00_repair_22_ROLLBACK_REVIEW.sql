-- REVIEW ONLY. Prefer retaining corrected associations and forward-fixing code.
-- Data rollback is permitted only with original guards, no later row/history/dependency changes.
-- It MUST abort rather than bypass a newer identity trigger or change a used V2 contract.
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'; SET LOCAL timezone='UTC';
LOCK TABLE public.sgp_aluminio_pendientes IN ACCESS EXCLUSIVE MODE NOWAIT;
LOCK TABLE sgp_pdt_line_repair_20261025.ledger IN EXCLUSIVE MODE NOWAIT;
DO $pre$ BEGIN
 IF session_user NOT IN ('postgres','supabase_admin') THEN RAISE EXCEPTION 'PDT_REPAIR_ADMIN_REQUIRED'; END IF;
 IF (SELECT count(*) FROM sgp_pdt_line_repair_20261025.ledger)<>22 OR EXISTS(SELECT 1 FROM sgp_pdt_line_repair_20261025.ledger WHERE rolled_back_at IS NOT NULL) THEN RAISE EXCEPTION 'PDT_ROLLBACK_COHORT_INVALID'; END IF;
 IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.sgp_aluminio_pendientes'::regclass AND NOT tgisinternal)<>1
 OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.sgp_aluminio_pendientes'::regclass AND NOT tgisinternal AND tgenabled<>'O')
 OR md5(pg_get_functiondef('public.sgp_pdt_guardar_contrato()'::regprocedure))<>'30cf521e6c7451074cdb3fbc23edc2c5' THEN RAISE EXCEPTION 'PDT_ROLLBACK_GUARDS_CHANGED'; END IF;
 IF EXISTS(SELECT 1 FROM sgp_pdt_line_repair_20261025.ledger l LEFT JOIN public.sgp_aluminio_pendientes p USING(id_pendiente) WHERE to_jsonb(p) IS DISTINCT FROM l.after_row)
 OR EXISTS(SELECT 1 FROM sgp_pdt_line_repair_20261025.ledger l WHERE l.history_digest IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(h) ORDER BY to_jsonb(h)::text)::text,'[]')) FROM public.sgp_aluminio_pendientes_historial h WHERE h.id_pendiente=l.id_pendiente)) THEN RAISE EXCEPTION 'PDT_ROLLBACK_NEW_WRITES'; END IF;
 IF EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d JOIN sgp_pdt_line_repair_20261025.ledger l USING(id_pendiente))
 OR EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_movimientos d JOIN sgp_pdt_line_repair_20261025.ledger l USING(id_pendiente))
 OR EXISTS(SELECT 1 FROM public.sgp_pdt_cierres d JOIN sgp_pdt_line_repair_20261025.ledger l USING(id_pendiente))
 OR EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_ncs d JOIN sgp_pdt_line_repair_20261025.ledger l USING(id_pendiente)) THEN RAISE EXCEPTION 'PDT_ROLLBACK_NEW_DEPENDENCIES'; END IF;
END $pre$;
UPDATE public.sgp_aluminio_pendientes p SET key_produccion=l.before_row->>'key_produccion'
 FROM sgp_pdt_line_repair_20261025.ledger l WHERE p.id_pendiente=l.id_pendiente;
DO $post$ BEGIN
 IF EXISTS(SELECT 1 FROM sgp_pdt_line_repair_20261025.ledger l JOIN public.sgp_aluminio_pendientes p USING(id_pendiente) WHERE to_jsonb(p) IS DISTINCT FROM l.before_row) THEN RAISE EXCEPTION 'PDT_ROLLBACK_POSTCHECK_FAILED'; END IF;
END $post$;
UPDATE sgp_pdt_line_repair_20261025.ledger SET rolled_back_at=clock_timestamp();
COMMIT;

-- PROPOSED CONTAINMENT ONLY. No history removal or source rollback.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
-- Match the installer/source lock order; never block an older source writer indefinitely.
LOCK TABLE public.sgp_linea_plan_asignaciones IN SHARE ROW EXCLUSIVE MODE NOWAIT;
UPDATE sgp_lp_operacion.plan_control SET enabled=false WHERE id;
-- Generation invalidates every old head. Native planner functions were never replaced.
-- All versions, receipts, source/origin IDs and unattributed mutations survive.
COMMIT;

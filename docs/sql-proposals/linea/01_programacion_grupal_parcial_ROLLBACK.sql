-- REVIEW ONLY. First disable the frontend capability and stop group writes.
-- Preserve the idempotency ledger and assignments: deleting the ledger could
-- permit an old request UUID to create duplicate assignments after reinstall.
BEGIN;
REVOKE ALL ON FUNCTION public.sgp_linea_plan_programar_grupo_v1(text,uuid,date,integer,jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sgp_linea_plan_saldos_grupo_v1(text,jsonb)
  FROM PUBLIC, anon, authenticated;
DROP FUNCTION public.sgp_linea_plan_programar_grupo_v1(text,uuid,date,integer,jsonb);
DROP FUNCTION public.sgp_linea_plan_saldos_grupo_v1(text,jsonb);
COMMIT;
-- Keep public.sgp_linea_plan_lotes_idempotencia for audit and safe recovery.

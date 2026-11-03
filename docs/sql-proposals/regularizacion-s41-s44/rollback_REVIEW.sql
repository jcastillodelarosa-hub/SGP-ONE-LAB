-- REVIEW ONLY. Reverses only Issue #187 ledger rows. No operational row was changed.
-- Export the ledger first; if another process has consumed it, stop and reconcile.
BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL lock_timeout='5s';
SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('SGP-ISSUE-187-S41-S44',0));
DO $rollback$ BEGIN
 IF (SELECT count(*) FROM sgp_regularizacion_187.producciones
     WHERE lote_id='SGP-187-2026-S41-S44') NOT IN (0,798) THEN
  RAISE EXCEPTION 'LEDGER_INCOMPLETE: stop before rollback';
 END IF;
 IF (SELECT count(*) FROM sgp_regularizacion_187.reservas
     WHERE lote_id='SGP-187-2026-S41-S44') NOT IN (0,94) THEN
  RAISE EXCEPTION 'RESERVE_LEDGER_INCOMPLETE: stop before rollback';
 END IF;
END $rollback$;
DELETE FROM sgp_regularizacion_187.producciones WHERE lote_id='SGP-187-2026-S41-S44';
DELETE FROM sgp_regularizacion_187.reservas WHERE lote_id='SGP-187-2026-S41-S44';
DELETE FROM sgp_regularizacion_187.lotes WHERE id='SGP-187-2026-S41-S44';
COMMIT;

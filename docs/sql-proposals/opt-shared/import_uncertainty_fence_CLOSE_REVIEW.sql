-- Fail-closed rollback: stops new document/source mutations, preserves registry and data.
-- Does not claim to cancel or certify already-running requests. No DROP/DELETE.
BEGIN;
SET LOCAL lock_timeout='1s';
UPDATE sgp_opt_shared.import_fence_control SET certified=false WHERE singleton;
COMMIT;

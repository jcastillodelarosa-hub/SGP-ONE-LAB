-- Disable future catalog reads. No source, image, revision, session or cut is deleted.
BEGIN;
UPDATE sgp_opt_matrices.config SET enabled=false WHERE singleton;
COMMIT;
-- If infrastructure itself fails, disable/neutralize opt-matrix-read separately.
-- Images already received by an authorized browser cannot be remotely erased.

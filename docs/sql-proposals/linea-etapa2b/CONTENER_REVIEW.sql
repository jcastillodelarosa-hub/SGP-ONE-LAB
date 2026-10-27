-- REVIEW ONLY. Authorized maintenance: stop new writes; preserve reports/data.
BEGIN;
UPDATE sgp_linea_b2.config SET escrituras=false WHERE id=1;
COMMIT;
-- Re-enable ONLY after review, coordinated writers and verification; no dispatch.

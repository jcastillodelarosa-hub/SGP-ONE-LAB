-- REVIEW ONLY, authorization required outside QA. No data/evidence deletion.
-- Locks sorted production keys; mark persistent containment before invalidation.
BEGIN;
DO $contain$ DECLARE r record;BEGIN
 FOR r IN SELECT key FROM sgp_linea_c2.estado ORDER BY key LOOP
 PERFORM 1 FROM sgp_linea_b2.producciones WHERE key=r.key FOR UPDATE;
 UPDATE sgp_linea_c2.estado SET contenido=true WHERE key=r.key;
 PERFORM sgp_linea_c2.invalidar(r.key,'CONTENCION_MANUAL');
 END LOOP;
END$contain$;
COMMIT;
-- Recovery is NOT automatic: reviewed owner must clear contenido only after
-- source/cut/scope verification; next read must re-conciliate all evidence.

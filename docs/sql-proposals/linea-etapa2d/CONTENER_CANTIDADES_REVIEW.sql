-- REVIEW ONLY. Contain just opted-in productions, preserve audit/cut snapshots.
-- Maintenance session only, never browser permission. No production execution.
BEGIN;
DO $$ DECLARE k text;BEGIN
 FOR k IN SELECT key FROM sgp_linea_d2q.fuentes ORDER BY key LOOP
 PERFORM 1 FROM sgp_linea_b2.producciones p WHERE p.key=k FOR UPDATE;
 PERFORM sgp_linea_c2.notificar(k,'PDT');
 UPDATE sgp_linea_c2.estado SET contenido=true WHERE key=k;
 END LOOP;
END$$;
COMMIT;
-- Rehabilitation is NOT automatic: recheck sources/roles/writers, review each
-- validation and then deliberately release containment/reconcile per production.

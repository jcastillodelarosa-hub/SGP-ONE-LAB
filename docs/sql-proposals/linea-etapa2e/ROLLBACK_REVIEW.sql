-- REVIEW ONLY. Empty installation only, no audit deletion.
BEGIN;
DO $$BEGIN IF EXISTS(SELECT 1 FROM sgp_linea_e2.manifiestos) THEN RAISE EXCEPTION 'E2_CON_EVIDENCIA_NO_BORRAR';END IF;END$$;
DROP TRIGGER e2_sellado ON sgp_linea_d2.export_ack;
DROP TABLE sgp_linea_e2.manifiestos;
DROP FUNCTION sgp_linea_e2.sellar(text,text,text,text,text,text),sgp_linea_e2.leer(text,text,text),sgp_linea_e2.proteger_ack();
DROP SCHEMA sgp_linea_e2;
COMMIT;

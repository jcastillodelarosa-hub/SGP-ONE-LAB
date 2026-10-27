-- Proposal only. If any rows or unexpected dependents exist, STOP: preserve data.
-- No CASCADE, no rewind of Export, no deletion of execution history.
BEGIN;
DO $empty$ DECLARE t record;n bigint;BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='sgp_linea_operativa_v1' LOOP
 EXECUTE format('SELECT count(*) FROM sgp_linea_operativa_v1.%I',t.tablename) INTO n;
 IF n<>0 THEN RAISE EXCEPTION 'LINEA_ROLLBACK_DATOS_EXISTENTES: %',t.tablename;END IF;
 END LOOP;
END $empty$;
DROP TABLE sgp_linea_operativa_v1.conciliaciones;
DROP TABLE sgp_linea_operativa_v1.cortes_export;
DROP TABLE sgp_linea_operativa_v1.arrastres;
DROP TABLE sgp_linea_operativa_v1.cierres;
DROP TABLE sgp_linea_operativa_v1.eventos;
DROP TABLE sgp_linea_operativa_v1.ordenes_turno;
DROP TABLE sgp_linea_operativa_v1.turnos;
DROP SCHEMA sgp_linea_operativa_v1;
COMMIT;

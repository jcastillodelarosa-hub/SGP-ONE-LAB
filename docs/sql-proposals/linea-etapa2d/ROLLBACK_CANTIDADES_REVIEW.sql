-- REVIEW ONLY. Empty installation only. With evidence, contain instead; do not
-- drop audit or restore a backup over later operations.
BEGIN;
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM sgp_linea_d2q.fuentes) OR EXISTS(SELECT 1 FROM sgp_linea_d2q.validaciones) OR EXISTS(SELECT 1 FROM sgp_linea_d2q.historial_fuentes) THEN RAISE EXCEPTION 'D2Q_CON_EVIDENCIA_CONTENER_NO_BORRAR';END IF;
 IF EXISTS(SELECT 1 FROM sgp_linea_c2.lectores WHERE firma LIKE '%d2q%') THEN RAISE EXCEPTION 'LECTOR_D2Q_REGISTRADO';END IF;
 EXECUTE replace(pg_get_functiondef('sgp_linea_d2q.base_disponible(text)'::regprocedure),'FUNCTION sgp_linea_d2q.base_disponible(', 'FUNCTION sgp_linea_b2.disponible(');
 EXECUTE replace(pg_get_functiondef('sgp_linea_d2q.base_snapshot(text)'::regprocedure),'FUNCTION sgp_linea_d2q.base_snapshot(', 'FUNCTION sgp_linea_b2.snapshot(');
END$$;
DROP TRIGGER d2q_respaldo ON sgp_linea_b2.eventos;
DROP TABLE sgp_linea_d2q.historial_fuentes,sgp_linea_d2q.validaciones,sgp_linea_d2q.fuentes;
DROP FUNCTION sgp_linea_d2q.guardar_ejecucion(),sgp_linea_d2q.invalidar(),sgp_linea_d2q.auditar_fuente(),sgp_linea_d2q.impacto(text),sgp_linea_d2q.validar(text,text,text,bigint,bigint,text,uuid,date,int,text),sgp_linea_d2q.estado(text,text),sgp_linea_d2q.fuente(text),sgp_linea_d2q.base_disponible(text),sgp_linea_d2q.base_snapshot(text);
DROP SCHEMA sgp_linea_d2q;
COMMIT;

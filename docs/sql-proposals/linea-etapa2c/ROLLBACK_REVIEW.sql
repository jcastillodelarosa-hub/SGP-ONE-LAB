-- REVIEW ONLY. Never erase source versions, reports or execution.
BEGIN;
DO $check$ BEGIN
 IF (SELECT md5(string_agg(pg_get_functiondef(p.oid),'' ORDER BY p.proname)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sgp_linea_c2') IS DISTINCT FROM '763db39e134157e2fb97b2edd51718aa' THEN RAISE EXCEPTION 'ROLLBACK_C2_CAMBIADO';END IF;
 IF EXISTS(SELECT 1 FROM sgp_linea_c2.estado) OR EXISTS(SELECT 1 FROM sgp_linea_c2.historial) THEN RAISE EXCEPTION 'ROLLBACK_C2_CON_EVIDENCIA';END IF;
END$check$;
DROP TRIGGER c2_vigencia ON sgp_linea_b2.eventos;
DROP TRIGGER c2_vigencia ON sgp_linea_b2.auditoria;
DROP FUNCTION sgp_linea_c2.guardar_vigencia(),sgp_linea_c2.exigir_vigencia(text),sgp_linea_c2.preparar(text,text,text),sgp_linea_c2.reconciliar(text),sgp_linea_c2.notificar(text,text),sgp_linea_c2.invalidar(text,text),sgp_linea_c2.leer(text,text);
DROP TABLE sgp_linea_c2.historial,sgp_linea_c2.estado,sgp_linea_c2.lectores;
DROP SCHEMA sgp_linea_c2;
COMMIT;

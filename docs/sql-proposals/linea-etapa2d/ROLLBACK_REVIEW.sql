-- REVIEW ONLY. Empty complement only; never delete operational/audit evidence.
BEGIN;
DO $check$ DECLARE t record;n bigint;BEGIN
 IF (SELECT md5(string_agg(pg_get_functiondef(p.oid),'' ORDER BY p.proname)) FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='sgp_linea_d2') IS DISTINCT FROM 'c66c6e799251d738c07c850fc89bf943' THEN RAISE EXCEPTION 'D2_ROLLBACK_CAMBIADO';END IF;
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='sgp_linea_d2' LOOP EXECUTE format('SELECT count(*) FROM sgp_linea_d2.%I',t.tablename) INTO n;IF n<>0 THEN RAISE EXCEPTION 'D2_ROLLBACK_CON_EVIDENCIA';END IF;END LOOP;
END$check$;
DROP TABLE sgp_linea_d2.export_ack,sgp_linea_d2.liberaciones,sgp_linea_d2.vinculos,sgp_linea_d2.unidades,sgp_linea_d2.cobertura,sgp_linea_d2.historial_fuente;
DROP FUNCTION sgp_linea_d2.verificar_ack(),sgp_linea_d2.invalidar(),sgp_linea_d2.impacto(text),sgp_linea_d2.huella_liberacion(uuid,uuid),sgp_linea_d2.asociar(text,text,uuid,uuid,uuid,text,text[],bigint,text,uuid,text),sgp_linea_d2.fuente(uuid,uuid,uuid);
DROP SCHEMA sgp_linea_d2;
COMMIT;

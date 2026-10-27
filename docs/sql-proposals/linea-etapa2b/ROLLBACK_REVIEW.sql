-- REVIEW ONLY. Empty new engine only; never erase operational/evidence rows.
BEGIN;
DO $check$ DECLARE t record;n bigint;BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_linea_motor_b2(text,jsonb)'::regprocedure)<>'ac0f54bd69c2936ef57ca57712edd290' THEN RAISE EXCEPTION 'ROLLBACK_FUNCION_CAMBIADA';END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_linea_disponible_b2(text,text)'::regprocedure)<>'c1b828f7644548ce695efa5b196dad19' THEN RAISE EXCEPTION 'ROLLBACK_FUNCION_CAMBIADA';END IF;

 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='sgp_linea_b2' AND tablename<>'config' LOOP
 EXECUTE format('SELECT count(*) FROM sgp_linea_b2.%I',t.tablename) INTO n;
 IF n<>0 THEN RAISE EXCEPTION 'ROLLBACK_CON_DATOS: %',t.tablename;END IF;END LOOP;
END$check$;
DROP FUNCTION public.sgp_linea_motor_b2(text,jsonb),public.sgp_linea_disponible_b2(text,text);
DROP TABLE sgp_linea_b2.incluidos,sgp_linea_b2.adaptador_solicitudes,sgp_linea_b2.cierres,sgp_linea_b2.arrastres,sgp_linea_b2.solicitudes,sgp_linea_b2.auditoria,sgp_linea_b2.permisos,sgp_linea_b2.ordenes,sgp_linea_b2.turnos,sgp_linea_b2.unidades,sgp_linea_b2.bloqueos;
DROP TABLE sgp_linea_b2.eventos;
ALTER TABLE sgp_linea_b2.producciones DROP CONSTRAINT producciones_corte_fkey;
DROP TABLE sgp_linea_b2.cortes,sgp_linea_b2.producciones,sgp_linea_b2.config;
DO $functions$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure::text firma FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sgp_linea_b2' LOOP EXECUTE 'DROP FUNCTION '||f.firma;END LOOP;
END$functions$;
DROP SCHEMA sgp_linea_b2;
COMMIT;

-- Recuperación de 03_session_scoped_REVIEW.sql: restaura el cuerpo anterior.
-- No revierte datos ni modifica ACL. Aplicar solo si la huella nueva coincide.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$ DECLARE p pg_proc%ROWTYPE; BEGIN
 SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure('sgp_lp_operacion.sesion(text,text,text,text)');
 IF p.oid IS NULL OR md5(p.prosrc)<>'3416a2f6e5640577a4a07c554e26c55e'
 OR p.proowner<>(SELECT oid FROM pg_roles WHERE rolname='postgres')
 OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
 OR p.proacl::text IS DISTINCT FROM '{postgres=X/postgres}'
 THEN RAISE EXCEPTION 'LP_SESSION_ROLLBACK_DRIFT'; END IF;
END $guard$;
CREATE OR REPLACE FUNCTION sgp_lp_operacion.sesion(token text, et text, k text DEFAULT NULL, line_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE s jsonb; BEGIN PERFORM sgp_lp_operacion.contener_ambitos(); s:=public.sgp_sesion_actual(token);
 IF s->>'valida' IS DISTINCT FROM 'true' OR nullif(s->>'usuario','') IS NULL OR (coalesce(s->>'rol','') NOT IN('LIDER','LIDER LINEA','COORDINADOR','ADMINISTRADOR','CONSULTA') AND NOT((SELECT habilitado FROM sgp_lp_operacion.perfil_roles WHERE id) AND s->>'rol' IN('SUPERVISOR ENSAMBLE','SUPERVISOR EMPAQUE'))) THEN RAISE EXCEPTION 'SESION_NO_AUTORIZADA'; END IF;
 IF et IS NULL OR et NOT IN('ENSAMBLE','EMPAQUE') OR line_id IS NULL OR NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo() p WHERE p.usuario=s->>'usuario' AND p.etapa=et AND(k IS NULL OR p.key=k) AND EXISTS(SELECT 1 FROM public.sgp_producciones x WHERE x.key_produccion=p.key AND x.id_linea=line_id)) THEN RAISE EXCEPTION 'AMBITO_DENEGADO'; END IF;
 RETURN s; END $body$;
DO $guard$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='sgp_lp_operacion.sesion(text,text,text,text)'::regprocedure)<>'f06e86fb101d602de053faa50d6696b3'
 THEN RAISE EXCEPTION 'LP_SESSION_ROLLBACK_FAILED'; END IF;
END $guard$;
COMMIT;

-- REVIEW ONLY: requires action-specific authorization before any production use.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(184,11);
DO $owner$ BEGIN
 IF current_user<>(SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.sgp_lp_operacion_comando(text,jsonb)'::regprocedure)
 OR current_user<>(SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='sgp_lp_operacion.operaciones_rol(text,text)'::regprocedure)
 THEN RAISE EXCEPTION 'OWNER_MISMATCH'; END IF;
END $owner$;
DO $dependency$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE pronamespace='sgp_lp_operacion'::regnamespace AND proname='sesion') IS DISTINCT FROM 'f06e86fb101d602de053faa50d6696b3' THEN RAISE EXCEPTION 'AUTH_DEPENDENCY_DRIFT: sesion'; END IF; END $dependency$;
DO $dependency$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE pronamespace='sgp_lp_operacion'::regnamespace AND proname='contener_ambitos') IS DISTINCT FROM '4bd286da759a7f14d9bb0b49dd9fff16' THEN RAISE EXCEPTION 'AUTH_DEPENDENCY_DRIFT: contener_ambitos'; END IF; END $dependency$;
DO $dependency$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE pronamespace='sgp_lp_operacion'::regnamespace AND proname='permisos_en_periodo') IS DISTINCT FROM '2bcf1551c9de003898e4bf663fe544b6' THEN RAISE EXCEPTION 'AUTH_DEPENDENCY_DRIFT: permisos_en_periodo'; END IF; END $dependency$;
DO $dependency$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE pronamespace='sgp_lp_operacion'::regnamespace AND proname='acceso_rol') IS DISTINCT FROM '198c0afba93e748b8fd40e3eda5f8cfc' THEN RAISE EXCEPTION 'AUTH_DEPENDENCY_DRIFT: acceso_rol'; END IF; END $dependency$;
DO $dependency$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE pronamespace='sgp_lp_operacion'::regnamespace AND proname='puede_operar') IS DISTINCT FROM 'b0b7459a0be0a7ea5a4a392eecb2afde' THEN RAISE EXCEPTION 'AUTH_DEPENDENCY_DRIFT: puede_operar'; END IF; END $dependency$;
DO $verify$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.sgp_lp_operacion_comando(text,jsonb)')) IS DISTINCT FROM '5d962fc5b2595e0420124b340f9bbe3a'
 OR (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid=to_regprocedure('public.sgp_lp_operacion_comando(text,jsonb)')) IS DISTINCT FROM current_user
 OR (SELECT prosecdef FROM pg_proc WHERE oid=to_regprocedure('public.sgp_lp_operacion_comando(text,jsonb)')) IS DISTINCT FROM true
 OR (SELECT proconfig FROM pg_proc WHERE oid=to_regprocedure('public.sgp_lp_operacion_comando(text,jsonb)')) IS DISTINCT FROM ARRAY['search_path=""']::text[]
 THEN RAISE EXCEPTION 'INSTALLED_SOURCE_OR_OWNER_DRIFT: public.sgp_lp_operacion_comando(text,jsonb)'; END IF;
END $verify$;
DO $verify$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('sgp_lp_operacion.operaciones_rol(text,text)')) IS DISTINCT FROM '69274f528a2fed8001da535856649036'
 OR (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid=to_regprocedure('sgp_lp_operacion.operaciones_rol(text,text)')) IS DISTINCT FROM current_user
 OR (SELECT prosecdef FROM pg_proc WHERE oid=to_regprocedure('sgp_lp_operacion.operaciones_rol(text,text)')) IS DISTINCT FROM false
 OR (SELECT proconfig FROM pg_proc WHERE oid=to_regprocedure('sgp_lp_operacion.operaciones_rol(text,text)')) IS DISTINCT FROM ARRAY['search_path=""']::text[]
 THEN RAISE EXCEPTION 'INSTALLED_SOURCE_OR_OWNER_DRIFT: sgp_lp_operacion.operaciones_rol(text,text)'; END IF;
END $verify$;
DO $verify$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('sgp_lp_operacion.seguimiento_prototipo(text,text,text)')) IS DISTINCT FROM '21853cbd46c825d96f3e12534b6bcf8e'
 OR (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid=to_regprocedure('sgp_lp_operacion.seguimiento_prototipo(text,text,text)')) IS DISTINCT FROM current_user
 OR (SELECT prosecdef FROM pg_proc WHERE oid=to_regprocedure('sgp_lp_operacion.seguimiento_prototipo(text,text,text)')) IS DISTINCT FROM false
 OR (SELECT proconfig FROM pg_proc WHERE oid=to_regprocedure('sgp_lp_operacion.seguimiento_prototipo(text,text,text)')) IS DISTINCT FROM ARRAY['search_path=""']::text[]
 THEN RAISE EXCEPTION 'INSTALLED_SOURCE_OR_OWNER_DRIFT: sgp_lp_operacion.seguimiento_prototipo(text,text,text)'; END IF;
END $verify$;
DO $verify$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.sgp_lp_seguimiento_consultar(text,text,text)')) IS DISTINCT FROM '8da826bfee51a1a4206c8c29fc7a0bff'
 OR (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid=to_regprocedure('public.sgp_lp_seguimiento_consultar(text,text,text)')) IS DISTINCT FROM current_user
 OR (SELECT prosecdef FROM pg_proc WHERE oid=to_regprocedure('public.sgp_lp_seguimiento_consultar(text,text,text)')) IS DISTINCT FROM true
 OR (SELECT proconfig FROM pg_proc WHERE oid=to_regprocedure('public.sgp_lp_seguimiento_consultar(text,text,text)')) IS DISTINCT FROM ARRAY['search_path=""']::text[]
 THEN RAISE EXCEPTION 'INSTALLED_SOURCE_OR_OWNER_DRIFT: public.sgp_lp_seguimiento_consultar(text,text,text)'; END IF;
END $verify$;
-- Preserve coordinator-only validation. Never restore broader historical permissions.
DO $contained$ BEGIN
 IF has_function_privilege('anon','public.sgp_lp_seguimiento_consultar(text,text,text)','EXECUTE') OR has_function_privilege('authenticated','public.sgp_lp_seguimiento_consultar(text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'CONTAIN_API_FIRST'; END IF;
END $contained$;
DROP FUNCTION public.sgp_lp_seguimiento_consultar(text,text,text) RESTRICT;
DROP FUNCTION sgp_lp_operacion.seguimiento_prototipo(text,text,text) RESTRICT;
NOTIFY pgrst, 'reload schema';
COMMIT;

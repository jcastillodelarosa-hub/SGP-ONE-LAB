-- REVIEW ONLY: requires action-specific authorization before any production use.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(184,11);
DO $owner$ BEGIN
 IF current_user<>(SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.sgp_lp_operacion_comando(text,jsonb)'::regprocedure)
 OR current_user<>(SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='sgp_lp_operacion.operaciones_rol(text,text)'::regprocedure)
 THEN RAISE EXCEPTION 'OWNER_MISMATCH'; END IF;
END $owner$;
DO $absent$ BEGIN
 IF to_regprocedure('public.sgp_lp_seguimiento_consultar(text,text,text)') IS NOT NULL OR to_regprocedure('sgp_lp_operacion.seguimiento_prototipo(text,text,text)') IS NOT NULL THEN RAISE EXCEPTION 'OBJECT_ALREADY_EXISTS'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname='sgp_lp_seguimiento_consultar') THEN RAISE EXCEPTION 'OVERLOAD_NOT_ADMITTED'; END IF;
 IF NOT has_schema_privilege('anon','public','USAGE') THEN RAISE EXCEPTION 'PUBLIC_SCHEMA_USAGE_MISSING'; END IF;
END $absent$;
CREATE TEMP TABLE lp_tracking_metadata ON COMMIT DROP AS SELECT oid,proowner,proacl,prosecdef,proconfig FROM pg_proc WHERE oid IN('public.sgp_lp_operacion_comando(text,jsonb)'::regprocedure,'sgp_lp_operacion.operaciones_rol(text,text)'::regprocedure);
DO $existing$ DECLARE c text;r text; BEGIN
 SELECT md5(prosrc) INTO c FROM pg_proc WHERE oid='public.sgp_lp_operacion_comando(text,jsonb)'::regprocedure;
 SELECT md5(prosrc) INTO r FROM pg_proc WHERE oid='sgp_lp_operacion.operaciones_rol(text,text)'::regprocedure;
 IF c='6327a5478c11ae6ba9a13e6966d42162' AND r='5e404be5761038bf569ac1d5c7b5fdd3' THEN
 EXECUTE $changes$DO $patch$ DECLARE d text;b text; BEGIN
 SELECT pg_get_functiondef(oid),prosrc INTO STRICT d,b FROM pg_proc WHERE oid='public.sgp_lp_operacion_comando(text,jsonb)'::regprocedure;
 IF md5(b)<>'6327a5478c11ae6ba9a13e6966d42162' THEN RAISE EXCEPTION 'BASE_INCOMPATIBLE'; END IF;
 EXECUTE replace(d,b,replace(b,$needle$ IF op IN('ABRIR','SALE','VALIDAR','REABRIR','LIBERAR')$needle$,$guard$ IF op='VALIDAR' AND s->>'rol' IS DISTINCT FROM 'COORDINADOR' THEN RAISE EXCEPTION 'CONSOLIDADO_SOLO_COORDINADOR'; END IF;
 IF op IN('ABRIR','SALE','VALIDAR','REABRIR','LIBERAR')$guard$));
END $patch$;
DO $patch$ DECLARE d text;b text; BEGIN
 SELECT pg_get_functiondef(oid),prosrc INTO STRICT d,b FROM pg_proc WHERE oid='sgp_lp_operacion.operaciones_rol(text,text)'::regprocedure;
 IF md5(b)<>'5e404be5761038bf569ac1d5c7b5fdd3' THEN RAISE EXCEPTION 'BASE_INCOMPATIBLE'; END IF;
 EXECUTE replace(d,b,$body$
 SELECT CASE WHEN et NOT IN('ENSAMBLE','EMPAQUE') THEN ARRAY[]::text[]
 WHEN r='COORDINADOR' THEN ARRAY['LEER','ABRIR','SALE','EJECUTAR','NOTA','AFECTAR','VALIDAR','IMPORTAR_BI','IMPORTAR_XLSX','CERRAR','REABRIR','LIBERAR']
 WHEN r='ADMINISTRADOR' THEN ARRAY['LEER','ABRIR','SALE','EJECUTAR','NOTA','AFECTAR','IMPORTAR_BI','IMPORTAR_XLSX','CERRAR','REABRIR','LIBERAR']
 WHEN r='LIDER LINEA' OR(r='SUPERVISOR ENSAMBLE' AND et='ENSAMBLE') OR(r='SUPERVISOR EMPAQUE' AND et='EMPAQUE') THEN ARRAY['LEER','EJECUTAR','NOTA','AFECTAR','IMPORTAR_BI','IMPORTAR_XLSX','CERRAR']
 WHEN r='CONSULTA' THEN ARRAY['LEER'] ELSE ARRAY[]::text[] END
$body$);
END $patch$;
$changes$;
 ELSIF c<>'5d962fc5b2595e0420124b340f9bbe3a' OR r<>'69274f528a2fed8001da535856649036' THEN RAISE EXCEPTION 'BASE_INCOMPATIBLE'; END IF;
END $existing$;
CREATE FUNCTION sgp_lp_operacion.seguimiento_prototipo(token text,et text,line_id text)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE s jsonb; result jsonb;
BEGIN
 s:=sgp_lp_operacion.sesion(token,et,NULL,line_id);
 IF s->>'rol' NOT IN('COORDINADOR','ADMINISTRADOR') THEN RAISE EXCEPTION 'SEGUIMIENTO_NO_AUTORIZADO'; END IF;
 SELECT jsonb_build_object('contract','LP-SEGUIMIENTO-1','role',s->>'rol','line',line_id,'stage',et,
 'productions',coalesce(jsonb_agg(jsonb_build_object(
 'identity',jsonb_build_array(p.key_produccion,et),'key',p.key_produccion,'line',p.id_linea,'stage',et,
 'oficial',jsonb_build_object('key_produccion',to_jsonb(p)->'key_produccion','produccion',to_jsonb(p)->'produccion','id_linea',to_jsonb(p)->'id_linea','sistema',to_jsonb(p)->'sistema','reserva_al',to_jsonb(p)->'reserva_al','saldos_inicializados',to_jsonb(p)->'saldos_inicializados','presente_ultimo_export',to_jsonb(p)->'presente_ultimo_export','saldo_ensamble',to_jsonb(p)->'saldo_ensamble','saldo_empaque',to_jsonb(p)->'saldo_empaque','semana_base',to_jsonb(p)->'semana_base','anio',to_jsonb(p)->'anio','ultima_carga_diaria',to_jsonb(p)->'ultima_carga_diaria','ultima_vez_export',to_jsonb(p)->'ultima_vez_export'),'saldo',q.saldo,'classification',CASE WHEN q.saldo>0 THEN 'ABIERTA' ELSE 'PENDIENTE_CONCILIACION' END,
 'history',coalesce((SELECT jsonb_agg(jsonb_build_object('id',to_jsonb(h)->'id','key',to_jsonb(h)->'key','parte',to_jsonb(h)->'parte','linea',to_jsonb(h)->'linea','etapa',to_jsonb(h)->'etapa','fecha',to_jsonb(h)->'fecha','turno',to_jsonb(h)->'turno','operacion',to_jsonb(h)->'operacion','usuario',to_jsonb(h)->'usuario','creado_en',to_jsonb(h)->'creado_en','payload',jsonb_build_object('observation',h.payload->'observation')) ORDER BY h.creado_en) FROM sgp_lp_operacion.auditoria h WHERE h.key=p.key_produccion AND h.etapa=et AND h.linea=line_id),'[]'::jsonb),
 'assignments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',to_jsonb(a)->'id','key_produccion',to_jsonb(a)->'key_produccion','fecha',to_jsonb(a)->'fecha','turno',to_jsonb(a)->'turno','cantidad',to_jsonb(a)->'cantidad','prioridad',to_jsonb(a)->'prioridad','estado',to_jsonb(a)->'estado','origen_id',to_jsonb(a)->'origen_id') ORDER BY a.fecha,a.turno,a.id) FROM public.sgp_linea_plan_asignaciones a WHERE a.key_produccion=p.key_produccion),'[]'::jsonb),
 'operations',coalesce((SELECT jsonb_agg(jsonb_build_object('key',to_jsonb(o)->'key','parte',to_jsonb(o)->'parte','linea',to_jsonb(o)->'linea','etapa',to_jsonb(o)->'etapa','fecha',to_jsonb(o)->'fecha','turno',to_jsonb(o)->'turno','sale',to_jsonb(o)->'sale','ejecutado',to_jsonb(o)->'ejecutado','revision',to_jsonb(o)->'revision','prioridad',to_jsonb(o)->'prioridad','origen_fecha',to_jsonb(o)->'origen_fecha','origen_turno',to_jsonb(o)->'origen_turno','antiguedad_fecha',to_jsonb(o)->'antiguedad_fecha','antiguedad_turno',to_jsonb(o)->'antiguedad_turno','afectaciones',to_jsonb(o)->'afectaciones','consolidado',to_jsonb(o)->'consolidado','validado',to_jsonb(o)->'validado','observacion',to_jsonb(o)->'observacion','sale_fuente',to_jsonb(o)->'sale_fuente','sale_estado',to_jsonb(o)->'sale_estado') ORDER BY o.fecha,o.turno,o.parte) FROM sgp_lp_operacion.ordenes o WHERE o.key=p.key_produccion AND o.linea=line_id AND o.etapa=et),'[]'::jsonb)
 ) ORDER BY p.key_produccion),'[]'::jsonb)) INTO result
 FROM public.sgp_producciones p
 CROSS JOIN LATERAL (SELECT CASE WHEN p.saldos_inicializados AND p.presente_ultimo_export AND
 (CASE et WHEN 'ENSAMBLE' THEN p.saldo_ensamble ELSE p.saldo_empaque END)>=0 AND
 trunc(CASE et WHEN 'ENSAMBLE' THEN p.saldo_ensamble ELSE p.saldo_empaque END)=(CASE et WHEN 'ENSAMBLE' THEN p.saldo_ensamble ELSE p.saldo_empaque END)
 THEN CASE et WHEN 'ENSAMBLE' THEN p.saldo_ensamble ELSE p.saldo_empaque END ELSE NULL END AS saldo) q
 WHERE p.id_linea=line_id AND EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo() a WHERE a.usuario=s->>'usuario' AND a.etapa=et AND a.key=p.key_produccion)
 AND (q.saldo IS NULL OR q.saldo>0 OR EXISTS(
 SELECT 1 FROM public.sgp_linea_plan_asignaciones a
 LEFT JOIN public.sgp_linea_plan_asignaciones root ON root.id=sgp_lp_operacion.raiz(a.id,a.key_produccion)
 WHERE a.key_produccion=p.key_produccion AND a.estado IS DISTINCT FROM 'CANCELADA'
 AND (root.cantidad IS NULL OR root.cantidad>(SELECT coalesce(sum(o.ejecutado),0) FROM sgp_lp_operacion.ordenes o WHERE o.key=p.key_produccion AND o.etapa=et AND o.parte=root.id))
 ) OR EXISTS(
 SELECT 1 FROM (SELECT DISTINCT ON(o.parte) o.* FROM sgp_lp_operacion.ordenes o
 WHERE o.key=p.key_produccion AND o.linea=line_id AND o.etapa=et ORDER BY o.parte,o.fecha DESC,o.turno DESC) latest
 WHERE latest.sale>latest.ejecutado OR coalesce(latest.consolidado,0)>0
 OR EXISTS(SELECT 1 FROM jsonb_each_text(latest.afectaciones) a WHERE a.value::numeric>0)
 ));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION sgp_lp_operacion.seguimiento_prototipo(text,text,text) FROM PUBLIC,anon,authenticated;
-- Facade prepared for future reviewed deployment. No API grant in this prototype.
CREATE FUNCTION public.sgp_lp_seguimiento_consultar(p_token text,p_etapa text,p_linea text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT sgp_lp_operacion.seguimiento_prototipo(p_token,p_etapa,p_linea)
$$;
REVOKE ALL ON FUNCTION public.sgp_lp_seguimiento_consultar(text,text,text) FROM PUBLIC,anon,authenticated;
-- Remove only this new facade's inherited service_role grant; preserve project defaults.
REVOKE ALL ON FUNCTION public.sgp_lp_seguimiento_consultar(text,text,text) FROM service_role;
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
DO $preserved$ BEGIN
 IF EXISTS(SELECT 1 FROM lp_tracking_metadata b JOIN pg_proc p USING(oid) WHERE ROW(b.proowner,b.proacl,b.prosecdef,b.proconfig) IS DISTINCT FROM ROW(p.proowner,p.proacl,p.prosecdef,p.proconfig)) THEN RAISE EXCEPTION 'FUNCTION_METADATA_CHANGED'; END IF;
END $preserved$;
DO $acl$ BEGIN IF EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid IN('public.sgp_lp_seguimiento_consultar(text,text,text)'::regprocedure,'sgp_lp_operacion.seguimiento_prototipo(text,text,text)'::regprocedure) AND a.grantee<>p.proowner) THEN RAISE EXCEPTION 'UNEXPECTED_FUNCTION_ACL'; END IF; END $acl$;
NOTIFY pgrst, 'reload schema';
COMMIT;

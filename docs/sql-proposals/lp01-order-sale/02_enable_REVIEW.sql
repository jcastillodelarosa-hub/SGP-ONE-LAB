-- REVIEW ONLY. Execute only after independent live metadata preflight, explicit two-RPC
-- anon approval, deployment readiness, and matching installed installer identity.
BEGIN;
SET LOCAL search_path='';SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='15s';
DO $guard$ DECLARE sig text;oid_ oid;p pg_proc%rowtype;BEGIN
 IF current_user<>'postgres' OR to_regnamespace('sgp_lp_sale_orden') IS NULL
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon' AND NOT rolsuper AND NOT rolbypassrls)
 OR pg_has_role('anon','postgres','MEMBER')
 OR (SELECT count(*) FROM sgp_lp_sale_orden.config)<>1
 OR (SELECT definitions_enabled FROM sgp_lp_sale_orden.config WHERE id) IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'SALE_ORDER_ENABLE_PRECONDITION';END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('sgp_lp_afectaciones.actor(text,text,text,text,date,integer)')) IS DISTINCT FROM 'ad60fdc6dd01904c366010467f96e6ca'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.sgp_lp_afectaciones_consultar_v2(text,text,text)')) IS DISTINCT FROM 'a74f14fefe3a3d91201423fdc3111d7a'
 THEN RAISE EXCEPTION 'SALE_ORDER_ENABLE_DEPENDENCY_DRIFT';END IF;
 FOREACH sig IN ARRAY ARRAY['public.sgp_lp_sale_orden_consultar_v1(text,text,text)','public.sgp_lp_sale_orden_definir_v1(text,text,text,jsonb)'] LOOP
  oid_:=to_regprocedure(sig);IF oid_ IS NULL THEN RAISE EXCEPTION 'SALE_ORDER_ENABLE_API_MISSING: %',sig;END IF;
  SELECT * INTO p FROM pg_proc WHERE oid=oid_;
  IF p.proowner<>(SELECT oid FROM pg_roles WHERE rolname='postgres') OR NOT p.prosecdef
   OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[] OR p.prorettype<>'jsonb'::regtype
   OR (p.proname='sgp_lp_sale_orden_consultar_v1' AND md5(p.prosrc)<>'6ca3e65a9248a55f973d26836744f757')
   OR (p.proname='sgp_lp_sale_orden_definir_v1' AND md5(p.prosrc)<>'d7aa1edaea6a22004226e4a73a6fb61f')
   OR (SELECT count(*) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))))<>1
   OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee<>p.proowner OR a.privilege_type<>'EXECUTE' OR a.is_grantable)
  THEN RAISE EXCEPTION 'SALE_ORDER_ENABLE_API_DRIFT: %',sig;END IF;
 END LOOP;
 IF has_schema_privilege('anon','sgp_lp_sale_orden','USAGE')
 OR has_table_privilege('anon','sgp_lp_sale_orden.definiciones','SELECT')
 OR has_table_privilege('anon','sgp_lp_sale_orden.eventos','SELECT')
 OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='sgp_lp_sale_orden' AND c.relkind IN('r','p') AND NOT c.relrowsecurity)
 THEN RAISE EXCEPTION 'SALE_ORDER_ENABLE_PRIVATE_ACCESS';END IF;
END; $guard$;
GRANT EXECUTE ON FUNCTION public.sgp_lp_sale_orden_consultar_v1(text,text,text),public.sgp_lp_sale_orden_definir_v1(text,text,text,jsonb) TO anon;
UPDATE sgp_lp_sale_orden.config SET definitions_enabled=true WHERE id=true AND definitions_enabled=false;
DO $check$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM sgp_lp_sale_orden.config WHERE id AND definitions_enabled)
 OR NOT has_function_privilege('anon','public.sgp_lp_sale_orden_consultar_v1(text,text,text)','EXECUTE')
 OR NOT has_function_privilege('anon','public.sgp_lp_sale_orden_definir_v1(text,text,text,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'SALE_ORDER_ENABLE_POSTCHECK';END IF;
END; $check$;
COMMIT;

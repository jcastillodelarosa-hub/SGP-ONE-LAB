-- Read-only postcheck; absence or unexpected ACL/security/search_path stops activation.
SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,p.prosecdef,
 p.proconfig,pg_get_userbyid(p.proowner) AS owner,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute,
 EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute
FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
AND p.proname IN('sgp_opt_import_contexto_retail_v3','sgp_opt_importar_retail_validado_v3')
ORDER BY p.proname;
-- Expected exactly two matching signatures, definer true, empty search_path,
-- anon/authenticated/public false and service true. Owner reviewed against baseline.

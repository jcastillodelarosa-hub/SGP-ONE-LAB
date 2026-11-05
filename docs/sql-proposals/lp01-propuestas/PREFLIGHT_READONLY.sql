BEGIN READ ONLY;
SELECT p.oid::regprocedure::text AS signature,md5(p.prosrc) AS body_md5,
       pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS security_definer,p.proconfig AS config,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE (n.nspname='public' AND p.proname IN('sgp_lp_operacion_consultar','sgp_lp_operacion_comando','sgp_lp_afectaciones_consultar_v2','sgp_lp_propuesta_v1'))
   OR (n.nspname='sgp_lp_operacion' AND p.proname IN('sesion','admitir','verificar_temporal','siguiente','puede_operar','inmutable'))
ORDER BY signature;
ROLLBACK;

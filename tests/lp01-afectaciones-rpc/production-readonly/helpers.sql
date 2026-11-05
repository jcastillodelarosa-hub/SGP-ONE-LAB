BEGIN READ ONLY; SET LOCAL statement_timeout='15s';
SELECT p.oid::regprocedure::text AS signature,md5(prosrc) AS body_md5,prosecdef AS security_definer,proconfig,pg_get_userbyid(proowner) AS owner,pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN('sgp_mecanizado_es_parte','sgp_pdt_origenes_internal_v3','sgp_pdt_contexto_internal_v3','sgp_pdt_crear_internal_v3','sgp_pdt_linea_maestro_v3','sgp_validar_sesion_rol')
ORDER BY signature; ROLLBACK;

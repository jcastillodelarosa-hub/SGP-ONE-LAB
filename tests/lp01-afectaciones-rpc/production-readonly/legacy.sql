BEGIN READ ONLY; SET LOCAL statement_timeout='15s';
SELECT p.oid::regprocedure::text AS signature,md5(prosrc) AS body_md5,pg_get_userbyid(proowner) AS owner,prosecdef AS security_definer,proconfig,pg_get_functiondef(p.oid) AS definition
FROM pg_proc p WHERE p.oid=to_regprocedure('sgp_mecanizado_parcial.registro_legacy(text,text,jsonb,jsonb,uuid)');
ROLLBACK;

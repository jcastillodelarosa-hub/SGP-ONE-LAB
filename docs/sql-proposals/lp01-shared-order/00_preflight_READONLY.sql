BEGIN READ ONLY;
SELECT to_regnamespace('sgp_lp_shared_order') AS existing_schema,
 to_regclass('public.sgp_nc_vidrio') AS nc_source,
 to_regclass('public.sgp_accesorios') AS accessory_source;
SELECT p.oid::regprocedure AS signature,pg_get_userbyid(p.proowner) AS owner,p.proconfig,p.proacl,md5(pg_get_functiondef(p.oid)) AS definition_md5
FROM pg_proc p WHERE p.oid IN(to_regprocedure('sgp_lp_order_details.authorize(text,text,text,text)'),to_regprocedure('sgp_lp_operacion.admitir()'),to_regprocedure('sgp_lp_operacion.puede_operar(text,text,text)'));
ROLLBACK;

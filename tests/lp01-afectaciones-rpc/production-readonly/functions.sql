BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT n.nspname AS schema,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
md5(p.prosrc) AS body_md5,md5(pg_get_functiondef(p.oid)) AS definition_md5,
p.prosecdef AS security_definer,p.provolatile AS volatility,p.proconfig,
pg_get_userbyid(p.proowner) AS owner,
has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE (n.nspname='sgp_lp_operacion' AND p.proname IN('sesion','contener_ambitos','verificar_temporal','operaciones_rol','admitir','saldo','puede_operar','permisos_en_periodo'))
OR (n.nspname='sgp_pdt_multiorigen' AND p.proname IN('actor','registrar','fuentes','identidad'))
OR (n.nspname='public' AND p.proname IN('sgp_sesion_actual','sgp_pdt_validar_rol_real','sgp_pdt_registrar_v4','sgp_pdt_registro_fuentes_v4','sgp_picking_piezas_panel'))
ORDER BY n.nspname,p.proname,arguments;
ROLLBACK;

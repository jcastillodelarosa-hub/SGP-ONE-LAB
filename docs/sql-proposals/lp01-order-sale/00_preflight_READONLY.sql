-- READ ONLY. Collect current metadata; never repair ACLs to match a test fixture.
BEGIN READ ONLY;
SET LOCAL search_path=''; SET LOCAL statement_timeout='15s';
WITH requested(signature) AS (VALUES
 ('sgp_lp_afectaciones.actor(text,text,text,text,date,integer)'),
 ('public.sgp_lp_afectaciones_consultar_v2(text,text,text)'),
 ('public.sgp_lp_afectaciones_consultar_v1(text,text,text)'),
 ('sgp_lp_operacion.saldo(text,text)'),
 ('sgp_lp_operacion.puede_operar(text,text,text)'),
 ('public.sgp_lp_sale_orden_consultar_v1(text,text,text)'),
 ('public.sgp_lp_sale_orden_definir_v1(text,text,text,jsonb)'))
SELECT r.signature,p.oid IS NOT NULL AS present,md5(p.prosrc) AS body_md5,
 pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS security_definer,p.proconfig,
 pg_get_function_result(p.oid) AS result,
 (SELECT jsonb_agg(jsonb_build_object('role',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY a.grantee)
  FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a) AS acl
FROM requested r LEFT JOIN pg_proc p ON p.oid=to_regprocedure(r.signature) ORDER BY r.signature;
SELECT to_regnamespace('sgp_lp_sale_orden') IS NOT NULL AS new_schema_present;
SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN ('postgres','anon','authenticated','service_role');
SELECT n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE (n.nspname='public' AND c.relname='sgp_producciones') OR n.nspname='sgp_lp_sale_orden';
COMMIT;
-- Full existing LP helper metadata, including indirect PL/pgSQL dependencies.
-- pg_depend alone does not prove dependencies of PL/pgSQL function bodies.
BEGIN READ ONLY;
SET LOCAL search_path='';SET LOCAL statement_timeout='15s';
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
 pg_get_function_result(p.oid) AS result,md5(p.prosrc) AS body_md5,
 pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig,
 (SELECT jsonb_agg(jsonb_build_object('role',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY a.grantee)
 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a) AS acl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('sgp_lp_operacion','sgp_lp_afectaciones','sgp_lp_sale_orden')
 OR(n.nspname='public' AND(p.proname LIKE 'sgp_lp_%' OR p.proname IN ('sgp_sesion_actual','sgp_mis_accesos','sgp_pdt_validar_rol_real')))
ORDER BY n.nspname,p.proname,p.oid;
SELECT n.nspname,c.relname,a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,
 pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
WHERE c.relkind IN ('r','p') AND(n.nspname IN ('sgp_lp_afectaciones','sgp_lp_operacion','sgp_lp_sale_orden')
 OR(n.nspname='public' AND c.relname IN ('sgp_producciones','sgp_usuarios','sgp_sesiones_app','sgp_usuario_accesos','sgp_aluminio_pendientes','sgp_linea_plan_asignaciones')))
ORDER BY n.nspname,c.relname,a.attnum;
SELECT r.rolname,pg_has_role(r.oid,'postgres','MEMBER') AS member_postgres,
 has_schema_privilege(r.oid,n.oid,'USAGE') AS schema_usage,n.nspname
FROM pg_roles r CROSS JOIN pg_namespace n
WHERE r.rolname IN ('anon','authenticated','service_role') AND n.nspname IN ('sgp_lp_operacion','sgp_lp_afectaciones','sgp_lp_sale_orden');
COMMIT;

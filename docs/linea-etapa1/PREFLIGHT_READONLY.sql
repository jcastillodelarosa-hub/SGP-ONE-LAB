-- Metadata only. PREPARED, NOT EXECUTED. No sessions or operational rows.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT jsonb_build_object('signature',p.oid::regprocedure::text,
 'arguments',pg_get_function_arguments(p.oid),'result',pg_get_function_result(p.oid),
 'definition',pg_get_functiondef(p.oid),'md5_definition',md5(pg_get_functiondef(p.oid)),
 'security_definer',p.prosecdef,'owner',pg_get_userbyid(p.proowner),'config',p.proconfig,'acl',p.proacl)
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind='f' AND p.proname IN
('sgp_linea_plan_consultar','sgp_linea_plan_programar','sgp_linea_plan_mover',
 'sgp_linea_plan_arrastrar','sgp_linea_plan_registrar','sgp_linea_plan_explorador_v327');
SELECT c.oid::regclass::text AS relation,c.relrowsecurity,c.relforcerowsecurity,c.relacl,
 (SELECT jsonb_agg(jsonb_build_object('column',a.attname,'type',format_type(a.atttypid,a.atttypmod),
 'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid))) FROM pg_attribute a
 LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
 (SELECT jsonb_agg(pg_get_constraintdef(x.oid)) FROM pg_constraint x WHERE x.conrelid=c.oid) AS constraints,
 (SELECT jsonb_agg(pg_get_triggerdef(t.oid)) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal) AS triggers
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
AND c.relname IN ('sgp_linea_plan_asignaciones','sgp_linea_plan_ejecuciones','sgp_producciones');
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN ('sgp_linea_plan_asignaciones','sgp_linea_plan_ejecuciones','sgp_producciones');
ROLLBACK;

BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT now() AS observed_at,
 (SELECT to_jsonb(c) FROM sgp_lp_afectaciones.config c WHERE id) AS flags,
 (SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'md5',md5(p.prosrc),'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text,'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service_role',has_function_privilege('service_role',p.oid,'EXECUTE')) ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'sgp_lp_afectaciones_%') AS api,
 (SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'usage',has_schema_privilege(r.oid,'sgp_lp_afectaciones','USAGE'),'create',has_schema_privilege(r.oid,'sgp_lp_afectaciones','CREATE'))) FROM pg_roles r WHERE r.rolname IN('anon','authenticated','service_role')) AS private_schema,
 (SELECT jsonb_agg(jsonb_build_object('table',c.relname,'rls',c.relrowsecurity,'acl',c.relacl::text)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='sgp_lp_afectaciones' AND c.relkind IN('r','p')) AS private_tables,
 (SELECT jsonb_build_object('md5',md5(prosrc),'acl',proacl::text,'owner',pg_get_userbyid(proowner),'definer',prosecdef,'config',proconfig) FROM pg_proc WHERE oid='sgp_pdt_multiorigen.registrar(text,text,jsonb,jsonb,uuid,uuid)'::regprocedure) AS shared_pdt,
 (SELECT count(*) FROM sgp_lp_afectaciones.reportes) AS report_count,
 (SELECT count(*) FROM sgp_lp_afectaciones.eventos) AS event_count,
 (SELECT count(*) FROM sgp_lp_afectaciones.pdt_recibos) AS receipt_count;
ROLLBACK;

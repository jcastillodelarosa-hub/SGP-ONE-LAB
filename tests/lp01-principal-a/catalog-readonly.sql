-- Catalog only. Never invokes the example business function or reads productive rows.
SELECT jsonb_build_object(
 'server_version',current_setting('server_version'),
 'lp_schema_present',to_regnamespace('sgp_lp_operacion') IS NOT NULL,
 'public_database_acl',(SELECT jsonb_agg(a.privilege_type ORDER BY a.privilege_type) FROM pg_database d CROSS JOIN LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a WHERE d.datname=current_database() AND a.grantee=0),
 'public_schema_acl',(SELECT jsonb_agg(a.privilege_type ORDER BY a.privilege_type) FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='public' AND a.grantee=0),
 'sgp_public_secdef_total',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND left(p.proname,4)='sgp_' AND p.prosecdef AND EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE')),
 'sgp_public_secdef_callable',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND left(p.proname,4)='sgp_' AND p.prosecdef AND p.prorettype NOT IN('trigger'::regtype,'event_trigger'::regtype) AND EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE')),
 'public_table_acl_count',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname='public' AND c.relkind IN('r','v','m','f') AND a.grantee=0),
 'session_md5',(SELECT md5(pg_get_functiondef('public.sgp_sesion_actual(text)'::regprocedure))),
 'unguarded_example',(SELECT jsonb_build_object('signature',p.oid::regprocedure::text,'definition_md5',md5(pg_get_functiondef(p.oid)),'security_definer',p.prosecdef,'return_type',p.prorettype::regtype::text,'config',p.proconfig,'definition',pg_get_functiondef(p.oid)) FROM pg_proc p WHERE p.oid='public.sgp_reservas_por_produccion_json(text)'::regprocedure)
) AS catalog_only;

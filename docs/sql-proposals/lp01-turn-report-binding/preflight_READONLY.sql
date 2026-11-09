SELECT jsonb_build_object(
'command',(SELECT jsonb_build_object('md5',md5(prosrc),'owner',pg_get_userbyid(proowner),'definer',prosecdef,'acl',proacl::text,'config',proconfig) FROM pg_proc WHERE oid=to_regprocedure('public.sgp_lp_operacion_comando(text,jsonb)')),
'columns',(SELECT jsonb_agg(jsonb_build_object('schema',table_schema,'table',table_name,'column',column_name,'type',data_type)) FROM information_schema.columns WHERE (table_schema='sgp_lp_sale_orden' AND table_name IN('eventos','definiciones')) OR (table_schema='sgp_lp_operacion' AND table_name IN('turnos','ordenes','inclusiones_empaque','preparaciones_historicas','config'))),
'existingReportTables',(SELECT jsonb_object_agg(name,to_regclass('sgp_lp_operacion.'||name) IS NOT NULL) FROM unnest(ARRAY['report_turn_bindings','report_available_revisions'])name),
'sourceTablesACL',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'rls',c.relrowsecurity,'acl',c.relacl::text,'owner',pg_get_userbyid(c.relowner))) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='sgp_lp_sale_orden' AND c.relname IN('eventos','definiciones'))
) preflight;

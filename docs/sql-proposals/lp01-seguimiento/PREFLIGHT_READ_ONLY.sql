-- Read-only metadata backup. Save output privately (0700 directory / 0600 file),
-- hash and review before installation. No user/session/business rows are selected.
BEGIN READ ONLY;
SELECT jsonb_build_object(
 'database',current_database(),'captured_at',clock_timestamp(),
 'functions',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,
 'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),
 'body_md5',md5(p.prosrc),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,
 'security_definer',p.prosecdef,'configuration',p.proconfig,'language',l.lanname,
 'dependencies',(SELECT jsonb_agg(jsonb_build_object('class',d.classid::regclass::text,'object',d.objid,'refclass',d.refclassid::regclass::text,'reference',d.refobjid,'type',d.deptype)) FROM pg_depend d WHERE (d.classid='pg_proc'::regclass AND d.objid=p.oid) OR(d.refclassid='pg_proc'::regclass AND d.refobjid=p.oid))) ORDER BY n.nspname,p.proname)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
 WHERE (n.nspname='public' AND p.proname IN('sgp_lp_operacion_comando','sgp_lp_seguimiento_consultar'))
 OR(n.nspname='sgp_lp_operacion' AND p.proname IN('operaciones_rol','seguimiento_prototipo','sesion','contener_ambitos','permisos_en_periodo','acceso_rol','puede_operar'))),
 'api_schema_usage',jsonb_build_object('anon',has_schema_privilege('anon','public','USAGE'),'authenticated',has_schema_privilege('authenticated','public','USAGE')),
 'default_acl',(SELECT jsonb_agg(to_jsonb(d)) FROM pg_default_acl d WHERE d.defaclobjtype='f')) AS private_metadata_backup;
COMMIT;

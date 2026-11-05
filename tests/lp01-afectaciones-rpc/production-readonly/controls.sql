BEGIN READ ONLY; SET LOCAL statement_timeout='15s';
SELECT 'lineage' AS section,jsonb_build_object(
'pending_rows',(SELECT count(*) FROM public.sgp_aluminio_pendientes WHERE origen='PICKING'),
'joined_rows',(SELECT count(*) FROM public.sgp_aluminio_pendientes p LEFT JOIN sgp_pdt_multiorigen.detalles d USING(id_pendiente) LEFT JOIN sgp_pdt_multiorigen.eventos e USING(id_evento) LEFT JOIN public.sgp_picking_entregas t USING(id_entrega) WHERE p.origen='PICKING'),
'duplicate_detail_ids',(SELECT count(*) FROM (SELECT id_pendiente FROM sgp_pdt_multiorigen.detalles GROUP BY id_pendiente HAVING count(*)>1)x),
'duplicate_event_ids',(SELECT count(*) FROM (SELECT id_evento FROM sgp_pdt_multiorigen.eventos GROUP BY id_evento HAVING count(*)>1)x),
'new_schema_present',to_regnamespace('sgp_lp_afectaciones') IS NOT NULL) AS value
UNION ALL SELECT 'api_roles',jsonb_agg(jsonb_build_object('role',rolname,'superuser',rolsuper,'bypassrls',rolbypassrls)) FROM pg_roles WHERE rolname IN('anon','authenticated')
UNION ALL SELECT 'public_table_policies',coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'command',p.polcmd,'permissive',p.polpermissive,'roles',(SELECT jsonb_agg(CASE WHEN x=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x) END) FROM unnest(p.polroles)x),'using_true',coalesce(pg_get_expr(p.polqual,p.polrelid)='true',false),'check_true',coalesce(pg_get_expr(p.polwithcheck,p.polrelid)='true',false),'using_md5',md5(pg_get_expr(p.polqual,p.polrelid)),'check_md5',md5(pg_get_expr(p.polwithcheck,p.polrelid)))),'[]') FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('sgp_aluminio_pendientes','sgp_picking_entregas');
ROLLBACK;

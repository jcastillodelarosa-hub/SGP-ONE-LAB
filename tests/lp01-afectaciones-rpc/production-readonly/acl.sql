BEGIN READ ONLY; SET LOCAL statement_timeout='15s';
SELECT 'schema' AS kind,n.nspname AS object,r.rolname AS api_role,
has_schema_privilege(r.oid,n.oid,'USAGE') AS can_use,
has_schema_privilege(r.oid,n.oid,'CREATE') AS can_create,
NULL::boolean AS can_select,NULL::boolean AS can_insert,NULL::boolean AS can_update,NULL::boolean AS can_delete,NULL::boolean AS rls
FROM pg_namespace n CROSS JOIN pg_roles r
WHERE n.nspname IN('sgp_lp_operacion','sgp_pdt_multiorigen','sgp_pdt_manual','sgp_lp_afectaciones') AND r.rolname IN('anon','authenticated')
UNION ALL
SELECT 'table',n.nspname||'.'||c.relname,r.rolname,
has_schema_privilege(r.oid,n.oid,'USAGE'),NULL,
has_table_privilege(r.oid,c.oid,'SELECT'),has_table_privilege(r.oid,c.oid,'INSERT'),
has_table_privilege(r.oid,c.oid,'UPDATE'),has_table_privilege(r.oid,c.oid,'DELETE'),c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r
WHERE c.relkind='r' AND r.rolname IN('anon','authenticated') AND
(n.nspname IN('sgp_pdt_multiorigen','sgp_lp_afectaciones') OR n.nspname='public' AND c.relname IN('sgp_aluminio_pendientes','sgp_picking_entregas'))
ORDER BY kind,object,api_role;
ROLLBACK;

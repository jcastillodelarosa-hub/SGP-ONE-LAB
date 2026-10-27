-- PREPARED, NOT EXECUTED. Catalog only; no operational rows, sessions or tokens.
-- Completes missing source bodies/relationships, NOT a repeat of known definer facts.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='15s';
WITH wanted AS (
 SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f' AND p.proname IN
 ('sgp_previsualizar_export_diario','sgp_aplicar_export_diario',
 'sgp_linea_plan_registrar','sgp_consultar_ensamble','sgp_sesion_actual')
), rels AS (
 SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m') AND c.relname IN
 ('sgp_export_diario_historial','sgp_lotes_carga','sgp_producciones',
 'sgp_linea_plan_asignaciones','sgp_linea_plan_ejecuciones',
 'sgp_aluminio_pendientes','sgp_pdt_fuentes','sgp_pdt_entrega_lineas',
 'sgp_usuarios','sgp_produccion_reservas_v')
), trigger_functions AS (
 SELECT DISTINCT p.* FROM pg_trigger t JOIN rels r ON r.oid=t.tgrelid
 JOIN pg_proc p ON p.oid=t.tgfoid WHERE NOT t.tgisinternal
)
SELECT jsonb_build_object(
 'captured_at',transaction_timestamp(),'read_only',current_setting('transaction_read_only'),
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',oid::regprocedure::text,
 'definition',pg_get_functiondef(oid),'md5_definition',md5(pg_get_functiondef(oid)),
 'owner',pg_get_userbyid(proowner),'acl',proacl,'search_path_config',proconfig))
 FROM (SELECT * FROM wanted UNION SELECT * FROM trigger_functions) x),
 'relations',(SELECT jsonb_agg(jsonb_build_object('relation',r.oid::regclass::text,
 'rls',relrowsecurity,'acl',relacl,
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',attname,'type',format_type(atttypid,atttypmod),'not_null',attnotnull)) FROM pg_attribute a WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(pg_get_constraintdef(oid)) FROM pg_constraint WHERE conrelid=r.oid),
 'triggers',(SELECT jsonb_agg(pg_get_triggerdef(oid)) FROM pg_trigger WHERE tgrelid=r.oid AND NOT tgisinternal),
 'view',CASE WHEN relkind IN ('v','m') THEN pg_get_viewdef(r.oid,true) END)) FROM rels r),
 'policies',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname='public' AND tablename IN(SELECT relname FROM rels)),
 'limits','Catalog only: bodies must be reviewed for actual writer locking, inclusion links and unit identity. Grants/definer alone are not authorization.'
) AS source_catalog;
ROLLBACK;

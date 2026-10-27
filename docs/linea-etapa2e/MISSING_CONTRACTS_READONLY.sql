-- Catalog-only, no operational/session/token rows. Not run on Supabase here.
-- Seven captured PDT/auth bodies are deliberately not requested again.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='15s';
WITH relations AS (
 SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN('sgp_producciones','sgp_export_diario_historial','sgp_lotes_carga','sgp_produccion_reservas_v','sgp_linea_plan_asignaciones','sgp_linea_plan_ejecuciones','sgp_picking_entregas','sgp_picking_faltantes','sgp_picking_auditoria_diferencias','sgp_aluminio_pendientes','sgp_pdt_fuentes','sgp_pdt_entrega_lineas','sgp_usuarios')
), functions AS (
 SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f' AND p.proname IN('sgp_previsualizar_export_diario','sgp_aplicar_export_diario','sgp_consultar_ensamble','sgp_linea_plan_consultar','sgp_linea_plan_programar','sgp_linea_plan_mover','sgp_linea_plan_registrar','sgp_linea_plan_arrastrar','sgp_mis_accesos','sgp_admin_rol_accesos_listar')
), candidates AS (
 SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f' AND p.prosrc ~* 'sgp_(producciones|export_diario_historial|picking_entregas|picking_faltantes|aluminio_pendientes|linea_plan_ejecuciones)'
)
SELECT jsonb_build_object(
 'read_only',current_setting('transaction_read_only'),'captured_at',transaction_timestamp(),
 'functions',coalesce((SELECT jsonb_agg(jsonb_build_object('signature',oid::regprocedure::text,'definition',pg_get_functiondef(oid),'md5',md5(pg_get_functiondef(oid)),'owner',pg_get_userbyid(proowner),'definer',prosecdef,'acl',proacl,'config',proconfig)) FROM functions),'[]'),
 'relations',coalesce((SELECT jsonb_agg(jsonb_build_object('name',r.relname,'kind',r.relkind,'rls',r.relrowsecurity,'acl',r.relacl,'columns',(SELECT jsonb_agg(jsonb_build_object('name',attname,'type',format_type(atttypid,atttypmod),'not_null',attnotnull) ORDER BY attnum) FROM pg_attribute WHERE attrelid=r.oid AND attnum>0 AND NOT attisdropped),'constraints',(SELECT jsonb_agg(pg_get_constraintdef(oid)) FROM pg_constraint WHERE conrelid=r.oid),'view',CASE WHEN r.relkind IN('v','m') THEN pg_get_viewdef(r.oid,true) END)) FROM relations r),'[]'),
 'triggers',coalesce((SELECT jsonb_agg(jsonb_build_object('table',tgrelid::regclass::text,'definition',pg_get_triggerdef(t.oid),'enabled',tgenabled,'function',tgfoid::regprocedure::text,'function_md5',md5(pg_get_functiondef(tgfoid)))) FROM pg_trigger t WHERE t.tgrelid IN(SELECT oid FROM relations) AND NOT t.tgisinternal),'[]'),
 'policies',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname='public' AND tablename IN(SELECT relname FROM relations)),'[]'),
 'writer_candidates',coalesce((SELECT jsonb_agg(jsonb_build_object('signature',oid::regprocedure::text,'md5',md5(pg_get_functiondef(oid)),'definition',CASE WHEN proname NOT IN('sgp_aluminio_pendiente_resolver','sgp_aluminio_pendiente_estado','sgp_picking_entrega_orden','sgp_picking_validar_recepcion','sgp_picking_rechazar_entrega_completa_duplicada','sgp_validar_sesion_rol') THEN pg_get_functiondef(oid) END)) FROM candidates),'[]'),
 'limits','Catalog presence/DEFINER/EXECUTE alone do not prove real scope, source semantics or coordination of all dynamic writers. No operational/auth rows.'
) AS missing_source_contracts;
ROLLBACK;

-- READ ONLY. Use existing complete ChatGPT results instead if already available.
-- Existence, SECURITY DEFINER and anon/authenticated grants are ALREADY REPORTED.
-- Do not repeat seven captured bodies; obtain only current hashes for comparison.
-- No row values, user identities, credentials or tokens are returned.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='15s';
WITH funcs AS (
 SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f' AND (
 p.proname IN('sgp_previsualizar_export_diario','sgp_aplicar_export_diario','sgp_picking_validar_recepcion','sgp_sesion_actual','sgp_mis_accesos','sgp_linea_plan_registrar','sgp_linea_plan_programar','sgp_linea_plan_mover','sgp_linea_plan_arrastrar')
 OR p.prosrc ~* '(insert into|update|delete from)[[:space:]]+(public[.])?sgp_(producciones|picking_entregas|picking_faltantes|aluminio_pendientes|export_diario_historial|linea_plan_ejecuciones)'
 )
), rels AS (
 SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN('sgp_export_diario_historial','sgp_pdt_entrega_lineas','sgp_produccion_reservas_v','sgp_linea_plan_asignaciones','sgp_linea_plan_ejecuciones')
), history_sample AS (
 SELECT to_jsonb(h)->'datos' payload FROM public.sgp_export_diario_historial h
 ORDER BY h.fecha_hora DESC NULLS LAST LIMIT 100
), data_keys AS (
 SELECT DISTINCT k FROM history_sample s CROSS JOIN LATERAL jsonb_object_keys(CASE WHEN jsonb_typeof(s.payload)='object' THEN s.payload ELSE '{}'::jsonb END) k
)
SELECT jsonb_build_object(
 'read_only',current_setting('transaction_read_only'),'captured_at',transaction_timestamp(),
 'functions',coalesce((SELECT jsonb_agg(jsonb_build_object('signature',oid::regprocedure::text,'md5_pg_get_functiondef',md5(pg_get_functiondef(oid)),'definition',CASE WHEN proname NOT IN('sgp_picking_validar_recepcion','sgp_sesion_actual','sgp_validar_sesion_rol','sgp_aluminio_pendiente_resolver','sgp_aluminio_pendiente_estado','sgp_picking_entrega_orden','sgp_picking_rechazar_entrega_completa_duplicada') THEN pg_get_functiondef(oid) END,'owner',pg_get_userbyid(proowner),'config',proconfig)) FROM funcs),'[]'),
 'relations',coalesce((SELECT jsonb_agg(jsonb_build_object('name',r.relname,'columns',(SELECT jsonb_agg(jsonb_build_object('name',attname,'type',format_type(atttypid,atttypmod),'not_null',attnotnull) ORDER BY attnum) FROM pg_attribute a WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped),'constraints',(SELECT jsonb_agg(pg_get_constraintdef(oid)) FROM pg_constraint WHERE conrelid=r.oid),'view',CASE WHEN relkind IN('v','m') THEN pg_get_viewdef(r.oid,true) END)) FROM rels r),'[]'),
 'active_role_labels_only',coalesce((SELECT jsonb_agg(x.rol ORDER BY x.rol) FROM(SELECT DISTINCT rol FROM public.sgp_usuarios WHERE activo=true AND rol IS NOT NULL)x),'[]'),
 'history_datos_keys_sample',coalesce((SELECT jsonb_agg(k ORDER BY k) FROM data_keys),'[]'),
 'history_datos_json_types',coalesce((SELECT jsonb_agg(t) FROM(SELECT DISTINCT jsonb_typeof(payload) t FROM history_sample)x),'[]'),
 'sample_limit',100,'sample_rows',(SELECT count(*) FROM history_sample),'coverage_certified',false,
 'limits','Only keys/types/role labels and definitions. Sample is NOT a complete capture, business semantics or event inclusion certificate. Dynamic writers may be absent. No automatic privilege recommendation.'
) AS source_delta;
ROLLBACK;

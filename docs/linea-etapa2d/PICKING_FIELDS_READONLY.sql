-- PREPARED, NOT EXECUTED PRODUCTIVELY. No operational rows or tokens.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT c.oid::regclass::text AS relation,c.relrowsecurity,c.relacl,
 (SELECT jsonb_agg(jsonb_build_object('column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull)) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
 (SELECT jsonb_agg(pg_get_constraintdef(x.oid)) FROM pg_constraint x WHERE x.conrelid=c.oid) AS constraints,
 (SELECT jsonb_agg(pg_get_triggerdef(t.oid)) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal) AS triggers
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
 ('sgp_picking_faltantes','sgp_picking_auditoria_diferencias','sgp_picking_entregas',
 'sgp_aluminio_pendientes','sgp_aluminio_pendiente_detalles','sgp_pdt_fuentes',
 'sgp_pdt_entrega_lineas','sgp_pdt_asignaciones','sgp_pdt_cierres');
-- Reuse full definitions already supplied; hashes only detect subsequent drift.
SELECT p.oid::regprocedure::text AS signature,md5(pg_get_functiondef(p.oid)) AS md5_definition,
 p.prosecdef,p.proconfig,p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind='f' AND p.proname IN
 ('sgp_picking_entrega_orden','sgp_picking_validar_recepcion','sgp_pdt_entrega_validar_v2',
 'sgp_pdt_entrega_registrar_v2','sgp_pdt_entrega_asignar_v2','sgp_pdt_cierre_acreditado');
ROLLBACK;

-- Read-only review. No tokens, passwords, account identifiers or operational row payloads.
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) arguments,
 pg_get_userbyid(p.proowner) owner,p.prosecdef,p.proconfig,p.proacl,
 md5(p.prosrc) body_hash
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
 ('sgp_picking_reporte_entregas_v1','sgp_picking_reporte_recepciones_v1','sgp_validar_sesion_rol','sgp_picking_auditoria_guardar');
SELECT table_schema,table_name,column_name,data_type FROM information_schema.columns
WHERE (table_schema='sgp_picking_audit' AND table_name IN ('eventos','decisiones'))
 OR (table_schema='public' AND table_name='sgp_picking_auditoria')
ORDER BY table_schema,table_name,ordinal_position;
SELECT (SELECT count(*) FROM sgp_picking_audit.eventos) ledger_count,
 (SELECT count(*) FROM public.sgp_picking_entregas e WHERE e.fecha_validacion IS NOT NULL
  AND nullif(btrim(e.usuario_validacion),'') IS NOT NULL AND e.estado IN ('VALIDADA','AUDITADA_DIFERENCIA')
  AND NOT EXISTS(SELECT 1 FROM sgp_picking_audit.eventos a WHERE a.id_entrega=e.id_entrega)) legacy_without_operational_date;

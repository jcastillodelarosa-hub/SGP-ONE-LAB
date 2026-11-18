-- Read-only preflight, no personal row contents.
SELECT n.nspname,p.proname,md5(pg_get_functiondef(p.oid)) definition_hash,p.prosecdef,p.proconfig
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE (n.nspname='sgp_pdt_picking_simple' AND p.proname IN ('completo','saldos')) OR (n.nspname='public' AND p.proname IN ('sgp_pdt_picking_simple_v1','sgp_pdt_picking_simple_estado_v1','sgp_pdt_validar_rol_real','sgp_mis_accesos'));
SELECT count(DISTINCT d.id_pendiente) historical_simple_parents FROM public.sgp_aluminio_pendiente_detalles d JOIN sgp_pdt_picking_simple.entregas e USING(id_detalle);
SELECT to_regnamespace('sgp_pdt_picking_flow') existing_flow;

-- SGP_ONE Picking report: add authenticated user display name without changing report authorization.
DO $migration$
DECLARE v_oid oid; v_definition text;
BEGIN
 SELECT p.oid INTO v_oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='sgp_picking_reporte_entregas_v1'
 AND pg_get_function_identity_arguments(p.oid) LIKE 'p_token text, p_fecha_inicio date, p_fecha_fin date%';
 IF v_oid IS NULL THEN RAISE EXCEPTION 'RPC report not found'; END IF;
 v_definition:=pg_get_functiondef(v_oid);
 IF position('nombre_responsable' in v_definition)>0 THEN RETURN; END IF;
 IF position('e.usuario_entrega,e.fecha_entrega' in v_definition)=0 THEN RAISE EXCEPTION 'RPC signature changed: review manually'; END IF;
 v_definition:=replace(v_definition,'e.usuario_entrega,e.fecha_entrega','e.usuario_entrega,(SELECT u.nombre FROM public.sgp_usuarios u WHERE u.usuario=e.usuario_entrega LIMIT 1) AS nombre_responsable,e.fecha_entrega');
 EXECUTE v_definition;
END
$migration$;

-- Only before any new business event. Otherwise use containment and forward repair.
BEGIN;
DO $$ DECLARE r record; BEGIN
 IF EXISTS(SELECT 1 FROM sgp_pdt_picking_flow.recepciones) OR EXISTS(SELECT 1 FROM sgp_pdt_picking_flow.avisos) OR EXISTS(SELECT 1 FROM sgp_pdt_picking_simple.entregas e JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle) WHERE NOT EXISTS(SELECT 1 FROM sgp_pdt_picking_flow.historicos h WHERE h.id_pendiente=d.id_pendiente)) THEN RAISE EXCEPTION 'PDT_FLOW_USED_USE_CONTAINMENT'; END IF;
 IF EXISTS(SELECT 1 FROM sgp_pdt_picking_flow.backup b JOIN pg_proc p ON p.oid=to_regprocedure(b.firma) WHERE p.proacl IS DISTINCT FROM b.original_acl OR p.proowner<>b.original_owner) THEN RAISE EXCEPTION 'PDT_FLOW_ACL_CHANGED_KEEP_CONTAINMENT'; END IF;
 FOR r IN SELECT definition FROM sgp_pdt_picking_flow.backup LOOP EXECUTE r.definition; END LOOP;
END $$;
DROP TRIGGER pdt_flow_aviso ON public.sgp_aluminio_pendiente_movimientos;
DROP TRIGGER pdt_flow_clave ON sgp_pdt_picking_simple.entregas;
DROP FUNCTION public.sgp_pdt_picking_movimiento_v1(text,uuid,text,integer,uuid,text),public.sgp_pdt_picking_cola_v1(text,text,text,text,text,uuid,integer),public.sgp_pdt_picking_avisos_v1(text,uuid,integer),public.sgp_pdt_picking_aviso_leer_v1(text,uuid);
DROP SCHEMA sgp_pdt_picking_flow CASCADE;
NOTIFY pgrst,'reload schema';
COMMIT;

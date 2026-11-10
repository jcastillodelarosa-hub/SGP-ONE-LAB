-- Full rollback only if no deliveries were ever accepted. Otherwise use contain.sql.
BEGIN;
LOCK TABLE sgp_pdt_picking_simple.entregas IN ACCESS EXCLUSIVE MODE;
DO $$ DECLARE def text; BEGIN
 IF EXISTS(SELECT 1 FROM sgp_pdt_picking_simple.entregas) OR EXISTS(SELECT 1 FROM public.sgp_pdt_cierres WHERE evidencia->>'contrato'='PICKING_SIMPLE_V1') THEN RAISE EXCEPTION 'PDT_SIMPLE_USED_USE_CONTAINMENT'; END IF;
 SELECT definition INTO STRICT def FROM sgp_pdt_picking_simple.backup;
 EXECUTE def;
END $$;
DROP TRIGGER sgp_pdt_simple_no_mezclar ON public.sgp_pdt_entrega_lineas;
DROP TRIGGER sgp_pdt_simple_no_mezclar ON public.sgp_pdt_asignaciones;
DROP TRIGGER sgp_pdt_simple_no_mezclar ON sgp_pdt_manual.entregas;
DROP TRIGGER sgp_pdt_simple_proteger_procesado ON public.sgp_aluminio_pendiente_movimientos;
DROP FUNCTION public.sgp_pdt_picking_simple_estado_v1(text,uuid);
DROP FUNCTION public.sgp_pdt_picking_simple_v1(text,uuid,integer,uuid,text);
DROP SCHEMA sgp_pdt_picking_simple CASCADE;
NOTIFY pgrst,'reload schema';
COMMIT;

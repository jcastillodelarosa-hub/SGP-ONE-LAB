-- Containment, preserves all accepted events and receipt-required closure guards.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.sgp_pdt_picking_movimiento_v1(text,uuid,text,integer,uuid,text),public.sgp_pdt_picking_aviso_leer_v1(text,uuid),public.sgp_pdt_picking_simple_v1(text,uuid,integer,uuid,text) FROM anon,authenticated,service_role;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT firma FROM sgp_pdt_picking_flow.backup WHERE firma LIKE 'public.sgp_pdt_%' AND firma NOT LIKE '%estado_v1%' LOOP EXECUTE 'REVOKE EXECUTE ON FUNCTION '||r.firma||' FROM anon,authenticated,service_role'; END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;

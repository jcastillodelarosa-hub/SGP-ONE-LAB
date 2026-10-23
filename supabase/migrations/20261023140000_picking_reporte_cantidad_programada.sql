-- Add source order quantity to each report row; no changes to historical deliveries.
-- Report client deduplicates by (id_programacion, produccion, sistema) and subtracts SUM(faltantes.cantidad).
DO $migration$
DECLARE fn text; sig regprocedure := 'public.sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer)'::regprocedure;
 old_fragment text := 'p.reserva,p.prioridad_semanal AS parte,p.sistema,p.acabado,';
 new_fragment text := 'p.reserva,p.prioridad_semanal AS parte,p.sistema,p.acabado,p.cantidad_programada,';
BEGIN
 fn:=pg_get_functiondef(sig);
 IF position(new_fragment IN fn)>0 THEN RETURN; END IF;
 IF position(old_fragment IN fn)=0 THEN RAISE EXCEPTION 'Unexpected report row contract'; END IF;
 IF position('sgp_validar_sesion_rol' IN fn)=0 OR position('p_limit' IN fn)=0 THEN RAISE EXCEPTION 'Missing report safeguards'; END IF;
 EXECUTE replace(fn,old_fragment,new_fragment);
END $migration$;

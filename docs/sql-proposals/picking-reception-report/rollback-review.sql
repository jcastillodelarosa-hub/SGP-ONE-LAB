-- REVIEW ONLY: explicit approval required. Removes only the new read-only RPC.
BEGIN;
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.sgp_picking_reporte_recepciones_v1(text,date,date,text,text,integer,integer)') AND md5(prosrc)='e6627795b806b60cfda8cfd0b734c7e7')
 THEN RAISE EXCEPTION 'CUERPO_RECEPCIONES_CAMBIO_REVISAR'; END IF;
END $guard$;
DROP FUNCTION public.sgp_picking_reporte_recepciones_v1(text,date,date,text,text,integer,integer);
COMMIT;

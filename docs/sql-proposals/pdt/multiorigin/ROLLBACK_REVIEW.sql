-- Roll back code only. NEVER delete reported events, PDTs, NCs or deliveries.
-- First pause use of new editor and restore the reviewed frontend build.
BEGIN;
DO $rollback$ DECLARE r record; BEGIN
 IF EXISTS(SELECT 1 FROM sgp_pdt_multiorigen.eventos) THEN RAISE EXCEPTION 'PDT_ROLLBACK_REQUIERE_CONCILIAR_EVENTOS: mantener lectores/cierre nuevos; usar CONTENER_REGISTRO_REVIEW'; END IF;
 FOR r IN SELECT * FROM sgp_pdt_multiorigen.funciones_previas LOOP
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=r.firma::regprocedure) IS DISTINCT FROM r.huella_posterior THEN
 RAISE EXCEPTION 'PDT_ROLLBACK_DEFINICION_MODIFICADA: %',r.firma; END IF;
 END LOOP;
 FOR r IN SELECT * FROM sgp_pdt_multiorigen.funciones_previas LOOP EXECUTE r.definicion; END LOOP;
END $rollback$;
REVOKE EXECUTE ON FUNCTION public.sgp_pdt_registrar_v4(text,text,jsonb,jsonb,uuid) FROM PUBLIC,anon,authenticated;
-- Read-only metadata/source RPCs can remain to inspect preserved reports.
NOTIFY pgrst,'reload schema';
COMMIT;

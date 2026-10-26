-- REVIEW / NO APLICADO. Primero revertir frontend355 con autorización.
-- Solo elimina esta RPC si su cuerpo sigue siendo el revisado; no toca la tabla.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Requiere postgres autorizado'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.sgp_mecanizado_reprogramaciones_listar(text)')
 AND md5(prosrc)<>'3ada4a4ce24b2d968b52656d164e9f21')
 THEN RAISE EXCEPTION 'RPC modificada posteriormente: detener reversión'; END IF;
END $guard$;
DROP FUNCTION IF EXISTS public.sgp_mecanizado_reprogramaciones_listar(text);
NOTIFY pgrst,'reload schema';
COMMIT;

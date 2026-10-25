-- REVIEW ONLY. Inspect installed overloads before approving. Does NOT touch either
-- sgp_picking_entrega_orden overload. Abort on unknown legacy parameter contracts.
BEGIN;
CREATE TABLE IF NOT EXISTS public.sgp_pdt_legacy_definiciones (
 firma text PRIMARY KEY, definicion text NOT NULL, guardada_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sgp_pdt_legacy_definiciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sgp_pdt_legacy_definiciones FROM PUBLIC,anon,authenticated;
DO $install$
DECLARE f record; definition text; body text; idx integer;
BEGIN
 FOR f IN SELECT p.*,p.oid::regprocedure::text firma FROM pg_catalog.pg_proc p
 JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_catalog.pg_language l ON l.oid=p.prolang
 WHERE n.nspname='public' AND p.proname IN ('sgp_aluminio_pendiente_editar',
 'sgp_aluminio_pendiente_editar_v2','sgp_aluminio_pendiente_validar','sgp_aluminio_pendiente_estado',
 'sgp_aluminio_pendiente_resolver','sgp_aluminio_pendiente_reserva_solucion')
 LOOP
  IF position('PDT_V2_USAR_RPC_DEDICADA' IN f.prosrc)>0 THEN CONTINUE; END IF;
  idx:=array_position(f.proargnames,'p_id');
  IF idx IS NULL OR f.proargtypes[idx-1]<>'uuid'::regtype OR (SELECT lanname FROM pg_catalog.pg_language WHERE oid=f.prolang)<>'plpgsql'
  THEN RAISE EXCEPTION 'Contrato legacy desconocido: %',f.firma; END IF;
  definition:=pg_catalog.pg_get_functiondef(f.oid);
  INSERT INTO public.sgp_pdt_legacy_definiciones VALUES(f.firma,definition,now()) ON CONFLICT DO NOTHING;
  body:=regexp_replace(f.prosrc,'\mBEGIN\M', $guard$BEGIN
   PERFORM 1 FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id FOR UPDATE;
   IF EXISTS(SELECT 1 FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id AND contrato_pdt='V2')
   THEN RAISE EXCEPTION 'PDT_V2_USAR_RPC_DEDICADA'; END IF;
  $guard$,'i');
  IF body=f.prosrc THEN RAISE EXCEPTION 'Cuerpo no reconocido: %',f.firma; END IF;
  EXECUTE replace(definition,f.prosrc,body);
 END LOOP;
END $install$;
COMMIT;

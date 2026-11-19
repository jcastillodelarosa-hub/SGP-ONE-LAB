-- Additive rollout: install before frontend. Leave v1 intact for cached-client retries.
BEGIN;
ALTER TABLE sgp_pdt_picking_flow.recepciones
 ADD COLUMN fecha_recepcion date,
 ADD COLUMN turno_recepcion text,
 ADD CONSTRAINT recepcion_turno_operativo CHECK (
   (fecha_recepcion IS NULL AND turno_recepcion IS NULL) OR
   (fecha_recepcion IS NOT NULL AND turno_recepcion IS NOT NULL AND turno_recepcion IN ('TURNO 1','TURNO 2'))
 );
CREATE FUNCTION public.sgp_pdt_picking_recepcion_v2(
 p_token text, p_id_detalle uuid, p_cantidad integer, p_idempotency_key uuid,
 p_observacion text, p_fecha_recepcion date, p_turno_recepcion text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 result jsonb; saved sgp_pdt_picking_flow.recepciones;
 start_local timestamp; end_local timestamp; cutoff timestamptz;
 delivered_by_cutoff bigint; already_received bigint;
BEGIN
 IF p_fecha_recepcion IS NULL OR NOT isfinite(p_fecha_recepcion) OR
    p_turno_recepcion IS NULL OR p_turno_recepcion NOT IN ('TURNO 1','TURNO 2') THEN
   RAISE EXCEPTION 'PDT_FLOW_TURNO_RECEPCION_INVALIDO';
 END IF;
 IF p_fecha_recepcion>(now() AT TIME ZONE 'America/Bogota')::date THEN
   RAISE EXCEPTION 'PDT_FLOW_RECEPCION_FUTURA';
 END IF;
 IF p_turno_recepcion='TURNO 1' THEN
   start_local:=p_fecha_recepcion+time '07:00';
   end_local:=p_fecha_recepcion+CASE WHEN extract(isodow FROM p_fecha_recepcion)=7 THEN time '18:00' ELSE time '19:00' END;
 ELSIF extract(isodow FROM p_fecha_recepcion)=7 THEN
   start_local:=p_fecha_recepcion+time '18:00';
   end_local:=p_fecha_recepcion+interval '1 day 5 hours';
 ELSE
   start_local:=p_fecha_recepcion+time '19:00';
   end_local:=p_fecha_recepcion+interval '1 day 7 hours';
 END IF;
 IF (start_local AT TIME ZONE 'America/Bogota')>now() THEN
   RAISE EXCEPTION 'PDT_FLOW_RECEPCION_FUTURA';
 END IF;
 -- Existing writer owns authorization, parent locks, idempotency, quantity and closure.
 -- Exceptions below roll back that call within the same transaction.
 result:=public.sgp_pdt_picking_movimiento_v1(p_token,p_id_detalle,'RECIBIR',p_cantidad,p_idempotency_key,p_observacion);
 SELECT * INTO STRICT saved FROM sgp_pdt_picking_flow.recepciones WHERE id_recepcion=(result->>'id_recepcion')::uuid;
 IF (result->>'duplicado')::boolean THEN
   IF saved.fecha_recepcion IS DISTINCT FROM p_fecha_recepcion OR saved.turno_recepcion IS DISTINCT FROM p_turno_recepcion THEN
     RAISE EXCEPTION 'PDT_FLOW_CLAVE_REUTILIZADA';
   END IF;
 ELSE
   cutoff:=end_local AT TIME ZONE 'America/Bogota';
   SELECT coalesce(sum(e.cantidad),0) INTO delivered_by_cutoff FROM sgp_pdt_picking_simple.entregas e
   WHERE e.id_detalle=p_id_detalle AND e.creado_en<cutoff;
   SELECT coalesce(sum(q.cantidad),0) INTO already_received FROM sgp_pdt_picking_flow.recepciones q
   WHERE q.id_detalle=p_id_detalle AND q.id_recepcion<>saved.id_recepcion;
   IF p_cantidad>delivered_by_cutoff-already_received THEN
     RAISE EXCEPTION 'PDT_FLOW_RECEPCION_SIN_SALDO_EN_TURNO';
   END IF;
   UPDATE sgp_pdt_picking_flow.recepciones SET fecha_recepcion=p_fecha_recepcion,turno_recepcion=p_turno_recepcion WHERE id_recepcion=saved.id_recepcion;
 END IF;
 RETURN result||jsonb_build_object('fecha_recepcion',p_fecha_recepcion,'turno_recepcion',p_turno_recepcion);
END $$;
REVOKE ALL ON FUNCTION public.sgp_pdt_picking_recepcion_v2(text,uuid,integer,uuid,text,date,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sgp_pdt_picking_recepcion_v2(text,uuid,integer,uuid,text,date,text) TO anon,authenticated;

-- Enrich existing history projection only; preserve all filtering, permissions and ordering.
DO $patch$
DECLARE
 target oid:='public.sgp_pdt_picking_cola_v1(text,text,text,text,text,uuid,integer)'::regprocedure;
 def text; acl aclitem[]; owner oid;
 json_old text:='''fecha'',m.fecha,''observacion'',m.observacion';
 delivery_old text:='e.creado_en fecha,e.observacion FROM sgp_pdt_picking_simple.entregas';
 receipt_old text:='q.creado_en,q.observacion FROM sgp_pdt_picking_flow.recepciones';
 needle text;
BEGIN
 SELECT pg_get_functiondef(oid),proacl,proowner INTO STRICT def,acl,owner FROM pg_proc WHERE oid=target;
 FOREACH needle IN ARRAY ARRAY[json_old,delivery_old,receipt_old] LOOP
  IF length(def)-length(replace(def,needle,''))<>length(needle) THEN RAISE EXCEPTION 'PDT_RECEPCION_COLA_BASELINE_CHANGED'; END IF;
 END LOOP;
 def:=replace(def,json_old,json_old||',''fecha_recepcion'',m.fecha_recepcion,''turno_recepcion'',m.turno_recepcion');
 def:=replace(def,delivery_old,'e.creado_en fecha,e.observacion,NULL::date fecha_recepcion,NULL::text turno_recepcion FROM sgp_pdt_picking_simple.entregas');
 def:=replace(def,receipt_old,'q.creado_en,q.observacion,q.fecha_recepcion,q.turno_recepcion FROM sgp_pdt_picking_flow.recepciones');
 EXECUTE def;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=target AND proacl IS NOT DISTINCT FROM acl AND proowner=owner) THEN RAISE EXCEPTION 'PDT_RECEPCION_COLA_ACL_CHANGED'; END IF;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;

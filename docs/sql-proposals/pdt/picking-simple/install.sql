-- Candidate only. Atomic, additive PDT delivery confirmation; no order delivery fabricated.
BEGIN;
CREATE SCHEMA sgp_pdt_picking_simple;
REVOKE ALL ON SCHEMA sgp_pdt_picking_simple FROM PUBLIC,anon,authenticated;
CREATE TABLE sgp_pdt_picking_simple.entregas (
 id_entrega uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 id_detalle uuid NOT NULL REFERENCES public.sgp_aluminio_pendiente_detalles(id_detalle),
 cantidad integer NOT NULL CHECK(cantidad>0), clave uuid NOT NULL UNIQUE,
 usuario text NOT NULL, observacion text, creado_en timestamptz NOT NULL DEFAULT now(),
 resultado jsonb NOT NULL DEFAULT '{}'
);
ALTER TABLE sgp_pdt_picking_simple.entregas ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON sgp_pdt_picking_simple.entregas(id_detalle);
CREATE TABLE sgp_pdt_picking_simple.backup(definition text NOT NULL);
ALTER TABLE sgp_pdt_picking_simple.backup ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE def text; BEGIN
 def:=pg_get_functiondef('public.sgp_pdt_cierre_acreditado(uuid)'::regprocedure);
 IF md5(def)<>'24e18c5a31ffd2b7f313078ac42721c5' THEN RAISE EXCEPTION 'PDT_SIMPLE_PREFLIGHT_CIERRE_CHANGED'; END IF;
 INSERT INTO sgp_pdt_picking_simple.backup VALUES(def);
 EXECUTE replace(def,'public.sgp_pdt_cierre_acreditado','sgp_pdt_picking_simple.cierre_original');
END $$;
CREATE FUNCTION sgp_pdt_picking_simple.saldos(p_id uuid)
RETURNS TABLE(id_detalle uuid,cantidad_validada bigint,procesada bigint,entregada bigint,saldo_entrega bigint,disponible_entrega bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT d.id_detalle,d.cantidad_validada::bigint,m.n,e.n,d.cantidad_validada-e.n,least(d.cantidad_validada,m.n)-e.n
 FROM public.sgp_aluminio_pendiente_detalles d
 CROSS JOIN LATERAL (SELECT coalesce(sum(CASE WHEN tipo='AVANCE' THEN cantidad ELSE -cantidad END),0)::bigint n FROM public.sgp_aluminio_pendiente_movimientos WHERE id_detalle=d.id_detalle) m
 CROSS JOIN LATERAL (SELECT coalesce(sum(q.cantidad),0)::bigint n FROM (
 SELECT cantidad FROM sgp_pdt_picking_simple.entregas WHERE id_detalle=d.id_detalle
 ) q) e WHERE d.id_pendiente=p_id;
$$;
CREATE FUNCTION sgp_pdt_picking_simple.completo(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM sgp_pdt_picking_simple.saldos(p_id)) AND NOT EXISTS(
 SELECT 1 FROM sgp_pdt_picking_simple.saldos(p_id) WHERE cantidad_validada<>procesada OR cantidad_validada<>entregada);
$$;
CREATE OR REPLACE FUNCTION public.sgp_pdt_cierre_acreditado(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.sgp_pdt_cierres WHERE id_pendiente=p_id AND evidencia->>'contrato'='PICKING_SIMPLE_V1') THEN
 RETURN sgp_pdt_picking_simple.completo(p_id);
 END IF;
 RETURN sgp_pdt_picking_simple.cierre_original(p_id);
END $$;
CREATE FUNCTION sgp_pdt_picking_simple.tiene_entregas_anteriores(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.sgp_pdt_entrega_lineas l JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle) WHERE d.id_pendiente=p_id AND l.estado<>'ANULADA')
 OR EXISTS(SELECT 1 FROM sgp_pdt_manual.entregas l JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle) WHERE d.id_pendiente=p_id AND l.estado<>'ANULADA');
$$;
CREATE FUNCTION public.sgp_pdt_picking_simple_estado_v1(p_token text,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE result jsonb; BEGIN
 PERFORM public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION','PATINADOR','LIDER','LIDER MECANIZADO','LIDER LINEA','SUPERVISOR DE PICKING','CONSULTA','PICKING']);
 -- One statement snapshot for parent, compatibility, quantities and ledger.
 SELECT jsonb_build_object('ok',true,'contract_version',1,'finalizado',p.estado='RESUELTO',
 'modo',CASE WHEN NOT compat.anterior THEN 'DIRECTO' WHEN compat.completa THEN 'ANTERIOR_COMPLETA' ELSE 'ANTERIOR_PENDIENTE' END,
 'detalles',CASE WHEN compat.anterior AND NOT compat.completa THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(to_jsonb(s)||CASE WHEN compat.anterior THEN jsonb_build_object('entregada',s.cantidad_validada,'saldo_entrega',0,'disponible_entrega',0) ELSE '{}'::jsonb END) FROM sgp_pdt_picking_simple.saldos(p_id) s),'[]'::jsonb) END,
 'entregas',coalesce((SELECT jsonb_agg(to_jsonb(e)-'clave'-'resultado' ORDER BY e.creado_en,e.id_entrega) FROM sgp_pdt_picking_simple.entregas e JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle) WHERE d.id_pendiente=p_id),'[]'::jsonb))
 INTO STRICT result FROM public.sgp_aluminio_pendientes p
 CROSS JOIN LATERAL (SELECT sgp_pdt_picking_simple.tiene_entregas_anteriores(p.id_pendiente) anterior,sgp_pdt_picking_simple.cierre_original(p.id_pendiente) completa) compat
 WHERE p.id_pendiente=p_id;
 RETURN result;
END $$;
CREATE FUNCTION public.sgp_pdt_picking_simple_v1(p_token text,p_id_detalle uuid,p_cantidad integer,p_idempotency_key uuid,p_observacion text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text; parent uuid; p public.sgp_aluminio_pendientes; prior sgp_pdt_picking_simple.entregas; s record; done boolean; result jsonb; eid uuid;
BEGIN
 actor:=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING']);
 IF p_id_detalle IS NULL OR p_cantidad IS NULL OR p_cantidad<=0 OR p_idempotency_key IS NULL THEN RAISE EXCEPTION 'PDT_SIMPLE_PARAMETROS_INVALIDOS'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key::text,431));
 SELECT id_pendiente INTO STRICT parent FROM public.sgp_aluminio_pendiente_detalles WHERE id_detalle=p_id_detalle;
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=parent FOR UPDATE;
 SELECT * INTO prior FROM sgp_pdt_picking_simple.entregas WHERE clave=p_idempotency_key;
 IF FOUND THEN
  IF prior.id_detalle IS DISTINCT FROM p_id_detalle OR prior.cantidad IS DISTINCT FROM p_cantidad OR prior.observacion IS DISTINCT FROM p_observacion OR prior.usuario IS DISTINCT FROM actor THEN RAISE EXCEPTION 'PDT_SIMPLE_CLAVE_REUTILIZADA'; END IF;
  RETURN prior.resultado||jsonb_build_object('duplicado',true);
 END IF;
 IF p.contrato_pdt IS DISTINCT FROM 'V2' OR p.estado IS DISTINCT FROM 'PENDIENTE' OR p.validacion_estado IS DISTINCT FROM 'VALIDADO' OR p.estado_repo NOT IN ('MECANIZADO','PROCESADO') OR p.estado_repo IS NULL OR p.fecha_cierre IS NOT NULL THEN RAISE EXCEPTION 'PDT_SIMPLE_NO_APTO'; END IF;
 PERFORM 1 FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=parent ORDER BY id_detalle FOR UPDATE;
 -- Never reinterpret earlier coverage: its exact existing branch remains authoritative.
 IF sgp_pdt_picking_simple.tiene_entregas_anteriores(parent) THEN RAISE EXCEPTION 'PDT_SIMPLE_ENTREGAS_PREVIAS_POR_CONCILIAR'; END IF;
 IF EXISTS(SELECT 1 FROM sgp_pdt_picking_simple.saldos(parent) WHERE procesada<0 OR procesada>cantidad_validada OR entregada<0 OR disponible_entrega<0) THEN RAISE EXCEPTION 'PDT_SIMPLE_SALDOS_INCONSISTENTES'; END IF;
 SELECT * INTO STRICT s FROM sgp_pdt_picking_simple.saldos(parent) WHERE id_detalle=p_id_detalle;
 IF p_cantidad>s.disponible_entrega THEN RAISE EXCEPTION 'PDT_SIMPLE_SUPERA_PROCESADO_O_TOTAL'; END IF;
 INSERT INTO sgp_pdt_picking_simple.entregas(id_detalle,cantidad,clave,usuario,observacion) VALUES(p_id_detalle,p_cantidad,p_idempotency_key,actor,p_observacion) RETURNING id_entrega INTO eid;
 done:=sgp_pdt_picking_simple.completo(parent);
 IF done THEN
  -- Trigger still validates all production quantities and the permitted physical transition.
  IF p.estado_repo='MECANIZADO' THEN UPDATE public.sgp_aluminio_pendientes SET estado_repo='PROCESADO',usuario_estado=actor,fecha_estado=now() WHERE id_pendiente=parent; END IF;
  INSERT INTO public.sgp_pdt_cierres(id_pendiente,clave,usuario,evidencia) VALUES(parent,p_idempotency_key,actor,jsonb_build_object('contrato','PICKING_SIMPLE_V1','detalles',(SELECT jsonb_agg(to_jsonb(x)) FROM sgp_pdt_picking_simple.saldos(parent) x)));
  UPDATE public.sgp_aluminio_pendientes SET estado='RESUELTO',estado_repo='PICKING',usuario_cierre=actor,fecha_cierre=now(),usuario_estado=actor,fecha_estado=now() WHERE id_pendiente=parent;
 END IF;
 result:=jsonb_build_object('ok',true,'duplicado',false,'finalizado',done,'id_entrega',eid);
 UPDATE sgp_pdt_picking_simple.entregas SET resultado=result WHERE id_entrega=eid;
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,estado_anterior,estado_nuevo,tipo_evento,observacion,datos_nuevos)
 VALUES(parent,actor,p.estado,CASE WHEN done THEN 'RESUELTO' ELSE p.estado END,'PICKING_SIMPLE_V1',p_observacion,jsonb_build_object('id_detalle',p_id_detalle,'cantidad',p_cantidad,'idempotency_key',p_idempotency_key,'resultado',result));
 RETURN result;
END $$;
-- Old writers cannot change delivery coverage once the simple ledger is in use.
CREATE FUNCTION sgp_pdt_picking_simple.proteger_entregas_anteriores() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE det uuid; parent uuid; BEGIN
 FOR parent IN SELECT DISTINCT d.id_pendiente FROM public.sgp_aluminio_pendiente_detalles d
 WHERE d.id_detalle IN (CASE WHEN TG_OP<>'INSERT' THEN OLD.id_detalle END,CASE WHEN TG_OP<>'DELETE' THEN NEW.id_detalle END)
 ORDER BY d.id_pendiente LOOP
 PERFORM 1 FROM public.sgp_aluminio_pendientes WHERE id_pendiente=parent FOR UPDATE;
 IF EXISTS(SELECT 1 FROM sgp_pdt_picking_simple.entregas e JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle) WHERE d.id_pendiente=parent) THEN RAISE EXCEPTION 'PDT_SIMPLE_USAR_CONFIRMACION_DE_CANTIDAD'; END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER sgp_pdt_simple_no_mezclar BEFORE INSERT OR UPDATE OR DELETE ON public.sgp_pdt_entrega_lineas FOR EACH ROW EXECUTE FUNCTION sgp_pdt_picking_simple.proteger_entregas_anteriores();
CREATE TRIGGER sgp_pdt_simple_no_mezclar BEFORE INSERT OR UPDATE OR DELETE ON public.sgp_pdt_asignaciones FOR EACH ROW EXECUTE FUNCTION sgp_pdt_picking_simple.proteger_entregas_anteriores();
CREATE TRIGGER sgp_pdt_simple_no_mezclar BEFORE INSERT OR UPDATE OR DELETE ON sgp_pdt_manual.entregas FOR EACH ROW EXECUTE FUNCTION sgp_pdt_picking_simple.proteger_entregas_anteriores();
CREATE FUNCTION sgp_pdt_picking_simple.proteger_procesado() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE parent uuid; s record; BEGIN
 SELECT id_pendiente INTO STRICT parent FROM public.sgp_aluminio_pendiente_detalles WHERE id_detalle=NEW.id_detalle;
 PERFORM 1 FROM public.sgp_aluminio_pendientes WHERE id_pendiente=parent FOR UPDATE;
 IF EXISTS(SELECT 1 FROM sgp_pdt_picking_simple.entregas e JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle) WHERE d.id_pendiente=parent) THEN
 SELECT * INTO STRICT s FROM sgp_pdt_picking_simple.saldos(parent) WHERE id_detalle=NEW.id_detalle;
 IF s.procesada<s.entregada OR s.procesada>s.cantidad_validada THEN RAISE EXCEPTION 'PDT_SIMPLE_REVERSO_AFECTA_ENTREGADO'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sgp_pdt_simple_proteger_procesado AFTER INSERT ON public.sgp_aluminio_pendiente_movimientos FOR EACH ROW EXECUTE FUNCTION sgp_pdt_picking_simple.proteger_procesado();
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_pdt_picking_simple FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_pdt_picking_simple FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.sgp_pdt_picking_simple_estado_v1(text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sgp_pdt_picking_simple_v1(text,uuid,integer,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_pdt_picking_simple_estado_v1(text,uuid),public.sgp_pdt_picking_simple_v1(text,uuid,integer,uuid,text) TO anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;

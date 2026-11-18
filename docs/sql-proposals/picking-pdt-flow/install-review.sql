-- REVIEW ONLY. Not applied. No existing business rows are rewritten.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
-- Stabilize the historical cutoff against in-flight legacy deliveries.
LOCK TABLE sgp_pdt_picking_simple.entregas IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
 IF md5(pg_get_functiondef('sgp_pdt_picking_simple.completo(uuid)'::regprocedure))<>'4fc8306277b30a407d19a655d55770eb' OR md5(pg_get_functiondef('public.sgp_pdt_picking_simple_v1(text,uuid,integer,uuid,text)'::regprocedure))<>'611b5077bff1f1248801569e29cca9b6' THEN RAISE EXCEPTION 'PDT_FLOW_BASELINE_CHANGED'; END IF;
END $$;
CREATE SCHEMA sgp_pdt_picking_flow;
REVOKE ALL ON SCHEMA sgp_pdt_picking_flow FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE sgp_pdt_picking_flow.historicos(id_pendiente uuid PRIMARY KEY);
-- Metadata quarantine, not a claim of physical receipt; never changes old ledgers.
INSERT INTO sgp_pdt_picking_flow.historicos SELECT DISTINCT d.id_pendiente FROM public.sgp_aluminio_pendiente_detalles d JOIN sgp_pdt_picking_simple.entregas e USING(id_detalle);
CREATE TABLE sgp_pdt_picking_flow.backup(firma text PRIMARY KEY,definition text NOT NULL,original_acl aclitem[],original_owner oid);
INSERT INTO sgp_pdt_picking_flow.backup VALUES('sgp_pdt_picking_simple.completo(uuid)',pg_get_functiondef('sgp_pdt_picking_simple.completo(uuid)'::regprocedure));
CREATE TABLE sgp_pdt_picking_flow.recepciones(id_recepcion uuid PRIMARY KEY DEFAULT gen_random_uuid(),id_detalle uuid NOT NULL REFERENCES public.sgp_aluminio_pendiente_detalles,idempotency_key uuid NOT NULL UNIQUE,cantidad integer NOT NULL CHECK(cantidad>0),usuario text NOT NULL,observacion text,creado_en timestamptz NOT NULL DEFAULT now(),resultado jsonb NOT NULL DEFAULT '{}');
CREATE INDEX ON sgp_pdt_picking_flow.recepciones(id_detalle);
CREATE TABLE sgp_pdt_picking_flow.avisos(id uuid PRIMARY KEY,id_pendiente uuid NOT NULL REFERENCES public.sgp_aluminio_pendientes,id_detalle uuid NOT NULL REFERENCES public.sgp_aluminio_pendiente_detalles,cantidad integer NOT NULL CHECK(cantidad>0),fecha timestamptz NOT NULL DEFAULT now());
CREATE INDEX ON sgp_pdt_picking_flow.avisos(id_pendiente,id_detalle);
CREATE TABLE sgp_pdt_picking_flow.lecturas(id uuid REFERENCES sgp_pdt_picking_flow.avisos,usuario text NOT NULL,fecha timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(id,usuario));
ALTER TABLE sgp_pdt_picking_flow.historicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_pdt_picking_flow.backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_pdt_picking_flow.recepciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_pdt_picking_flow.avisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_pdt_picking_flow.lecturas ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION sgp_pdt_picking_flow.historico(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM sgp_pdt_picking_flow.historicos WHERE id_pendiente=p_id) OR sgp_pdt_picking_simple.tiene_entregas_anteriores(p_id) $$;
CREATE OR REPLACE FUNCTION sgp_pdt_picking_simple.completo(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM sgp_pdt_picking_simple.saldos(p_id)) AND NOT EXISTS(SELECT 1 FROM sgp_pdt_picking_simple.saldos(p_id) s WHERE cantidad_validada<>procesada OR cantidad_validada<>entregada OR (NOT sgp_pdt_picking_flow.historico(p_id) AND cantidad_validada<>(SELECT coalesce(sum(r.cantidad),0) FROM sgp_pdt_picking_flow.recepciones r WHERE r.id_detalle=s.id_detalle)));
$$;
CREATE FUNCTION sgp_pdt_picking_flow.acceso(p_token text,p_accion text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT upper(btrim(to_jsonb(public.sgp_sesion_actual(p_token))->>'rol'))='ADMINISTRADOR' OR EXISTS(SELECT 1 FROM public.sgp_mis_accesos(p_token) a WHERE a.ventana='picking' OR a.ventana=CASE WHEN p_accion='ENTREGAR' THEN 'picking.entrega' WHEN p_accion='RECIBIR' THEN 'picking.recepcion' ELSE '' END OR (p_accion='LEER' AND a.ventana IN ('picking.entrega','picking.recepcion')));
$$;
-- Guard every public PDT delivery/receipt/close entrypoint, including cached clients.
-- CREATE OR REPLACE preserves identity, ownership, ACL and the original role checks.
DO $$ DECLARE spec record; oid_before oid; def text; patched text; BEGIN
 FOR spec IN SELECT * FROM (VALUES
 ('public.sgp_pdt_picking_simple_v1(text,uuid,integer,uuid,text)','ENTREGAR','611b5077bff1f1248801569e29cca9b6'),
 ('public.sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)','ENTREGAR','7dc66ea3b4be1befaa88f33258652d3b'),
 ('public.sgp_pdt_manual_entrega_registrar_v1(text,uuid,uuid,integer,uuid)','ENTREGAR','b3345388b80c0dea374dc380e00a5283'),
 ('public.sgp_pdt_entrega_validar_v2(text,uuid)','RECIBIR','d1636ba2f38234b43a69a95ab6b42019'),
 ('public.sgp_pdt_manual_entrega_validar_v1(text,uuid)','RECIBIR','dda702c28ed637496a3f6437ddba1ac2'),
 ('public.sgp_pdt_asignar_v2(text,uuid,uuid)','RECIBIR','831f98fcc52e25248d8fbc4747c1ebe9'),
 ('public.sgp_pdt_manual_asignar_v1(text,uuid,uuid)','RECIBIR','1780cc1ed8b03c76837f7a69f64bdc0d'),
 ('public.sgp_pdt_cerrar_v2(text,uuid,uuid)','RECIBIR','cad60e24cefcd15a441189b320753808'),
 ('public.sgp_pdt_manual_cerrar_v1(text,uuid,uuid)','RECIBIR','e3822711b04fef239cac96175d6b2687'),
 ('public.sgp_pdt_entrega_anular_v2(text,uuid,text)','ENTREGAR','33434cec647698daf03a2125077d35c7'),
 ('public.sgp_pdt_manual_entrega_anular_v1(text,uuid,text)','ENTREGAR','f3ef90992bc95a4890db39f9b5286032')
 ) AS v(firma,accion,expected_hash) LOOP
 oid_before:=to_regprocedure(spec.firma);
 IF oid_before IS NULL THEN RAISE EXCEPTION 'PDT_FLOW_LEGACY_ENTRYPOINT_MISSING: %',spec.firma; END IF;
 def:=pg_get_functiondef(oid_before);
 IF md5(def)<>spec.expected_hash OR position(E'\nBEGIN\n' in def)=0 THEN RAISE EXCEPTION 'PDT_FLOW_LEGACY_ENTRYPOINT_CHANGED: %',spec.firma; END IF;
 INSERT INTO sgp_pdt_picking_flow.backup(firma,definition,original_acl,original_owner) SELECT spec.firma,def,proacl,proowner FROM pg_proc WHERE oid=oid_before;
 patched:=regexp_replace(def,E'\nBEGIN\n',E'\nBEGIN\n IF NOT sgp_pdt_picking_flow.acceso(p_token,'||quote_literal(spec.accion)||E') THEN RAISE EXCEPTION ''PDT_FLOW_ACCESO_DENEGADO''; END IF;\n');
 EXECUTE patched;
 IF to_regprocedure(spec.firma)<>oid_before OR EXISTS(SELECT 1 FROM pg_proc p JOIN sgp_pdt_picking_flow.backup b ON b.firma=spec.firma WHERE p.oid=oid_before AND (p.proacl IS DISTINCT FROM b.original_acl OR p.proowner<>b.original_owner)) THEN RAISE EXCEPTION 'PDT_FLOW_LEGACY_ACL_CHANGED'; END IF;
 END LOOP;
END $$;
CREATE FUNCTION public.sgp_pdt_picking_movimiento_v1(p_token text,p_id_detalle uuid,p_accion text,p_cantidad integer,p_idempotency_key uuid,p_observacion text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text; parent uuid; p public.sgp_aluminio_pendientes; old sgp_pdt_picking_flow.recepciones; s record; received bigint; done boolean; result jsonb; rid uuid;
BEGIN
 IF p_accion NOT IN ('ENTREGAR','RECIBIR') OR p_accion IS NULL OR p_id_detalle IS NULL OR p_cantidad IS NULL OR p_cantidad<=0 OR p_idempotency_key IS NULL OR length(coalesce(p_observacion,''))>2000 THEN RAISE EXCEPTION 'PDT_FLOW_PARAMETROS_INVALIDOS'; END IF;
 actor:=public.sgp_pdt_validar_rol_real(p_token,CASE WHEN p_accion='ENTREGAR' THEN ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING'] ELSE ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','RECEPCION','LIDER LINEA','LIDER'] END);
 IF NOT sgp_pdt_picking_flow.acceso(p_token,p_accion) THEN RAISE EXCEPTION 'PDT_FLOW_ACCESO_DENEGADO'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key::text,431));
 SELECT id_pendiente INTO STRICT parent FROM public.sgp_aluminio_pendiente_detalles WHERE id_detalle=p_id_detalle;
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=parent FOR UPDATE;
 IF sgp_pdt_picking_flow.historico(parent) THEN RAISE EXCEPTION 'PDT_FLOW_HISTORICO_POR_CONCILIAR'; END IF;
 SELECT * INTO old FROM sgp_pdt_picking_flow.recepciones WHERE idempotency_key=p_idempotency_key;
 IF FOUND THEN
 IF p_accion<>'RECIBIR' OR old.id_detalle<>p_id_detalle OR old.cantidad<>p_cantidad OR old.usuario<>actor OR old.observacion IS DISTINCT FROM p_observacion THEN RAISE EXCEPTION 'PDT_FLOW_CLAVE_REUTILIZADA'; END IF;
 RETURN old.resultado||jsonb_build_object('duplicado',true);
 END IF;
 IF p_accion='ENTREGAR' THEN RETURN public.sgp_pdt_picking_simple_v1(p_token,p_id_detalle,p_cantidad,p_idempotency_key,p_observacion); END IF;
 IF EXISTS(SELECT 1 FROM sgp_pdt_picking_simple.entregas WHERE clave=p_idempotency_key) THEN RAISE EXCEPTION 'PDT_FLOW_CLAVE_REUTILIZADA'; END IF;
 IF p.contrato_pdt IS DISTINCT FROM 'V2' OR p.estado IS DISTINCT FROM 'PENDIENTE' OR p.validacion_estado IS DISTINCT FROM 'VALIDADO' OR p.fecha_cierre IS NOT NULL THEN RAISE EXCEPTION 'PDT_FLOW_NO_APTO'; END IF;
 PERFORM 1 FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=parent ORDER BY id_detalle FOR UPDATE;
 SELECT * INTO STRICT s FROM sgp_pdt_picking_simple.saldos(parent) WHERE id_detalle=p_id_detalle;
 SELECT coalesce(sum(cantidad),0) INTO received FROM sgp_pdt_picking_flow.recepciones WHERE id_detalle=p_id_detalle;
 IF s.procesada<s.entregada OR s.procesada>s.cantidad_validada OR received>s.entregada THEN RAISE EXCEPTION 'PDT_SIMPLE_SALDOS_INCONSISTENTES'; END IF;
 IF p_cantidad>s.entregada-received THEN RAISE EXCEPTION 'PDT_FLOW_SUPERA_ENTREGADO'; END IF;
 INSERT INTO sgp_pdt_picking_flow.recepciones(id_detalle,idempotency_key,cantidad,usuario,observacion) VALUES(p_id_detalle,p_idempotency_key,p_cantidad,actor,p_observacion) RETURNING id_recepcion INTO rid;
 done:=sgp_pdt_picking_simple.completo(parent);
 IF done THEN
 IF p.estado_repo='MECANIZADO' THEN UPDATE public.sgp_aluminio_pendientes SET estado_repo='PROCESADO',usuario_estado=actor,fecha_estado=now() WHERE id_pendiente=parent; END IF;
 INSERT INTO public.sgp_pdt_cierres(id_pendiente,clave,usuario,evidencia) VALUES(parent,p_idempotency_key,actor,jsonb_build_object('contrato','PICKING_SIMPLE_V1','recepcion','PICKING_FLOW_V1','detalles',(SELECT jsonb_agg(to_jsonb(x)) FROM sgp_pdt_picking_simple.saldos(parent) x)));
 UPDATE public.sgp_aluminio_pendientes SET estado='RESUELTO',estado_repo='PICKING',usuario_cierre=actor,fecha_cierre=now(),usuario_estado=actor,fecha_estado=now() WHERE id_pendiente=parent;
 END IF;
 result:=jsonb_build_object('ok',true,'duplicado',false,'finalizado',done,'id_recepcion',rid);
 UPDATE sgp_pdt_picking_flow.recepciones SET resultado=result WHERE id_recepcion=rid;
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,estado_anterior,estado_nuevo,tipo_evento,observacion,datos_nuevos) VALUES(parent,actor,p.estado,CASE WHEN done THEN 'RESUELTO' ELSE p.estado END,'PICKING_RECEPCION_V1',p_observacion,jsonb_build_object('id_detalle',p_id_detalle,'cantidad',p_cantidad,'idempotency_key',p_idempotency_key,'resultado',result));
 RETURN result;
END $$;
CREATE FUNCTION sgp_pdt_picking_flow.notificar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NEW.tipo='AVANCE' AND NEW.cantidad>0 THEN INSERT INTO sgp_pdt_picking_flow.avisos(id,id_pendiente,id_detalle,cantidad) VALUES(NEW.id_movimiento,NEW.id_pendiente,NEW.id_detalle,NEW.cantidad) ON CONFLICT DO NOTHING; END IF; RETURN NEW;
END $$;
CREATE TRIGGER pdt_flow_aviso AFTER INSERT ON public.sgp_aluminio_pendiente_movimientos FOR EACH ROW EXECUTE FUNCTION sgp_pdt_picking_flow.notificar();
CREATE FUNCTION public.sgp_pdt_picking_aviso_leer_v1(p_token text,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE actor text; BEGIN
 actor:=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','RECEPCION','LIDER LINEA','LIDER','PATINADOR','CONSULTA']);
 IF NOT sgp_pdt_picking_flow.acceso(p_token,'LEER') THEN RAISE EXCEPTION 'PDT_FLOW_ACCESO_DENEGADO'; END IF;
 IF NOT EXISTS(SELECT 1 FROM sgp_pdt_picking_flow.avisos WHERE id=p_id) THEN RAISE EXCEPTION 'PDT_FLOW_AVISO_NO_EXISTE'; END IF;
 INSERT INTO sgp_pdt_picking_flow.lecturas(id,usuario) VALUES(p_id,actor) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('ok',true);
END $$;
CREATE FUNCTION public.sgp_pdt_picking_cola_v1(p_token text,p_modo text DEFAULT 'delivery',p_estado text DEFAULT 'open',p_semana text DEFAULT NULL,p_busqueda text DEFAULT NULL,p_cursor uuid DEFAULT NULL,p_limite integer DEFAULT 100) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text; rol text; result jsonb; page jsonb; more boolean; BEGIN
 IF p_modo IS NULL OR p_modo NOT IN ('delivery','reception') OR p_estado IS NULL OR p_estado NOT IN ('open','closed','all') OR p_limite IS NULL OR p_limite<1 OR p_limite>100 OR length(coalesce(p_busqueda,''))>200 THEN RAISE EXCEPTION 'PDT_FLOW_PARAMETROS_INVALIDOS'; END IF;
 actor:=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','RECEPCION','LIDER LINEA','LIDER','PATINADOR','CONSULTA']);
 IF NOT sgp_pdt_picking_flow.acceso(p_token,'LEER') THEN RAISE EXCEPTION 'PDT_FLOW_ACCESO_DENEGADO'; END IF;
 rol:=upper(btrim(to_jsonb(public.sgp_sesion_actual(p_token))->>'rol'));
 SELECT jsonb_build_object('ok',true,'contract_version',1,'capabilities',jsonb_build_object('deliver',sgp_pdt_picking_flow.acceso(p_token,'ENTREGAR') AND rol=ANY(ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING']),'receive',sgp_pdt_picking_flow.acceso(p_token,'RECIBIR') AND rol=ANY(ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','RECEPCION','LIDER LINEA','LIDER'])),
 'rows',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM (
 SELECT d.id_detalle id,d.id_pendiente,p.contrato_pdt contrato,coalesce(to_jsonb(p)->>'semana',(SELECT coalesce(to_jsonb(pr)->>'semana_actual',to_jsonb(pr)->>'semana_base') FROM public.sgp_producciones pr WHERE pr.key_produccion=p.key_produccion LIMIT 1)) semana,p.produccion,p.reserva,p.perfil,to_jsonb(p)->>'nc' nc,to_jsonb(d)->>'fabricacion' fabricacion,to_jsonb(d)->>'longitud' longitud,to_jsonb(d)->>'acabado' acabado,to_jsonb(d)->>'id_pieza' id_pieza,
 s.procesada procesado,s.entregada entregado,rx.n recibido,s.disponible_entrega, s.entregada-rx.n saldo_recepcion,
 CASE WHEN h.yes THEN 'HISTORICO_POR_CONCILIAR' WHEN p.estado='RESUELTO' THEN 'CERRADO' WHEN rx.n>0 THEN 'RECEPCION_PARCIAL' WHEN s.entregada>0 AND s.entregada=s.cantidad_validada THEN 'POR_RECIBIR' WHEN s.entregada>0 THEN 'ENTREGA_PARCIAL' ELSE 'POR_ENTREGAR' END estado,
 NOT h.yes AND p.contrato_pdt='V2' AND p.estado='PENDIENTE' AND p.validacion_estado='VALIDADO' AND s.disponible_entrega>0 AND sgp_pdt_picking_flow.acceso(p_token,'ENTREGAR') AND rol=ANY(ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING']) can_deliver,
 NOT h.yes AND p.contrato_pdt='V2' AND p.estado='PENDIENTE' AND s.entregada>rx.n AND sgp_pdt_picking_flow.acceso(p_token,'RECIBIR') AND rol=ANY(ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','RECEPCION','LIDER LINEA','LIDER']) can_receive,
 coalesce((SELECT jsonb_agg(jsonb_build_object('tipo',m.tipo,'cantidad',m.cantidad,'nombre',coalesce(nullif(btrim(u.nombre),''),'Nombre no disponible'),'fecha',m.fecha,'observacion',m.observacion) ORDER BY m.fecha) FROM (
 SELECT 'ENTREGA' tipo,e.cantidad,e.usuario,e.creado_en fecha,e.observacion FROM sgp_pdt_picking_simple.entregas e WHERE e.id_detalle=d.id_detalle
 UNION ALL SELECT 'RECEPCION',q.cantidad,q.usuario,q.creado_en,q.observacion FROM sgp_pdt_picking_flow.recepciones q WHERE q.id_detalle=d.id_detalle
 ) m LEFT JOIN public.sgp_usuarios u ON u.usuario=m.usuario),'[]'::jsonb) movimientos
 FROM public.sgp_aluminio_pendientes p CROSS JOIN LATERAL sgp_pdt_picking_simple.saldos(p.id_pendiente) s JOIN public.sgp_aluminio_pendiente_detalles d ON d.id_detalle=s.id_detalle
 CROSS JOIN LATERAL (SELECT coalesce(sum(q.cantidad),0) n FROM sgp_pdt_picking_flow.recepciones q WHERE q.id_detalle=d.id_detalle) rx
 CROSS JOIN LATERAL (SELECT sgp_pdt_picking_flow.historico(p.id_pendiente) yes) h
 WHERE p.contrato_pdt='V2' AND p.estado<>'ANULADO' AND (s.procesada>0 OR s.entregada>0)
 AND (p_cursor IS NULL OR d.id_detalle>p_cursor)
 AND (p_estado='all' OR (p_estado='closed' AND p.estado='RESUELTO') OR (p_estado='open' AND p.estado='PENDIENTE' AND (h.yes OR CASE WHEN p_modo='delivery' THEN s.disponible_entrega>0 ELSE s.entregada>rx.n END)))
 AND (nullif(p_semana,'') IS NULL OR coalesce(to_jsonb(p)->>'semana',(SELECT coalesce(to_jsonb(pr)->>'semana_actual',to_jsonb(pr)->>'semana_base') FROM public.sgp_producciones pr WHERE pr.key_produccion=p.key_produccion LIMIT 1))=p_semana)
 AND (nullif(btrim(p_busqueda),'') IS NULL OR strpos(lower(concat_ws(' ',p.produccion,p.reserva,p.perfil,to_jsonb(p)->>'nc',to_jsonb(d)->>'fabricacion',to_jsonb(d)->>'acabado',to_jsonb(d)->>'longitud')),lower(btrim(p_busqueda)))>0)
 ORDER BY d.id_detalle LIMIT p_limite+1
 ) r),'[]'::jsonb),
 'notifications','[]'::jsonb) INTO result;
 more:=jsonb_array_length(result->'rows')>p_limite;
 SELECT coalesce(jsonb_agg(x.value ORDER BY x.ord),'[]'::jsonb) INTO page FROM jsonb_array_elements(result->'rows') WITH ORDINALITY x(value,ord) WHERE x.ord<=p_limite;
 result:=result||jsonb_build_object('rows',page,'has_more',more,'next_cursor',CASE WHEN more THEN page->(jsonb_array_length(page)-1)->>'id' ELSE NULL END);
 RETURN result;
END $$;
CREATE FUNCTION public.sgp_pdt_picking_avisos_v1(p_token text,p_cursor uuid DEFAULT NULL,p_limite integer DEFAULT 50) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text; rol text; result jsonb; page jsonb; more boolean; BEGIN
 actor:=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','RECEPCION','LIDER LINEA','LIDER','PATINADOR','CONSULTA']);
 IF NOT sgp_pdt_picking_flow.acceso(p_token,'LEER') THEN RAISE EXCEPTION 'PDT_FLOW_ACCESO_DENEGADO'; END IF;
 IF p_limite IS NULL OR p_limite<1 OR p_limite>50 THEN RAISE EXCEPTION 'PDT_FLOW_PARAMETROS_INVALIDOS'; END IF;
 rol:=upper(btrim(to_jsonb(public.sgp_sesion_actual(p_token))->>'rol'));
 WITH eligible AS MATERIALIZED (
 SELECT a.id,a.id_pendiente,p.produccion,p.reserva,p.perfil,a.cantidad,a.fecha,l.fecha read_at FROM sgp_pdt_picking_flow.avisos a JOIN public.sgp_aluminio_pendientes p USING(id_pendiente) LEFT JOIN sgp_pdt_picking_flow.lecturas l ON l.id=a.id AND l.usuario=actor
 WHERE p.estado='PENDIENTE' AND NOT sgp_pdt_picking_flow.historico(p.id_pendiente) AND EXISTS(SELECT 1 FROM sgp_pdt_picking_simple.saldos(p.id_pendiente) s WHERE s.id_detalle=a.id_detalle AND s.disponible_entrega>0)
 ), bounded AS (SELECT * FROM eligible WHERE p_cursor IS NULL OR id>p_cursor ORDER BY id LIMIT p_limite+1)
 SELECT jsonb_build_object('ok',true,'contract_version',1,'notifications',coalesce((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM bounded b),'[]'::jsonb),'unread_count',(SELECT count(*) FROM eligible WHERE read_at IS NULL),'capabilities',jsonb_build_object('deliver',sgp_pdt_picking_flow.acceso(p_token,'ENTREGAR') AND rol=ANY(ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING']),'receive',sgp_pdt_picking_flow.acceso(p_token,'RECIBIR') AND rol=ANY(ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','RECEPCION','LIDER LINEA','LIDER']))) INTO result;
 more:=jsonb_array_length(result->'notifications')>p_limite;
 SELECT coalesce(jsonb_agg(x.value ORDER BY x.ord),'[]'::jsonb) INTO page FROM jsonb_array_elements(result->'notifications') WITH ORDINALITY x(value,ord) WHERE x.ord<=p_limite;
 RETURN result||jsonb_build_object('notifications',page,'has_more',more,'next_cursor',CASE WHEN more THEN page->(jsonb_array_length(page)-1)->>'id' ELSE NULL END);
END $$;
-- The old detail UI must not offer explicit close for a new receipt-required PDT.
DO $$ DECLARE def text; BEGIN
 def:=pg_get_functiondef('public.sgp_pdt_picking_simple_estado_v1(text,uuid)'::regprocedure);
 INSERT INTO sgp_pdt_picking_flow.backup VALUES('public.sgp_pdt_picking_simple_estado_v1(text,uuid)',def);
 IF position('RETURN result;' in def)=0 THEN RAISE EXCEPTION 'PDT_FLOW_ESTADO_CHANGED'; END IF;
 EXECUTE replace(def,'RETURN result;', 'RETURN result||jsonb_build_object(''requiere_recepcion'',NOT sgp_pdt_picking_flow.historico(p_id));');
END $$;
CREATE FUNCTION sgp_pdt_picking_flow.proteger_clave() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.clave::text,431));
 IF EXISTS(SELECT 1 FROM sgp_pdt_picking_flow.recepciones WHERE idempotency_key=NEW.clave) THEN RAISE EXCEPTION 'PDT_FLOW_CLAVE_REUTILIZADA'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER pdt_flow_clave BEFORE INSERT ON sgp_pdt_picking_simple.entregas FOR EACH ROW EXECUTE FUNCTION sgp_pdt_picking_flow.proteger_clave();
UPDATE sgp_pdt_picking_flow.backup b SET original_acl=p.proacl,original_owner=p.proowner FROM pg_proc p WHERE p.oid=to_regprocedure(b.firma) AND b.original_owner IS NULL;
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_pdt_picking_flow FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_pdt_picking_flow FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.sgp_pdt_picking_cola_v1(text,text,text,text,text,uuid,integer),public.sgp_pdt_picking_avisos_v1(text,uuid,integer),public.sgp_pdt_picking_movimiento_v1(text,uuid,text,integer,uuid,text),public.sgp_pdt_picking_aviso_leer_v1(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_pdt_picking_cola_v1(text,text,text,text,text,uuid,integer),public.sgp_pdt_picking_avisos_v1(text,uuid,integer),public.sgp_pdt_picking_movimiento_v1(text,uuid,text,integer,uuid,text),public.sgp_pdt_picking_aviso_leer_v1(text,uuid) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

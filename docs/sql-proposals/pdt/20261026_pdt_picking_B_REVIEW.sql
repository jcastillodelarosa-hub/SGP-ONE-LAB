-- OPTIONAL PHASE B. Not advertised by phase-A capabilities. REVIEW, ISOLATED TEST ONLY.
BEGIN;
CREATE TABLE IF NOT EXISTS public.sgp_pdt_entrega_lineas (
 id_linea uuid PRIMARY KEY DEFAULT gen_random_uuid(), id_entrega uuid NOT NULL REFERENCES public.sgp_picking_entregas(id_entrega),
 id_detalle uuid NOT NULL REFERENCES public.sgp_aluminio_pendiente_detalles(id_detalle),
 id_pieza text NOT NULL,
 cantidad integer NOT NULL CHECK(cantidad>0), estado text NOT NULL DEFAULT 'REGISTRADA' CHECK(estado IN ('REGISTRADA','VALIDADA','ANULADA')),
 clave uuid NOT NULL UNIQUE, registrado_por text NOT NULL, validado_por text, motivo text, anulado_por text, anulado_en timestamptz,
 creado_en timestamptz NOT NULL DEFAULT now(), validado_en timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS sgp_pdt_linea_fuente_activa ON public.sgp_pdt_entrega_lineas(id_entrega,id_pieza) WHERE estado<>'ANULADA';
CREATE TABLE IF NOT EXISTS public.sgp_pdt_asignaciones (
 id_asignacion uuid PRIMARY KEY DEFAULT gen_random_uuid(), id_linea uuid NOT NULL UNIQUE REFERENCES public.sgp_pdt_entrega_lineas(id_linea),
 id_detalle uuid NOT NULL REFERENCES public.sgp_aluminio_pendiente_detalles(id_detalle),
 cantidad integer NOT NULL CHECK(cantidad>0), clave uuid NOT NULL UNIQUE, asignado_por text NOT NULL,
 creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.sgp_pdt_cierres (
 id_pendiente uuid PRIMARY KEY REFERENCES public.sgp_aluminio_pendientes(id_pendiente),
 clave uuid NOT NULL UNIQUE, usuario text NOT NULL, evidencia jsonb NOT NULL, creado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sgp_pdt_entrega_lineas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sgp_pdt_asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sgp_pdt_cierres ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sgp_pdt_entrega_lineas,public.sgp_pdt_asignaciones,public.sgp_pdt_cierres FROM PUBLIC,anon,authenticated;

-- All operations lock parent FIRST, then line; never lock a line before its PDT.
CREATE OR REPLACE FUNCTION public.sgp_pdt_picking_v2(p_token text,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE p public.sgp_aluminio_pendientes%rowtype;
BEGIN
 PERFORM public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION','PICKING','SUPERVISOR DE PICKING','LIDER MECANIZADO','LIDER']);
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id;
 IF p.contrato_pdt<>'V2' THEN RAISE EXCEPTION 'PDT no V2'; END IF;
 RETURN jsonb_build_object('ok',true,'entregas',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (
  SELECT pe.id_entrega,pe.estado,pe.completa,pe.produccion FROM public.sgp_picking_entregas pe
  JOIN public.sgp_mecanizado_programacion mp USING(id_programacion)
  JOIN public.sgp_producciones prod ON prod.key_produccion=p.key_produccion
  WHERE pe.produccion=prod.produccion AND upper(btrim(mp.sistema))=upper(btrim(prod.sistema))
  AND mp.reserva=p.reserva AND upper(btrim(mp.acabado))=upper(btrim(p.acabado_pendiente))
 )x),'[]'::jsonb),'lineas',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('asignada',EXISTS(
 SELECT 1 FROM public.sgp_pdt_asignaciones a WHERE a.id_linea=l.id_linea)))
 FROM public.sgp_pdt_entrega_lineas l JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle)
 WHERE d.id_pendiente=p_id),'[]'::jsonb));
END $fn$;
CREATE OR REPLACE FUNCTION public.sgp_pdt_entrega_registrar_v2(p_token text,p_detalle uuid,p_entrega uuid,p_cantidad integer,p_clave uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE d public.sgp_aluminio_pendiente_detalles%rowtype; p public.sgp_aluminio_pendientes%rowtype;
 e public.sgp_pdt_entrega_lineas%rowtype; u text; nuevo uuid; neto bigint;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING']);
 IF p_cantidad IS NULL OR p_cantidad<=0 OR p_clave IS NULL THEN RAISE EXCEPTION 'Cantidad/clave inválida'; END IF;
 SELECT * INTO STRICT d FROM public.sgp_aluminio_pendiente_detalles WHERE id_detalle=p_detalle;
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=d.id_pendiente FOR UPDATE;
 SELECT * INTO e FROM public.sgp_pdt_entrega_lineas WHERE clave=p_clave;
 IF FOUND THEN
  IF e.id_detalle<>p_detalle OR e.id_entrega<>p_entrega OR e.cantidad<>p_cantidad THEN RAISE EXCEPTION 'Clave reutilizada'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicado',true,'id_linea',e.id_linea);
 END IF;
 IF p.contrato_pdt<>'V2' OR p.estado<>'PENDIENTE' OR p.validacion_estado<>'VALIDADO' THEN RAISE EXCEPTION 'PDT no apto'; END IF;
 PERFORM 1 FROM public.sgp_picking_entregas WHERE id_entrega=p_entrega FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Entrega inexistente'; END IF;
 PERFORM 1 FROM public.sgp_mecanizado_programacion mp JOIN public.sgp_picking_entregas pe_lock USING(id_programacion) WHERE pe_lock.id_entrega=p_entrega FOR UPDATE OF mp;
 -- Explicit event identity, not global order status or missing quantities.
 PERFORM 1 FROM public.sgp_picking_entregas pe
 JOIN public.sgp_mecanizado_programacion mp ON mp.id_programacion=pe.id_programacion
 JOIN public.sgp_producciones prod ON prod.key_produccion=p.key_produccion
 WHERE pe.id_entrega=p_entrega AND pe.produccion=prod.produccion
 AND upper(btrim(mp.sistema))=upper(btrim(prod.sistema))
 AND mp.reserva=p.reserva AND upper(btrim(mp.acabado))=upper(btrim(d.acabado))
 AND EXISTS(SELECT 1 FROM public.sgp_pdt_fuentes f WHERE f.id_detalle=d.id_detalle
 AND upper(btrim(f.snapshot->>'sistema'))=upper(btrim(mp.sistema))
 AND f.snapshot->>'key_produccion'=p.key_produccion);
 IF NOT FOUND THEN RAISE EXCEPTION 'Entrega ajena o identidad incompleta'; END IF;
 SELECT coalesce(sum(CASE WHEN tipo='AVANCE' THEN cantidad ELSE -cantidad END),0) INTO neto
 FROM public.sgp_aluminio_pendiente_movimientos WHERE id_detalle=p_detalle;
 IF p_cantidad+coalesce((SELECT sum(cantidad) FROM public.sgp_pdt_entrega_lineas WHERE id_detalle=p_detalle AND estado<>'ANULADA'),0)>neto
 THEN RAISE EXCEPTION 'Entrega supera procesado'; END IF;
 INSERT INTO public.sgp_pdt_entrega_lineas(id_entrega,id_detalle,id_pieza,cantidad,clave,registrado_por)
 VALUES(p_entrega,p_detalle,d.id_pieza,p_cantidad,p_clave,u) RETURNING id_linea INTO nuevo;
 RETURN jsonb_build_object('ok',true,'id_linea',nuevo);
END $fn$;
CREATE OR REPLACE FUNCTION public.sgp_pdt_entrega_validar_v2(p_token text,p_linea uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE l public.sgp_pdt_entrega_lineas%rowtype; parent uuid; u text; p public.sgp_aluminio_pendientes%rowtype;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION','SUPERVISOR DE PICKING']);
 SELECT d.id_pendiente INTO STRICT parent FROM public.sgp_pdt_entrega_lineas x JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle) WHERE x.id_linea=p_linea;
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=parent FOR UPDATE;
 SELECT * INTO STRICT l FROM public.sgp_pdt_entrega_lineas WHERE id_linea=p_linea FOR UPDATE;
 IF l.estado='VALIDADA' THEN RETURN jsonb_build_object('ok',true,'duplicado',true); END IF;
 IF p.estado<>'PENDIENTE' OR l.estado<>'REGISTRADA' THEN RAISE EXCEPTION 'Línea no apta'; END IF;
 PERFORM 1 FROM public.sgp_picking_entregas WHERE id_entrega=l.id_entrega AND estado='VALIDADA' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Entrega Picking sin validación inequívoca'; END IF;
 UPDATE public.sgp_pdt_entrega_lineas SET estado='VALIDADA',validado_por=u,validado_en=now() WHERE id_linea=p_linea;
 RETURN jsonb_build_object('ok',true);
END $fn$;
CREATE OR REPLACE FUNCTION public.sgp_pdt_asignar_v2(p_token text,p_linea uuid,p_clave uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE l public.sgp_pdt_entrega_lineas%rowtype; parent uuid; e public.sgp_pdt_asignaciones%rowtype; u text; p public.sgp_aluminio_pendientes%rowtype;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION','SUPERVISOR DE PICKING']);
 IF p_clave IS NULL THEN RAISE EXCEPTION 'Clave requerida'; END IF;
 SELECT d.id_pendiente INTO STRICT parent FROM public.sgp_pdt_entrega_lineas x JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle) WHERE x.id_linea=p_linea;
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=parent FOR UPDATE;
 SELECT * INTO e FROM public.sgp_pdt_asignaciones WHERE clave=p_clave;
 IF FOUND THEN
  IF e.id_linea<>p_linea THEN RAISE EXCEPTION 'Clave reutilizada'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicado',true);
 END IF;
 SELECT * INTO STRICT l FROM public.sgp_pdt_entrega_lineas WHERE id_linea=p_linea FOR UPDATE;
 IF p.estado<>'PENDIENTE' OR l.estado<>'VALIDADA' THEN RAISE EXCEPTION 'Evidencia no apta'; END IF;
 -- Minimal contract: whole line assigned once, to its verified detail only.
 IF (SELECT coalesce(sum(a.cantidad),0) FROM public.sgp_pdt_asignaciones a
 JOIN public.sgp_pdt_entrega_lineas x USING(id_linea) WHERE a.id_detalle=l.id_detalle AND x.estado='VALIDADA')+l.cantidad
 >(SELECT cantidad_validada FROM public.sgp_aluminio_pendiente_detalles WHERE id_detalle=l.id_detalle)
 THEN RAISE EXCEPTION 'Sobreasignación'; END IF;
 INSERT INTO public.sgp_pdt_asignaciones(id_linea,id_detalle,cantidad,clave,asignado_por) VALUES(p_linea,l.id_detalle,l.cantidad,p_clave,u);
 RETURN jsonb_build_object('ok',true);
END $fn$;
CREATE OR REPLACE FUNCTION public.sgp_pdt_entrega_anular_v2(p_token text,p_linea uuid,p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE parent uuid; p public.sgp_aluminio_pendientes%rowtype; l public.sgp_pdt_entrega_lineas%rowtype; u text;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR']);
 IF nullif(btrim(p_motivo),'') IS NULL THEN RAISE EXCEPTION 'Motivo requerido'; END IF;
 SELECT d.id_pendiente INTO STRICT parent FROM public.sgp_pdt_entrega_lineas x JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle) WHERE x.id_linea=p_linea;
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=parent FOR UPDATE;
 SELECT * INTO STRICT l FROM public.sgp_pdt_entrega_lineas WHERE id_linea=p_linea FOR UPDATE;
 IF l.estado='ANULADA' THEN RETURN jsonb_build_object('ok',true,'duplicado',true); END IF;
 IF p.estado<>'PENDIENTE' THEN RAISE EXCEPTION 'Conciliar cierre antes de anular'; END IF;
 UPDATE public.sgp_pdt_entrega_lineas SET estado='ANULADA',motivo=p_motivo,anulado_por=u,anulado_en=now() WHERE id_linea=p_linea;
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,tipo_evento,observacion,datos_nuevos)
 VALUES(parent,u,'ANULACION_ENTREGA_V2',p_motivo,jsonb_build_object('linea',p_linea));
 RETURN jsonb_build_object('ok',true);
END $fn$;
CREATE OR REPLACE FUNCTION public.sgp_pdt_comprometido(p_detalle uuid)
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $fn$
 SELECT coalesce(sum(cantidad),0)::bigint FROM public.sgp_pdt_entrega_lineas WHERE id_detalle=p_detalle AND estado<>'ANULADA';
$fn$;
CREATE OR REPLACE FUNCTION public.sgp_pdt_proteger_entrega_origen()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM public.sgp_pdt_entrega_lineas WHERE id_entrega=OLD.id_entrega AND estado<>'ANULADA') THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Entrega con evidencia PDT vigente'; END IF;
  IF ROW(NEW.produccion,NEW.id_programacion) IS DISTINCT FROM ROW(OLD.produccion,OLD.id_programacion) THEN
   RAISE EXCEPTION 'Conciliar evidencia PDT antes de modificar entrega';
  END IF;
  -- Registered quantities do not certify delivery: let the legacy audit produce
  -- VALIDADA or AUDITADA_DIFERENCIA. Once certified, annul explicitly first.
  IF NEW.estado IS DISTINCT FROM OLD.estado AND EXISTS(
   SELECT 1 FROM public.sgp_pdt_entrega_lineas WHERE id_entrega=OLD.id_entrega AND estado='VALIDADA') THEN
   RAISE EXCEPTION 'Conciliar evidencia PDT antes de modificar entrega';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS trg_sgp_pdt_entrega_origen ON public.sgp_picking_entregas;
CREATE TRIGGER trg_sgp_pdt_entrega_origen BEFORE UPDATE OR DELETE ON public.sgp_picking_entregas
 FOR EACH ROW EXECUTE FUNCTION public.sgp_pdt_proteger_entrega_origen();
REVOKE ALL ON FUNCTION public.sgp_pdt_comprometido(uuid),public.sgp_pdt_proteger_entrega_origen() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.sgp_pdt_proteger_programacion_origen()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM public.sgp_pdt_entrega_lineas l JOIN public.sgp_picking_entregas e USING(id_entrega)
 WHERE e.id_programacion=OLD.id_programacion AND l.estado<>'ANULADA') THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Programación con evidencia PDT vigente'; END IF;
  IF ROW(NEW.sistema,NEW.reserva,NEW.acabado) IS DISTINCT FROM ROW(OLD.sistema,OLD.reserva,OLD.acabado)
  THEN RAISE EXCEPTION 'Conciliar evidencia PDT antes de modificar identidad de programación'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS trg_sgp_pdt_programacion_origen ON public.sgp_mecanizado_programacion;
CREATE TRIGGER trg_sgp_pdt_programacion_origen BEFORE UPDATE OR DELETE ON public.sgp_mecanizado_programacion
 FOR EACH ROW EXECUTE FUNCTION public.sgp_pdt_proteger_programacion_origen();
REVOKE ALL ON FUNCTION public.sgp_pdt_proteger_programacion_origen() FROM PUBLIC,anon,authenticated;
-- Server certificate checked by header trigger. Phase A returns false if absent.
CREATE OR REPLACE FUNCTION public.sgp_pdt_cierre_acreditado(p_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $fn$
 SELECT EXISTS(SELECT 1 FROM public.sgp_pdt_cierres WHERE id_pendiente=p_id)
 AND EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=p_id)
 AND NOT EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d WHERE d.id_pendiente=p_id AND (
 d.cantidad_validada<>(SELECT coalesce(sum(CASE WHEN m.tipo='AVANCE' THEN m.cantidad ELSE -m.cantidad END),0) FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_detalle=d.id_detalle)
 OR d.cantidad_validada<>(SELECT coalesce(sum(a.cantidad),0) FROM public.sgp_pdt_asignaciones a
 JOIN public.sgp_pdt_entrega_lineas l USING(id_linea) JOIN public.sgp_picking_entregas e ON e.id_entrega=l.id_entrega
 JOIN public.sgp_mecanizado_programacion mp ON mp.id_programacion=e.id_programacion
 JOIN public.sgp_pdt_fuentes f ON f.id_detalle=a.id_detalle
 JOIN public.sgp_aluminio_pendientes p ON p.id_pendiente=d.id_pendiente
 WHERE a.id_detalle=d.id_detalle AND l.estado='VALIDADA' AND e.estado='VALIDADA'
 AND e.produccion=p.produccion AND mp.reserva=p.reserva
 AND upper(btrim(mp.sistema))=upper(btrim(f.snapshot->>'sistema'))
 AND upper(btrim(mp.acabado))=upper(btrim(d.acabado)))));
$fn$;
CREATE OR REPLACE FUNCTION public.sgp_pdt_cerrar_v2(p_token text,p_id uuid,p_clave uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE p public.sgp_aluminio_pendientes%rowtype; u text; e public.sgp_pdt_cierres%rowtype;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['COORDINADOR','PICKING','SUPERVISOR DE PICKING','ADMINISTRADOR']);
 IF p_clave IS NULL THEN RAISE EXCEPTION 'Clave requerida'; END IF;
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id FOR UPDATE;
 SELECT * INTO e FROM public.sgp_pdt_cierres WHERE id_pendiente=p_id;
 IF FOUND THEN
  IF e.clave<>p_clave THEN RAISE EXCEPTION 'Cierre ya registrado'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicado',true);
 END IF;
 IF p.contrato_pdt<>'V2' OR p.estado<>'PENDIENTE' OR p.validacion_estado<>'VALIDADO' OR p.estado_repo<>'PROCESADO' THEN RAISE EXCEPTION 'PDT no apto para cierre'; END IF;
 -- Lock underlying event rows against validation/anulation races; legacy source
 -- updates after closure still need the integration guard described in README.
 PERFORM 1 FROM public.sgp_picking_entregas pe WHERE pe.id_entrega IN (
 SELECT l.id_entrega FROM public.sgp_pdt_entrega_lineas l JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle)
 WHERE d.id_pendiente=p_id) ORDER BY pe.id_entrega FOR UPDATE;
 INSERT INTO public.sgp_pdt_cierres(id_pendiente,clave,usuario,evidencia)
 VALUES(p_id,p_clave,u,(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) FROM public.sgp_pdt_asignaciones a
 JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle) WHERE d.id_pendiente=p_id));
 IF NOT public.sgp_pdt_cierre_acreditado(p_id) THEN RAISE EXCEPTION 'Cobertura Picking incompleta'; END IF;
 UPDATE public.sgp_aluminio_pendientes SET estado='RESUELTO',estado_repo='PICKING',usuario_cierre=u,fecha_cierre=now() WHERE id_pendiente=p_id;
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,tipo_evento,datos_nuevos)
 VALUES(p_id,u,'CIERRE_V2',jsonb_build_object('clave',p_clave));
 RETURN jsonb_build_object('ok',true);
END $fn$;
REVOKE ALL ON FUNCTION public.sgp_pdt_cierre_acreditado(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid),public.sgp_pdt_entrega_validar_v2(text,uuid),public.sgp_pdt_asignar_v2(text,uuid,uuid),public.sgp_pdt_entrega_anular_v2(text,uuid,text),public.sgp_pdt_cerrar_v2(text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid),public.sgp_pdt_entrega_validar_v2(text,uuid),public.sgp_pdt_asignar_v2(text,uuid,uuid),public.sgp_pdt_entrega_anular_v2(text,uuid,text),public.sgp_pdt_cerrar_v2(text,uuid,uuid) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.sgp_pdt_picking_v2(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_pdt_picking_v2(text,uuid) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.sgp_pdt_capacidades_v2(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 PERFORM public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION','PATINADOR','LIDER','LIDER MECANIZADO','LIDER LINEA','SUPERVISOR DE PICKING','CONSULTA','PICKING']);
 RETURN jsonb_build_object('ok',true,'contract_version',2,'picking_cuantitativo',true,'cierre_v2',true,
 'operations',jsonb_build_array('sgp_aluminio_pendiente_validar_detalles_v1','sgp_aluminio_pendiente_registrar_avance_v1',
 'sgp_aluminio_pendiente_revertir_avance_v1','sgp_aluminio_pendiente_nc_vincular_v1','sgp_pdt_estado_v2',
 'sgp_pdt_entrega_registrar_v2','sgp_pdt_entrega_validar_v2','sgp_pdt_asignar_v2','sgp_pdt_entrega_anular_v2','sgp_pdt_cerrar_v2'));
END $fn$;
COMMIT;

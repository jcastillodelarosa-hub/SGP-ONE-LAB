ALTER TABLE public.sgp_aluminio_pendiente_detalles ADD COLUMN id_pieza text, ADD COLUMN fabricacion text, ADD COLUMN longitud numeric, ADD COLUMN acabado text;
-- Read-only function definitions, no production rows. Used only for wrapper/ACL testing.
CREATE OR REPLACE FUNCTION public.sgp_pdt_asignar_v2(p_token text, p_linea uuid, p_clave uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION public.sgp_pdt_cerrar_v2(p_token text, p_id uuid, p_clave uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF EXISTS(SELECT 1 FROM sgp_pdt_manual.detalles WHERE id_pendiente=p_id)
 THEN RETURN public.sgp_pdt_manual_cerrar_v1(p_token,p_id,p_clave); END IF;
 RETURN sgp_pdt_manual.original_cerrar_v2(p_token,p_id,p_clave);
END $function$
;
CREATE OR REPLACE FUNCTION public.sgp_pdt_entrega_anular_v2(p_token text, p_linea uuid, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION public.sgp_pdt_entrega_registrar_v2(p_token text, p_detalle uuid, p_entrega uuid, p_cantidad integer, p_clave uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE grouped boolean;
BEGIN
 SELECT id_pieza='' INTO grouped FROM public.sgp_aluminio_pendiente_detalles WHERE id_detalle=p_detalle;
 IF grouped THEN
  IF sgp_pdt_multiorigen.es_registro_v4((SELECT id_pendiente FROM public.sgp_aluminio_pendiente_detalles WHERE id_detalle=p_detalle)) THEN
   RETURN sgp_pdt_multiorigen.grouped_nuevo_entrega(p_token,p_detalle,p_entrega,p_cantidad,p_clave);
  END IF;
  RETURN sgp_pdt_multiorigen.grouped_original_entrega(p_token,p_detalle,p_entrega,p_cantidad,p_clave);
 END IF;
 IF sgp_pdt_multiorigen.es_registro_v4((SELECT id_pendiente FROM public.sgp_aluminio_pendiente_detalles WHERE id_detalle=p_detalle)) THEN
  RETURN sgp_pdt_multiorigen.nuevo_sgp_pdt_entrega_registrar_v2(p_token,p_detalle,p_entrega,p_cantidad,p_clave);
 END IF;
 RETURN sgp_pdt_multiorigen.original_sgp_pdt_entrega_registrar_v2(p_token,p_detalle,p_entrega,p_cantidad,p_clave);
END $function$
;
CREATE OR REPLACE FUNCTION public.sgp_pdt_entrega_validar_v2(p_token text, p_linea uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION public.sgp_pdt_manual_asignar_v1(p_token text, p_linea uuid, p_clave uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE line sgp_pdt_manual.entregas%rowtype; parent uuid; actor text; parent_state text;
BEGIN
 actor:=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION','SUPERVISOR DE PICKING']);
 IF p_clave IS NULL THEN RAISE EXCEPTION 'PDT_MANUAL_CLAVE_REQUERIDA'; END IF;
 SELECT d.id_pendiente INTO STRICT parent FROM sgp_pdt_manual.entregas l
 JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle) WHERE l.id_linea=p_linea;
 SELECT estado INTO parent_state FROM public.sgp_aluminio_pendientes WHERE id_pendiente=parent AND estado='PENDIENTE' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PDT_MANUAL_CERRADO'; END IF;
 SELECT * INTO STRICT line FROM sgp_pdt_manual.entregas WHERE id_linea=p_linea FOR UPDATE;
 IF line.asignado_en IS NOT NULL THEN
  IF line.clave_asignacion<>p_clave THEN RAISE EXCEPTION 'PDT_MANUAL_ASIGNACION_EXISTENTE'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicado',true);
 END IF;
 IF line.estado<>'VALIDADA' OR NOT EXISTS(SELECT 1 FROM public.sgp_picking_entregas
  WHERE id_entrega=line.id_entrega AND estado='VALIDADA') THEN RAISE EXCEPTION 'PDT_MANUAL_ENTREGA_NO_ACREDITABLE'; END IF;
 IF line.cantidad+coalesce((SELECT sum(cantidad) FROM sgp_pdt_manual.entregas
  WHERE id_detalle=line.id_detalle AND estado='VALIDADA' AND asignado_en IS NOT NULL),0)
  >(SELECT cantidad_validada FROM public.sgp_aluminio_pendiente_detalles WHERE id_detalle=line.id_detalle)
 THEN RAISE EXCEPTION 'PDT_MANUAL_SOBREASIGNACION'; END IF;
 UPDATE sgp_pdt_manual.entregas SET asignado_por=actor,asignado_en=now(),clave_asignacion=p_clave WHERE id_linea=p_linea;
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,estado_anterior,estado_nuevo,tipo_evento,datos_nuevos)
 VALUES(parent,actor,parent_state,parent_state,'ASIGNACION_ENTREGA_MANUAL_PDT',jsonb_build_object('linea',p_linea,'cantidad',line.cantidad));
 RETURN jsonb_build_object('ok',true);
END $function$
;
CREATE OR REPLACE FUNCTION public.sgp_pdt_manual_cerrar_v1(p_token text, p_id uuid, p_clave uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE p public.sgp_aluminio_pendientes%rowtype; actor text; prior public.sgp_pdt_cierres%rowtype; final_state text;
BEGIN
 actor:=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING']);
 IF p_clave IS NULL THEN RAISE EXCEPTION 'PDT_MANUAL_CLAVE_REQUERIDA'; END IF;
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM sgp_pdt_manual.detalles WHERE id_pendiente=p_id)
 THEN RAISE EXCEPTION 'PDT_MANUAL_INEXISTENTE'; END IF;
 SELECT * INTO prior FROM public.sgp_pdt_cierres WHERE id_pendiente=p_id;
 IF FOUND THEN
  IF prior.clave<>p_clave THEN RAISE EXCEPTION 'PDT_MANUAL_CIERRE_EXISTENTE'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicado',true);
 END IF;
 IF p.contrato_pdt<>'V2' OR p.estado<>'PENDIENTE' OR p.validacion_estado<>'VALIDADO'
 OR p.estado_repo<>'PROCESADO' THEN RAISE EXCEPTION 'PDT_MANUAL_NO_APTO_PARA_CIERRE'; END IF;
 PERFORM 1 FROM public.sgp_picking_entregas e WHERE e.id_entrega IN (
  SELECT l.id_entrega FROM sgp_pdt_manual.entregas l
  JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle) WHERE d.id_pendiente=p_id)
 ORDER BY e.id_entrega FOR UPDATE;
 INSERT INTO public.sgp_pdt_cierres(id_pendiente,clave,usuario,evidencia)
 VALUES(p_id,p_clave,actor,(SELECT coalesce(jsonb_agg(to_jsonb(l)),'[]'::jsonb)
  FROM sgp_pdt_manual.entregas l JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle)
  WHERE d.id_pendiente=p_id AND l.estado='VALIDADA' AND l.asignado_en IS NOT NULL));
 IF NOT sgp_pdt_manual.cierre_acreditado(p_id) THEN RAISE EXCEPTION 'PDT_MANUAL_COBERTURA_PICKING_INCOMPLETA'; END IF;
 UPDATE public.sgp_aluminio_pendientes SET estado='RESUELTO',estado_repo='PICKING',usuario_cierre=actor,fecha_cierre=now()
 WHERE id_pendiente=p_id RETURNING estado INTO STRICT final_state;
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,estado_anterior,estado_nuevo,tipo_evento,datos_nuevos)
 VALUES(p_id,actor,p.estado,final_state,'CIERRE_MANUAL_PDT',jsonb_build_object('clave',p_clave));
 RETURN jsonb_build_object('ok',true);
END $function$
;
CREATE OR REPLACE FUNCTION public.sgp_pdt_manual_entrega_anular_v1(p_token text, p_linea uuid, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE line sgp_pdt_manual.entregas%rowtype; parent uuid; actor text; parent_state text;
BEGIN
 actor:=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR']);
 IF nullif(btrim(p_motivo),'') IS NULL THEN RAISE EXCEPTION 'PDT_MANUAL_MOTIVO_REQUERIDO'; END IF;
 SELECT d.id_pendiente INTO STRICT parent FROM sgp_pdt_manual.entregas l
 JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle) WHERE l.id_linea=p_linea;
 SELECT estado INTO parent_state FROM public.sgp_aluminio_pendientes WHERE id_pendiente=parent AND estado='PENDIENTE' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PDT_MANUAL_CERRADO'; END IF;
 SELECT * INTO STRICT line FROM sgp_pdt_manual.entregas WHERE id_linea=p_linea FOR UPDATE;
 IF line.estado='ANULADA' THEN RETURN jsonb_build_object('ok',true,'duplicado',true); END IF;
 UPDATE sgp_pdt_manual.entregas SET estado='ANULADA',anulado_por=actor,anulado_en=now(),motivo_anulacion=p_motivo
 WHERE id_linea=p_linea;
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,observacion,estado_anterior,estado_nuevo,tipo_evento,datos_nuevos)
 VALUES(parent,actor,p_motivo,parent_state,parent_state,'ANULACION_ENTREGA_MANUAL_PDT',jsonb_build_object('linea',p_linea,'cantidad',line.cantidad));
 RETURN jsonb_build_object('ok',true);
END $function$
;
CREATE OR REPLACE FUNCTION public.sgp_pdt_manual_entrega_registrar_v1(p_token text, p_detalle uuid, p_entrega uuid, p_cantidad integer, p_clave uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE d public.sgp_aluminio_pendiente_detalles%rowtype; p public.sgp_aluminio_pendientes%rowtype;
 prior sgp_pdt_manual.entregas%rowtype; actor text; neto bigint; nuevo uuid;
BEGIN
 actor:=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING']);
 IF p_cantidad IS NULL OR p_cantidad<=0 OR p_clave IS NULL THEN RAISE EXCEPTION 'PDT_MANUAL_CANTIDAD_O_CLAVE_INVALIDA'; END IF;
 SELECT * INTO STRICT d FROM public.sgp_aluminio_pendiente_detalles WHERE id_detalle=p_detalle;
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=d.id_pendiente FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM sgp_pdt_manual.detalles WHERE id_pendiente=p.id_pendiente)
 OR NOT EXISTS(SELECT 1 FROM sgp_pdt_manual.fuentes_validadas WHERE id_detalle=p_detalle)
 THEN RAISE EXCEPTION 'PDT_MANUAL_FUENTE_NO_VALIDADA'; END IF;
 SELECT * INTO prior FROM sgp_pdt_manual.entregas WHERE clave=p_clave;
 IF FOUND THEN
  IF prior.id_detalle<>p_detalle OR prior.id_entrega<>p_entrega OR prior.cantidad<>p_cantidad
  THEN RAISE EXCEPTION 'PDT_MANUAL_CLAVE_REUTILIZADA'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicado',true,'id_linea',prior.id_linea);
 END IF;
 IF p.contrato_pdt<>'V2' OR p.estado<>'PENDIENTE' OR p.validacion_estado<>'VALIDADO'
  OR p.estado_repo NOT IN ('MECANIZADO','PROCESADO') OR p.fecha_cierre IS NOT NULL
 THEN RAISE EXCEPTION 'PDT_MANUAL_NO_APTO_PARA_ENTREGA'; END IF;
 PERFORM 1 FROM public.sgp_picking_entregas WHERE id_entrega=p_entrega FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PDT_MANUAL_ENTREGA_INEXISTENTE'; END IF;
 PERFORM 1 FROM public.sgp_mecanizado_programacion mp JOIN public.sgp_picking_entregas pe USING(id_programacion)
  WHERE pe.id_entrega=p_entrega FOR UPDATE OF mp;
 PERFORM 1 FROM public.sgp_picking_entregas pe JOIN public.sgp_mecanizado_programacion mp USING(id_programacion)
 JOIN public.sgp_producciones prod ON prod.key_produccion=p.key_produccion
 WHERE pe.id_entrega=p_entrega AND pe.produccion=prod.produccion
 AND upper(btrim(mp.sistema))=upper(btrim(prod.sistema)) AND upper(btrim(mp.acabado))=upper(btrim(d.acabado))
 AND (mp.reserva=p.reserva OR (mp.reserva=p.reserva_principal AND EXISTS(
  SELECT 1 FROM public.sgp_produccion_reservas_v rel WHERE rel.key_produccion=p.key_produccion
  AND rel.reserva=p.reserva AND rel.reserva_principal=mp.reserva)));
 IF NOT FOUND THEN RAISE EXCEPTION 'PDT_MANUAL_ENTREGA_AJENA'; END IF;
 SELECT coalesce(sum(CASE WHEN tipo='AVANCE' THEN cantidad ELSE -cantidad END),0) INTO neto
 FROM public.sgp_aluminio_pendiente_movimientos WHERE id_detalle=p_detalle;
 IF p_cantidad+coalesce((SELECT sum(cantidad) FROM sgp_pdt_manual.entregas
  WHERE id_detalle=p_detalle AND estado<>'ANULADA'),0)>neto
 THEN RAISE EXCEPTION 'PDT_MANUAL_ENTREGA_SUPERA_PROCESADO'; END IF;
 INSERT INTO sgp_pdt_manual.entregas(id_detalle,id_entrega,cantidad,clave,registrado_por)
 VALUES(p_detalle,p_entrega,p_cantidad,p_clave,actor) RETURNING id_linea INTO nuevo;
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,estado_anterior,estado_nuevo,tipo_evento,datos_nuevos)
 VALUES(p.id_pendiente,actor,p.estado,p.estado,'ENTREGA_MANUAL_PDT',jsonb_build_object('linea',nuevo,'detalle',p_detalle,'entrega',p_entrega,'cantidad',p_cantidad));
 RETURN jsonb_build_object('ok',true,'id_linea',nuevo);
END $function$
;
CREATE OR REPLACE FUNCTION public.sgp_pdt_manual_entrega_validar_v1(p_token text, p_linea uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE line sgp_pdt_manual.entregas%rowtype; parent uuid; actor text; parent_state text;
BEGIN
 actor:=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION','SUPERVISOR DE PICKING']);
 SELECT d.id_pendiente INTO STRICT parent FROM sgp_pdt_manual.entregas l
 JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle) WHERE l.id_linea=p_linea;
 SELECT estado INTO parent_state FROM public.sgp_aluminio_pendientes WHERE id_pendiente=parent AND estado='PENDIENTE' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PDT_MANUAL_CERRADO'; END IF;
 SELECT * INTO STRICT line FROM sgp_pdt_manual.entregas WHERE id_linea=p_linea FOR UPDATE;
 IF line.estado='VALIDADA' THEN RETURN jsonb_build_object('ok',true,'duplicado',true); END IF;
 IF line.estado<>'REGISTRADA' THEN RAISE EXCEPTION 'PDT_MANUAL_LINEA_NO_APTA'; END IF;
 PERFORM 1 FROM public.sgp_picking_entregas WHERE id_entrega=line.id_entrega AND estado='VALIDADA' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PDT_MANUAL_PICKING_SIN_VALIDACION'; END IF;
 UPDATE sgp_pdt_manual.entregas SET estado='VALIDADA',validado_por=actor,validado_en=now() WHERE id_linea=p_linea;
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,estado_anterior,estado_nuevo,tipo_evento,datos_nuevos)
 VALUES(parent,actor,parent_state,parent_state,'VALIDACION_ENTREGA_MANUAL_PDT',jsonb_build_object('linea',p_linea));
 RETURN jsonb_build_object('ok',true);
END $function$
;

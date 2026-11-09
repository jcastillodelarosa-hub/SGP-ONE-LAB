-- PDT v420: atomic quantity workflow; preserves existing stage, validation and delivery guards.
-- No production test data. Apply as one migration.
CREATE OR REPLACE FUNCTION public.sgp_pdt_proceso_simple_estado_v1(p_token text,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE resultado jsonb;
BEGIN
 PERFORM public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION','PATINADOR','LIDER','LIDER MECANIZADO','LIDER LINEA','SUPERVISOR DE PICKING','CONSULTA','PICKING']);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id_detalle',d.id_detalle,'en_proceso',
  least(greatest(0,d.cantidad_validada-m.hecho),greatest(0,coalesce((h.datos_nuevos->>'en_proceso')::bigint,0)-greatest(0,m.hecho-coalesce((h.datos_nuevos->>'procesado_acumulado')::bigint,m.hecho)))))),'[]'::jsonb)
 INTO resultado FROM public.sgp_aluminio_pendiente_detalles d
 CROSS JOIN LATERAL (SELECT coalesce(sum(CASE WHEN tipo='AVANCE' THEN cantidad ELSE -cantidad END),0) hecho FROM public.sgp_aluminio_pendiente_movimientos WHERE id_detalle=d.id_detalle) m
 LEFT JOIN LATERAL (SELECT datos_nuevos FROM public.sgp_aluminio_pendientes_historial WHERE id_pendiente=p_id AND tipo_evento='PROCESO_SIMPLE_V1' AND datos_nuevos->>'id_detalle'=d.id_detalle::text ORDER BY id DESC LIMIT 1) h ON true
 WHERE d.id_pendiente=p_id;
 RETURN jsonb_build_object('ok',true,'detalles',resultado);
END $$;

CREATE OR REPLACE FUNCTION public.sgp_pdt_proceso_simple_v1(
 p_token text,p_id uuid,p_id_detalle uuid,p_accion text,p_cantidad integer,
 p_turno text,p_fecha_operativa date,p_idempotency_key uuid,p_observacion text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u text; p public.sgp_aluminio_pendientes%rowtype;
 d public.sgp_aluminio_pendiente_detalles%rowtype; old jsonb; request jsonb;
 hecho bigint; saldo bigint; enproceso bigint; result jsonb; event jsonb;
BEGIN
 u:=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER']);
 IF p_id IS NULL OR p_id_detalle IS NULL OR p_accion IS NULL OR p_accion NOT IN ('INICIAR','PROCESAR') OR p_cantidad IS NULL OR p_cantidad<=0 OR p_turno IS NULL OR p_turno NOT IN ('T1','T2') OR p_fecha_operativa IS NULL OR p_idempotency_key IS NULL THEN RAISE EXCEPTION 'Parámetros de proceso inválidos'; END IF;
 -- Serializes reuse of a key even across different pending items; row lock serializes quantities.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key::text,420));
 SELECT * INTO p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pendiente inexistente'; END IF;
 request:=jsonb_build_object('id_pendiente',p_id,'id_detalle',p_id_detalle,'accion',p_accion,'cantidad',p_cantidad,'turno',p_turno,'fecha_operativa',p_fecha_operativa,'observacion',p_observacion);
 SELECT datos_nuevos INTO old FROM public.sgp_aluminio_pendientes_historial WHERE tipo_evento='PROCESO_SIMPLE_V1' AND datos_nuevos->>'idempotency_key'=p_idempotency_key::text ORDER BY id DESC LIMIT 1;
 IF FOUND THEN
  IF old->'request' IS DISTINCT FROM request THEN RAISE EXCEPTION 'Clave de idempotencia reutilizada'; END IF;
  RETURN (old->'resultado')||jsonb_build_object('duplicado',true);
 END IF;
 IF EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_movimientos WHERE idempotency_key=p_idempotency_key) THEN RAISE EXCEPTION 'Clave de idempotencia reutilizada'; END IF;
 IF p.contrato_pdt<>'V2' OR p.estado<>'PENDIENTE' OR p.validacion_estado<>'VALIDADO' OR p.estado_repo='PICKING' OR p.fecha_cierre IS NOT NULL THEN RAISE EXCEPTION 'Pendiente no apto para proceso'; END IF;
 SELECT * INTO d FROM public.sgp_aluminio_pendiente_detalles WHERE id_detalle=p_id_detalle AND id_pendiente=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Fabricación no pertenece al pendiente'; END IF;
 SELECT coalesce(sum(CASE WHEN tipo='AVANCE' THEN cantidad ELSE -cantidad END),0) INTO hecho FROM public.sgp_aluminio_pendiente_movimientos WHERE id_detalle=p_id_detalle;
 saldo:=d.cantidad_validada-hecho;
 SELECT datos_nuevos INTO event FROM public.sgp_aluminio_pendientes_historial WHERE id_pendiente=p_id AND tipo_evento='PROCESO_SIMPLE_V1' AND datos_nuevos->>'id_detalle'=p_id_detalle::text ORDER BY id DESC LIMIT 1;
 enproceso:=least(greatest(0,saldo),greatest(0,coalesce((event->>'en_proceso')::bigint,0)-greatest(0,hecho-coalesce((event->>'procesado_acumulado')::bigint,hecho))));
 IF p_cantidad>saldo OR (p_accion='INICIAR' AND p_cantidad>saldo-enproceso) THEN RAISE EXCEPTION 'Cantidad supera saldo disponible de fabricación'; END IF;
 -- Technical stages are internal; existing trigger remains the authority.
 IF p.estado_repo='PROCESADO' AND saldo>0 THEN PERFORM public.sgp_pdt_estado_v2(p_token,p_id,'MECANIZADO'); p.estado_repo:='MECANIZADO'; END IF;
 IF p.estado_repo='PENDIENTE' THEN PERFORM public.sgp_pdt_estado_v2(p_token,p_id,'CORTE'); p.estado_repo:='CORTE'; END IF;
 IF p.estado_repo='CORTE' THEN PERFORM public.sgp_pdt_estado_v2(p_token,p_id,'MECANIZADO'); p.estado_repo:='MECANIZADO'; END IF;
 IF p.estado_repo<>'MECANIZADO' THEN RAISE EXCEPTION 'Pendiente no apto para proceso'; END IF;
 IF p_accion='INICIAR' THEN enproceso:=enproceso+p_cantidad;
 ELSE
  PERFORM public.sgp_aluminio_pendiente_registrar_avance_v1(p_token,p_id,p_id_detalle,p_cantidad,p_turno,p_fecha_operativa,p_idempotency_key,p_observacion);
  hecho:=hecho+p_cantidad; saldo:=saldo-p_cantidad; enproceso:=greatest(0,enproceso-p_cantidad);
  IF NOT EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles x WHERE x.id_pendiente=p_id AND x.cantidad_validada<>(SELECT coalesce(sum(CASE WHEN tipo='AVANCE' THEN cantidad ELSE -cantidad END),0) FROM public.sgp_aluminio_pendiente_movimientos WHERE id_detalle=x.id_detalle)) THEN
   PERFORM public.sgp_pdt_estado_v2(p_token,p_id,'PROCESADO'); p.estado_repo:='PROCESADO';
  END IF;
 END IF;
 result:=jsonb_build_object('ok',true,'duplicado',false,'estado_repo',p.estado_repo,'en_proceso',enproceso,'saldo_detalle',saldo);
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,estado_nuevo,usuario,tipo_evento,observacion,datos_nuevos)
 VALUES(p_id,p.estado_repo,u,'PROCESO_SIMPLE_V1',p_observacion,jsonb_build_object('id_detalle',p_id_detalle,'idempotency_key',p_idempotency_key,'request',request,'en_proceso',enproceso,'procesado_acumulado',hecho,'resultado',result));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.sgp_pdt_proceso_simple_v1(text,uuid,uuid,text,integer,text,date,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sgp_pdt_proceso_simple_estado_v1(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_pdt_proceso_simple_v1(text,uuid,uuid,text,integer,text,date,uuid,text) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sgp_pdt_proceso_simple_estado_v1(text,uuid) TO anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';

-- Add only new advertised operation, preserving every existing capability/role.
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.sgp_pdt_capacidades_v2(text)'::regprocedure) INTO definition;
 IF position('sgp_pdt_proceso_simple_v1' IN definition)=0 THEN
  IF position('''sgp_pdt_cerrar_v2''' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected capabilities definition'; END IF;
  EXECUTE replace(definition,'''sgp_pdt_cerrar_v2''','''sgp_pdt_cerrar_v2'',''sgp_pdt_proceso_simple_v1''');
 END IF;
END $migration$;
CREATE UNIQUE INDEX IF NOT EXISTS sgp_pdt_simple_idempotency_idx
 ON public.sgp_aluminio_pendientes_historial ((datos_nuevos->>'idempotency_key'))
 WHERE tipo_evento='PROCESO_SIMPLE_V1';
CREATE INDEX IF NOT EXISTS sgp_pdt_simple_detalle_idx
 ON public.sgp_aluminio_pendientes_historial (id_pendiente,(datos_nuevos->>'id_detalle'),id DESC)
 WHERE tipo_evento='PROCESO_SIMPLE_V1';
NOTIFY pgrst,'reload schema';

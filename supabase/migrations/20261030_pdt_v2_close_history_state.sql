-- Fix PDT V2 legacy closure history: estado_nuevo is NOT NULL.
-- Apply only after approval; preserves existing authorization and coverage checks.
-- This is the exact current production definition of original_cerrar_v2 with
-- only the history INSERT amended to include old and new states.
CREATE OR REPLACE FUNCTION sgp_pdt_manual.original_cerrar_v2(p_token text, p_id uuid, p_clave uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
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
 PERFORM 1 FROM public.sgp_picking_entregas pe WHERE pe.id_entrega IN (
 SELECT l.id_entrega FROM public.sgp_pdt_entrega_lineas l JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle)
 WHERE d.id_pendiente=p_id) ORDER BY pe.id_entrega FOR UPDATE;
 INSERT INTO public.sgp_pdt_cierres(id_pendiente,clave,usuario,evidencia)
 VALUES(p_id,p_clave,u,(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) FROM public.sgp_pdt_asignaciones a
 JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle) WHERE d.id_pendiente=p_id));
 IF NOT public.sgp_pdt_cierre_acreditado(p_id) THEN RAISE EXCEPTION 'Cobertura Picking incompleta'; END IF;
 UPDATE public.sgp_aluminio_pendientes SET estado='RESUELTO',estado_repo='PICKING',usuario_cierre=u,fecha_cierre=now() WHERE id_pendiente=p_id;
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,estado_anterior,estado_nuevo,tipo_evento,datos_nuevos)
 VALUES(p_id,u,p.estado_repo,'PICKING','CIERRE_V2',jsonb_build_object('clave',p_clave));
 RETURN jsonb_build_object('ok',true);
END $function$;

-- SGP_ONE PR91 - REVIEW ONLY. Do not apply before QA.
BEGIN;
CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_revertir_avance_v1(
 p_token text, p_id uuid, p_movimiento uuid, p_clave uuid, p_motivo text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 u text;
 p public.sgp_aluminio_pendientes%rowtype;
 a public.sgp_aluminio_pendiente_movimientos%rowtype;
 e public.sgp_aluminio_pendiente_movimientos%rowtype;
 nuevo uuid;
BEGIN
 u := public.sgp_validar_sesion_rol(p_token, ARRAY['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER']);
 IF p_id IS NULL OR p_movimiento IS NULL OR p_clave IS NULL OR nullif(btrim(p_motivo),'') IS NULL
 THEN RAISE EXCEPTION 'Parametros invalidos'; END IF;
 SELECT * INTO p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id FOR UPDATE;
 IF NOT FOUND OR p.estado <> 'PENDIENTE' OR p.estado_repo = 'PICKING' OR p.fecha_cierre IS NOT NULL
 THEN RAISE EXCEPTION 'Pendiente no apto'; END IF;
 SELECT * INTO e FROM public.sgp_aluminio_pendiente_movimientos WHERE idempotency_key=p_clave;
 IF FOUND THEN
  IF e.tipo <> 'REVERSO' OR e.id_pendiente <> p_id OR e.id_movimiento_revertido <> p_movimiento OR e.observacion IS DISTINCT FROM p_motivo
  THEN RAISE EXCEPTION 'Clave reutilizada'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicado',true,'id_movimiento',e.id_movimiento);
 END IF;
 SELECT * INTO a FROM public.sgp_aluminio_pendiente_movimientos
 WHERE id_movimiento=p_movimiento AND id_pendiente=p_id AND tipo='AVANCE' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Avance inexistente'; END IF;
 IF EXISTS (SELECT 1 FROM public.sgp_aluminio_pendiente_movimientos WHERE id_movimiento_revertido=p_movimiento)
 THEN RAISE EXCEPTION 'Avance ya revertido'; END IF;
 INSERT INTO public.sgp_aluminio_pendiente_movimientos
 (id_pendiente,id_detalle,tipo,cantidad,id_movimiento_revertido,idempotency_key,usuario,turno,fecha_operativa,observacion)
 VALUES (p_id,a.id_detalle,'REVERSO',a.cantidad,p_movimiento,p_clave,u,a.turno,a.fecha_operativa,p_motivo)
 RETURNING id_movimiento INTO nuevo;
 INSERT INTO public.sgp_aluminio_pendientes_historial (id_pendiente,usuario,observacion,tipo_evento,datos_nuevos)
 VALUES (p_id,u,p_motivo,'REVERSO_AVANCE_PDT',jsonb_build_object('original',p_movimiento,'reverso',nuevo,'cantidad',a.cantidad));
 RETURN jsonb_build_object('ok',true,'duplicado',false,'id_movimiento',nuevo);
END $fn$;
REVOKE ALL ON FUNCTION public.sgp_aluminio_pendiente_revertir_avance_v1(text,uuid,uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_aluminio_pendiente_revertir_avance_v1(text,uuid,uuid,uuid,text) TO anon,authenticated;
COMMIT;

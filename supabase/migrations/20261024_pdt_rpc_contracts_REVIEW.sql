-- SGP_ONE / PR 91. REVIEW BEFORE APPLYING. Requires draft schema file.
-- No existing RPC is replaced. No existing pending rows are backfilled.
BEGIN;
ALTER TABLE public.sgp_aluminio_pendiente_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sgp_aluminio_pendiente_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sgp_aluminio_pendiente_ncs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sgp_aluminio_pendiente_detalles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sgp_aluminio_pendiente_movimientos FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sgp_aluminio_pendiente_ncs FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_validar_detalles_v1(
 p_token text, p_id uuid, p_detalles jsonb, p_reserva text DEFAULT NULL,
 p_observacion text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 v_usuario text; v_p public.sgp_aluminio_pendientes%rowtype;
 v_row jsonb; v_fab text; v_acab text; v_long numeric; v_cant integer;
 v_total bigint:=0; v_count integer:=0; v_first jsonb; v_source boolean;
 v_key text; v_keys text[]:=array[]::text[]; v_out jsonb;
BEGIN
 v_usuario:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','LIDER LINEA','SUPERVISOR DE PICKING']);
 SELECT * INTO v_p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id FOR UPDATE;
 IF NOT FOUND OR v_p.estado<>'PENDIENTE' OR coalesce(v_p.estado_repo,'PENDIENTE')='PICKING' OR coalesce(v_p.validacion_estado,'POR_VALIDAR')='VALIDADO'
 THEN RAISE EXCEPTION 'Pendiente no activo o ya validado'; END IF;
 IF jsonb_typeof(p_detalles)<>'array' OR jsonb_array_length(p_detalles) NOT BETWEEN 1 AND 100
 THEN RAISE EXCEPTION 'Se requiere entre 1 y 100 fabricaciones'; END IF;
 IF EXISTS (SELECT 1 FROM public.sgp_aluminio_pendiente_movimientos WHERE id_pendiente=p_id)
 THEN RAISE EXCEPTION 'No se puede revalidar un pendiente con movimientos'; END IF;
 FOR v_row IN SELECT value FROM jsonb_array_elements(p_detalles)
 LOOP
  v_count:=v_count+1;
  v_fab:=nullif(btrim(v_row->>'fabricacion'),'');
  v_acab:=nullif(btrim(v_row->>'acabado'),'');
  IF v_row->>'longitud' !~ '^[0-9]+([.][0-9]+)?$'
    OR v_row->>'cantidad' !~ '^[0-9]+$'
  THEN RAISE EXCEPTION 'Longitud y cantidad deben ser numéricas'; END IF;
  v_long:=(v_row->>'longitud')::numeric;
  IF length(v_row->>'cantidad')>9 THEN RAISE EXCEPTION 'Cantidad fuera de rango'; END IF;
  v_cant:=(v_row->>'cantidad')::integer;
  IF v_fab IS NULL OR v_acab IS NULL OR v_long<=0 OR v_cant<=0
  THEN RAISE EXCEPTION 'Fabricación, acabado, longitud y cantidad obligatorios'; END IF;
  v_key:=lower(v_fab)||'|'||v_long::text||'|'||upper(v_acab);
  IF v_key=ANY(v_keys) THEN RAISE EXCEPTION 'Fabricación repetida'; END IF;
  v_keys:=array_append(v_keys,v_key);
  IF v_count=1 THEN v_first:=v_row; END IF;
  v_total:=v_total+v_cant;
  IF v_total>2147483647 THEN RAISE EXCEPTION 'Cantidad fuera de rango'; END IF;
  SELECT EXISTS(
   SELECT 1 FROM public.sgp_aluminio a
   WHERE a.activo='SI' AND a.tipo_pieza='PANEL'
     AND btrim(coalesce(a.codigo_sap,''))=btrim(coalesce(v_p.perfil,''))
     AND ((v_p.key_produccion IS NOT NULL AND a.key_produccion=v_p.key_produccion)
          OR a.produccion=v_p.produccion)
     AND lower(btrim(coalesce(a.fabricacion,'')))=lower(v_fab)
     AND a.longitud=v_long AND upper(btrim(coalesce(a.acabado,'')))=upper(v_acab)
  ) INTO v_source;
  IF NOT v_source THEN RAISE EXCEPTION 'Fabricación % no encontrada como PANEL de la producción',v_fab; END IF;
 END LOOP;
 -- BLOCKER: legacy validator excludes RECEPCION; this wrapper must not be applied
 -- until equivalent secure reservation/source checks are extracted to a shared internal helper.
 -- Reuse legacy reservation/acabado validation, audit and session checks.
 v_out:=public.sgp_aluminio_pendiente_validar(
   p_token,p_id,v_first->>'fabricacion',(v_first->>'longitud')::numeric,
   p_reserva,v_first->>'acabado',p_observacion);
 UPDATE public.sgp_aluminio_pendientes SET cantidad=v_total WHERE id_pendiente=p_id;
 FOR v_row IN SELECT value FROM jsonb_array_elements(p_detalles)
 LOOP
  INSERT INTO public.sgp_aluminio_pendiente_detalles
   (id_pendiente,id_pieza,fabricacion,longitud,acabado,cantidad_validada,creado_por)
  VALUES (p_id,'',btrim(v_row->>'fabricacion'),(v_row->>'longitud')::numeric,
          btrim(v_row->>'acabado'),(v_row->>'cantidad')::integer,v_usuario);
 END LOOP;
 INSERT INTO public.sgp_aluminio_pendientes_historial
 (id_pendiente,usuario,observacion,tipo_evento,datos_anteriores,datos_nuevos)
 VALUES(p_id,v_usuario,p_observacion,'VALIDACION_DETALLES_PDT',
  jsonb_build_object('cantidad_reportada',v_p.cantidad,'fabricacion_reportada',v_p.fabricacion),
  jsonb_build_object('cantidad_validada',v_total,'detalles',p_detalles));
 RETURN jsonb_build_object('ok',true,'cantidad',v_total,'detalles',v_count);
END $fn$;

CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_registrar_avance_v1(
 p_token text,p_id uuid,p_id_detalle uuid,p_cantidad integer,p_turno text,
 p_fecha_operativa date,p_idempotency_key uuid,p_observacion text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_usuario text; v_p public.sgp_aluminio_pendientes%rowtype;
 v_d public.sgp_aluminio_pendiente_detalles%rowtype;
 v_solved bigint; v_remaining bigint; v_existing public.sgp_aluminio_pendiente_movimientos%rowtype;
BEGIN
 v_usuario:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER']);
 IF p_cantidad IS NULL OR p_cantidad<=0 OR p_turno IS NULL OR p_turno NOT IN ('T1','T2')
 OR p_fecha_operativa IS NULL OR p_idempotency_key IS NULL
 THEN RAISE EXCEPTION 'Parámetros de avance inválidos'; END IF;
 SELECT * INTO v_p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id FOR UPDATE;
 IF NOT FOUND OR v_p.estado<>'PENDIENTE' OR v_p.validacion_estado<>'VALIDADO'
 OR v_p.estado_repo='PICKING' THEN RAISE EXCEPTION 'Pendiente no apto para avances'; END IF;
 SELECT * INTO v_existing FROM public.sgp_aluminio_pendiente_movimientos
 WHERE idempotency_key=p_idempotency_key;
 IF FOUND THEN
  IF v_existing.id_pendiente<>p_id OR v_existing.id_detalle<>p_id_detalle
    OR v_existing.cantidad<>p_cantidad OR v_existing.tipo<>'AVANCE'
    OR v_existing.turno<>p_turno OR v_existing.fecha_operativa<>p_fecha_operativa
  THEN RAISE EXCEPTION 'Clave de idempotencia reutilizada'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicado',true,'id_movimiento',v_existing.id_movimiento);
 END IF;
 SELECT * INTO v_d FROM public.sgp_aluminio_pendiente_detalles
 WHERE id_detalle=p_id_detalle AND id_pendiente=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Fabricación no pertenece al pendiente'; END IF;
 SELECT coalesce(sum(CASE WHEN m.tipo='AVANCE' THEN m.cantidad ELSE -m.cantidad END),0)
 INTO v_solved FROM public.sgp_aluminio_pendiente_movimientos m
 WHERE m.id_detalle=p_id_detalle;
 v_remaining:=v_d.cantidad_validada-v_solved;
 IF p_cantidad>v_remaining THEN RAISE EXCEPTION 'Cantidad supera saldo de fabricación'; END IF;
 INSERT INTO public.sgp_aluminio_pendiente_movimientos
 (id_pendiente,id_detalle,tipo,cantidad,idempotency_key,usuario,turno,fecha_operativa,observacion)
 VALUES(p_id,p_id_detalle,'AVANCE',p_cantidad,p_idempotency_key,v_usuario,p_turno,p_fecha_operativa,p_observacion);
 INSERT INTO public.sgp_aluminio_pendientes_historial
 (id_pendiente,usuario,observacion,tipo_evento,datos_nuevos)
 VALUES(p_id,v_usuario,p_observacion,'AVANCE_PDT',
 jsonb_build_object('id_detalle',p_id_detalle,'cantidad',p_cantidad,'turno',p_turno,
 'fecha_operativa',p_fecha_operativa,'saldo_detalle',v_remaining-p_cantidad));
 RETURN jsonb_build_object('ok',true,'duplicado',false,'saldo_detalle',v_remaining-p_cantidad);
END $fn$;

REVOKE ALL ON FUNCTION public.sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sgp_aluminio_pendiente_registrar_avance_v1(text,uuid,uuid,integer,text,date,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sgp_aluminio_pendiente_registrar_avance_v1(text,uuid,uuid,integer,text,date,uuid,text) TO anon,authenticated;
COMMIT;

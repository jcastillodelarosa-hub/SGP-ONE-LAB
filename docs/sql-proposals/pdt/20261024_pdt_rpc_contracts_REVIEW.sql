-- SGP_ONE / PR 91. REVIEW BEFORE APPLYING. Requires draft schema file.
-- No existing RPC is replaced. No existing pending rows are backfilled.
BEGIN;
ALTER TABLE public.sgp_aluminio_pendiente_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sgp_aluminio_pendiente_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sgp_aluminio_pendiente_ncs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sgp_aluminio_pendiente_detalles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sgp_aluminio_pendiente_movimientos FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sgp_aluminio_pendiente_ncs FROM PUBLIC, anon, authenticated;

-- Exact server session role; never accept a role asserted by the browser.
-- Contract already consumed by app.js: sgp_sesion_actual(text) -> {valida,rol}.
CREATE OR REPLACE FUNCTION public.sgp_pdt_validar_rol_real(p_token text,p_roles text[])
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE sesion jsonb; rol_real text;
BEGIN
 IF p_token IS NULL OR p_roles IS NULL OR cardinality(p_roles)=0 THEN
  RAISE EXCEPTION 'PDT_ROL_REAL_NO_AUTORIZADO';
 END IF;
 sesion:=to_jsonb(public.sgp_sesion_actual(p_token));
 IF jsonb_typeof(sesion) IS DISTINCT FROM 'object' OR sesion->'valida' IS DISTINCT FROM 'true'::jsonb THEN
  RAISE EXCEPTION 'PDT_SESION_NO_VALIDA';
 END IF;
 rol_real:=upper(btrim(sesion->>'rol'));
 IF rol_real IS NULL OR NOT coalesce(rol_real=ANY(p_roles),false) THEN
  RAISE EXCEPTION 'PDT_ROL_REAL_NO_AUTORIZADO';
 END IF;
 -- Preserve legacy actor resolution only AFTER the exact-role check.
 RETURN public.sgp_validar_sesion_rol(p_token,p_roles);
END $fn$;
REVOKE ALL ON FUNCTION public.sgp_pdt_validar_rol_real(text,text[]) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_validar_detalles_v1(
 p_token text, p_id uuid, p_detalles jsonb, p_reserva text DEFAULT NULL,
 p_observacion text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 v_usuario text; v_p public.sgp_aluminio_pendientes%rowtype;
 v_row jsonb; v_fab text; v_acab text; v_long numeric; v_cant integer;
 v_total bigint:=0; v_count integer:=0; v_first jsonb; v_source integer; v_detalle uuid; v_a public.sgp_aluminio%rowtype;
 v_key text; v_keys text[]:=array[]::text[]; v_out jsonb; v_correction boolean; v_res text; v_acab_res text;
BEGIN
 v_usuario:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','LIDER LINEA','SUPERVISOR DE PICKING','RECEPCION']);
 SELECT * INTO v_p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id FOR UPDATE;
 IF NOT FOUND OR v_p.estado<>'PENDIENTE' OR v_p.fecha_cierre IS NOT NULL OR coalesce(v_p.estado_repo,'PENDIENTE')='PICKING' OR coalesce(v_p.validacion_estado,'POR_VALIDAR')='VALIDADO'
 THEN RAISE EXCEPTION 'Pendiente no activo o ya validado'; END IF;
 IF p_detalles IS NULL OR jsonb_typeof(p_detalles)<>'array' OR jsonb_array_length(p_detalles) NOT BETWEEN 1 AND 100
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
  IF length(v_row->>'cantidad')>10 OR (v_row->>'cantidad')::numeric>2147483647 THEN RAISE EXCEPTION 'Cantidad fuera de rango'; END IF;
  v_cant:=(v_row->>'cantidad')::integer;
  IF v_fab IS NULL OR v_acab IS NULL OR v_long<=0 OR v_cant<=0
  THEN RAISE EXCEPTION 'Fabricación, acabado, longitud y cantidad obligatorios'; END IF;
  v_key:=v_row->>'id_pieza';
  IF nullif(v_key,'') IS NULL THEN RAISE EXCEPTION 'Referencia fuente requerida'; END IF;
  IF v_key=ANY(v_keys) THEN RAISE EXCEPTION 'Fabricación repetida'; END IF;
  v_keys:=array_append(v_keys,v_key);
  IF v_count=1 THEN v_first:=v_row; END IF;
  v_total:=v_total+v_cant;
  IF v_total>2147483647 THEN RAISE EXCEPTION 'Cantidad fuera de rango'; END IF;
  IF nullif(btrim(v_p.key_produccion),'') IS NULL THEN RAISE EXCEPTION 'Identidad producción no resuelta'; END IF;
  SELECT count(*) INTO v_source FROM public.sgp_aluminio a
   JOIN public.sgp_producciones prod ON prod.key_produccion=a.key_produccion
   WHERE a.id_pieza=v_key AND a.activo='SI' AND a.tipo_pieza='PANEL'
     AND a.key_produccion=v_p.key_produccion
     AND upper(btrim(a.sistema))=upper(btrim(prod.sistema))
     AND btrim(a.codigo_sap)=btrim(v_p.perfil)
     AND lower(btrim(a.fabricacion))=lower(v_fab) AND a.longitud=v_long
     AND upper(btrim(a.acabado))=upper(v_acab);
  IF v_source<>1 THEN RAISE EXCEPTION 'Fuente PANEL inexistente o ambigua'; END IF;
 END LOOP;
 v_correction := v_total IS DISTINCT FROM v_p.cantidad;
 IF v_correction AND nullif(btrim(coalesce(p_observacion,'')),'') IS NULL
 THEN RAISE EXCEPTION 'Corrección de cantidad requiere observación'; END IF;
 -- Dedicated validation for this new RPC. Legacy validator is not modified.
 v_res:=coalesce(nullif(btrim(coalesce(p_reserva,'')),''),v_p.reserva);
 v_acab_res:=coalesce(nullif(btrim(coalesce(v_p.acabado_pendiente,'')),''),nullif(btrim(v_first->>'acabado'),''));
 IF v_res IS NULL OR v_acab_res IS NULL THEN RAISE EXCEPTION 'Reserva y acabado obligatorios'; END IF;
 IF nullif(btrim(coalesce(v_p.key_produccion,'')),'') IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM public.sgp_produccion_reservas_v r
  WHERE r.key_produccion=v_p.key_produccion AND r.reserva=v_res
    AND (r.acabado_reserva IS NULL OR upper(btrim(r.acabado_reserva))=upper(v_acab_res)))
 THEN RAISE EXCEPTION 'Reserva/acabado no pertenece a producción'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_detalles) d
  WHERE upper(btrim(d->>'acabado'))<>upper(v_acab_res))
 THEN RAISE EXCEPTION 'Acabado distinto al de la reserva'; END IF;
 INSERT INTO public.sgp_aluminio_pendientes_historial
 (id_pendiente,usuario,observacion,tipo_evento,datos_anteriores,datos_nuevos)
 VALUES(p_id,v_usuario,p_observacion,'VALIDACION_PDT',
  jsonb_build_object('fabricacion',v_p.fabricacion,'longitud',v_p.longitud,
   'reserva',v_p.reserva,'acabado',v_p.acabado_pendiente,'validacion_estado',v_p.validacion_estado),
  jsonb_build_object('fabricacion',v_first->>'fabricacion','reserva',v_res,
   'acabado',v_acab_res,'validacion_estado','VALIDADO'));
 FOR v_row IN SELECT value FROM jsonb_array_elements(p_detalles)
 LOOP
  INSERT INTO public.sgp_aluminio_pendiente_detalles
   (id_pendiente,id_pieza,fabricacion,longitud,acabado,cantidad_validada,creado_por)
  VALUES (p_id,v_row->>'id_pieza',btrim(v_row->>'fabricacion'),(v_row->>'longitud')::numeric,
          btrim(v_row->>'acabado'),(v_row->>'cantidad')::integer,v_usuario) RETURNING id_detalle INTO v_detalle;
  SELECT * INTO STRICT v_a FROM public.sgp_aluminio WHERE id_pieza=v_row->>'id_pieza';
  INSERT INTO public.sgp_pdt_fuentes(id_detalle,id_pieza,id_carga,fila_origen,snapshot)
  VALUES(v_detalle,v_a.id_pieza,v_a.id_carga,v_a.fila_origen,to_jsonb(v_a));
 END LOOP;
 UPDATE public.sgp_aluminio_pendientes SET contrato_pdt='V2',
  fabricacion=btrim(v_first->>'fabricacion'),longitud=(v_first->>'longitud')::numeric,
  reserva=v_res,acabado_pendiente=v_acab_res,validacion_estado='VALIDADO',
  validado_por=v_usuario,fecha_validacion=now(),
  observacion_validacion=nullif(btrim(coalesce(p_observacion,'')),'')
 WHERE id_pendiente=p_id;
 INSERT INTO public.sgp_aluminio_pendientes_historial
 (id_pendiente,usuario,observacion,tipo_evento,datos_anteriores,datos_nuevos)
 VALUES(p_id,v_usuario,p_observacion,'VALIDACION_DETALLES_PDT',
  jsonb_build_object('cantidad_reportada',v_p.cantidad,'fabricacion_reportada',v_p.fabricacion),
  jsonb_build_object('cantidad_validada',v_total,'correccion',v_correction,'detalles',p_detalles));
 RETURN jsonb_build_object('ok',true,'cantidad_reportada',v_p.cantidad,'cantidad_validada',v_total,'detalles',v_count);
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
 v_usuario:=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER']);
 IF p_id IS NULL OR p_id_detalle IS NULL OR p_cantidad IS NULL OR p_cantidad<=0 OR p_turno IS NULL OR p_turno NOT IN ('T1','T2')
 OR p_fecha_operativa IS NULL OR p_idempotency_key IS NULL
 THEN RAISE EXCEPTION 'Parámetros de avance inválidos'; END IF;
 SELECT * INTO v_p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pendiente inexistente'; END IF;
 SELECT * INTO v_existing FROM public.sgp_aluminio_pendiente_movimientos
 WHERE idempotency_key=p_idempotency_key;
 IF FOUND THEN
  IF v_existing.id_pendiente<>p_id OR v_existing.id_detalle<>p_id_detalle
    OR v_existing.cantidad<>p_cantidad OR v_existing.tipo<>'AVANCE'
    OR v_existing.turno<>p_turno OR v_existing.fecha_operativa<>p_fecha_operativa
    OR v_existing.observacion IS DISTINCT FROM p_observacion
  THEN RAISE EXCEPTION 'Clave de idempotencia reutilizada'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicado',true,'id_movimiento',v_existing.id_movimiento);
 END IF;
 IF v_p.contrato_pdt<>'V2' OR v_p.estado<>'PENDIENTE' OR v_p.validacion_estado<>'VALIDADO'
 OR v_p.estado_repo='PICKING' OR v_p.fecha_cierre IS NOT NULL THEN RAISE EXCEPTION 'Pendiente no apto para avances'; END IF;
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

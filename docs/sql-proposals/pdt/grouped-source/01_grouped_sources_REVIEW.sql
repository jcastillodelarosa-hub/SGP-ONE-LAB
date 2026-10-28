-- REVIEW ONLY: grouped source hotfix; outside automatic migrations.
-- Apply only after isolated restore, full regression, backups and explicit production approval.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $source_guard$ DECLARE actual text; BEGIN
 SELECT md5(prosrc) INTO actual FROM pg_proc WHERE oid='public.sgp_aluminio_pendiente_registrar_avance_v1(text,uuid,uuid,integer,text,date,uuid,text)'::regprocedure;
 IF actual IS DISTINCT FROM 'ae75300b61654ce54434ed85feeec967' THEN RAISE EXCEPTION 'PDT_INSTALLED_BODY_CHANGED: public.sgp_aluminio_pendiente_registrar_avance_v1(text,uuid,uuid,integer,text,date,uuid,text)'; END IF;
 SELECT md5(prosrc) INTO actual FROM pg_proc WHERE oid='public.sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)'::regprocedure;
 IF actual IS DISTINCT FROM '82225ac71db91d5418b9b79ab6eb7c2a' THEN RAISE EXCEPTION 'PDT_INSTALLED_BODY_CHANGED: public.sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)'; END IF;
 SELECT md5(prosrc) INTO actual FROM pg_proc WHERE oid='public.sgp_pdt_asignar_v2(text,uuid,uuid)'::regprocedure;
 IF actual IS DISTINCT FROM '0b92431c8f1c5b3318fe2a2d8d9c4a71' THEN RAISE EXCEPTION 'PDT_INSTALLED_BODY_CHANGED: public.sgp_pdt_asignar_v2(text,uuid,uuid)'; END IF;
 SELECT md5(prosrc) INTO actual FROM pg_proc WHERE oid='public.sgp_pdt_cerrar_v2(text,uuid,uuid)'::regprocedure;
 IF actual IS DISTINCT FROM 'e20373f0e5d4ca5c0ececf282eccf014' THEN RAISE EXCEPTION 'PDT_INSTALLED_BODY_CHANGED: public.sgp_pdt_cerrar_v2(text,uuid,uuid)'; END IF;
 SELECT md5(prosrc) INTO actual FROM pg_proc WHERE oid='public.sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'::regprocedure;
 IF actual IS DISTINCT FROM '9d2141b4b0dd887cf3aeebdcdc168441' THEN RAISE EXCEPTION 'PDT_INSTALLED_BODY_CHANGED: public.sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'; END IF;
 SELECT md5(prosrc) INTO actual FROM pg_proc WHERE oid='public.sgp_pdt_entrega_validar_v2(text,uuid)'::regprocedure;
 IF actual IS DISTINCT FROM 'd38c460825e18eb62792c49e0a8ec331' THEN RAISE EXCEPTION 'PDT_INSTALLED_BODY_CHANGED: public.sgp_pdt_entrega_validar_v2(text,uuid)'; END IF;
 SELECT md5(prosrc) INTO actual FROM pg_proc WHERE oid='sgp_pdt_multiorigen.nuevo_sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)'::regprocedure;
 IF actual IS DISTINCT FROM '322b893878514e207a5e022c0c79b200' THEN RAISE EXCEPTION 'PDT_INSTALLED_BODY_CHANGED: sgp_pdt_multiorigen.nuevo_sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)'; END IF;
 SELECT md5(prosrc) INTO actual FROM pg_proc WHERE oid='sgp_pdt_multiorigen.nuevo_sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'::regprocedure;
 IF actual IS DISTINCT FROM 'a4c027adcd55accc397cd91aa146ea38' THEN RAISE EXCEPTION 'PDT_INSTALLED_BODY_CHANGED: sgp_pdt_multiorigen.nuevo_sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'; END IF;
 SELECT md5(prosrc) INTO actual FROM pg_proc WHERE oid='sgp_pdt_multiorigen.original_sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)'::regprocedure;
 IF actual IS DISTINCT FROM '2c5f310a07c8926d077601db43f55185' THEN RAISE EXCEPTION 'PDT_INSTALLED_BODY_CHANGED: sgp_pdt_multiorigen.original_sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)'; END IF;
 SELECT md5(prosrc) INTO actual FROM pg_proc WHERE oid='sgp_pdt_multiorigen.original_sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'::regprocedure;
 IF actual IS DISTINCT FROM 'e45fbfc78b1ba0a66b1ae9adf409a069' THEN RAISE EXCEPTION 'PDT_INSTALLED_BODY_CHANGED: sgp_pdt_multiorigen.original_sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'; END IF;
 SELECT md5(prosrc) INTO actual FROM pg_proc WHERE oid='public.sgp_pdt_cierre_acreditado(uuid)'::regprocedure;
 IF actual IS DISTINCT FROM '8f2dcf3592e780f04b2cf47b710e2f00' THEN RAISE EXCEPTION 'PDT_INSTALLED_BODY_CHANGED: public.sgp_pdt_cierre_acreditado(uuid)'; END IF;
 SELECT md5(prosrc) INTO actual FROM pg_proc WHERE oid='sgp_pdt_multiorigen.nuevo_sgp_pdt_cierre_acreditado(uuid)'::regprocedure;
 IF actual IS DISTINCT FROM '09a67b14a879aed2622c849cec15f15b' THEN RAISE EXCEPTION 'PDT_INSTALLED_BODY_CHANGED: sgp_pdt_multiorigen.nuevo_sgp_pdt_cierre_acreditado(uuid)'; END IF;
 SELECT md5(prosrc) INTO actual FROM pg_proc WHERE oid='sgp_pdt_multiorigen.original_sgp_pdt_cierre_acreditado(uuid)'::regprocedure;
 IF actual IS DISTINCT FROM 'e7106b3fb8b5c78d8eca938556352bd1' THEN RAISE EXCEPTION 'PDT_INSTALLED_BODY_CHANGED: sgp_pdt_multiorigen.original_sgp_pdt_cierre_acreditado(uuid)'; END IF;
END $source_guard$;
DO $guard$ BEGIN
 IF EXISTS (SELECT 1 FROM public.sgp_aluminio_pendiente_detalles WHERE id_pieza='')
 OR EXISTS (SELECT 1 FROM public.sgp_pdt_entrega_lineas WHERE id_pieza='')
 THEN RAISE EXCEPTION 'PDT_GROUP_SENTINEL_ALREADY_USED'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.sgp_pdt_fuentes'::regclass AND contype='p' AND pg_get_constraintdef(oid)='PRIMARY KEY (id_detalle)')
 THEN RAISE EXCEPTION 'PDT_SOURCE_PK_CHANGED'; END IF;
END $guard$;
ALTER TABLE public.sgp_pdt_fuentes DROP CONSTRAINT sgp_pdt_fuentes_pkey;
ALTER TABLE public.sgp_pdt_fuentes ADD CONSTRAINT sgp_pdt_fuentes_pkey PRIMARY KEY (id_detalle,id_pieza);
-- Existing rows, quantities and rights remain unchanged. Empty id_pieza denotes an aggregate detail, never a physical piece.
-- Existing active-delivery uniqueness is per physical piece. Grouped lines use their detail UUID instead.
DO $index$ BEGIN
 IF to_regclass('public.sgp_pdt_linea_fuente_activa') IS NULL OR
    pg_get_indexdef('public.sgp_pdt_linea_fuente_activa'::regclass) NOT LIKE '%(id_entrega, id_pieza)%'
 THEN RAISE EXCEPTION 'PDT_PICKING_ACTIVE_INDEX_CHANGED'; END IF;
END $index$;
DROP INDEX public.sgp_pdt_linea_fuente_activa;
CREATE UNIQUE INDEX sgp_pdt_linea_fuente_activa ON public.sgp_pdt_entrega_lineas(id_entrega,id_pieza)
 WHERE estado<>'ANULADA' AND id_pieza<>'';
CREATE UNIQUE INDEX sgp_pdt_linea_grouped_activa ON public.sgp_pdt_entrega_lineas(id_entrega,id_detalle)
 WHERE estado<>'ANULADA' AND id_pieza='';

CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.grouped_nuevo_validar(p_token text, p_id uuid, p_detalles jsonb, p_reserva text DEFAULT NULL::text, p_observacion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_key:=lower(v_fab)||'|'||v_long::text||'|'||upper(v_acab);
  IF nullif(v_row->>'id_pieza','') IS NOT NULL THEN RAISE EXCEPTION 'Modo fuente mixta no permitido'; END IF;
  IF v_key=ANY(v_keys) THEN RAISE EXCEPTION 'Fabricación repetida'; END IF;
  v_keys:=array_append(v_keys,v_key);
  IF v_count=1 THEN v_first:=v_row; END IF;
  v_total:=v_total+v_cant;
  IF v_total>2147483647 THEN RAISE EXCEPTION 'Cantidad fuera de rango'; END IF;
 PERFORM public.sgp_pdt_exigir_panel_v3(p_id);
  IF nullif(btrim(v_p.key_produccion),'') IS NULL THEN RAISE EXCEPTION 'Identidad producción no resuelta'; END IF;
  -- Direct, physical-source validation as in production. A legacy imported
  -- source key may point at FRAME, but its base ID and PANEL master must prove
  -- ONE matching PANEL target. No name-only match and no generic source helper.
  SELECT count(*) INTO v_source FROM public.sgp_aluminio a
  JOIN public.sgp_producciones origin ON origin.key_produccion=a.key_produccion
  JOIN public.sgp_producciones prod ON prod.id=origin.id AND nullif(btrim(origin.id),'') IS NOT NULL
  JOIN public.sgp_maestro_piezas m ON m.codigo_sap=a.codigo_sap
  WHERE a.activo='SI' AND a.tipo_pieza='PANEL'
   AND m.activo='SI' AND m.tipo_pieza='PANEL' AND m.destino_productivo='PANEL'
   AND origin.id_linea IN ('PANELES_2','FRAMES_2') AND prod.id_linea='PANELES_2'
   AND prod.key_produccion=v_p.key_produccion
   AND btrim(a.produccion)=btrim(v_p.produccion) AND btrim(origin.produccion)=btrim(prod.produccion)
   AND upper(btrim(a.sistema))=upper(btrim(prod.sistema)) AND upper(btrim(origin.sistema))=upper(btrim(prod.sistema))
   AND btrim(a.codigo_sap)=btrim(v_p.perfil)
   AND lower(btrim(a.fabricacion))=lower(v_fab) AND a.longitud=v_long AND upper(btrim(a.acabado))=upper(v_acab)
   AND (nullif(btrim(v_p.acabado_pendiente),'') IS NULL OR upper(btrim(a.acabado))=upper(btrim(v_p.acabado_pendiente)))
   AND EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v r
    WHERE r.key_produccion=prod.key_produccion AND r.reserva=coalesce(nullif(btrim(p_reserva),''),v_p.reserva)
    AND (NOT coalesce(r.es_reserva_compartida,false) OR nullif(btrim(r.reserva_principal),'') IS NOT NULL)
    AND (r.acabado_reserva IS NULL OR upper(btrim(r.acabado_reserva))=upper(btrim(a.acabado))))
   AND (SELECT count(*) FROM public.sgp_producciones other WHERE other.id=origin.id AND other.id_linea='PANELES_2')=1;
  IF v_source<1 THEN RAISE EXCEPTION 'Fuente PANEL inexistente o ambigua'; END IF;
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
 (id_pendiente,usuario,observacion,estado_anterior,estado_nuevo,tipo_evento,datos_anteriores,datos_nuevos)
 VALUES(p_id,v_usuario,p_observacion,v_p.estado_repo,v_p.estado_repo,'VALIDACION_PDT',
  jsonb_build_object('fabricacion',v_p.fabricacion,'longitud',v_p.longitud,
   'reserva',v_p.reserva,'acabado',v_p.acabado_pendiente,'validacion_estado',v_p.validacion_estado),
  jsonb_build_object('fabricacion',v_first->>'fabricacion','reserva',v_res,
   'acabado',v_acab_res,'validacion_estado','VALIDADO'));
 FOR v_row IN SELECT value FROM jsonb_array_elements(p_detalles)
 LOOP
  v_fab:=btrim(v_row->>'fabricacion'); v_long:=(v_row->>'longitud')::numeric; v_acab:=btrim(v_row->>'acabado');
  INSERT INTO public.sgp_aluminio_pendiente_detalles
   (id_pendiente,id_pieza,fabricacion,longitud,acabado,cantidad_validada,creado_por)
  VALUES (p_id,'',v_fab,v_long,v_acab,(v_row->>'cantidad')::integer,v_usuario) RETURNING id_detalle INTO v_detalle;
  FOR v_a IN SELECT DISTINCT a.* FROM public.sgp_aluminio a
  JOIN public.sgp_producciones origin ON origin.key_produccion=a.key_produccion
  JOIN public.sgp_producciones prod ON prod.id=origin.id AND nullif(btrim(origin.id),'') IS NOT NULL
  JOIN public.sgp_maestro_piezas m ON m.codigo_sap=a.codigo_sap
  WHERE a.activo='SI' AND a.tipo_pieza='PANEL'
   AND m.activo='SI' AND m.tipo_pieza='PANEL' AND m.destino_productivo='PANEL'
   AND origin.id_linea IN ('PANELES_2','FRAMES_2') AND prod.id_linea='PANELES_2'
   AND prod.key_produccion=v_p.key_produccion
   AND btrim(a.produccion)=btrim(v_p.produccion) AND btrim(origin.produccion)=btrim(prod.produccion)
   AND upper(btrim(a.sistema))=upper(btrim(prod.sistema)) AND upper(btrim(origin.sistema))=upper(btrim(prod.sistema))
   AND btrim(a.codigo_sap)=btrim(v_p.perfil)
   AND lower(btrim(a.fabricacion))=lower(v_fab) AND a.longitud=v_long AND upper(btrim(a.acabado))=upper(v_acab)
   AND (nullif(btrim(v_p.acabado_pendiente),'') IS NULL OR upper(btrim(a.acabado))=upper(btrim(v_p.acabado_pendiente)))
   AND EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v r
    WHERE r.key_produccion=prod.key_produccion AND r.reserva=coalesce(nullif(btrim(p_reserva),''),v_p.reserva)
    AND (NOT coalesce(r.es_reserva_compartida,false) OR nullif(btrim(r.reserva_principal),'') IS NOT NULL)
    AND (r.acabado_reserva IS NULL OR upper(btrim(r.acabado_reserva))=upper(btrim(a.acabado))))
   AND (SELECT count(*) FROM public.sgp_producciones other WHERE other.id=origin.id AND other.id_linea='PANELES_2')=1 LOOP
   INSERT INTO public.sgp_pdt_fuentes(id_detalle,id_pieza,id_carga,fila_origen,snapshot)
   VALUES(v_detalle,v_a.id_pieza,v_a.id_carga,v_a.fila_origen,to_jsonb(v_a));
  END LOOP;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fuentes PANEL cambiaron durante validación'; END IF;
 END LOOP;
 UPDATE public.sgp_aluminio_pendientes SET contrato_pdt='V2',
  fabricacion=btrim(v_first->>'fabricacion'),longitud=(v_first->>'longitud')::numeric,
  reserva=v_res,acabado_pendiente=v_acab_res,validacion_estado='VALIDADO',
  validado_por=v_usuario,fecha_validacion=now(),
  observacion_validacion=nullif(btrim(coalesce(p_observacion,'')),'')
 WHERE id_pendiente=p_id;
 INSERT INTO public.sgp_aluminio_pendientes_historial
 (id_pendiente,usuario,observacion,estado_anterior,estado_nuevo,tipo_evento,datos_anteriores,datos_nuevos)
 VALUES(p_id,v_usuario,p_observacion,v_p.estado_repo,v_p.estado_repo,'VALIDACION_DETALLES_PDT',
  jsonb_build_object('cantidad_reportada',v_p.cantidad,'fabricacion_reportada',v_p.fabricacion),
  jsonb_build_object('cantidad_validada',v_total,'correccion',v_correction,'detalles',p_detalles));
 RETURN jsonb_build_object('ok',true,'cantidad_reportada',v_p.cantidad,'cantidad_validada',v_total,'detalles',v_count);
END $function$;

CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.grouped_original_validar(p_token text, p_id uuid, p_detalles jsonb, p_reserva text DEFAULT NULL::text, p_observacion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_key:=lower(v_fab)||'|'||v_long::text||'|'||upper(v_acab);
  IF nullif(v_row->>'id_pieza','') IS NOT NULL THEN RAISE EXCEPTION 'Modo fuente mixta no permitido'; END IF;
  IF v_key=ANY(v_keys) THEN RAISE EXCEPTION 'Fabricación repetida'; END IF;
  v_keys:=array_append(v_keys,v_key);
  IF v_count=1 THEN v_first:=v_row; END IF;
  v_total:=v_total+v_cant;
  IF v_total>2147483647 THEN RAISE EXCEPTION 'Cantidad fuera de rango'; END IF;
 PERFORM public.sgp_pdt_exigir_panel_v3(p_id);
  IF nullif(btrim(v_p.key_produccion),'') IS NULL THEN RAISE EXCEPTION 'Identidad producción no resuelta'; END IF;
  SELECT count(*) INTO v_source FROM public.sgp_aluminio a
   JOIN public.sgp_producciones prod ON prod.key_produccion=a.key_produccion
   WHERE a.activo='SI' AND a.tipo_pieza='PANEL'
     AND a.key_produccion=v_p.key_produccion AND prod.id_linea='PANELES_2' AND btrim(a.produccion)=btrim(v_p.produccion)
     AND (nullif(btrim(coalesce(v_p.acabado_pendiente,'')),'') IS NULL OR upper(btrim(a.acabado))=upper(btrim(v_p.acabado_pendiente)))
     AND EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v r WHERE r.key_produccion=v_p.key_produccion AND r.reserva=coalesce(nullif(btrim(p_reserva),''),v_p.reserva) AND (r.acabado_reserva IS NULL OR upper(btrim(r.acabado_reserva))=upper(btrim(a.acabado))))
     AND upper(btrim(a.sistema))=upper(btrim(prod.sistema))
     AND btrim(a.codigo_sap)=btrim(v_p.perfil)
     AND lower(btrim(a.fabricacion))=lower(v_fab) AND a.longitud=v_long
     AND upper(btrim(a.acabado))=upper(v_acab);
  IF v_source<1 THEN RAISE EXCEPTION 'Fuente PANEL inexistente o ambigua'; END IF;
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
 (id_pendiente,estado_nuevo,usuario,observacion,tipo_evento,datos_anteriores,datos_nuevos)
 VALUES(p_id,coalesce(v_p.estado_repo,'PENDIENTE'),v_usuario,p_observacion,'VALIDACION_PDT',
  jsonb_build_object('fabricacion',v_p.fabricacion,'longitud',v_p.longitud,
   'reserva',v_p.reserva,'acabado',v_p.acabado_pendiente,'validacion_estado',v_p.validacion_estado),
  jsonb_build_object('fabricacion',v_first->>'fabricacion','reserva',v_res,
   'acabado',v_acab_res,'validacion_estado','VALIDADO'));
 FOR v_row IN SELECT value FROM jsonb_array_elements(p_detalles)
 LOOP
  v_fab:=btrim(v_row->>'fabricacion'); v_long:=(v_row->>'longitud')::numeric; v_acab:=btrim(v_row->>'acabado');
  INSERT INTO public.sgp_aluminio_pendiente_detalles
   (id_pendiente,id_pieza,fabricacion,longitud,acabado,cantidad_validada,creado_por)
  VALUES (p_id,'',v_fab,v_long,v_acab,(v_row->>'cantidad')::integer,v_usuario) RETURNING id_detalle INTO v_detalle;
  FOR v_a IN SELECT DISTINCT a.* FROM public.sgp_aluminio a
   JOIN public.sgp_producciones prod ON prod.key_produccion=a.key_produccion
   WHERE a.activo='SI' AND a.tipo_pieza='PANEL'
     AND a.key_produccion=v_p.key_produccion AND prod.id_linea='PANELES_2' AND btrim(a.produccion)=btrim(v_p.produccion)
     AND (nullif(btrim(coalesce(v_p.acabado_pendiente,'')),'') IS NULL OR upper(btrim(a.acabado))=upper(btrim(v_p.acabado_pendiente)))
     AND EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v r WHERE r.key_produccion=v_p.key_produccion AND r.reserva=coalesce(nullif(btrim(p_reserva),''),v_p.reserva) AND (r.acabado_reserva IS NULL OR upper(btrim(r.acabado_reserva))=upper(btrim(a.acabado))))
     AND upper(btrim(a.sistema))=upper(btrim(prod.sistema))
     AND btrim(a.codigo_sap)=btrim(v_p.perfil)
     AND lower(btrim(a.fabricacion))=lower(v_fab) AND a.longitud=v_long
     AND upper(btrim(a.acabado))=upper(v_acab) LOOP
   INSERT INTO public.sgp_pdt_fuentes(id_detalle,id_pieza,id_carga,fila_origen,snapshot)
   VALUES(v_detalle,v_a.id_pieza,v_a.id_carga,v_a.fila_origen,to_jsonb(v_a));
  END LOOP;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fuentes PANEL cambiaron durante validación'; END IF;
 END LOOP;
 UPDATE public.sgp_aluminio_pendientes SET contrato_pdt='V2',
  fabricacion=btrim(v_first->>'fabricacion'),longitud=(v_first->>'longitud')::numeric,
  reserva=v_res,acabado_pendiente=v_acab_res,validacion_estado='VALIDADO',
  validado_por=v_usuario,fecha_validacion=now(),
  observacion_validacion=nullif(btrim(coalesce(p_observacion,'')),'')
 WHERE id_pendiente=p_id;
 INSERT INTO public.sgp_aluminio_pendientes_historial
 (id_pendiente,estado_nuevo,usuario,observacion,tipo_evento,datos_anteriores,datos_nuevos)
 VALUES(p_id,coalesce(v_p.estado_repo,'PENDIENTE'),v_usuario,p_observacion,'VALIDACION_DETALLES_PDT',
  jsonb_build_object('cantidad_reportada',v_p.cantidad,'fabricacion_reportada',v_p.fabricacion),
  jsonb_build_object('cantidad_validada',v_total,'correccion',v_correction,'detalles',p_detalles));
 RETURN jsonb_build_object('ok',true,'cantidad_reportada',v_p.cantidad,'cantidad_validada',v_total,'detalles',v_count);
END $function$;

CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_validar_detalles_v1(p_token text,p_id uuid,p_detalles jsonb,p_reserva text DEFAULT NULL,p_observacion text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 IF jsonb_typeof(p_detalles)='array' AND jsonb_array_length(p_detalles)>0
 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_detalles) x WHERE nullif(x->>'id_pieza','') IS NOT NULL) THEN
  IF sgp_pdt_multiorigen.es_registro_v4(p_id) THEN
   RETURN sgp_pdt_multiorigen.grouped_nuevo_validar(p_token,p_id,p_detalles,p_reserva,p_observacion);
  END IF;
  RETURN sgp_pdt_multiorigen.grouped_original_validar(p_token,p_id,p_detalles,p_reserva,p_observacion);
 END IF;
 IF sgp_pdt_multiorigen.es_registro_v4(p_id) THEN
  RETURN sgp_pdt_multiorigen.nuevo_sgp_aluminio_pendiente_validar_detalles_v1(p_token,p_id,p_detalles,p_reserva,p_observacion);
 END IF;
 RETURN sgp_pdt_multiorigen.original_sgp_aluminio_pendiente_validar_detalles_v1(p_token,p_id,p_detalles,p_reserva,p_observacion);
END $fn$;

CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.grouped_nuevo_entrega(p_token text, p_detalle uuid, p_entrega uuid, p_cantidad integer, p_clave uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE d public.sgp_aluminio_pendiente_detalles%rowtype; p public.sgp_aluminio_pendientes%rowtype;
 e public.sgp_pdt_entrega_lineas%rowtype; u text; nuevo uuid; neto bigint;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING']);
 IF p_cantidad IS NULL OR p_cantidad<=0 OR p_clave IS NULL THEN RAISE EXCEPTION 'Cantidad/clave inválida'; END IF;
 SELECT * INTO STRICT d FROM public.sgp_aluminio_pendiente_detalles WHERE id_detalle=p_detalle;
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=d.id_pendiente FOR UPDATE;
 PERFORM public.sgp_pdt_exigir_panel_v3(p.id_pendiente);
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
 AND (mp.reserva=p.reserva OR (mp.reserva=p.reserva_principal AND EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v rel WHERE rel.key_produccion=p.key_produccion AND rel.reserva=p.reserva AND rel.reserva_principal=mp.reserva))) AND upper(btrim(mp.acabado))=upper(btrim(d.acabado))
 AND EXISTS(SELECT 1 FROM public.sgp_pdt_fuentes f WHERE f.id_detalle=d.id_detalle
 AND upper(btrim(f.snapshot->>'sistema'))=upper(btrim(mp.sistema))
 AND EXISTS(SELECT 1 FROM public.sgp_pdt_origenes_internal_v3(p.reserva,p.perfil,p.produccion,p.acabado_pendiente,f.id_pieza) x
 WHERE x->>'key_produccion'=p.key_produccion AND x->>'tipo_pieza'='PANEL' AND x->>'id_linea'='PANELES_2'
 AND f.snapshot->>'id_pieza'=x->>'id_pieza'
 AND (SELECT to_jsonb(a)-'cantidad' FROM public.sgp_aluminio a WHERE a.id_pieza=f.id_pieza)=f.snapshot-'cantidad'));
 IF NOT FOUND THEN RAISE EXCEPTION 'Entrega ajena o identidad incompleta'; END IF;
 SELECT coalesce(sum(CASE WHEN tipo='AVANCE' THEN cantidad ELSE -cantidad END),0) INTO neto
 FROM public.sgp_aluminio_pendiente_movimientos WHERE id_detalle=p_detalle;
 IF p_cantidad+coalesce((SELECT sum(cantidad) FROM public.sgp_pdt_entrega_lineas WHERE id_detalle=p_detalle AND estado<>'ANULADA'),0)>neto
 THEN RAISE EXCEPTION 'Entrega supera procesado'; END IF;
 INSERT INTO public.sgp_pdt_entrega_lineas(id_entrega,id_detalle,id_pieza,cantidad,clave,registrado_por)
 VALUES(p_entrega,p_detalle,'',p_cantidad,p_clave,u) RETURNING id_linea INTO nuevo;
 RETURN jsonb_build_object('ok',true,'id_linea',nuevo);
END $function$;

CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.grouped_original_entrega(p_token text, p_detalle uuid, p_entrega uuid, p_cantidad integer, p_clave uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE d public.sgp_aluminio_pendiente_detalles%rowtype; p public.sgp_aluminio_pendientes%rowtype;
 e public.sgp_pdt_entrega_lineas%rowtype; u text; nuevo uuid; neto bigint;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING']);
 IF p_cantidad IS NULL OR p_cantidad<=0 OR p_clave IS NULL THEN RAISE EXCEPTION 'Cantidad/clave inválida'; END IF;
 SELECT * INTO STRICT d FROM public.sgp_aluminio_pendiente_detalles WHERE id_detalle=p_detalle;
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=d.id_pendiente FOR UPDATE;
 PERFORM public.sgp_pdt_exigir_panel_v3(p.id_pendiente);
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
 VALUES(p_entrega,p_detalle,'',p_cantidad,p_clave,u) RETURNING id_linea INTO nuevo;
 RETURN jsonb_build_object('ok',true,'id_linea',nuevo);
END $function$;

CREATE OR REPLACE FUNCTION public.sgp_pdt_entrega_registrar_v2(p_token text,p_detalle uuid,p_entrega uuid,p_cantidad integer,p_clave uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
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
END $fn$;

CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.grouped_nuevo_cierre_acreditado(p_id uuid)RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.sgp_pdt_cierres WHERE id_pendiente=p_id)
 AND EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=p_id)
 AND NOT EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d WHERE d.id_pendiente=p_id AND (
 d.cantidad_validada<>(SELECT coalesce(sum(CASE WHEN m.tipo='AVANCE' THEN m.cantidad ELSE -m.cantidad END),0) FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_detalle=d.id_detalle)
 OR d.cantidad_validada<>(SELECT coalesce(sum(a.cantidad),0) FROM public.sgp_pdt_asignaciones a
 JOIN public.sgp_pdt_entrega_lineas l USING(id_linea) JOIN public.sgp_picking_entregas e ON e.id_entrega=l.id_entrega
 JOIN public.sgp_mecanizado_programacion mp ON mp.id_programacion=e.id_programacion

 JOIN public.sgp_aluminio_pendientes p ON p.id_pendiente=d.id_pendiente
 WHERE a.id_detalle=d.id_detalle AND l.estado='VALIDADA' AND e.estado='VALIDADA'
 AND e.produccion=p.produccion AND (mp.reserva=p.reserva OR (mp.reserva=p.reserva_principal AND EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v rel WHERE rel.key_produccion=p.key_produccion AND rel.reserva=p.reserva AND rel.reserva_principal=mp.reserva)))
 AND EXISTS(SELECT 1 FROM public.sgp_pdt_fuentes f WHERE f.id_detalle=a.id_detalle AND upper(btrim(mp.sistema))=upper(btrim(f.snapshot->>'sistema')))
 AND upper(btrim(mp.acabado))=upper(btrim(d.acabado)))));
$function$;

CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.grouped_original_cierre_acreditado(p_id uuid)RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.sgp_pdt_cierres WHERE id_pendiente=p_id)
 AND EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=p_id)
 AND NOT EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d WHERE d.id_pendiente=p_id AND (
 d.cantidad_validada<>(SELECT coalesce(sum(CASE WHEN m.tipo='AVANCE' THEN m.cantidad ELSE -m.cantidad END),0) FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_detalle=d.id_detalle)
 OR d.cantidad_validada<>(SELECT coalesce(sum(a.cantidad),0) FROM public.sgp_pdt_asignaciones a
 JOIN public.sgp_pdt_entrega_lineas l USING(id_linea) JOIN public.sgp_picking_entregas e ON e.id_entrega=l.id_entrega
 JOIN public.sgp_mecanizado_programacion mp ON mp.id_programacion=e.id_programacion

 JOIN public.sgp_aluminio_pendientes p ON p.id_pendiente=d.id_pendiente
 WHERE a.id_detalle=d.id_detalle AND l.estado='VALIDADA' AND e.estado='VALIDADA'
 AND e.produccion=p.produccion AND mp.reserva=p.reserva
 AND EXISTS(SELECT 1 FROM public.sgp_pdt_fuentes f WHERE f.id_detalle=a.id_detalle AND upper(btrim(mp.sistema))=upper(btrim(f.snapshot->>'sistema')))
 AND upper(btrim(mp.acabado))=upper(btrim(d.acabado)))));
$function$;

CREATE OR REPLACE FUNCTION public.sgp_pdt_cierre_acreditado(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=p_id AND id_pieza='') THEN
  IF sgp_pdt_multiorigen.es_registro_v4(p_id) THEN RETURN sgp_pdt_multiorigen.grouped_nuevo_cierre_acreditado(p_id); END IF;
  RETURN sgp_pdt_multiorigen.grouped_original_cierre_acreditado(p_id);
 END IF;
 IF sgp_pdt_multiorigen.es_registro_v4(p_id) THEN RETURN sgp_pdt_multiorigen.nuevo_sgp_pdt_cierre_acreditado(p_id); END IF;
 RETURN sgp_pdt_multiorigen.original_sgp_pdt_cierre_acreditado(p_id);
END $fn$;
-- New helpers are not callable by client roles; public dispatchers retain their installed EXECUTE grants.
REVOKE ALL ON FUNCTION sgp_pdt_multiorigen.grouped_nuevo_validar(text,uuid,jsonb,text,text), sgp_pdt_multiorigen.grouped_nuevo_entrega(text,uuid,uuid,integer,uuid), sgp_pdt_multiorigen.grouped_nuevo_cierre_acreditado(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION sgp_pdt_multiorigen.grouped_original_validar(text,uuid,jsonb,text,text), sgp_pdt_multiorigen.grouped_original_entrega(text,uuid,uuid,integer,uuid), sgp_pdt_multiorigen.grouped_original_cierre_acreditado(uuid) FROM PUBLIC,anon,authenticated;
-- Existing function owners remain unchanged.
COMMIT;

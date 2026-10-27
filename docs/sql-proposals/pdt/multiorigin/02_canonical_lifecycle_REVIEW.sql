-- OPTIONAL REVIEW ONLY — productive validator fingerprint supplied by owner/ChatGPT.
-- 641227c7727bd9586b2ef20323a23791 is checked against definition/body, never trusted as a fixture hash.
-- Scoped to new V4-ledger V2 only; LEGACY and pre-existing V2 delegate unchanged.
BEGIN;
DO $preflight$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid IN (
 'public.sgp_pdt_fuentes_v2(text,uuid)'::regprocedure,
 'public.sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)'::regprocedure,
 'public.sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'::regprocedure,
 'public.sgp_pdt_cierre_acreditado(uuid)'::regprocedure,
 'public.sgp_pdt_picking_v2(text,uuid)'::regprocedure)
 AND (p.prosecdef IS DISTINCT FROM true OR pg_get_userbyid(p.proowner)<>'postgres' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']))
 THEN RAISE EXCEPTION 'PDT_CICLO_SEGURIDAD_DISTINTA'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_pdt_fuentes_v2(text,uuid)'::regprocedure)<>'c20c8f375798982befd91a67cc0c0de4' THEN RAISE EXCEPTION 'PDT_CICLO_DEFINICION_CAMBIADA: sgp_pdt_fuentes_v2'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)'::regprocedure
 AND '641227c7727bd9586b2ef20323a23791' IN (md5(prosrc),md5(pg_get_functiondef(oid))))
 THEN RAISE EXCEPTION 'PDT_CICLO_DEFINICION_CAMBIADA: sgp_aluminio_pendiente_validar_detalles_v1'; END IF;
 -- Required history columns/types are checked before changing any function.
 IF (SELECT count(*) FROM pg_attribute WHERE attrelid='public.sgp_aluminio_pendientes_historial'::regclass
 AND attname IN ('estado_anterior','estado_nuevo') AND atttypid='text'::regtype AND NOT attisdropped)<>2
 THEN RAISE EXCEPTION 'PDT_HISTORIAL_CONTRATO_INCOMPATIBLE'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'::regprocedure)<>'ae9345ecee5dc46195774dbbce58468c' THEN RAISE EXCEPTION 'PDT_CICLO_DEFINICION_CAMBIADA: sgp_pdt_entrega_registrar_v2'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_pdt_cierre_acreditado(uuid)'::regprocedure)<>'e7106b3fb8b5c78d8eca938556352bd1' THEN RAISE EXCEPTION 'PDT_CICLO_DEFINICION_CAMBIADA: sgp_pdt_cierre_acreditado'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_pdt_picking_v2(text,uuid)'::regprocedure)<>'656af05b7edba188cca0003074ac2ea2' THEN RAISE EXCEPTION 'PDT_CICLO_DEFINICION_CAMBIADA: sgp_pdt_picking_v2'; END IF;
 -- Unknown mandatory audit columns must not be discovered after deployment.
 IF EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.sgp_aluminio_pendientes_historial'::regclass
 AND a.attnum>0 AND NOT a.attisdropped AND a.attnotnull AND NOT a.atthasdef
 AND a.attidentity='' AND a.attgenerated=''
 AND a.attname NOT IN ('id_pendiente','usuario','observacion','estado_anterior','estado_nuevo','tipo_evento','datos_anteriores','datos_nuevos'))
 THEN RAISE EXCEPTION 'PDT_HISTORIAL_COLUMNA_OBLIGATORIA_DESCONOCIDA'; END IF;
END $preflight$;
-- No shared replacement body applies to LEGACY or previously installed V2.
-- Only freshly reported V2 rows in this feature's private ledger opt into it.
CREATE FUNCTION sgp_pdt_multiorigen.es_registro_v4(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
 SELECT EXISTS(SELECT 1 FROM sgp_pdt_multiorigen.detalles e
 JOIN public.sgp_aluminio_pendientes p USING(id_pendiente)
 WHERE p.id_pendiente=p_id AND p.contrato_pdt='V2');
$fn$;
INSERT INTO sgp_pdt_multiorigen.funciones_previas(firma,definicion) VALUES('public.sgp_pdt_fuentes_v2(text,uuid)',pg_get_functiondef('public.sgp_pdt_fuentes_v2(text,uuid)'::regprocedure));
DO $clone$ DECLARE original text; BEGIN
 original:=pg_get_functiondef('public.sgp_pdt_fuentes_v2(text,uuid)'::regprocedure);
 EXECUTE replace(original,'FUNCTION public.sgp_pdt_fuentes_v2(','FUNCTION sgp_pdt_multiorigen.original_sgp_pdt_fuentes_v2(');
END $clone$;
CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.nuevo_sgp_pdt_fuentes_v2(p_token text,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE p public.sgp_aluminio_pendientes%rowtype; result jsonb;
BEGIN
 PERFORM public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION','LIDER LINEA','SUPERVISOR DE PICKING']);
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id;
 PERFORM public.sgp_pdt_exigir_panel_v3(p_id);
 SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('id_pieza',x->>'id_pieza','id_carga',a.id_carga,'fila_origen',a.fila_origen,'fabricacion',x->>'fabricacion','longitud',x->>'longitud','acabado',x->>'acabado','marca',x->>'marca','uso',a.uso,'cantidad',a.cantidad)),'[]'::jsonb)
 INTO result FROM public.sgp_pdt_origenes_internal_v3(p.reserva,p.perfil,p.produccion,p.acabado_pendiente,NULL) x
 JOIN public.sgp_aluminio a ON a.id_pieza=x->>'id_pieza'
 WHERE x->>'key_produccion'=p.key_produccion AND x->>'codigo_sap'=p.perfil AND x->>'tipo_pieza'='PANEL' AND x->>'id_linea'='PANELES_2';
 RETURN result;
END $fn$;
CREATE OR REPLACE FUNCTION public.sgp_pdt_fuentes_v2(p_token text,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $dispatch$
BEGIN
 IF sgp_pdt_multiorigen.es_registro_v4(p_id) THEN
 RETURN sgp_pdt_multiorigen.nuevo_sgp_pdt_fuentes_v2(p_token,p_id);
 END IF;
 RETURN sgp_pdt_multiorigen.original_sgp_pdt_fuentes_v2(p_token,p_id);
END $dispatch$;
INSERT INTO sgp_pdt_multiorigen.funciones_previas(firma,definicion) VALUES('public.sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)',pg_get_functiondef('public.sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)'::regprocedure));
DO $clone$ DECLARE original text; BEGIN
 original:=pg_get_functiondef('public.sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)'::regprocedure);
 EXECUTE replace(original,'FUNCTION public.sgp_aluminio_pendiente_validar_detalles_v1(','FUNCTION sgp_pdt_multiorigen.original_sgp_aluminio_pendiente_validar_detalles_v1(');
END $clone$;
CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.nuevo_sgp_aluminio_pendiente_validar_detalles_v1(p_token text, p_id uuid, p_detalles jsonb, p_reserva text DEFAULT NULL::text, p_observacion text DEFAULT NULL::text)
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
  v_key:=v_row->>'id_pieza';
  IF nullif(v_key,'') IS NULL THEN RAISE EXCEPTION 'Referencia fuente requerida'; END IF;
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
  WHERE a.id_pieza=v_key AND a.activo='SI' AND a.tipo_pieza='PANEL'
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
 (id_pendiente,usuario,observacion,estado_anterior,estado_nuevo,tipo_evento,datos_anteriores,datos_nuevos)
 VALUES(p_id,v_usuario,p_observacion,v_p.estado_repo,v_p.estado_repo,'VALIDACION_PDT',
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
 (id_pendiente,usuario,observacion,estado_anterior,estado_nuevo,tipo_evento,datos_anteriores,datos_nuevos)
 VALUES(p_id,v_usuario,p_observacion,v_p.estado_repo,v_p.estado_repo,'VALIDACION_DETALLES_PDT',
  jsonb_build_object('cantidad_reportada',v_p.cantidad,'fabricacion_reportada',v_p.fabricacion),
  jsonb_build_object('cantidad_validada',v_total,'correccion',v_correction,'detalles',p_detalles));
 RETURN jsonb_build_object('ok',true,'cantidad_reportada',v_p.cantidad,'cantidad_validada',v_total,'detalles',v_count);
END $function$;
CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_validar_detalles_v1(p_token text,p_id uuid,p_detalles jsonb,p_reserva text DEFAULT NULL::text,p_observacion text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $dispatch$
BEGIN
 IF sgp_pdt_multiorigen.es_registro_v4(p_id) THEN
 RETURN sgp_pdt_multiorigen.nuevo_sgp_aluminio_pendiente_validar_detalles_v1(p_token,p_id,p_detalles,p_reserva,p_observacion);
 END IF;
 RETURN sgp_pdt_multiorigen.original_sgp_aluminio_pendiente_validar_detalles_v1(p_token,p_id,p_detalles,p_reserva,p_observacion);
END $dispatch$;
INSERT INTO sgp_pdt_multiorigen.funciones_previas(firma,definicion) VALUES('public.sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)',pg_get_functiondef('public.sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'::regprocedure));
DO $clone$ DECLARE original text; BEGIN
 original:=pg_get_functiondef('public.sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'::regprocedure);
 EXECUTE replace(original,'FUNCTION public.sgp_pdt_entrega_registrar_v2(','FUNCTION sgp_pdt_multiorigen.original_sgp_pdt_entrega_registrar_v2(');
END $clone$;
CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.nuevo_sgp_pdt_entrega_registrar_v2(p_token text,p_detalle uuid,p_entrega uuid,p_cantidad integer,p_clave uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
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
 AND EXISTS(SELECT 1 FROM public.sgp_pdt_origenes_internal_v3(p.reserva,p.perfil,p.produccion,p.acabado_pendiente,d.id_pieza) x
 WHERE x->>'key_produccion'=p.key_produccion AND x->>'tipo_pieza'='PANEL' AND x->>'id_linea'='PANELES_2'
 AND f.snapshot->>'id_pieza'=x->>'id_pieza'
 AND (SELECT to_jsonb(a)-'cantidad' FROM public.sgp_aluminio a WHERE a.id_pieza=d.id_pieza)=f.snapshot-'cantidad'));
 IF NOT FOUND THEN RAISE EXCEPTION 'Entrega ajena o identidad incompleta'; END IF;
 SELECT coalesce(sum(CASE WHEN tipo='AVANCE' THEN cantidad ELSE -cantidad END),0) INTO neto
 FROM public.sgp_aluminio_pendiente_movimientos WHERE id_detalle=p_detalle;
 IF p_cantidad+coalesce((SELECT sum(cantidad) FROM public.sgp_pdt_entrega_lineas WHERE id_detalle=p_detalle AND estado<>'ANULADA'),0)>neto
 THEN RAISE EXCEPTION 'Entrega supera procesado'; END IF;
 INSERT INTO public.sgp_pdt_entrega_lineas(id_entrega,id_detalle,id_pieza,cantidad,clave,registrado_por)
 VALUES(p_entrega,p_detalle,d.id_pieza,p_cantidad,p_clave,u) RETURNING id_linea INTO nuevo;
 RETURN jsonb_build_object('ok',true,'id_linea',nuevo);
END $fn$;
CREATE OR REPLACE FUNCTION public.sgp_pdt_entrega_registrar_v2(p_token text,p_detalle uuid,p_entrega uuid,p_cantidad integer,p_clave uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $dispatch$
BEGIN
 IF sgp_pdt_multiorigen.es_registro_v4((SELECT id_pendiente FROM public.sgp_aluminio_pendiente_detalles WHERE id_detalle=p_detalle)) THEN
 RETURN sgp_pdt_multiorigen.nuevo_sgp_pdt_entrega_registrar_v2(p_token,p_detalle,p_entrega,p_cantidad,p_clave);
 END IF;
 RETURN sgp_pdt_multiorigen.original_sgp_pdt_entrega_registrar_v2(p_token,p_detalle,p_entrega,p_cantidad,p_clave);
END $dispatch$;
INSERT INTO sgp_pdt_multiorigen.funciones_previas(firma,definicion) VALUES('public.sgp_pdt_cierre_acreditado(uuid)',pg_get_functiondef('public.sgp_pdt_cierre_acreditado(uuid)'::regprocedure));
DO $clone$ DECLARE original text; BEGIN
 original:=pg_get_functiondef('public.sgp_pdt_cierre_acreditado(uuid)'::regprocedure);
 EXECUTE replace(original,'FUNCTION public.sgp_pdt_cierre_acreditado(','FUNCTION sgp_pdt_multiorigen.original_sgp_pdt_cierre_acreditado(');
END $clone$;
CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.nuevo_sgp_pdt_cierre_acreditado(p_id uuid)
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
 AND e.produccion=p.produccion AND (mp.reserva=p.reserva OR (mp.reserva=p.reserva_principal AND EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v rel WHERE rel.key_produccion=p.key_produccion AND rel.reserva=p.reserva AND rel.reserva_principal=mp.reserva)))
 AND upper(btrim(mp.sistema))=upper(btrim(f.snapshot->>'sistema'))
 AND upper(btrim(mp.acabado))=upper(btrim(d.acabado)))));
$fn$;
CREATE OR REPLACE FUNCTION public.sgp_pdt_cierre_acreditado(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $dispatch$
BEGIN
 IF sgp_pdt_multiorigen.es_registro_v4(p_id) THEN
 RETURN sgp_pdt_multiorigen.nuevo_sgp_pdt_cierre_acreditado(p_id);
 END IF;
 RETURN sgp_pdt_multiorigen.original_sgp_pdt_cierre_acreditado(p_id);
END $dispatch$;
INSERT INTO sgp_pdt_multiorigen.funciones_previas(firma,definicion) VALUES('public.sgp_pdt_picking_v2(text,uuid)',pg_get_functiondef('public.sgp_pdt_picking_v2(text,uuid)'::regprocedure));
DO $clone$ DECLARE original text; BEGIN
 original:=pg_get_functiondef('public.sgp_pdt_picking_v2(text,uuid)'::regprocedure);
 EXECUTE replace(original,'FUNCTION public.sgp_pdt_picking_v2(','FUNCTION sgp_pdt_multiorigen.original_sgp_pdt_picking_v2(');
END $clone$;
CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.nuevo_sgp_pdt_picking_v2(p_token text,p_id uuid)
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
  AND (mp.reserva=p.reserva OR (mp.reserva=p.reserva_principal AND EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v rel WHERE rel.key_produccion=p.key_produccion AND rel.reserva=p.reserva AND rel.reserva_principal=mp.reserva))) AND upper(btrim(mp.acabado))=upper(btrim(p.acabado_pendiente))
 )x),'[]'::jsonb),'lineas',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('asignada',EXISTS(
 SELECT 1 FROM public.sgp_pdt_asignaciones a WHERE a.id_linea=l.id_linea)))
 FROM public.sgp_pdt_entrega_lineas l JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle)
 WHERE d.id_pendiente=p_id),'[]'::jsonb));
END $fn$;
CREATE OR REPLACE FUNCTION public.sgp_pdt_picking_v2(p_token text,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $dispatch$
BEGIN
 IF sgp_pdt_multiorigen.es_registro_v4(p_id) THEN
 RETURN sgp_pdt_multiorigen.nuevo_sgp_pdt_picking_v2(p_token,p_id);
 END IF;
 RETURN sgp_pdt_multiorigen.original_sgp_pdt_picking_v2(p_token,p_id);
END $dispatch$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_pdt_multiorigen FROM PUBLIC,anon,authenticated;
UPDATE sgp_pdt_multiorigen.funciones_previas f SET huella_posterior=(SELECT md5(prosrc) FROM pg_proc WHERE oid=f.firma::regprocedure);
NOTIFY pgrst,'reload schema';
COMMIT;

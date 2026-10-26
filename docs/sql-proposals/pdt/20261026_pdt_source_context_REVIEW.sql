-- REVIEW ONLY. Outside automatic migrations. NOT APPLIED TO PRODUCTION.
-- Atomic forward proposal: source reader + its validator + dependent snapshot guard.
-- Requires separately authorized backup/control/application; no business row updates.
-- Does not change pending keys, snapshots, quantities, LEGACY functions or NC.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $preflight$ DECLARE f record; BEGIN
 FOR f IN SELECT * FROM (VALUES
  ('public.sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)','531f1b67efff0806667d0666c9f8911b'),
  ('public.sgp_pdt_fuentes_v2(text,uuid)','0ba2d5fa00c3782a8c3af91141508c17'),
  ('public.sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)','00a1fd5fad7b0786ae144703d8efc8e1')
 ) x(signature,digest) LOOP
 IF to_regprocedure(f.signature) IS NULL OR md5(pg_get_functiondef(to_regprocedure(f.signature)))<>f.digest
 THEN RAISE EXCEPTION 'PDT_SOURCE: installed definition differs: %',f.signature; END IF;
 END LOOP;
 IF to_regprocedure('public.sgp_pdt_fuente_contexto_v2(text,text,text,text,text,text)') IS NOT NULL
 THEN RAISE EXCEPTION 'PDT_SOURCE: existing helper requires review'; END IF;
END $preflight$;
-- SOURCE_CONTEXT_BEGIN
CREATE OR REPLACE FUNCTION public.sgp_pdt_fuente_contexto_v2(
 p_pending_key text,p_source_key text,p_produccion text,p_sistema text,p_reserva text,p_acabado text
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $context$
 SELECT EXISTS(
  SELECT 1 FROM public.sgp_producciones pp JOIN public.sgp_producciones sp ON sp.id=pp.id
  WHERE pp.key_produccion=p_pending_key AND sp.key_produccion=p_source_key
   AND nullif(btrim(pp.id),'') IS NOT NULL
   AND (sp.key_produccion=pp.key_produccion OR (pp.id_linea='FRAMES_2' AND sp.id_linea='PANELES_2'))
   AND btrim(pp.produccion)=btrim(p_produccion) AND btrim(sp.produccion)=btrim(p_produccion)
   AND upper(btrim(pp.sistema))=upper(btrim(p_sistema)) AND upper(btrim(sp.sistema))=upper(btrim(p_sistema))
   AND nullif(btrim(p_acabado),'') IS NOT NULL
   AND EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v r WHERE r.key_produccion=pp.key_produccion AND r.reserva=p_reserva
    AND (r.acabado_reserva IS NULL OR upper(btrim(r.acabado_reserva))=upper(btrim(p_acabado))))
   AND EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v r WHERE r.key_produccion=sp.key_produccion AND r.reserva=p_reserva
    AND (r.acabado_reserva IS NULL OR upper(btrim(r.acabado_reserva))=upper(btrim(p_acabado))))
 );
$context$;
REVOKE ALL ON FUNCTION public.sgp_pdt_fuente_contexto_v2(text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
-- SOURCE_CONTEXT_END

-- SOURCE_READER_BEGIN
CREATE OR REPLACE FUNCTION public.sgp_pdt_fuentes_v2(p_token text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE p public.sgp_aluminio_pendientes%rowtype;
BEGIN
 PERFORM public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION','LIDER LINEA','SUPERVISOR DE PICKING']);
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id;
 IF p.key_produccion IS NULL THEN RAISE EXCEPTION 'Producción sin identidad'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id_pieza',a.id_pieza,'id_carga',a.id_carga,'fila_origen',a.fila_origen,'key_produccion',a.key_produccion,'fabricacion',a.fabricacion,
  'longitud',a.longitud::text,'acabado',a.acabado,'marca',a.marca,'uso',a.uso,'cantidad',a.cantidad) ORDER BY a.fabricacion,a.longitud,a.acabado,a.id_pieza)
 FROM public.sgp_aluminio a JOIN public.sgp_producciones prod ON prod.key_produccion=a.key_produccion
 WHERE btrim(a.produccion)=btrim(p.produccion) AND public.sgp_pdt_fuente_contexto_v2(p.key_produccion,a.key_produccion,p.produccion,a.sistema,p.reserva,a.acabado) AND a.activo='SI' AND a.tipo_pieza='PANEL'
 AND (nullif(btrim(coalesce(p.acabado_pendiente,'')),'') IS NULL OR upper(btrim(a.acabado))=upper(btrim(p.acabado_pendiente)))
 AND upper(btrim(a.sistema))=upper(btrim(prod.sistema)) AND btrim(a.codigo_sap)=btrim(p.perfil)),'[]'::jsonb);
END $function$
;
-- SOURCE_READER_END
CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_validar_detalles_v1(p_token text, p_id uuid, p_detalles jsonb, p_reserva text DEFAULT NULL::text, p_observacion text DEFAULT NULL::text)
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
  IF nullif(btrim(v_p.key_produccion),'') IS NULL THEN RAISE EXCEPTION 'Identidad producción no resuelta'; END IF;
  SELECT count(*) INTO v_source FROM public.sgp_aluminio a
   JOIN public.sgp_producciones prod ON prod.key_produccion=a.key_produccion
   WHERE a.id_pieza=v_key AND a.activo='SI' AND a.tipo_pieza='PANEL'
     AND btrim(a.produccion)=btrim(v_p.produccion)
     AND public.sgp_pdt_fuente_contexto_v2(v_p.key_produccion,a.key_produccion,v_p.produccion,a.sistema,coalesce(nullif(btrim(p_reserva),''),v_p.reserva),a.acabado)
     AND (nullif(btrim(coalesce(v_p.acabado_pendiente,'')),'') IS NULL OR upper(btrim(a.acabado))=upper(btrim(v_p.acabado_pendiente)))
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
END $function$
;

-- The Picking event must accept the SAME proven cross-line context, using the
-- immutable saved source snapshot, never a current reimported aluminum row.
DO $picking_guard$
DECLARE signature regprocedure:='public.sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'::regprocedure;
 original record; after_record record; definition text;
 needle text:=$needle$AND f.snapshot->>'key_produccion'=p.key_produccion$needle$;
 replacement text:=$replacement$AND public.sgp_pdt_fuente_contexto_v2(p.key_produccion,f.snapshot->>'key_produccion',p.produccion,f.snapshot->>'sistema',p.reserva,d.acabado)$replacement$;
BEGIN
 SELECT proowner,proacl,prosecdef,proconfig INTO original FROM pg_proc WHERE oid=signature;
 definition:=pg_get_functiondef(signature);
 IF array_length(string_to_array(definition,needle),1)<>2 THEN RAISE EXCEPTION 'PDT_SOURCE: unknown Picking predicate'; END IF;
 EXECUTE replace(definition,needle,replacement);
 SELECT proowner,proacl,prosecdef,proconfig INTO after_record FROM pg_proc WHERE oid=signature;
 IF after_record IS DISTINCT FROM original THEN RAISE EXCEPTION 'PDT_SOURCE: Picking metadata changed'; END IF;
END $picking_guard$;
NOTIFY pgrst, 'reload schema';
COMMIT;

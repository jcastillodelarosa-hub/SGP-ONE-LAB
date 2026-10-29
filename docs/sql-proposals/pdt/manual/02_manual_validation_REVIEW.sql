-- REVIEW ONLY. Integration order: grouped-source #139, manual 01, then manual 02.
-- Never run against production without compatible restored-backup tests and approval.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$ BEGIN
 IF to_regclass('sgp_pdt_manual.reportes') IS NULL OR to_regclass('sgp_pdt_manual.detalles') IS NULL
 OR to_regprocedure('public.sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)') IS NULL
 OR to_regprocedure('public.sgp_pdt_origenes_internal_v3(text,text,text,text,text)') IS NULL
 THEN RAISE EXCEPTION 'PDT_MANUAL_PHASE1_OR_VALIDATOR_MISSING'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)'::regprocedure)
 IS DISTINCT FROM 'e63bd39e5c7cb891a7834e8c30eef428'
 THEN RAISE EXCEPTION 'PDT_MANUAL_VALIDATOR_BODY_CHANGED'; END IF;
 IF to_regprocedure('sgp_pdt_multiorigen.grouped_original_validar(text,uuid,jsonb,text,text)') IS NULL
 OR to_regprocedure('sgp_pdt_multiorigen.grouped_nuevo_validar(text,uuid,jsonb,text,text)') IS NULL
 THEN RAISE EXCEPTION 'PDT_GROUPED_VALIDATOR_NOT_INSTALLED'; END IF;
 IF EXISTS(SELECT 1 FROM sgp_pdt_manual.detalles md JOIN public.sgp_aluminio_pendientes p USING(id_pendiente)
  WHERE p.validacion_estado='VALIDADO' OR EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d WHERE d.id_pendiente=md.id_pendiente))
 THEN RAISE EXCEPTION 'PDT_MANUAL_ALREADY_VALIDATED_OR_UNEXPECTED_DETAILS'; END IF;
END $preflight$;

-- The report, original detail and original source snapshots are append-only.
CREATE FUNCTION sgp_pdt_manual.proteger_original() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'PDT_MANUAL_ORIGINAL_IMMUTABLE'; END IF;
 IF TG_TABLE_NAME='reportes' AND OLD.respuesta='{}'::jsonb AND NEW.respuesta<>'{}'::jsonb
 AND (to_jsonb(NEW)-'respuesta')=(to_jsonb(OLD)-'respuesta') THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'PDT_MANUAL_ORIGINAL_IMMUTABLE';
END $fn$;
CREATE TRIGGER trg_pdt_manual_report_original BEFORE UPDATE OR DELETE ON sgp_pdt_manual.reportes
 FOR EACH ROW EXECUTE FUNCTION sgp_pdt_manual.proteger_original();
CREATE TRIGGER trg_pdt_manual_detail_original BEFORE UPDATE OR DELETE ON sgp_pdt_manual.detalles
 FOR EACH ROW EXECUTE FUNCTION sgp_pdt_manual.proteger_original();
CREATE TRIGGER trg_pdt_manual_source_original BEFORE UPDATE OR DELETE ON sgp_pdt_manual.fuentes
 FOR EACH ROW EXECUTE FUNCTION sgp_pdt_manual.proteger_original();
CREATE TABLE sgp_pdt_manual.fuentes_validadas(
 id_detalle uuid NOT NULL REFERENCES public.sgp_aluminio_pendiente_detalles(id_detalle),
 id_pieza text NOT NULL, snapshot jsonb NOT NULL, PRIMARY KEY(id_detalle,id_pieza)
);
REVOKE ALL ON sgp_pdt_manual.fuentes_validadas FROM PUBLIC,anon,authenticated;
CREATE TABLE sgp_pdt_manual.funcion_previa(firma text PRIMARY KEY, definicion text NOT NULL);
REVOKE ALL ON sgp_pdt_manual.funcion_previa FROM PUBLIC,anon,authenticated;
INSERT INTO sgp_pdt_manual.funcion_previa VALUES(
 'public.sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)',
 pg_get_functiondef('public.sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)'::regprocedure));
DO $clone$ DECLARE original text; BEGIN
 SELECT definicion INTO STRICT original FROM sgp_pdt_manual.funcion_previa;
 EXECUTE replace(original,'FUNCTION public.sgp_aluminio_pendiente_validar_detalles_v1(',
  'FUNCTION sgp_pdt_manual.original_validar(');
END $clone$;
REVOKE ALL ON FUNCTION sgp_pdt_manual.original_validar(text,uuid,jsonb,text,text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.sgp_pdt_manual_ids_v1(p_token text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 PERFORM public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION','LIDER LINEA','LIDER MECANIZADO','LIDER','PICKING','SUPERVISOR DE PICKING','PATINADOR','CONSULTA']);
 RETURN jsonb_build_object('ok',true,'ids',coalesce((SELECT jsonb_agg(md.id_pendiente) FROM sgp_pdt_manual.detalles md),'[]'::jsonb));
END $fn$;

CREATE FUNCTION public.sgp_pdt_manual_fuentes_validacion_v1(p_token text,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE original record; options jsonb;
BEGIN
 PERFORM public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION','LIDER LINEA','SUPERVISOR DE PICKING']);
 SELECT md.*,r.key_produccion,r.produccion,r.reserva,r.acabado AS acabado_reporte,p.validacion_estado
 INTO STRICT original FROM sgp_pdt_manual.detalles md JOIN sgp_pdt_manual.reportes r USING(id_reporte)
 JOIN public.sgp_aluminio_pendientes p USING(id_pendiente) WHERE md.id_pendiente=p_id;
 IF original.validacion_estado='VALIDADO' THEN RAISE EXCEPTION 'PDT_MANUAL_YA_VALIDADO'; END IF;
 SELECT coalesce(jsonb_agg(x ORDER BY x->>'fabricacion',x->>'longitud',x->>'id_pieza'),'[]'::jsonb) INTO options
 FROM (SELECT DISTINCT x FROM public.sgp_pdt_origenes_internal_v3(original.reserva,original.perfil,original.produccion,original.acabado_reporte,NULL) x
  WHERE x->>'key_produccion'=original.key_produccion AND x->>'reserva'=original.reserva
  AND x->>'codigo_sap'=original.perfil AND x->>'tipo_pieza'='PANEL' AND x->>'id_linea'='PANELES_2' LIMIT 1001) q;
 IF jsonb_array_length(options)>1000 THEN RAISE EXCEPTION 'PDT_MANUAL_FUENTES_EXCEDEN_LIMITE'; END IF;
 RETURN jsonb_build_object('ok',true,'original',jsonb_build_object('perfil',original.perfil,'fabricacion',original.fabricacion,
  'marca',original.marca,'longitud',original.longitud,'acabado',original.acabado,'cantidad',original.cantidad,
  'observacion',original.observacion,'nc',original.nc),'fuentes',options);
END $fn$;

CREATE FUNCTION sgp_pdt_manual.validar(p_token text,p_id uuid,p_detalles jsonb,p_reserva text,p_observacion text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE actor text; original record; pending public.sgp_aluminio_pendientes%rowtype;
 row jsonb; src jsonb; sources jsonb; detail uuid; source_count integer; reference_total numeric;
 total bigint:=0; count_rows integer:=0; corrected boolean; first_row jsonb; seen text[]:=array[]::text[]; key text;
BEGIN
 actor:=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION','LIDER LINEA','SUPERVISOR DE PICKING']);
 SELECT * INTO STRICT pending FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id FOR UPDATE;
 SELECT md.*,r.key_produccion,r.produccion,r.reserva,r.acabado AS acabado_reporte
 INTO STRICT original FROM sgp_pdt_manual.detalles md JOIN sgp_pdt_manual.reportes r USING(id_reporte)
 WHERE md.id_pendiente=p_id;
 IF p_reserva IS DISTINCT FROM original.reserva OR pending.contrato_pdt<>'V2' OR pending.estado<>'PENDIENTE'
 OR pending.fecha_cierre IS NOT NULL OR pending.validacion_estado<>'POR_VALIDAR'
 OR coalesce(pending.estado_repo,'PENDIENTE')='PICKING'
 OR EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_movimientos WHERE id_pendiente=p_id)
 OR EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=p_id)
 THEN RAISE EXCEPTION 'PDT_MANUAL_NO_APTO_PARA_VALIDAR'; END IF;
 IF jsonb_typeof(p_detalles) IS DISTINCT FROM 'array' OR jsonb_array_length(p_detalles) NOT BETWEEN 1 AND 100
 THEN RAISE EXCEPTION 'PDT_MANUAL_DETALLES_INVALIDOS'; END IF;
 sources:=public.sgp_pdt_manual_fuentes_validacion_v1(p_token,p_id)->'fuentes';
 FOR row IN SELECT value FROM jsonb_array_elements(p_detalles) LOOP
  count_rows:=count_rows+1;
  IF nullif(btrim(row->>'fabricacion'),'') IS NULL OR nullif(btrim(row->>'acabado'),'') IS NULL
  OR row->>'longitud' !~ '^[0-9]+([.][0-9]+)?$' OR row->>'cantidad' !~ '^[0-9]+$'
  OR length(row->>'cantidad')>10 OR (row->>'cantidad')::numeric>2147483647
  OR (row->>'longitud')::numeric<=0 OR (row->>'cantidad')::integer<=0
  OR nullif(row->>'id_pieza','') IS NOT NULL
  THEN RAISE EXCEPTION 'PDT_MANUAL_DETALLE_INVALIDO'; END IF;
  IF row->>'perfil' IS NOT NULL AND row->>'perfil'<>original.perfil THEN RAISE EXCEPTION 'PDT_MANUAL_REFERENCIA_INMUTABLE'; END IF;
  IF upper(btrim(row->>'acabado'))<>upper(btrim(original.acabado_reporte)) THEN RAISE EXCEPTION 'PDT_MANUAL_ACABADO_AJENO'; END IF;
  key:=lower(btrim(row->>'fabricacion'))||'|'||(row->>'longitud')::numeric::text||'|'||upper(btrim(row->>'acabado'))||'|'||lower(btrim(coalesce(row->>'marca','')));
  IF key=ANY(seen) THEN RAISE EXCEPTION 'PDT_MANUAL_COMBINACION_REPETIDA'; END IF;
  seen:=array_append(seen,key);
  SELECT count(*),coalesce(sum(m.cantidad),0) INTO source_count,reference_total FROM (
   SELECT DISTINCT ON (x->>'id_pieza') x->>'id_pieza' id_pieza,(x->>'cantidad_referencia')::numeric cantidad
   FROM jsonb_array_elements(sources) x WHERE lower(btrim(x->>'fabricacion'))=lower(btrim(row->>'fabricacion'))
   AND (x->>'longitud')::numeric=(row->>'longitud')::numeric
   AND lower(btrim(coalesce(x->>'marca','')))=lower(btrim(coalesce(row->>'marca','')))
   AND upper(btrim(x->>'acabado'))=upper(btrim(row->>'acabado'))
  ) m;
  IF source_count<1 OR (row->>'cantidad')::integer>reference_total THEN RAISE EXCEPTION 'PDT_MANUAL_FUENTE_O_CANTIDAD_INVALIDA'; END IF;
  total:=total+(row->>'cantidad')::integer;
  IF total>2147483647 THEN RAISE EXCEPTION 'PDT_MANUAL_TOTAL_FUERA_DE_RANGO'; END IF;
  IF count_rows=1 THEN first_row:=row; END IF;
 END LOOP;
 corrected:=count_rows<>1 OR total<>original.cantidad
  OR lower(btrim(first_row->>'fabricacion'))<>lower(btrim(original.fabricacion))
  OR (first_row->>'longitud')::numeric<>original.longitud
  OR lower(btrim(coalesce(first_row->>'marca','')))<>lower(btrim(coalesce(original.marca,'')))
  OR upper(btrim(first_row->>'acabado'))<>upper(btrim(original.acabado));
 IF corrected AND nullif(btrim(coalesce(p_observacion,'')),'') IS NULL
 THEN RAISE EXCEPTION 'PDT_MANUAL_CORRECCION_REQUIERE_OBSERVACION'; END IF;
 FOR row IN SELECT value FROM jsonb_array_elements(p_detalles) LOOP
  INSERT INTO public.sgp_aluminio_pendiente_detalles(id_pendiente,id_pieza,fabricacion,longitud,acabado,cantidad_validada,creado_por)
  VALUES(p_id,'',btrim(row->>'fabricacion'),(row->>'longitud')::numeric,btrim(row->>'acabado'),(row->>'cantidad')::integer,actor)
  RETURNING id_detalle INTO detail;
  FOR src IN SELECT value FROM jsonb_array_elements(sources) x WHERE lower(btrim(x.value->>'fabricacion'))=lower(btrim(row->>'fabricacion'))
   AND (x.value->>'longitud')::numeric=(row->>'longitud')::numeric
   AND lower(btrim(coalesce(x.value->>'marca','')))=lower(btrim(coalesce(row->>'marca','')))
   AND upper(btrim(x.value->>'acabado'))=upper(btrim(row->>'acabado')) LOOP
   INSERT INTO sgp_pdt_manual.fuentes_validadas(id_detalle,id_pieza,snapshot)
   VALUES(detail,src->>'id_pieza',src) ON CONFLICT DO NOTHING;
  END LOOP;
 END LOOP;
 UPDATE public.sgp_aluminio_pendientes SET validacion_estado='VALIDADO',validado_por=actor,
  fecha_validacion=now(),observacion_validacion=nullif(btrim(p_observacion),''),
  fabricacion=btrim(first_row->>'fabricacion'),longitud=(first_row->>'longitud')::numeric
 WHERE id_pendiente=p_id;
 INSERT INTO public.sgp_aluminio_pendientes_historial
 (id_pendiente,usuario,observacion,estado_anterior,estado_nuevo,tipo_evento,datos_anteriores,datos_nuevos)
 VALUES(p_id,actor,p_observacion,pending.estado_repo,pending.estado_repo,'VALIDACION_MANUAL_PDT',
  jsonb_build_object('id_reporte',original.id_reporte,'perfil',original.perfil,'fabricacion',original.fabricacion,
   'marca',original.marca,'longitud',original.longitud,'acabado',original.acabado,'cantidad',original.cantidad,'nc',original.nc),
  jsonb_build_object('detalles',p_detalles,'cantidad_validada',total,'correccion',corrected));
 RETURN jsonb_build_object('ok',true,'cantidad_reportada',original.cantidad,'cantidad_validada',total,'detalles',count_rows,'correccion',corrected);
END $fn$;

CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_validar_detalles_v1(p_token text,p_id uuid,p_detalles jsonb,p_reserva text DEFAULT NULL::text,p_observacion text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $dispatch$
BEGIN
 IF EXISTS(SELECT 1 FROM sgp_pdt_manual.detalles WHERE id_pendiente=p_id)
 THEN RETURN sgp_pdt_manual.validar(p_token,p_id,p_detalles,p_reserva,p_observacion); END IF;
 RETURN sgp_pdt_manual.original_validar(p_token,p_id,p_detalles,p_reserva,p_observacion);
END $dispatch$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_pdt_manual FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sgp_pdt_manual_ids_v1(text),public.sgp_pdt_manual_fuentes_validacion_v1(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_pdt_manual_ids_v1(text),public.sgp_pdt_manual_fuentes_validacion_v1(text,uuid) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

-- REVIEW ONLY. Additive Phase 1; never apply automatically or without restored-backup preflight.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$ BEGIN
 IF current_setting('server_version_num')::int<170000 THEN RAISE EXCEPTION 'PDT_MANUAL_REQUIERE_PG17'; END IF;
 IF to_regprocedure('public.sgp_pdt_validar_rol_real(text,text[])') IS NULL
 OR to_regprocedure('public.sgp_pdt_contexto_internal_v3(text,text,text,text,text,text,text,numeric)') IS NULL
 OR to_regprocedure('public.sgp_pdt_origenes_internal_v3(text,text,text,text,text)') IS NULL
 OR to_regclass('public.sgp_produccion_reservas_v') IS NULL
 OR to_regclass('public.sgp_aluminio_pendientes') IS NULL
 THEN RAISE EXCEPTION 'PDT_MANUAL_DEPENDENCY_MISSING'; END IF;
 IF (SELECT count(*) FROM pg_attribute a WHERE a.attrelid='public.sgp_producciones'::regclass
  AND a.attname IN ('anio','semana_base','semana_actual') AND a.attnum>0 AND NOT a.attisdropped)<>3
 THEN RAISE EXCEPTION 'PDT_MANUAL_PRODUCTION_PERIOD_COLUMNS_MISSING'; END IF;
 IF to_regnamespace('sgp_pdt_manual') IS NOT NULL THEN RAISE EXCEPTION 'PDT_MANUAL_ALREADY_INSTALLED'; END IF;
END $preflight$;
CREATE SCHEMA sgp_pdt_manual;
REVOKE ALL ON SCHEMA sgp_pdt_manual FROM PUBLIC,anon,authenticated;
CREATE TABLE sgp_pdt_manual.reportes(
 id_reporte uuid PRIMARY KEY DEFAULT gen_random_uuid(), idempotency_key uuid NOT NULL UNIQUE,
 anio integer NOT NULL CHECK(anio BETWEEN 2020 AND 2100), semana integer NOT NULL CHECK(semana BETWEEN 1 AND 53),
 linea text NOT NULL CHECK(linea='PANELES_2'), key_produccion text NOT NULL,
 produccion text NOT NULL, reserva text NOT NULL, sistema text NOT NULL, acabado text NOT NULL,
 origen text NOT NULL CHECK(origen IN ('PICKING','ENSAMBLE','EMPAQUE')),
 usuario text NOT NULL, fecha timestamptz NOT NULL DEFAULT now(), observacion text,
 solicitud jsonb NOT NULL, respuesta jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX reportes_consulta_idx ON sgp_pdt_manual.reportes(anio,semana,linea,key_produccion,reserva,fecha DESC);
CREATE INDEX reportes_produccion_idx ON sgp_pdt_manual.reportes(produccion,sistema,acabado,fecha DESC);
CREATE TABLE sgp_pdt_manual.detalles(
 id_detalle uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 id_reporte uuid NOT NULL REFERENCES sgp_pdt_manual.reportes(id_reporte),
 id_pendiente uuid NOT NULL UNIQUE REFERENCES public.sgp_aluminio_pendientes(id_pendiente),
 perfil text NOT NULL, fabricacion text NOT NULL, marca text, longitud numeric NOT NULL CHECK(longitud>0),
 acabado text NOT NULL, cantidad integer NOT NULL CHECK(cantidad>0), nc text, observacion text,
 UNIQUE(id_reporte,perfil,fabricacion,marca,longitud,acabado)
);
CREATE TABLE sgp_pdt_manual.fuentes(
 id_detalle uuid NOT NULL REFERENCES sgp_pdt_manual.detalles(id_detalle),
 id_pieza text NOT NULL, snapshot jsonb NOT NULL,
 PRIMARY KEY(id_detalle,id_pieza)
);
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_pdt_manual FROM PUBLIC,anon,authenticated;

-- Current production year/week come from the same production row. The reserve
-- view establishes membership; it does not supply an authoritative year.
CREATE FUNCTION sgp_pdt_manual.programacion(p_key text,p_reserva text)
RETURNS TABLE(anio integer,semana integer,linea text,produccion text,reserva text,sistema text,acabado text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
 SELECT DISTINCT
  p.anio::integer,coalesce(p.semana_actual,p.semana_base)::integer,
  p.id_linea,p.produccion,r.reserva,p.sistema,coalesce(r.acabado_reserva,'')
 FROM public.sgp_produccion_reservas_v r JOIN public.sgp_producciones p USING(key_produccion)
 WHERE p.id_linea='PANELES_2' AND (p_key IS NULL OR r.key_produccion=p_key)
 AND (p_reserva IS NULL OR r.reserva=p_reserva);
$fn$;

CREATE FUNCTION public.sgp_pdt_manual_catalogo_v1(p_token text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE data jsonb;
BEGIN
 PERFORM public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','LIDER LINEA']);
 SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.anio DESC,p.semana DESC,p.produccion,p.reserva),'[]'::jsonb) INTO data
 FROM (SELECT * FROM sgp_pdt_manual.programacion(NULL,NULL) p WHERE p.anio IS NOT NULL AND p.semana BETWEEN 1 AND 53 AND p.acabado<>'' LIMIT 3000) p;
 RETURN jsonb_build_object('ok',true,'producciones',data);
END $fn$;

CREATE FUNCTION public.sgp_pdt_manual_fuentes_v1(p_token text,p_key_produccion text,p_reserva text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE data jsonb;
BEGIN
 PERFORM public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','LIDER LINEA']);
 IF (SELECT count(*) FROM sgp_pdt_manual.programacion(p_key_produccion,p_reserva) p WHERE p.anio IS NOT NULL AND p.semana BETWEEN 1 AND 53)<>1
 THEN RAISE EXCEPTION 'PDT_MANUAL_PROGRAMACION_AMBIGUA'; END IF;
 SELECT coalesce(jsonb_agg(x ORDER BY x->>'codigo_sap',x->>'fabricacion',x->>'longitud',x->>'id_pieza'),'[]'::jsonb) INTO data
 FROM (SELECT DISTINCT x FROM public.sgp_pdt_origenes_internal_v3(p_reserva,NULL,
  (SELECT p.produccion FROM sgp_pdt_manual.programacion(p_key_produccion,p_reserva) p LIMIT 1),NULL,NULL) x
  WHERE x->>'key_produccion'=p_key_produccion AND x->>'reserva'=p_reserva
  AND x->>'tipo_pieza'='PANEL' AND x->>'id_linea'='PANELES_2' LIMIT 1001) q;
 IF jsonb_array_length(data)>1000 THEN RAISE EXCEPTION 'PDT_MANUAL_FUENTES_EXCEDEN_LIMITE'; END IF;
 RETURN jsonb_build_object('ok',true,'fuentes',data);
END $fn$;

-- Exact NC lookup only; never infer quantity or mark a NC as resolved.
CREATE FUNCTION public.sgp_pdt_manual_nc_consultar_v1(p_token text,p_referencia text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE matches integer; data jsonb;
BEGIN
 PERFORM public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','LIDER LINEA']);
 IF nullif(btrim(p_referencia),'') IS NULL OR length(p_referencia)>120 THEN RAISE EXCEPTION 'PDT_MANUAL_NC_INVALIDA'; END IF;
 SELECT count(DISTINCT n.consecutivo) INTO matches FROM public.sgp_nc_aluminio n WHERE n.consecutivo=btrim(p_referencia) OR n.cod_nc=btrim(p_referencia);
 IF matches>1 THEN RAISE EXCEPTION 'PDT_MANUAL_NC_AMBIGUA'; END IF;
 SELECT jsonb_build_object('consecutivo',n.consecutivo,'numero',n.cod_nc,'estado',n.estado,
   'reserva_solucion',coalesce(to_jsonb(n)->>'reserva_solucion',to_jsonb(n)->>'reserva_de_solucion'),
   'activo',n.activo) INTO data FROM public.sgp_nc_aluminio n
 WHERE n.consecutivo=btrim(p_referencia) OR n.cod_nc=btrim(p_referencia) LIMIT 1;
 RETURN jsonb_build_object('ok',true,'nc',data);
END $fn$;

CREATE FUNCTION public.sgp_pdt_manual_registrar_v1(p_token text,p_origen text,p_contexto jsonb,p_detalles jsonb,p_observacion text,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE actor text; program record; sources jsonb; row jsonb; src jsonb; ctx jsonb;
 report uuid; pending uuid; detail uuid; result jsonb; ids jsonb:='[]'; quantity numeric;
 nc text; matches integer; reference_total numeric; source_count integer; signature jsonb;
BEGIN
 IF p_origen='PICKING' THEN
  actor:=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR']);
 ELSIF p_origen IN ('ENSAMBLE','EMPAQUE') THEN
  actor:=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','LIDER LINEA']);
 ELSE RAISE EXCEPTION 'PDT_MANUAL_ORIGEN_INVALIDO'; END IF;
 IF p_idempotency_key IS NULL OR jsonb_typeof(p_detalles) IS DISTINCT FROM 'array' OR jsonb_array_length(p_detalles) NOT BETWEEN 1 AND 100
 THEN RAISE EXCEPTION 'PDT_MANUAL_SOLICITUD_INVALIDA'; END IF;
 signature:=jsonb_build_object('origen',p_origen,'contexto',p_contexto,'detalles',p_detalles,'observacion',p_observacion);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key::text,0));
 SELECT r.id_reporte,r.respuesta,r.solicitud INTO report,result,ctx FROM sgp_pdt_manual.reportes r WHERE r.idempotency_key=p_idempotency_key;
 IF FOUND THEN
  IF ctx IS DISTINCT FROM signature OR (SELECT usuario FROM sgp_pdt_manual.reportes WHERE id_reporte=report)<>actor THEN RAISE EXCEPTION 'PDT_MANUAL_CLAVE_REUTILIZADA'; END IF;
  RETURN result||jsonb_build_object('duplicado',true);
 END IF;
 SELECT * INTO STRICT program FROM sgp_pdt_manual.programacion(p_contexto->>'key_produccion',p_contexto->>'reserva');
 IF program.anio IS NULL OR program.semana NOT BETWEEN 1 AND 53 OR program.acabado=''
 OR program.produccion IS DISTINCT FROM p_contexto->>'produccion'
 THEN RAISE EXCEPTION 'PDT_MANUAL_PROGRAMACION_INCOMPLETA'; END IF;
 sources:=public.sgp_pdt_manual_fuentes_v1(p_token,p_contexto->>'key_produccion',p_contexto->>'reserva')->'fuentes';
 INSERT INTO sgp_pdt_manual.reportes(idempotency_key,anio,semana,linea,key_produccion,produccion,reserva,sistema,acabado,origen,usuario,observacion,solicitud)
 VALUES(p_idempotency_key,program.anio,program.semana,program.linea,p_contexto->>'key_produccion',program.produccion,program.reserva,program.sistema,program.acabado,p_origen,actor,nullif(btrim(p_observacion),''),signature)
 RETURNING id_reporte INTO report;
 FOR row IN SELECT value FROM jsonb_array_elements(p_detalles) LOOP
  quantity:=nullif(row->>'cantidad','')::numeric;nc:=nullif(btrim(row->>'nc'),'');
  IF quantity IS NULL OR quantity<>trunc(quantity) OR quantity<1 OR quantity>2147483647 OR length(coalesce(nc,''))>120 OR coalesce(nc,'')~'[[:cntrl:]]'
  THEN RAISE EXCEPTION 'PDT_MANUAL_CANTIDAD_NC_INVALIDA'; END IF;
  SELECT count(*),coalesce(sum(m.cantidad),0) INTO source_count,reference_total FROM (
   SELECT DISTINCT ON (x->>'id_pieza') x->>'id_pieza' id_pieza,(x->>'cantidad_referencia')::numeric cantidad
   FROM jsonb_array_elements(sources) x
   WHERE x->>'codigo_sap'=row->>'perfil' AND lower(btrim(x->>'fabricacion'))=lower(btrim(row->>'fabricacion'))
   AND lower(btrim(coalesce(x->>'marca','')))=lower(btrim(coalesce(row->>'marca','')))
   AND (x->>'longitud')::numeric=(row->>'longitud')::numeric AND upper(btrim(x->>'acabado'))=upper(btrim(row->>'acabado'))
  ) m;
  IF source_count<1 OR quantity>reference_total OR upper(btrim(row->>'acabado'))<>upper(btrim(program.acabado))
  THEN RAISE EXCEPTION 'PDT_MANUAL_FUENTE_O_CANTIDAD_INVALIDA'; END IF;
  IF EXISTS(SELECT 1 FROM sgp_pdt_manual.detalles d WHERE d.id_reporte=report
   AND d.perfil=row->>'perfil' AND lower(btrim(d.fabricacion))=lower(btrim(row->>'fabricacion'))
   AND lower(btrim(coalesce(d.marca,'')))=lower(btrim(coalesce(row->>'marca','')))
   AND d.longitud=(row->>'longitud')::numeric AND upper(btrim(d.acabado))=upper(btrim(row->>'acabado')))
  THEN RAISE EXCEPTION 'PDT_MANUAL_DETALLE_REPETIDO'; END IF;
  ctx:=public.sgp_pdt_contexto_internal_v3(program.reserva,row->>'perfil',program.produccion,row->>'acabado',NULL,p_contexto->>'key_produccion',NULL,(row->>'longitud')::numeric);
  INSERT INTO public.sgp_aluminio_pendientes(reserva,reserva_principal,key_produccion,es_reserva_compartida,acabado_pendiente,produccion,perfil,cantidad,longitud,origen,causa,observacion,usuario_reporte,id_pieza,marca,fabricacion,nc,contrato_pdt)
  VALUES(ctx->>'reserva',ctx->>'reserva_principal',ctx->>'key_produccion',coalesce((ctx->>'es_reserva_compartida')::boolean,false),ctx->>'acabado',ctx->>'produccion',row->>'perfil',quantity,(row->>'longitud')::numeric,p_origen,'REGISTRO_MANUAL',nullif(btrim(row->>'observacion'),''),actor,NULL,row->>'marca',row->>'fabricacion',nc,'V2') RETURNING id_pendiente INTO pending;
  INSERT INTO sgp_pdt_manual.detalles(id_reporte,id_pendiente,perfil,fabricacion,marca,longitud,acabado,cantidad,nc,observacion)
  VALUES(report,pending,row->>'perfil',row->>'fabricacion',row->>'marca',(row->>'longitud')::numeric,row->>'acabado',quantity::integer,nc,nullif(btrim(row->>'observacion'),'')) RETURNING id_detalle INTO detail;
  FOR src IN SELECT value FROM jsonb_array_elements(sources) x WHERE x.value->>'codigo_sap'=row->>'perfil'
   AND lower(btrim(x.value->>'fabricacion'))=lower(btrim(row->>'fabricacion'))
   AND lower(btrim(coalesce(x.value->>'marca','')))=lower(btrim(coalesce(row->>'marca','')))
   AND (x.value->>'longitud')::numeric=(row->>'longitud')::numeric
   AND upper(btrim(x.value->>'acabado'))=upper(btrim(row->>'acabado')) LOOP
   INSERT INTO sgp_pdt_manual.fuentes(id_detalle,id_pieza,snapshot) VALUES(detail,src->>'id_pieza',src) ON CONFLICT DO NOTHING;
  END LOOP;
  IF nc IS NOT NULL THEN
   SELECT count(DISTINCT n.consecutivo) INTO matches FROM public.sgp_nc_aluminio n WHERE n.consecutivo=nc OR n.cod_nc=nc;
   IF matches>1 THEN RAISE EXCEPTION 'PDT_MANUAL_NC_AMBIGUA'; END IF;
   IF matches=0 THEN RAISE EXCEPTION 'PDT_MANUAL_NC_NO_ENCONTRADA'; END IF;
   INSERT INTO public.sgp_aluminio_pendiente_ncs(id_pendiente,consecutivo,enlazado_por,snapshot)
   SELECT pending,n.consecutivo,actor,to_jsonb(n) FROM public.sgp_nc_aluminio n WHERE n.consecutivo=nc OR n.cod_nc=nc LIMIT 1;
  END IF;
  INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,estado_anterior,estado_nuevo,tipo_evento,datos_nuevos)
  VALUES(pending,actor,NULL,'PENDIENTE','REGISTRO_MANUAL_V1',jsonb_build_object('id_reporte',report,'origen',p_origen,'fuentes',source_count,'cantidad',quantity));
  ids:=ids||jsonb_build_array(pending);
 END LOOP;
 result:=jsonb_build_object('ok',true,'id_reporte',report,'ids_pendientes',ids);
 UPDATE sgp_pdt_manual.reportes SET respuesta=result WHERE id_reporte=report;
 RETURN result;
END $fn$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_pdt_manual FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sgp_pdt_manual_catalogo_v1(text),public.sgp_pdt_manual_fuentes_v1(text,text,text),public.sgp_pdt_manual_nc_consultar_v1(text,text),public.sgp_pdt_manual_registrar_v1(text,text,jsonb,jsonb,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_pdt_manual_catalogo_v1(text),public.sgp_pdt_manual_fuentes_v1(text,text,text),public.sgp_pdt_manual_nc_consultar_v1(text,text),public.sgp_pdt_manual_registrar_v1(text,text,jsonb,jsonb,text,uuid) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

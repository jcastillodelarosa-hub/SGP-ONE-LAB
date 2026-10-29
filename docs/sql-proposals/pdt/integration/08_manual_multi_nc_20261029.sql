-- PDT manual: multiple NC links per pending, legacy nc still supported.
CREATE OR REPLACE FUNCTION public.sgp_pdt_manual_registrar_v1(p_token text, p_origen text, p_contexto jsonb, p_detalles jsonb, p_observacion text, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  IF row ? 'ncs' THEN
   IF jsonb_typeof(row->'ncs') <> 'array' OR jsonb_array_length(row->'ncs')>20 THEN RAISE EXCEPTION 'PDT_MANUAL_NCS_INVALIDAS'; END IF;
   IF (SELECT count(*)<>count(DISTINCT btrim(value #>> '{}')) FROM jsonb_array_elements(row->'ncs') WHERE btrim(value #>> '{}')<>'') THEN RAISE EXCEPTION 'PDT_MANUAL_NCS_DUPLICADAS'; END IF;
  END IF;
  FOR src IN SELECT value FROM jsonb_array_elements(CASE WHEN row ? 'ncs' THEN row->'ncs' ELSE CASE WHEN nc IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(nc) END END) LOOP
   IF jsonb_typeof(src)<>'string' OR length(btrim(src #>> '{}'))>120 OR btrim(src #>> '{}')~'[[:cntrl:]]' THEN RAISE EXCEPTION 'PDT_MANUAL_NC_INVALIDA'; END IF;
   IF btrim(src #>> '{}')='' THEN CONTINUE; END IF;
   SELECT count(DISTINCT n.consecutivo) INTO matches FROM public.sgp_nc_aluminio n WHERE n.consecutivo=btrim(src #>> '{}') OR n.cod_nc=btrim(src #>> '{}');
   IF matches>1 THEN RAISE EXCEPTION 'PDT_MANUAL_NC_AMBIGUA'; END IF;
   IF matches=0 THEN RAISE EXCEPTION 'PDT_MANUAL_NC_NO_ENCONTRADA'; END IF;
   INSERT INTO public.sgp_aluminio_pendiente_ncs(id_pendiente,consecutivo,enlazado_por,snapshot)
   SELECT pending,n.consecutivo,actor,to_jsonb(n) FROM public.sgp_nc_aluminio n WHERE n.consecutivo=btrim(src #>> '{}') OR n.cod_nc=btrim(src #>> '{}') LIMIT 1;
  END LOOP;
  INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,estado_anterior,estado_nuevo,tipo_evento,datos_nuevos)
  VALUES(pending,actor,NULL,'PENDIENTE','REGISTRO_MANUAL_V1',jsonb_build_object('id_reporte',report,'origen',p_origen,'fuentes',source_count,'cantidad',quantity));
  ids:=ids||jsonb_build_array(pending);
 END LOOP;
 result:=jsonb_build_object('ok',true,'id_reporte',report,'ids_pendientes',ids);
 UPDATE sgp_pdt_manual.reportes SET respuesta=result WHERE id_reporte=report;
 RETURN result;
END $function$

NOTIFY pgrst, 'reload schema';

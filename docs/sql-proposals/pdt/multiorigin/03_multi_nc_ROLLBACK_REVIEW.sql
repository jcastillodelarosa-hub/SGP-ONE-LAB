-- REVIEW ONLY. Roll back the V4 registrar body before multi-NC use.
-- Never delete PDTs, deliveries, events, history or NC links.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $rollback$ BEGIN
 IF to_regprocedure('sgp_pdt_multiorigen.registrar(text,text,jsonb,jsonb,uuid,uuid)') IS NULL
 OR (SELECT md5(replace(prosrc,E'\r\n',E'\n')) FROM pg_proc
     WHERE oid='sgp_pdt_multiorigen.registrar(text,text,jsonb,jsonb,uuid,uuid)'::regprocedure)<>'c0af642cc10c1d391cc30d6f28b611c8'
 THEN RAISE EXCEPTION 'PDT_MULTI_NC_ROLLBACK_DEFINICION_CAMBIADA'; END IF;
 IF EXISTS(SELECT 1 FROM sgp_pdt_multiorigen.eventos e
  CROSS JOIN LATERAL jsonb_array_elements(e.solicitud->'piezas') p
  WHERE jsonb_typeof(p.value->'ncs')='array' AND jsonb_array_length(p.value->'ncs')>1)
 THEN RAISE EXCEPTION 'PDT_MULTI_NC_ROLLBACK_REQUIERE_FORWARD_REPAIR'; END IF;
END $rollback$;
CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.registrar(p_token text,p_origen text,p_contexto jsonb,p_piezas jsonb,p_evento uuid,p_entrega uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE actor text; sources jsonb; row jsonb; source jsonb; ctx jsonb; id uuid; ids jsonb:='[]'; n integer; quantity numeric; nc text; snap jsonb; matches integer;
BEGIN
 actor:=sgp_pdt_multiorigen.actor(p_token,p_origen);
 IF jsonb_typeof(p_piezas) IS DISTINCT FROM 'array' OR jsonb_array_length(p_piezas) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'PDT_PIEZAS_REQUERIDAS'; END IF;
 IF (SELECT count(DISTINCT jsonb_build_array(x->>'id_pieza',x->>'key_produccion',x->>'reserva')) FROM jsonb_array_elements(p_piezas) x)<>jsonb_array_length(p_piezas) THEN RAISE EXCEPTION 'PDT_PIEZA_REPETIDA_EN_EVENTO'; END IF;
 sources:=sgp_pdt_multiorigen.fuentes(p_token,p_origen,p_contexto);
 FOR row IN SELECT value FROM jsonb_array_elements(p_piezas) LOOP
 IF nullif(row->>'id_pieza','') IS NULL OR nullif(row->>'key_produccion','') IS NULL OR nullif(row->>'reserva','') IS NULL THEN RAISE EXCEPTION 'PDT_IDENTIDAD_REQUERIDA'; END IF;
 SELECT count(*),jsonb_agg(x)->0 INTO n,source FROM jsonb_array_elements(sources) x
 WHERE x->>'id_pieza'=row->>'id_pieza' AND x->>'key_produccion'=row->>'key_produccion' AND x->>'reserva'=row->>'reserva'
 AND x->>'codigo_sap'=row->>'perfil' AND x->>'fabricacion' IS NOT DISTINCT FROM row->>'fabricacion'
 AND (x->>'longitud')::numeric=(row->>'longitud')::numeric
 AND x->>'acabado'=row->>'acabado';
 IF n<>1 THEN RAISE EXCEPTION 'PDT_PIEZA_NO_CORRESPONDE_AL_CONTEXTO'; END IF;
 -- Locks prevent a concurrent source/master/relationship edit from silently
 -- changing the identity during the transaction (the view relations are asserted
 -- again by the strict identity trigger on INSERT).
 PERFORM 1 FROM public.sgp_aluminio WHERE id_pieza=row->>'id_pieza' FOR SHARE;
 PERFORM 1 FROM public.sgp_maestro_piezas WHERE codigo_sap=row->>'perfil' FOR SHARE;
 PERFORM 1 FROM public.sgp_producciones WHERE key_produccion=row->>'key_produccion' FOR SHARE;
 ctx:=public.sgp_pdt_contexto_internal_v3(row->>'reserva',row->>'perfil',p_contexto->>'produccion',row->>'acabado',row->>'id_pieza',row->>'key_produccion',row->>'reserva_principal',(row->>'longitud')::numeric);
 SELECT ctx||jsonb_build_object('id_carga',a.id_carga,'fila_origen',a.fila_origen) INTO ctx FROM public.sgp_aluminio a WHERE a.id_pieza=row->>'id_pieza';
 quantity:=(row->>'cantidad')::numeric; nc:=nullif(btrim(row->>'nc'),'');
 IF quantity IS NULL OR quantity<=0 OR quantity<>trunc(quantity) OR quantity>2147483647 OR (SELECT cantidad FROM public.sgp_aluminio WHERE id_pieza=row->>'id_pieza') IS NULL OR quantity>(SELECT cantidad FROM public.sgp_aluminio WHERE id_pieza=row->>'id_pieza') THEN RAISE EXCEPTION 'PDT_CANTIDAD_INVALIDA'; END IF;
 IF p_origen IN ('ENSAMBLE','EMPAQUE') AND nc IS NULL THEN RAISE EXCEPTION 'PDT_NC_OBLIGATORIA'; END IF;
 IF nc IS NOT NULL AND (length(nc)>120 OR nc~'[[:cntrl:]]') THEN RAISE EXCEPTION 'PDT_NC_INVALIDA'; END IF;
 INSERT INTO public.sgp_aluminio_pendientes(reserva,reserva_principal,key_produccion,es_reserva_compartida,acabado_pendiente,produccion,perfil,cantidad,longitud,origen,causa,observacion,usuario_reporte,id_pieza,marca,fabricacion,nc,contrato_pdt)
 VALUES(ctx->>'reserva',ctx->>'reserva_principal',ctx->>'key_produccion',coalesce((ctx->>'es_reserva_compartida')::boolean,false),ctx->>'acabado',ctx->>'produccion',row->>'perfil',quantity,(ctx->>'longitud')::numeric,p_origen,CASE p_origen WHEN 'PICKING' THEN 'FALTANTE_ENTREGA' ELSE 'DANO_'||p_origen END,nullif(btrim(row->>'observacion'),''),actor,ctx->>'id_pieza',ctx->>'marca',ctx->>'fabricacion',nc,'V2') RETURNING id_pendiente INTO id;
 INSERT INTO sgp_pdt_multiorigen.detalles VALUES(id,p_evento,p_entrega,ctx);
 IF nc IS NOT NULL THEN
 SELECT count(DISTINCT consecutivo) INTO matches FROM public.sgp_nc_aluminio WHERE consecutivo=nc OR cod_nc=nc;
 IF matches>1 THEN RAISE EXCEPTION 'PDT_NC_AMBIGUA'; END IF;
 IF matches=1 THEN
 SELECT to_jsonb(c) INTO snap FROM public.sgp_nc_aluminio c WHERE consecutivo=nc OR cod_nc=nc ORDER BY fecha_actualizacion DESC NULLS LAST,creacion DESC NULLS LAST LIMIT 1;
 INSERT INTO public.sgp_aluminio_pendiente_ncs(id_pendiente,consecutivo,enlazado_por,snapshot) VALUES(id,snap->>'consecutivo',actor,snap);
 END IF;
 END IF;
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,estado_anterior,estado_nuevo,tipo_evento,datos_nuevos)
 VALUES(id,actor,NULL,'PENDIENTE','REGISTRO_MULTIORIGEN_V4',jsonb_build_object('origen',p_origen,'id_evento',p_evento,'id_entrega',p_entrega,'fuente',ctx,'nc',nc));
 ids:=ids||jsonb_build_array(id);
 END LOOP;
 RETURN jsonb_build_object('ok',true,'contract_version',4,'ids_pendientes',ids);
END $fn$;
DO $post$ BEGIN
 IF (SELECT md5(replace(prosrc,E'\r\n',E'\n')) FROM pg_proc
     WHERE oid='sgp_pdt_multiorigen.registrar(text,text,jsonb,jsonb,uuid,uuid)'::regprocedure)<>'ec01e6f39c131b55c4b0c021d48124f3'
 THEN RAISE EXCEPTION 'PDT_MULTI_NC_ROLLBACK_POSTCHECK_FAILED'; END IF;
END $post$;
NOTIFY pgrst,'reload schema';
COMMIT;

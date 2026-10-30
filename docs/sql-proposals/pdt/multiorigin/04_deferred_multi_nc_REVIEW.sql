-- Corrective migration for deferred multi-NC references. No data rewrite or grants.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $pre$ BEGIN
 IF current_setting('server_version_num')::int<170000
 OR to_regprocedure('sgp_pdt_multiorigen.registrar(text,text,jsonb,jsonb,uuid,uuid)') IS NULL
 OR to_regprocedure('public.sgp_aluminio_pendientes_listar_v2(text,boolean)') IS NULL
 THEN RAISE EXCEPTION 'PDT_NC_DIFERIDA_DEPENDENCIA'; END IF;
 IF (SELECT md5(replace(prosrc,E'\r\n',E'\n')) FROM pg_proc WHERE oid='sgp_pdt_multiorigen.registrar(text,text,jsonb,jsonb,uuid,uuid)'::regprocedure)<>'c0af642cc10c1d391cc30d6f28b611c8'
 OR (SELECT md5(replace(prosrc,E'\r\n',E'\n')) FROM pg_proc WHERE oid='public.sgp_aluminio_pendientes_listar_v2(text,boolean)'::regprocedure)<>'e3e05984d915b2c3a1f55226719204d0'
 THEN RAISE EXCEPTION 'PDT_NC_DIFERIDA_DEFINICION_CAMBIADA'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='sgp_pdt_multiorigen.registrar(text,text,jsonb,jsonb,uuid,uuid)'::regprocedure AND p.prosecdef AND p.proconfig=ARRAY['search_path=""']::text[] AND NOT has_function_privilege('anon',p.oid,'EXECUTE') AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE'))
 OR NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.sgp_aluminio_pendientes_listar_v2(text,boolean)'::regprocedure AND p.prosecdef AND p.proconfig=ARRAY['search_path=""']::text[] AND has_function_privilege('anon',p.oid,'EXECUTE') AND has_function_privilege('authenticated',p.oid,'EXECUTE'))
 THEN RAISE EXCEPTION 'PDT_NC_DIFERIDA_SEGURIDAD_CAMBIADA'; END IF;
END $pre$;
CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.registrar(p_token text,p_origen text,p_contexto jsonb,p_piezas jsonb,p_evento uuid,p_entrega uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE actor text; sources jsonb; row jsonb; source jsonb; ctx jsonb; id uuid; ids jsonb:='[]'; n integer; quantity numeric; nc text; snap jsonb; matches integer; ncs jsonb; nc_item jsonb; raw_nc text; seen_raw text[]; seen_links text[];
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
 IF row ? 'ncs' THEN
  IF p_origen<>'PICKING' OR jsonb_typeof(row->'ncs') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'PDT_NCS_INVALIDAS'; END IF;
  IF jsonb_array_length(row->'ncs')>20 THEN RAISE EXCEPTION 'PDT_NCS_INVALIDAS'; END IF;
  ncs:=row->'ncs';
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(ncs) x
   WHERE jsonb_typeof(x.value)<>'string' OR btrim(x.value #>> '{}')=''
   OR length(btrim(x.value #>> '{}'))>120 OR btrim(x.value #>> '{}')~'[[:cntrl:]]')
  THEN RAISE EXCEPTION 'PDT_NC_INVALIDA'; END IF;
  IF (jsonb_array_length(ncs)=0 AND nc IS NOT NULL)
   OR (jsonb_array_length(ncs)>0 AND nc IS DISTINCT FROM btrim(ncs->>0))
  THEN RAISE EXCEPTION 'PDT_NC_PRINCIPAL_NO_COINCIDE'; END IF;
 ELSE
  ncs:=CASE WHEN nc IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(nc) END;
 END IF;
 INSERT INTO public.sgp_aluminio_pendientes(reserva,reserva_principal,key_produccion,es_reserva_compartida,acabado_pendiente,produccion,perfil,cantidad,longitud,origen,causa,observacion,usuario_reporte,id_pieza,marca,fabricacion,nc,contrato_pdt)
 VALUES(ctx->>'reserva',ctx->>'reserva_principal',ctx->>'key_produccion',coalesce((ctx->>'es_reserva_compartida')::boolean,false),ctx->>'acabado',ctx->>'produccion',row->>'perfil',quantity,(ctx->>'longitud')::numeric,p_origen,CASE p_origen WHEN 'PICKING' THEN 'FALTANTE_ENTREGA' ELSE 'DANO_'||p_origen END,nullif(btrim(row->>'observacion'),''),actor,ctx->>'id_pieza',ctx->>'marca',ctx->>'fabricacion',nc,'V2') RETURNING id_pendiente INTO id;
 INSERT INTO sgp_pdt_multiorigen.detalles VALUES(id,p_evento,p_entrega,ctx);
 seen_raw:=ARRAY[]::text[]; seen_links:=ARRAY[]::text[];
 FOR nc_item IN SELECT value FROM jsonb_array_elements(ncs) LOOP
  raw_nc:=btrim(nc_item #>> '{}');
  IF raw_nc=ANY(seen_raw) THEN RAISE EXCEPTION 'PDT_NC_DUPLICADA'; END IF;
  seen_raw:=array_append(seen_raw,raw_nc);
  SELECT count(DISTINCT consecutivo) INTO matches FROM public.sgp_nc_aluminio WHERE consecutivo=raw_nc OR cod_nc=raw_nc;
  IF matches>1 THEN RAISE EXCEPTION 'PDT_NC_AMBIGUA'; END IF;
  IF matches=1 THEN
   SELECT to_jsonb(c) INTO snap FROM public.sgp_nc_aluminio c WHERE consecutivo=raw_nc OR cod_nc=raw_nc ORDER BY fecha_actualizacion DESC NULLS LAST,creacion DESC NULLS LAST LIMIT 1;
   IF snap->>'consecutivo'=ANY(seen_links) THEN RAISE EXCEPTION 'PDT_NC_DUPLICADA'; END IF;
   seen_links:=array_append(seen_links,snap->>'consecutivo');
   INSERT INTO public.sgp_aluminio_pendiente_ncs(id_pendiente,consecutivo,enlazado_por,snapshot) VALUES(id,snap->>'consecutivo',actor,snap);
  END IF;
 END LOOP;
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,estado_anterior,estado_nuevo,tipo_evento,datos_nuevos)
 VALUES(id,actor,NULL,'PENDIENTE','REGISTRO_MULTIORIGEN_V4',jsonb_build_object('origen',p_origen,'id_evento',p_evento,'id_entrega',p_entrega,'fuente',ctx,'nc',nc,'ncs',ncs));
 ids:=ids||jsonb_build_array(id);
 END LOOP;
 RETURN jsonb_build_object('ok',true,'contract_version',4,'ids_pendientes',ids);
END $fn$;
CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendientes_listar_v2(p_token text,p_solo_abiertos boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE u text; resultado jsonb;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PATINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','SUPERVISOR DE PICKING','CONSULTA','RECEPCION','PICKING']);
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'contrato_pdt',p.contrato_pdt,'tipo_pieza',(SELECT m.tipo_pieza FROM public.sgp_maestro_piezas m WHERE m.codigo_sap=btrim(p.perfil) AND m.activo='SI'),'id_pendiente',p.id_pendiente,'produccion',p.produccion,'perfil',p.perfil,
  'estado',p.estado,'estado_repo',p.estado_repo,'validacion_estado',p.validacion_estado,
  'cantidad_reportada',p.cantidad,'nc_historica',p.nc,
  'reserva',p.reserva,'key_produccion',p.key_produccion,'acabado',p.acabado_pendiente,
  'semana',(SELECT coalesce(to_jsonb(r)->>'semana_reserva',to_jsonb(r)->>'semana_produccion') FROM public.sgp_produccion_reservas_v r WHERE r.key_produccion=p.key_produccion AND r.reserva=p.reserva LIMIT 1),
  'picking',jsonb_build_object('cobertura','NO_VERIFICADA'),'cierre_habilitado',false,'fecha_reporte',p.fecha_reporte,
  'movimientos',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.registrado_en) FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_pendiente=p.id_pendiente),'[]'::jsonb),
  'detalles',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id_detalle',d.id_detalle,'id_pieza',d.id_pieza,'fabricacion',d.fabricacion,'longitud',d.longitud::text,
   'acabado',d.acabado,'cantidad_validada',d.cantidad_validada,
   'avance_neto',coalesce((SELECT sum(CASE WHEN m.tipo='AVANCE' THEN m.cantidad ELSE -m.cantidad END)
    FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_detalle=d.id_detalle),0),
   'saldo',d.cantidad_validada-coalesce((SELECT sum(CASE WHEN m.tipo='AVANCE' THEN m.cantidad ELSE -m.cantidad END)
    FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_detalle=d.id_detalle),0)
  )) FROM public.sgp_aluminio_pendiente_detalles d WHERE d.id_pendiente=p.id_pendiente),'[]'::jsonb),
  'ncs',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'referencia',refs.ref,'consecutivo',nc.consecutivo,'cod_nc',nc.cod_nc,
    'estado',nc.estado,'responsable',nc.responsable,'creacion',nc.creacion,
    'resolucion',CASE WHEN matching.total>1 THEN 'AMBIGUA' WHEN nc.consecutivo IS NULL THEN 'NO_ENCONTRADA'
      WHEN nc.activo IS TRUE THEN 'ACTIVA' ELSE 'INACTIVA' END,
    'ultimo_estado_conocido',refs.snapshot->>'estado','snapshot_enlace',refs.snapshot,
    'finalizada_en',NULL,'origen',refs.origen) ORDER BY refs.ref)
   FROM (
    SELECT n.consecutivo ref,'VINCULO'::text origen,n.snapshot
    FROM public.sgp_aluminio_pendiente_ncs n WHERE n.id_pendiente=p.id_pendiente
    UNION ALL
    SELECT pending.ref,'HISTORICA'::text,NULL::jsonb
    FROM (
     SELECT btrim(x) ref FROM regexp_split_to_table(coalesce(p.nc,''),'[,;\n]+') x
     UNION
     SELECT btrim(j.value #>> '{}') ref
     FROM public.sgp_aluminio_pendientes_historial h
     CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(h.datos_nuevos->'ncs')='array'
       THEN h.datos_nuevos->'ncs' ELSE '[]'::jsonb END) j
     WHERE h.id_pendiente=p.id_pendiente AND h.tipo_evento='REGISTRO_MULTIORIGEN_V4'
       AND jsonb_typeof(j.value)='string'
    ) pending
    WHERE pending.ref<>'' AND NOT EXISTS (
     SELECT 1 FROM public.sgp_aluminio_pendiente_ncs linked
     WHERE linked.id_pendiente=p.id_pendiente AND
      (linked.consecutivo=pending.ref OR EXISTS (
       SELECT 1 FROM public.sgp_nc_aluminio nc_link
       WHERE nc_link.consecutivo=linked.consecutivo AND nc_link.cod_nc=pending.ref))
    )
   ) refs
   CROSS JOIN LATERAL (
    SELECT count(DISTINCT n.consecutivo) total FROM public.sgp_nc_aluminio n
    WHERE n.consecutivo=refs.ref OR n.cod_nc=refs.ref
   ) matching
   LEFT JOIN LATERAL (
    SELECT n.* FROM public.sgp_nc_aluminio n WHERE matching.total=1 AND (n.consecutivo=refs.ref OR n.cod_nc=refs.ref)
    ORDER BY n.fecha_actualizacion DESC NULLS LAST,n.creacion DESC NULLS LAST,n.consecutivo LIMIT 1
   ) nc ON true),'[]'::jsonb)
  )),'[]'::jsonb)
 INTO resultado FROM public.sgp_aluminio_pendientes p
 WHERE p.estado IN ('PENDIENTE','RESUELTO') AND (NOT coalesce(p_solo_abiertos,true) OR (p.estado='PENDIENTE' AND coalesce(p.estado_repo,'PENDIENTE')<>'PICKING'));
 RETURN jsonb_build_object('ok',true,'contract_version',2,'pendientes',resultado);
END $fn$;
DO $post$ BEGIN
 IF (SELECT md5(replace(prosrc,E'\r\n',E'\n')) FROM pg_proc WHERE oid='sgp_pdt_multiorigen.registrar(text,text,jsonb,jsonb,uuid,uuid)'::regprocedure)<>'2c9da616eb830fd6db20973e9bec4155'
 OR (SELECT md5(replace(prosrc,E'\r\n',E'\n')) FROM pg_proc WHERE oid='public.sgp_aluminio_pendientes_listar_v2(text,boolean)'::regprocedure)<>'ebc7e76a95408002b0c4b5e92ed4e70c'
 THEN RAISE EXCEPTION 'PDT_NC_DIFERIDA_POSTCHECK'; END IF;
END $post$;
NOTIFY pgrst,'reload schema';
COMMIT;

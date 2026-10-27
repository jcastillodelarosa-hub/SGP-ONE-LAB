-- REVIEW ONLY. Not an automatic migration. No production application authorized.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $preflight$ BEGIN
 IF current_setting('server_version_num')::int<170000 THEN RAISE EXCEPTION 'PDT_REQUIERE_PG17'; END IF;
 IF to_regprocedure('public.sgp_pdt_contexto_internal_v3(text,text,text,text,text,text,text,numeric)') IS NULL
 OR to_regprocedure('public.sgp_pdt_validar_rol_real(text,text[])') IS NULL
 OR to_regprocedure('public.sgp_pdt_guardar_contrato()') IS NULL
 OR to_regprocedure('public.sgp_picking_piezas_panel(text,uuid,text)') IS NULL
 OR to_regprocedure('sgp_pdt_compat_91.sgp_picking_entrega_orden(text,uuid,text,boolean,text,jsonb,date,text)') IS NULL
 THEN RAISE EXCEPTION 'PDT_DEPENDENCIA_NO_INSTALADA'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.sgp_aluminio_pendientes'::regclass AND tgfoid='public.sgp_pdt_proteger_identidad_v3()'::regprocedure AND tgenabled='O')
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.sgp_aluminio_pendientes'::regclass AND tgfoid='public.sgp_pdt_guardar_contrato()'::regprocedure AND tgenabled='O')
 THEN RAISE EXCEPTION 'PDT_GUARDS_NO_ACTIVOS'; END IF;
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='sgp_pdt_contexto_internal_v3' AND md5(replace(p.prosrc,E'\r\n',E'\n'))='9fa3879614d2243d37dd7f7b7e735c11')<>1 THEN RAISE EXCEPTION 'PDT_DEFINICION_NO_COMPATIBLE: sgp_pdt_contexto_internal_v3'; END IF;
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='sgp_pdt_origenes_internal_v3' AND md5(replace(p.prosrc,E'\r\n',E'\n'))='9e2f8cdbff11ad3aa7a6857c804a1985')<>1 THEN RAISE EXCEPTION 'PDT_DEFINICION_NO_COMPATIBLE: sgp_pdt_origenes_internal_v3'; END IF;
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='sgp_pdt_proteger_identidad_v3' AND md5(replace(p.prosrc,E'\r\n',E'\n'))='de5f18fce4ed182660170000802e6b26')<>1 THEN RAISE EXCEPTION 'PDT_DEFINICION_NO_COMPATIBLE: sgp_pdt_proteger_identidad_v3'; END IF;
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sgp_pdt_compat_91' AND p.proname='sgp_picking_entrega_orden' AND md5(replace(p.prosrc,E'\r\n',E'\n'))='fa56f3c686ced0b3b77c55f50daa83ac')<>1 THEN RAISE EXCEPTION 'PDT_DEFINICION_NO_COMPATIBLE: sgp_picking_entrega_orden'; END IF;
 IF to_regnamespace('sgp_pdt_multiorigen') IS NOT NULL THEN RAISE EXCEPTION 'PDT_MULTIORIGEN_YA_INSTALADO'; END IF;
END $preflight$;
CREATE SCHEMA sgp_pdt_multiorigen;
REVOKE ALL ON SCHEMA sgp_pdt_multiorigen FROM PUBLIC,anon,authenticated;
CREATE TABLE sgp_pdt_multiorigen.funciones_previas(firma text PRIMARY KEY,definicion text NOT NULL,huella_posterior text);
CREATE TABLE sgp_pdt_multiorigen.eventos(
 id_evento uuid PRIMARY KEY, usuario text NOT NULL, solicitud jsonb NOT NULL,
 respuesta jsonb NOT NULL, creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sgp_pdt_multiorigen.detalles(
 id_pendiente uuid PRIMARY KEY REFERENCES public.sgp_aluminio_pendientes(id_pendiente),
 id_evento uuid NOT NULL REFERENCES sgp_pdt_multiorigen.eventos(id_evento) DEFERRABLE INITIALLY DEFERRED,
 id_entrega uuid REFERENCES public.sgp_picking_entregas(id_entrega), fuente jsonb NOT NULL
);
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_pdt_multiorigen FROM PUBLIC,anon,authenticated;

-- Real SGP role, never the RECEPCION -> LIDER legacy equivalence.
CREATE FUNCTION sgp_pdt_multiorigen.actor(p_token text,p_origen text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 IF p_origen='PICKING' THEN
 RETURN public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','PATINADOR','PICKING','SUPERVISOR DE PICKING']);
 ELSIF p_origen IN ('ENSAMBLE','EMPAQUE') THEN
 RETURN public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','LIDER','LIDER LINEA']);
 ELSE RAISE EXCEPTION 'PDT_ORIGEN_INVALIDO'; END IF;
END $fn$;

-- Caller context is an assertion, never identity proof. Picking scope is its
-- selected programming row AND its existing authorized PANEL list.
CREATE FUNCTION sgp_pdt_multiorigen.fuentes(p_token text,p_origen text,p_contexto jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE program public.sgp_mecanizado_programacion%rowtype; allowed jsonb; result jsonb;
BEGIN
 PERFORM sgp_pdt_multiorigen.actor(p_token,p_origen);
 IF nullif(btrim(p_contexto->>'produccion'),'') IS NULL THEN RAISE EXCEPTION 'PDT_PRODUCCION_REQUERIDA'; END IF;
 IF p_origen='PICKING' THEN
 SELECT * INTO STRICT program FROM public.sgp_mecanizado_programacion WHERE id_programacion=(p_contexto->>'id_programacion')::uuid AND estado<>'CANCELADA' FOR SHARE;
 allowed:=public.sgp_picking_piezas_panel(p_token,program.id_programacion,p_contexto->>'produccion');
 ELSE
 IF nullif(p_contexto->>'key_produccion','') IS NULL THEN RAISE EXCEPTION 'PDT_CLAVE_REQUERIDA'; END IF;
 END IF;
 SELECT coalesce(jsonb_agg(x ORDER BY x->>'codigo_sap',x->>'fabricacion',x->>'longitud',x->>'id_pieza'),'[]'::jsonb) INTO result
 FROM (SELECT DISTINCT x||jsonb_build_object('id_carga',a.id_carga,'fila_origen',a.fila_origen) AS x FROM public.sgp_produccion_reservas_v r
 CROSS JOIN LATERAL public.sgp_pdt_origenes_internal_v3(r.reserva,NULL,p_contexto->>'produccion',NULL,NULL) x
 JOIN public.sgp_aluminio a ON a.id_pieza=x->>'id_pieza'
 WHERE r.produccion=p_contexto->>'produccion' AND r.key_produccion=x->>'key_produccion' AND r.reserva=x->>'reserva'
 AND x->>'tipo_pieza'='PANEL' AND x->>'id_linea'='PANELES_2'
 AND (nullif(p_contexto->>'reserva','') IS NULL OR x->>'reserva'=p_contexto->>'reserva')
 AND (nullif(p_contexto->>'key_produccion','') IS NULL OR x->>'key_produccion'=p_contexto->>'key_produccion')
 AND (p_origen<>'PICKING' OR (
 coalesce(x->>'reserva_principal',x->>'reserva')=program.reserva
 AND upper(btrim(x->>'sistema'))=upper(btrim(program.sistema))
 AND upper(btrim(x->>'acabado'))=upper(btrim(program.acabado))
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(allowed) a WHERE a->>'id_pieza'=x->>'id_pieza')))) q;
 IF jsonb_array_length(result)>1000 THEN RAISE EXCEPTION 'PDT_FUENTES_EXCEDEN_LIMITE'; END IF;
 RETURN result;
END $fn$;
CREATE FUNCTION public.sgp_pdt_registro_fuentes_v4(p_token text,p_origen text,p_contexto jsonb)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $fn$
 SELECT jsonb_build_object('ok',true,'contract_version',4,'fuentes',sgp_pdt_multiorigen.fuentes(p_token,p_origen,p_contexto));
$fn$;

CREATE FUNCTION sgp_pdt_multiorigen.registrar(p_token text,p_origen text,p_contexto jsonb,p_piezas jsonb,p_evento uuid,p_entrega uuid DEFAULT NULL)
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
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,tipo_evento,datos_nuevos)
 VALUES(id,actor,'REGISTRO_MULTIORIGEN_V4',jsonb_build_object('origen',p_origen,'id_evento',p_evento,'id_entrega',p_entrega,'fuente',ctx,'nc',nc));
 ids:=ids||jsonb_build_array(id);
 END LOOP;
 RETURN jsonb_build_object('ok',true,'contract_version',4,'ids_pendientes',ids);
END $fn$;

-- Atomic event boundary: delivery + missing lines + independent PDTs + history.
-- Advisory lock serializes retries, request/actor binding rejects key reuse.
CREATE FUNCTION public.sgp_pdt_registrar_v4(p_token text,p_origen text,p_contexto jsonb,p_piezas jsonb,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE actor text; request jsonb; prior sgp_pdt_multiorigen.eventos%rowtype; result jsonb; delivery uuid; program public.sgp_mecanizado_programacion%rowtype; row jsonb; complete boolean;
BEGIN
 actor:=sgp_pdt_multiorigen.actor(p_token,p_origen);
 IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'PDT_EVENTO_REQUERIDO'; END IF;
 request:=jsonb_build_object('origen',p_origen,'contexto',p_contexto,'piezas',p_piezas);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key::text,0));
 SELECT * INTO prior FROM sgp_pdt_multiorigen.eventos WHERE id_evento=p_idempotency_key;
 IF FOUND THEN
 IF prior.usuario IS DISTINCT FROM actor OR prior.solicitud IS DISTINCT FROM request THEN RAISE EXCEPTION 'PDT_IDEMPOTENCIA_REUTILIZADA'; END IF;
 RETURN prior.respuesta||jsonb_build_object('duplicado',true);
 END IF;
 IF p_origen='PICKING' THEN
 SELECT * INTO STRICT program FROM public.sgp_mecanizado_programacion WHERE id_programacion=(p_contexto->>'id_programacion')::uuid AND estado<>'CANCELADA' FOR UPDATE;
 IF nullif(p_contexto->>'produccion','') IS NULL OR p_contexto->>'completa' NOT IN ('true','false') OR p_contexto->>'completa' IS NULL THEN RAISE EXCEPTION 'PDT_ENTREGA_INVALIDA'; END IF;
 IF p_contexto->>'turno' NOT IN ('TURNO 1','TURNO 2') OR p_contexto->>'turno' IS NULL OR nullif(p_contexto->>'fecha_entrega','') IS NULL THEN RAISE EXCEPTION 'PDT_FECHA_TURNO_REQUERIDOS'; END IF;
 complete:=(p_contexto->>'completa')::boolean;
 IF complete THEN
 IF p_piezas IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION 'PDT_ENTREGA_COMPLETA_CON_FALTANTES'; END IF;
 -- Preserve installed complete-delivery behavior and its duplicate trigger.
 result:=sgp_pdt_compat_91.sgp_picking_entrega_orden(p_token,program.id_programacion,p_contexto->>'produccion',true,p_contexto->>'observacion','[]'::jsonb,(p_contexto->>'fecha_entrega')::date,p_contexto->>'turno');
 ELSE
 delivery:=gen_random_uuid();
 INSERT INTO public.sgp_picking_entregas(id_entrega,id_programacion,produccion,completa,estado,observacion,usuario_entrega,fecha_entrega,fecha_operativa,turno_entrega)
 VALUES(delivery,program.id_programacion,p_contexto->>'produccion',false,'PENDIENTE_VALIDACION',nullif(btrim(p_contexto->>'observacion'),''),actor,now(),(p_contexto->>'fecha_entrega')::date,p_contexto->>'turno');
 result:=sgp_pdt_multiorigen.registrar(p_token,p_origen,p_contexto,p_piezas,p_idempotency_key,delivery);
 FOR row IN SELECT value FROM jsonb_array_elements(p_piezas) LOOP
 INSERT INTO public.sgp_picking_faltantes(id_entrega,id_pieza,produccion,perfil,marca,fabricacion,longitud,cantidad,observacion,nc,reserva_pendiente,acabado_pendiente)
 VALUES(delivery,row->>'id_pieza',p_contexto->>'produccion',row->>'perfil',row->>'marca',row->>'fabricacion',(row->>'longitud')::numeric,(row->>'cantidad')::numeric,nullif(btrim(row->>'observacion'),''),nullif(btrim(row->>'nc'),''),row->>'reserva',row->>'acabado');
 END LOOP;
 result:=result||jsonb_build_object('id_entrega',delivery,'estado','PENDIENTE_VALIDACION');
 END IF;
 ELSE
 result:=sgp_pdt_multiorigen.registrar(p_token,p_origen,p_contexto,p_piezas,p_idempotency_key);
 END IF;
 INSERT INTO sgp_pdt_multiorigen.eventos VALUES(p_idempotency_key,actor,request,result,now());
 RETURN result;
END $fn$;

-- Additive metadata: no replacement of current v2 balances/closure/NC contracts.
CREATE FUNCTION public.sgp_pdt_registro_metadatos_v4(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 PERFORM public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PATINADOR','PICKING','SUPERVISOR DE PICKING','LIDER','LIDER LINEA','LIDER MECANIZADO','RECEPCION','CONSULTA']);
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id_pendiente',p.id_pendiente,'origen',p.origen,'usuario_reporte',p.usuario_reporte,'fecha_reporte',p.fecha_reporte,'nc',p.nc)) FROM public.sgp_aluminio_pendientes p),'[]'::jsonb);
END $fn$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_pdt_multiorigen FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sgp_pdt_registro_fuentes_v4(text,text,jsonb),public.sgp_pdt_registrar_v4(text,text,jsonb,jsonb,uuid),public.sgp_pdt_registro_metadatos_v4(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_pdt_registro_fuentes_v4(text,text,jsonb),public.sgp_pdt_registrar_v4(text,text,jsonb,jsonb,uuid),public.sgp_pdt_registro_metadatos_v4(text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

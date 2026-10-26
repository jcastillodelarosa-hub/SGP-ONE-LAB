-- REVIEW ONLY. No production application is authorized by this file.
-- Preserves old creation signature; new callers use an explicit physical source ID.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $preflight$ BEGIN
 IF md5(pg_get_functiondef('public.sgp_aluminio_pendiente_crear(text,text,text,text,numeric,numeric,text,text,text,text,text,text)'::regprocedure))<>'7ac17f1c0e243f1d05d2d9197b592cea'
 THEN RAISE EXCEPTION 'PDT_IDENTITY: creation definition changed; stop'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('sgp_pdt_linea_maestro_v3','sgp_pdt_origenes_internal_v3','sgp_pdt_origenes_novedad_v3','sgp_pdt_contexto_internal_v3','sgp_pdt_crear_internal_v3','sgp_produccion_novedad_pdt_crear_v3','sgp_pdt_proteger_identidad_v3')) THEN RAISE EXCEPTION 'PDT_IDENTITY_V3_ALREADY_EXISTS_REVIEW_REQUIRED'; END IF;
END $preflight$;

CREATE OR REPLACE FUNCTION public.sgp_pdt_linea_maestro_v3(p_perfil text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE m public.sgp_maestro_piezas%rowtype;
BEGIN
 SELECT * INTO STRICT m FROM public.sgp_maestro_piezas WHERE codigo_sap=btrim(p_perfil);
 IF m.activo IS DISTINCT FROM 'SI' OR m.tipo_pieza IS NULL OR m.destino_productivo IS NULL OR m.destino_productivo NOT IN ('PANEL','FRAME')
 OR m.tipo_pieza NOT IN ('PANEL','FRAME','COVER','REFUERZO','MUNTIN')
 OR (m.tipo_pieza IN ('PANEL','FRAME') AND m.tipo_pieza<>m.destino_productivo)
 THEN RAISE EXCEPTION 'PDT_MAESTRO_NO_VERIFICABLE'; END IF;
 RETURN CASE m.destino_productivo WHEN 'PANEL' THEN 'PANELES_2' ELSE 'FRAMES_2' END;
EXCEPTION WHEN NO_DATA_FOUND OR TOO_MANY_ROWS THEN RAISE EXCEPTION 'PDT_MAESTRO_NO_VERIFICABLE';
END $fn$;
REVOKE ALL ON FUNCTION public.sgp_pdt_linea_maestro_v3(text) FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.sgp_pdt_linea_maestro_v3(text) OWNER TO postgres;

-- Raw BOM imports can contain a legacy source-line key. The production base ID
-- comes from the registered source key; the TARGET LINE comes only from master.
-- Never choose an arbitrary same-name production or accept a frontend key as proof.
CREATE OR REPLACE FUNCTION public.sgp_pdt_origenes_internal_v3(
 p_reserva text,p_buscar text,p_produccion text DEFAULT NULL,p_acabado text DEFAULT NULL,p_id_pieza text DEFAULT NULL
) RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
 SELECT jsonb_build_object('id_pieza',a.id_pieza,'codigo_sap',m.codigo_sap,'tipo_pieza',m.tipo_pieza,
  'destino_productivo',m.destino_productivo,'activo',m.activo,'id_linea',target.id_linea,
  'key_produccion',target.key_produccion,'produccion',target.produccion,'sistema',target.sistema,
  'reserva',r.reserva,'reserva_principal',coalesce(nullif(btrim(r.reserva_principal),''),r.reserva),'es_reserva_compartida',r.es_reserva_compartida,
  'acabado',a.acabado,'marca',a.marca,'fabricacion',a.fabricacion,'longitud',a.longitud,'cantidad_referencia',a.cantidad,
  'reservas',(SELECT jsonb_agg(DISTINCT jsonb_build_object('reserva',rs.reserva,'acabado',coalesce(rs.acabado_reserva,a.acabado),
    'tipo',CASE WHEN rs.reserva=rs.reserva_principal THEN 'PRINCIPAL' ELSE 'ASOCIADA' END,
    'es_principal_compartida',coalesce((to_jsonb(rs)->>'es_principal_compartida')::boolean,false)))
    FROM public.sgp_produccion_reservas_v rs WHERE rs.key_produccion=target.key_produccion))
 FROM public.sgp_aluminio a
 JOIN public.sgp_maestro_piezas m ON m.codigo_sap=a.codigo_sap AND m.activo='SI'
 JOIN public.sgp_producciones origin ON origin.key_produccion=a.key_produccion
 JOIN public.sgp_producciones target ON target.id=origin.id AND nullif(btrim(origin.id),'') IS NOT NULL
 JOIN public.sgp_produccion_reservas_v r ON r.key_produccion=target.key_produccion
 WHERE origin.id_linea IN ('PANELES_2','FRAMES_2') AND a.activo='SI' AND m.tipo_pieza IN ('PANEL','FRAME','COVER','REFUERZO','MUNTIN')
  AND m.destino_productivo IN ('PANEL','FRAME')
  AND (m.tipo_pieza NOT IN ('PANEL','FRAME') OR m.tipo_pieza=m.destino_productivo)
  AND a.tipo_pieza=m.tipo_pieza
  AND target.id_linea=CASE m.destino_productivo WHEN 'PANEL' THEN 'PANELES_2' ELSE 'FRAMES_2' END
  AND btrim(a.produccion)=btrim(target.produccion) AND btrim(origin.produccion)=btrim(target.produccion)
  AND upper(btrim(a.sistema))=upper(btrim(target.sistema)) AND upper(btrim(origin.sistema))=upper(btrim(target.sistema))
  AND r.reserva=btrim(p_reserva)
  AND (NOT coalesce(r.es_reserva_compartida,false) OR nullif(btrim(r.reserva_principal),'') IS NOT NULL)
  AND (r.acabado_reserva IS NULL OR upper(btrim(r.acabado_reserva))=upper(btrim(a.acabado)))
  AND (nullif(btrim(p_acabado),'') IS NULL OR upper(btrim(a.acabado))=upper(btrim(p_acabado)))
  AND (nullif(btrim(p_produccion),'') IS NULL OR target.produccion=p_produccion)
  AND (p_id_pieza IS NULL OR a.id_pieza=p_id_pieza)
  AND (nullif(btrim(p_buscar),'') IS NULL OR a.codigo_sap ILIKE '%'||btrim(p_buscar)||'%')
 ORDER BY target.key_produccion,a.codigo_sap,a.fabricacion,a.longitud,a.id_pieza;
$fn$;
REVOKE ALL ON FUNCTION public.sgp_pdt_origenes_internal_v3(text,text,text,text,text) FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.sgp_pdt_origenes_internal_v3(text,text,text,text,text) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.sgp_pdt_origenes_novedad_v3(p_token text,p_reserva text,p_buscar text DEFAULT NULL,p_produccion text DEFAULT NULL,p_acabado text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 PERFORM public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA']);
 RETURN coalesce((SELECT jsonb_agg(x) FROM (SELECT DISTINCT x FROM public.sgp_pdt_origenes_internal_v3(p_reserva,p_buscar,p_produccion,p_acabado,NULL) x LIMIT 101) q),'[]'::jsonb);
END $fn$;
REVOKE ALL ON FUNCTION public.sgp_pdt_origenes_novedad_v3(text,text,text,text,text) FROM PUBLIC;
ALTER FUNCTION public.sgp_pdt_origenes_novedad_v3(text,text,text,text,text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.sgp_pdt_origenes_novedad_v3(text,text,text,text,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.sgp_pdt_contexto_internal_v3(p_reserva text,p_perfil text,p_produccion text,p_acabado text,p_id_pieza text,p_expected_key text,p_principal text,p_longitud numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE line text; sources jsonb; ctx jsonb; keys_count integer;
BEGIN
 line:=public.sgp_pdt_linea_maestro_v3(p_perfil);
 SELECT jsonb_agg(DISTINCT x),count(DISTINCT x->>'key_produccion') INTO sources,keys_count
 FROM public.sgp_pdt_origenes_internal_v3(p_reserva,p_perfil,p_produccion,p_acabado,p_id_pieza) x
 WHERE x->>'codigo_sap'=btrim(p_perfil) AND x->>'id_linea'=line
 AND (p_longitud IS NULL OR (x->>'longitud')::numeric=p_longitud);
 IF keys_count IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'PDT_ASOCIACION_INEXISTENTE_O_AMBIGUA'; END IF;
 -- Principal and finish must also be unambiguous; caller inputs are assertions only.
 IF (SELECT count(DISTINCT coalesce(x->>'reserva_principal',x->>'reserva')) FROM jsonb_array_elements(sources) x)<>1
 OR (SELECT count(DISTINCT x->>'acabado') FROM jsonb_array_elements(sources) x)<>1
 THEN RAISE EXCEPTION 'PDT_RESERVA_ACABADO_AMBIGUOS'; END IF;
 ctx:=sources->0;
 IF nullif(btrim(p_expected_key),'') IS NOT NULL AND p_expected_key<>ctx->>'key_produccion'
 THEN RAISE EXCEPTION 'PDT_CLAVE_NO_CORRESPONDE_A_MAESTRO'; END IF;
 IF nullif(btrim(p_principal),'') IS NOT NULL AND p_principal<>coalesce(ctx->>'reserva_principal',ctx->>'reserva')
 THEN RAISE EXCEPTION 'PDT_PRINCIPAL_INCONSISTENTE'; END IF;
 RETURN ctx;
END $fn$;
REVOKE ALL ON FUNCTION public.sgp_pdt_contexto_internal_v3(text,text,text,text,text,text,text,numeric) FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.sgp_pdt_contexto_internal_v3(text,text,text,text,text,text,text,numeric) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.sgp_pdt_crear_internal_v3(p_token text,p_reserva text,p_produccion text,p_perfil text,p_cantidad numeric,p_longitud numeric,p_origen text,p_causa text,p_observacion text,p_key_produccion text,p_reserva_principal text,p_acabado_pendiente text,p_id_pieza text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE actor text; ctx jsonb; id uuid;
BEGIN
 actor:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA']);
 IF p_cantidad IS NULL OR p_cantidad<=0 OR p_cantidad<>trunc(p_cantidad) OR p_cantidad>2147483647 THEN RAISE EXCEPTION 'PDT_CANTIDAD_INVALIDA'; END IF;
 ctx:=public.sgp_pdt_contexto_internal_v3(p_reserva,p_perfil,p_produccion,p_acabado_pendiente,p_id_pieza,p_key_produccion,p_reserva_principal,p_longitud);
 INSERT INTO public.sgp_aluminio_pendientes(reserva,reserva_principal,key_produccion,es_reserva_compartida,acabado_pendiente,produccion,perfil,cantidad,longitud,origen,causa,observacion,usuario_reporte,id_pieza,marca,fabricacion)
 VALUES(ctx->>'reserva',coalesce(ctx->>'reserva_principal',ctx->>'reserva'),ctx->>'key_produccion',coalesce((ctx->>'es_reserva_compartida')::boolean,false),ctx->>'acabado',ctx->>'produccion',btrim(p_perfil),p_cantidad,CASE WHEN p_id_pieza IS NOT NULL THEN coalesce(p_longitud,(ctx->>'longitud')::numeric) ELSE p_longitud END,upper(coalesce(p_origen,'PRODUCCION')),p_causa,p_observacion,actor,
  p_id_pieza,CASE WHEN p_id_pieza IS NOT NULL THEN ctx->>'marca' END,CASE WHEN p_id_pieza IS NOT NULL THEN ctx->>'fabricacion' END)
 RETURNING id_pendiente INTO id;
 RETURN id;
END $fn$;
REVOKE ALL ON FUNCTION public.sgp_pdt_crear_internal_v3(text,text,text,text,numeric,numeric,text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.sgp_pdt_crear_internal_v3(text,text,text,text,numeric,numeric,text,text,text,text,text,text,text) OWNER TO postgres;

-- Same legacy signature/defaults/return type and roles, but no name-only LIMIT 1.
CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_crear(p_token text,p_reserva text,p_produccion text,p_perfil text,p_cantidad numeric,p_longitud numeric,p_origen text,p_causa text,p_observacion text,p_key_produccion text DEFAULT NULL,p_reserva_principal text DEFAULT NULL,p_acabado_pendiente text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 RETURN public.sgp_pdt_crear_internal_v3(p_token,p_reserva,p_produccion,p_perfil,p_cantidad,p_longitud,p_origen,p_causa,p_observacion,p_key_produccion,p_reserva_principal,p_acabado_pendiente,NULL);
END $fn$;

-- Atomic novelty + PDT: failed identity or authorization leaves neither row.
CREATE OR REPLACE FUNCTION public.sgp_produccion_novedad_pdt_crear_v3(p_token text,p_novedad jsonb,p_id_pieza text,p_reserva text,p_acabado text,p_key_produccion text,p_reserva_principal text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE actor text; ctx jsonb; program public.sgp_mecanizado_programacion%rowtype; pending_id uuid; novelty_id uuid;
BEGIN
 actor:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA']);
 IF nullif(p_id_pieza,'') IS NULL THEN RAISE EXCEPTION 'PDT_PIEZA_REAL_REQUERIDA'; END IF;
 ctx:=public.sgp_pdt_contexto_internal_v3(p_reserva,p_novedad->>'perfil',p_novedad->>'produccion',p_acabado,p_id_pieza,p_key_produccion,p_reserva_principal,(p_novedad->>'longitud')::numeric);
 SELECT * INTO STRICT program FROM public.sgp_mecanizado_programacion WHERE id_programacion=(p_novedad->>'id_programacion')::uuid FOR SHARE;
 IF program.reserva IS DISTINCT FROM p_reserva AND program.reserva IS DISTINCT FROM coalesce(ctx->>'reserva_principal',ctx->>'reserva') THEN RAISE EXCEPTION 'PDT_PROGRAMACION_RESERVA_INCONSISTENTE'; END IF;
 IF upper(btrim(program.sistema)) IS DISTINCT FROM upper(btrim(ctx->>'sistema')) OR upper(btrim(program.acabado)) IS DISTINCT FROM upper(btrim(p_acabado)) THEN RAISE EXCEPTION 'PDT_PROGRAMACION_SISTEMA_ACABADO_INCONSISTENTE'; END IF;
 IF nullif(p_novedad->>'origen','') IS NULL OR nullif(p_novedad->>'tipo','') IS NULL THEN RAISE EXCEPTION 'PDT_NOVEDAD_INCOMPLETA'; END IF;
 IF ((p_novedad->>'origen')='MECANIZADO_MAQUINA' AND nullif(p_novedad->>'ticket_mtto','') IS NULL)
 OR ((p_novedad->>'origen')='MECANIZADO_PERSONAL' AND nullif(p_novedad->>'numero_nc','') IS NULL)
 OR ((p_novedad->>'origen') IN ('INGENIERIA','CALIDAD') AND nullif(p_novedad->>'numero_novedad','') IS NULL) THEN RAISE EXCEPTION 'PDT_REFERENCIA_NOVEDAD_REQUERIDA'; END IF;
 pending_id:=public.sgp_pdt_crear_internal_v3(p_token,p_reserva,ctx->>'produccion',p_novedad->>'perfil',(p_novedad->>'cantidad')::numeric,(p_novedad->>'longitud')::numeric,'PRODUCCION',(p_novedad->>'origen')||' · '||(p_novedad->>'tipo'),p_novedad->>'observacion',p_key_produccion,p_reserva_principal,p_acabado,p_id_pieza);
 INSERT INTO public.sgp_mecanizado_novedades(id_programacion,produccion,origen,tipo,perfil,longitud,cantidad,cortes_afectados,observacion,usuario,estado,numero_nc,numero_novedad,ticket_mtto)
 VALUES(program.id_programacion,ctx->>'produccion',p_novedad->>'origen',p_novedad->>'tipo',p_novedad->>'perfil',(p_novedad->>'longitud')::numeric,(p_novedad->>'cantidad')::integer,p_novedad->>'cortes_afectados',p_novedad->>'observacion',actor,CASE WHEN coalesce(nullif(p_novedad->>'numero_nc',''),nullif(p_novedad->>'numero_novedad',''),nullif(p_novedad->>'ticket_mtto','')) IS NULL THEN 'PENDIENTE_RESOLVER' ELSE 'REPORTADA' END,p_novedad->>'numero_nc',p_novedad->>'numero_novedad',p_novedad->>'ticket_mtto') RETURNING id_novedad INTO novelty_id;
 RETURN jsonb_build_object('ok',true,'id_pendiente',pending_id,'id_novedad',novelty_id,'id_linea',ctx->>'id_linea');
END $fn$;
REVOKE ALL ON FUNCTION public.sgp_produccion_novedad_pdt_crear_v3(text,jsonb,text,text,text,text,text) FROM PUBLIC;
ALTER FUNCTION public.sgp_produccion_novedad_pdt_crear_v3(text,jsonb,text,text,text,text,text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.sgp_produccion_novedad_pdt_crear_v3(text,jsonb,text,text,text,text,text) TO anon,authenticated;

-- Existing historic non-identity edits remain available; new associations cannot
-- bypass master checks through another RPC or a direct table write.
CREATE OR REPLACE FUNCTION public.sgp_pdt_proteger_identidad_v3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE ctx jsonb;
BEGIN
 IF TG_OP='UPDATE' AND ROW(NEW.key_produccion,NEW.produccion,NEW.reserva,NEW.perfil,NEW.acabado_pendiente,NEW.id_pieza,NEW.longitud,NEW.contrato_pdt)
 IS NOT DISTINCT FROM ROW(OLD.key_produccion,OLD.produccion,OLD.reserva,OLD.perfil,OLD.acabado_pendiente,OLD.id_pieza,OLD.longitud,OLD.contrato_pdt) THEN RETURN NEW; END IF;
 ctx:=public.sgp_pdt_contexto_internal_v3(NEW.reserva,NEW.perfil,NEW.produccion,NEW.acabado_pendiente,NEW.id_pieza,NEW.key_produccion,NEW.reserva_principal,NEW.longitud);
 IF NEW.key_produccion IS DISTINCT FROM ctx->>'key_produccion' THEN RAISE EXCEPTION 'PDT_CLAVE_NO_VERIFICADA'; END IF;
 IF NEW.contrato_pdt='V2' AND ctx->>'tipo_pieza'<>'PANEL' THEN RAISE EXCEPTION 'PDT_V2_REQUIERE_PIEZA_PANEL'; END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.sgp_pdt_proteger_identidad_v3() FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.sgp_pdt_proteger_identidad_v3() OWNER TO postgres;
CREATE TRIGGER trg_sgp_pdt_identidad_v3 BEFORE INSERT OR UPDATE ON public.sgp_aluminio_pendientes
 FOR EACH ROW EXECUTE FUNCTION public.sgp_pdt_proteger_identidad_v3();
NOTIFY pgrst,'reload schema';
COMMIT;

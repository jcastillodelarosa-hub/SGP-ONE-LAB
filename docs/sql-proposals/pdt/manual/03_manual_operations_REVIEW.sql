-- REVIEW ONLY. Phase 3; install only after 01 and 02 on a restored compatible PG17 database.
-- Manual grouped details have no physical id_pieza. Existing V2/LEGACY RPCs remain unchanged.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$ BEGIN
 IF to_regclass('sgp_pdt_manual.fuentes_validadas') IS NULL
 OR to_regclass('public.sgp_picking_entregas') IS NULL
 OR to_regclass('public.sgp_mecanizado_programacion') IS NULL
 OR to_regclass('public.sgp_pdt_cierres') IS NULL
 OR to_regprocedure('public.sgp_pdt_cierre_acreditado(uuid)') IS NULL
 OR to_regprocedure('public.sgp_pdt_comprometido(uuid)') IS NULL
 OR to_regprocedure('public.sgp_pdt_estado_v2(text,uuid,text)') IS NULL
 OR to_regprocedure('public.sgp_pdt_cerrar_v2(text,uuid,uuid)') IS NULL
 OR to_regprocedure('public.sgp_aluminio_pendiente_registrar_avance_v1(text,uuid,uuid,integer,text,date,uuid,text)') IS NULL
 THEN RAISE EXCEPTION 'PDT_MANUAL_PHASE3_DEPENDENCY_MISSING'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid IN
  ('public.sgp_pdt_cierre_acreditado(uuid)'::regprocedure,'public.sgp_pdt_comprometido(uuid)'::regprocedure,
   'public.sgp_aluminio_pendiente_registrar_avance_v1(text,uuid,uuid,integer,text,date,uuid,text)'::regprocedure)
  AND (p.prosecdef IS DISTINCT FROM true OR pg_get_userbyid(p.proowner)<>'postgres' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']))
 THEN RAISE EXCEPTION 'PDT_MANUAL_PHASE3_SECURITY_DIFFERENT'; END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.sgp_aluminio_pendientes_historial'::regclass
  AND a.attnum>0 AND NOT a.attisdropped AND a.attnotnull AND NOT a.atthasdef
  AND a.attidentity='' AND a.attgenerated=''
  AND a.attname NOT IN ('id_pendiente','usuario','observacion','estado_anterior','estado_nuevo','tipo_evento','datos_anteriores','datos_nuevos'))
 THEN RAISE EXCEPTION 'PDT_MANUAL_PHASE3_HISTORIAL_DIFFERENT'; END IF;
END $preflight$;

-- One independently audited quantity per detail and Picking event, never per physical piece.
CREATE TABLE sgp_pdt_manual.entregas(
 id_linea uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 id_detalle uuid NOT NULL REFERENCES public.sgp_aluminio_pendiente_detalles(id_detalle),
 id_entrega uuid NOT NULL REFERENCES public.sgp_picking_entregas(id_entrega),
 cantidad integer NOT NULL CHECK(cantidad>0),
 estado text NOT NULL DEFAULT 'REGISTRADA' CHECK(estado IN ('REGISTRADA','VALIDADA','ANULADA')),
 clave uuid NOT NULL UNIQUE, registrado_por text NOT NULL, creado_en timestamptz NOT NULL DEFAULT now(),
 validado_por text, validado_en timestamptz, asignado_por text, asignado_en timestamptz,
 clave_asignacion uuid UNIQUE, anulado_por text, anulado_en timestamptz, motivo_anulacion text
);
CREATE UNIQUE INDEX entrega_manual_activa ON sgp_pdt_manual.entregas(id_detalle,id_entrega) WHERE estado<>'ANULADA';
CREATE INDEX entrega_manual_evento ON sgp_pdt_manual.entregas(id_entrega) WHERE estado<>'ANULADA';
REVOKE ALL ON sgp_pdt_manual.entregas FROM PUBLIC,anon,authenticated;

-- Indexed header read for the existing PDT-open list; no search across source pieces.
CREATE FUNCTION public.sgp_pdt_manual_listar_v1(p_token text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 PERFORM public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION','LIDER LINEA','LIDER MECANIZADO','LIDER','PICKING','SUPERVISOR DE PICKING','PATINADOR','CONSULTA']);
 RETURN jsonb_build_object('ok',true,'contract_version','pdt-manual-3','pendientes',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (
  SELECT md.id_pendiente,r.anio AS anio_original,r.semana AS semana_original,
   prod.anio AS anio,coalesce(prod.semana_actual,prod.semana_base) AS semana,
   r.linea,r.key_produccion,r.produccion,r.reserva,
   r.sistema,r.acabado,r.origen,r.observacion AS observacion_general,md.perfil,
   md.fabricacion AS fabricacion_original,md.marca AS marca_original,
   md.longitud AS longitud_original,md.cantidad AS cantidad_original,md.nc,
   p.estado,p.estado_repo,p.validacion_estado
  FROM sgp_pdt_manual.reportes r JOIN sgp_pdt_manual.detalles md USING(id_reporte)
  JOIN public.sgp_producciones prod ON prod.key_produccion=r.key_produccion
  JOIN public.sgp_aluminio_pendientes p USING(id_pendiente)
  WHERE p.estado='PENDIENTE' ORDER BY prod.anio DESC,coalesce(prod.semana_actual,prod.semana_base) DESC,r.fecha DESC
 ) x),'[]'::jsonb));
END $fn$;

CREATE FUNCTION public.sgp_pdt_manual_picking_v1(p_token text,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE p public.sgp_aluminio_pendientes%rowtype;
BEGIN
 PERFORM public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION','PICKING','SUPERVISOR DE PICKING','LIDER MECANIZADO','LIDER']);
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id;
 IF NOT EXISTS(SELECT 1 FROM sgp_pdt_manual.detalles WHERE id_pendiente=p_id) THEN RAISE EXCEPTION 'PDT_MANUAL_INEXISTENTE'; END IF;
 RETURN jsonb_build_object('ok',true,
  'entregas',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT pe.id_entrega,pe.estado,pe.completa,pe.produccion FROM public.sgp_picking_entregas pe
   JOIN public.sgp_mecanizado_programacion mp USING(id_programacion)
   JOIN public.sgp_producciones prod ON prod.key_produccion=p.key_produccion
   WHERE pe.produccion=prod.produccion AND upper(btrim(mp.sistema))=upper(btrim(prod.sistema))
    AND upper(btrim(mp.acabado))=upper(btrim(p.acabado_pendiente))
    AND (mp.reserva=p.reserva OR (mp.reserva=p.reserva_principal AND EXISTS(
     SELECT 1 FROM public.sgp_produccion_reservas_v rel WHERE rel.key_produccion=p.key_produccion
      AND rel.reserva=p.reserva AND rel.reserva_principal=mp.reserva)))
  ) x),'[]'::jsonb),
  'lineas',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('asignada',l.asignado_en IS NOT NULL))
   FROM sgp_pdt_manual.entregas l JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle)
   WHERE d.id_pendiente=p_id),'[]'::jsonb));
END $fn$;

CREATE FUNCTION public.sgp_pdt_manual_entrega_registrar_v1(p_token text,p_detalle uuid,p_entrega uuid,p_cantidad integer,p_clave uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE d public.sgp_aluminio_pendiente_detalles%rowtype; p public.sgp_aluminio_pendientes%rowtype;
 prior sgp_pdt_manual.entregas%rowtype; actor text; neto bigint; nuevo uuid;
BEGIN
 actor:=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING']);
 IF p_cantidad IS NULL OR p_cantidad<=0 OR p_clave IS NULL THEN RAISE EXCEPTION 'PDT_MANUAL_CANTIDAD_O_CLAVE_INVALIDA'; END IF;
 SELECT * INTO STRICT d FROM public.sgp_aluminio_pendiente_detalles WHERE id_detalle=p_detalle;
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=d.id_pendiente FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM sgp_pdt_manual.detalles WHERE id_pendiente=p.id_pendiente)
 OR NOT EXISTS(SELECT 1 FROM sgp_pdt_manual.fuentes_validadas WHERE id_detalle=p_detalle)
 THEN RAISE EXCEPTION 'PDT_MANUAL_FUENTE_NO_VALIDADA'; END IF;
 SELECT * INTO prior FROM sgp_pdt_manual.entregas WHERE clave=p_clave;
 IF FOUND THEN
  IF prior.id_detalle<>p_detalle OR prior.id_entrega<>p_entrega OR prior.cantidad<>p_cantidad
  THEN RAISE EXCEPTION 'PDT_MANUAL_CLAVE_REUTILIZADA'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicado',true,'id_linea',prior.id_linea);
 END IF;
 IF p.contrato_pdt<>'V2' OR p.estado<>'PENDIENTE' OR p.validacion_estado<>'VALIDADO'
  OR p.estado_repo NOT IN ('MECANIZADO','PROCESADO') OR p.fecha_cierre IS NOT NULL
 THEN RAISE EXCEPTION 'PDT_MANUAL_NO_APTO_PARA_ENTREGA'; END IF;
 PERFORM 1 FROM public.sgp_picking_entregas WHERE id_entrega=p_entrega FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PDT_MANUAL_ENTREGA_INEXISTENTE'; END IF;
 PERFORM 1 FROM public.sgp_mecanizado_programacion mp JOIN public.sgp_picking_entregas pe USING(id_programacion)
  WHERE pe.id_entrega=p_entrega FOR UPDATE OF mp;
 PERFORM 1 FROM public.sgp_picking_entregas pe JOIN public.sgp_mecanizado_programacion mp USING(id_programacion)
 JOIN public.sgp_producciones prod ON prod.key_produccion=p.key_produccion
 WHERE pe.id_entrega=p_entrega AND pe.produccion=prod.produccion
 AND upper(btrim(mp.sistema))=upper(btrim(prod.sistema)) AND upper(btrim(mp.acabado))=upper(btrim(d.acabado))
 AND (mp.reserva=p.reserva OR (mp.reserva=p.reserva_principal AND EXISTS(
  SELECT 1 FROM public.sgp_produccion_reservas_v rel WHERE rel.key_produccion=p.key_produccion
  AND rel.reserva=p.reserva AND rel.reserva_principal=mp.reserva)));
 IF NOT FOUND THEN RAISE EXCEPTION 'PDT_MANUAL_ENTREGA_AJENA'; END IF;
 SELECT coalesce(sum(CASE WHEN tipo='AVANCE' THEN cantidad ELSE -cantidad END),0) INTO neto
 FROM public.sgp_aluminio_pendiente_movimientos WHERE id_detalle=p_detalle;
 IF p_cantidad+coalesce((SELECT sum(cantidad) FROM sgp_pdt_manual.entregas
  WHERE id_detalle=p_detalle AND estado<>'ANULADA'),0)>neto
 THEN RAISE EXCEPTION 'PDT_MANUAL_ENTREGA_SUPERA_PROCESADO'; END IF;
 INSERT INTO sgp_pdt_manual.entregas(id_detalle,id_entrega,cantidad,clave,registrado_por)
 VALUES(p_detalle,p_entrega,p_cantidad,p_clave,actor) RETURNING id_linea INTO nuevo;
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,tipo_evento,datos_nuevos)
 VALUES(p.id_pendiente,actor,'ENTREGA_MANUAL_PDT',jsonb_build_object('linea',nuevo,'detalle',p_detalle,'entrega',p_entrega,'cantidad',p_cantidad));
 RETURN jsonb_build_object('ok',true,'id_linea',nuevo);
END $fn$;

CREATE FUNCTION public.sgp_pdt_manual_entrega_validar_v1(p_token text,p_linea uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE line sgp_pdt_manual.entregas%rowtype; parent uuid; actor text;
BEGIN
 actor:=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION','SUPERVISOR DE PICKING']);
 SELECT d.id_pendiente INTO STRICT parent FROM sgp_pdt_manual.entregas l
 JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle) WHERE l.id_linea=p_linea;
 PERFORM 1 FROM public.sgp_aluminio_pendientes WHERE id_pendiente=parent AND estado='PENDIENTE' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PDT_MANUAL_CERRADO'; END IF;
 SELECT * INTO STRICT line FROM sgp_pdt_manual.entregas WHERE id_linea=p_linea FOR UPDATE;
 IF line.estado='VALIDADA' THEN RETURN jsonb_build_object('ok',true,'duplicado',true); END IF;
 IF line.estado<>'REGISTRADA' THEN RAISE EXCEPTION 'PDT_MANUAL_LINEA_NO_APTA'; END IF;
 PERFORM 1 FROM public.sgp_picking_entregas WHERE id_entrega=line.id_entrega AND estado='VALIDADA' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PDT_MANUAL_PICKING_SIN_VALIDACION'; END IF;
 UPDATE sgp_pdt_manual.entregas SET estado='VALIDADA',validado_por=actor,validado_en=now() WHERE id_linea=p_linea;
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,tipo_evento,datos_nuevos)
 VALUES(parent,actor,'VALIDACION_ENTREGA_MANUAL_PDT',jsonb_build_object('linea',p_linea));
 RETURN jsonb_build_object('ok',true);
END $fn$;

CREATE FUNCTION public.sgp_pdt_manual_asignar_v1(p_token text,p_linea uuid,p_clave uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE line sgp_pdt_manual.entregas%rowtype; parent uuid; actor text;
BEGIN
 actor:=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION','SUPERVISOR DE PICKING']);
 IF p_clave IS NULL THEN RAISE EXCEPTION 'PDT_MANUAL_CLAVE_REQUERIDA'; END IF;
 SELECT d.id_pendiente INTO STRICT parent FROM sgp_pdt_manual.entregas l
 JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle) WHERE l.id_linea=p_linea;
 PERFORM 1 FROM public.sgp_aluminio_pendientes WHERE id_pendiente=parent AND estado='PENDIENTE' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PDT_MANUAL_CERRADO'; END IF;
 SELECT * INTO STRICT line FROM sgp_pdt_manual.entregas WHERE id_linea=p_linea FOR UPDATE;
 IF line.asignado_en IS NOT NULL THEN
  IF line.clave_asignacion<>p_clave THEN RAISE EXCEPTION 'PDT_MANUAL_ASIGNACION_EXISTENTE'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicado',true);
 END IF;
 IF line.estado<>'VALIDADA' OR NOT EXISTS(SELECT 1 FROM public.sgp_picking_entregas
  WHERE id_entrega=line.id_entrega AND estado='VALIDADA') THEN RAISE EXCEPTION 'PDT_MANUAL_ENTREGA_NO_ACREDITABLE'; END IF;
 IF line.cantidad+coalesce((SELECT sum(cantidad) FROM sgp_pdt_manual.entregas
  WHERE id_detalle=line.id_detalle AND estado='VALIDADA' AND asignado_en IS NOT NULL),0)
  >(SELECT cantidad_validada FROM public.sgp_aluminio_pendiente_detalles WHERE id_detalle=line.id_detalle)
 THEN RAISE EXCEPTION 'PDT_MANUAL_SOBREASIGNACION'; END IF;
 UPDATE sgp_pdt_manual.entregas SET asignado_por=actor,asignado_en=now(),clave_asignacion=p_clave WHERE id_linea=p_linea;
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,tipo_evento,datos_nuevos)
 VALUES(parent,actor,'ASIGNACION_ENTREGA_MANUAL_PDT',jsonb_build_object('linea',p_linea,'cantidad',line.cantidad));
 RETURN jsonb_build_object('ok',true);
END $fn$;

CREATE FUNCTION public.sgp_pdt_manual_entrega_anular_v1(p_token text,p_linea uuid,p_motivo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE line sgp_pdt_manual.entregas%rowtype; parent uuid; actor text;
BEGIN
 actor:=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR']);
 IF nullif(btrim(p_motivo),'') IS NULL THEN RAISE EXCEPTION 'PDT_MANUAL_MOTIVO_REQUERIDO'; END IF;
 SELECT d.id_pendiente INTO STRICT parent FROM sgp_pdt_manual.entregas l
 JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle) WHERE l.id_linea=p_linea;
 PERFORM 1 FROM public.sgp_aluminio_pendientes WHERE id_pendiente=parent AND estado='PENDIENTE' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PDT_MANUAL_CERRADO'; END IF;
 SELECT * INTO STRICT line FROM sgp_pdt_manual.entregas WHERE id_linea=p_linea FOR UPDATE;
 IF line.estado='ANULADA' THEN RETURN jsonb_build_object('ok',true,'duplicado',true); END IF;
 UPDATE sgp_pdt_manual.entregas SET estado='ANULADA',anulado_por=actor,anulado_en=now(),motivo_anulacion=p_motivo
 WHERE id_linea=p_linea;
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,observacion,tipo_evento,datos_nuevos)
 VALUES(parent,actor,p_motivo,'ANULACION_ENTREGA_MANUAL_PDT',jsonb_build_object('linea',p_linea,'cantidad',line.cantidad));
 RETURN jsonb_build_object('ok',true);
END $fn$;

-- Preserve existing closure and reverse contracts for every nonmanual detail.
INSERT INTO sgp_pdt_manual.funcion_previa(firma,definicion) VALUES
 ('public.sgp_pdt_cierre_acreditado(uuid)',pg_get_functiondef('public.sgp_pdt_cierre_acreditado(uuid)'::regprocedure)),
 ('public.sgp_pdt_comprometido(uuid)',pg_get_functiondef('public.sgp_pdt_comprometido(uuid)'::regprocedure)),
 ('public.sgp_pdt_estado_v2(text,uuid,text)',pg_get_functiondef('public.sgp_pdt_estado_v2(text,uuid,text)'::regprocedure)),
 ('public.sgp_pdt_cerrar_v2(text,uuid,uuid)',pg_get_functiondef('public.sgp_pdt_cerrar_v2(text,uuid,uuid)'::regprocedure)),
 ('public.sgp_aluminio_pendiente_registrar_avance_v1(text,uuid,uuid,integer,text,date,uuid,text)',
  pg_get_functiondef('public.sgp_aluminio_pendiente_registrar_avance_v1(text,uuid,uuid,integer,text,date,uuid,text)'::regprocedure));
DO $clone$ DECLARE original text; BEGIN
 SELECT definicion INTO STRICT original FROM sgp_pdt_manual.funcion_previa WHERE firma='public.sgp_pdt_cierre_acreditado(uuid)';
 EXECUTE replace(original,'FUNCTION public.sgp_pdt_cierre_acreditado(','FUNCTION sgp_pdt_manual.original_cierre_acreditado(');
 SELECT definicion INTO STRICT original FROM sgp_pdt_manual.funcion_previa WHERE firma='public.sgp_pdt_comprometido(uuid)';
 EXECUTE replace(original,'FUNCTION public.sgp_pdt_comprometido(','FUNCTION sgp_pdt_manual.original_comprometido(');
 SELECT definicion INTO STRICT original FROM sgp_pdt_manual.funcion_previa WHERE firma='public.sgp_pdt_estado_v2(text,uuid,text)';
 EXECUTE replace(original,'FUNCTION public.sgp_pdt_estado_v2(','FUNCTION sgp_pdt_manual.original_estado_v2(');
 SELECT definicion INTO STRICT original FROM sgp_pdt_manual.funcion_previa WHERE firma='public.sgp_pdt_cerrar_v2(text,uuid,uuid)';
 EXECUTE replace(original,'FUNCTION public.sgp_pdt_cerrar_v2(','FUNCTION sgp_pdt_manual.original_cerrar_v2(');
 SELECT definicion INTO STRICT original FROM sgp_pdt_manual.funcion_previa
  WHERE firma='public.sgp_aluminio_pendiente_registrar_avance_v1(text,uuid,uuid,integer,text,date,uuid,text)';
 EXECUTE replace(original,'FUNCTION public.sgp_aluminio_pendiente_registrar_avance_v1(','FUNCTION sgp_pdt_manual.original_avance(');
END $clone$;

CREATE FUNCTION sgp_pdt_manual.cierre_acreditado(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
 SELECT EXISTS(SELECT 1 FROM public.sgp_pdt_cierres WHERE id_pendiente=p_id)
 AND EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=p_id)
 AND NOT EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d WHERE d.id_pendiente=p_id AND (
  d.cantidad_validada<>(SELECT coalesce(sum(CASE WHEN m.tipo='AVANCE' THEN m.cantidad ELSE -m.cantidad END),0)
   FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_detalle=d.id_detalle)
  OR d.cantidad_validada<>(SELECT coalesce(sum(l.cantidad),0) FROM sgp_pdt_manual.entregas l
   JOIN public.sgp_picking_entregas e USING(id_entrega)
   WHERE l.id_detalle=d.id_detalle AND l.estado='VALIDADA' AND l.asignado_en IS NOT NULL AND e.estado='VALIDADA')));
$fn$;
CREATE OR REPLACE FUNCTION public.sgp_pdt_cierre_acreditado(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM sgp_pdt_manual.detalles WHERE id_pendiente=p_id)
 THEN RETURN sgp_pdt_manual.cierre_acreditado(p_id); END IF;
 RETURN sgp_pdt_manual.original_cierre_acreditado(p_id);
END $fn$;
CREATE OR REPLACE FUNCTION public.sgp_pdt_comprometido(p_detalle uuid) RETURNS bigint
LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $fn$
 SELECT sgp_pdt_manual.original_comprometido(p_detalle)
 + coalesce((SELECT sum(cantidad) FROM sgp_pdt_manual.entregas
   WHERE id_detalle=p_detalle AND estado<>'ANULADA'),0)::bigint;
$fn$;
CREATE OR REPLACE FUNCTION public.sgp_pdt_estado_v2(p_token text,p_id uuid,p_estado text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM sgp_pdt_manual.detalles WHERE id_pendiente=p_id)
 AND NOT EXISTS(SELECT 1 FROM public.sgp_aluminio_pendientes
  WHERE id_pendiente=p_id AND validacion_estado='VALIDADO')
 THEN RAISE EXCEPTION 'PDT_MANUAL_REQUIERE_VALIDACION'; END IF;
 RETURN sgp_pdt_manual.original_estado_v2(p_token,p_id,p_estado);
END $fn$;
CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_registrar_avance_v1(
 p_token text,p_id uuid,p_id_detalle uuid,p_cantidad integer,p_turno text,p_fecha_operativa date,
 p_idempotency_key uuid,p_observacion text DEFAULT NULL::text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM sgp_pdt_manual.detalles WHERE id_pendiente=p_id)
 AND NOT EXISTS(SELECT 1 FROM public.sgp_aluminio_pendientes
  WHERE id_pendiente=p_id AND validacion_estado='VALIDADO' AND estado='PENDIENTE'
   AND estado_repo IN ('CORTE','MECANIZADO') AND fecha_cierre IS NULL)
 THEN RAISE EXCEPTION 'PDT_MANUAL_ETAPA_O_VALIDACION_NO_APTA'; END IF;
 RETURN sgp_pdt_manual.original_avance(p_token,p_id,p_id_detalle,p_cantidad,p_turno,p_fecha_operativa,p_idempotency_key,p_observacion);
END $fn$;

CREATE FUNCTION public.sgp_pdt_manual_cerrar_v1(p_token text,p_id uuid,p_clave uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE p public.sgp_aluminio_pendientes%rowtype; actor text; prior public.sgp_pdt_cierres%rowtype;
BEGIN
 actor:=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING']);
 IF p_clave IS NULL THEN RAISE EXCEPTION 'PDT_MANUAL_CLAVE_REQUERIDA'; END IF;
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM sgp_pdt_manual.detalles WHERE id_pendiente=p_id)
 THEN RAISE EXCEPTION 'PDT_MANUAL_INEXISTENTE'; END IF;
 SELECT * INTO prior FROM public.sgp_pdt_cierres WHERE id_pendiente=p_id;
 IF FOUND THEN
  IF prior.clave<>p_clave THEN RAISE EXCEPTION 'PDT_MANUAL_CIERRE_EXISTENTE'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicado',true);
 END IF;
 IF p.contrato_pdt<>'V2' OR p.estado<>'PENDIENTE' OR p.validacion_estado<>'VALIDADO'
 OR p.estado_repo<>'PROCESADO' THEN RAISE EXCEPTION 'PDT_MANUAL_NO_APTO_PARA_CIERRE'; END IF;
 PERFORM 1 FROM public.sgp_picking_entregas e WHERE e.id_entrega IN (
  SELECT l.id_entrega FROM sgp_pdt_manual.entregas l
  JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle) WHERE d.id_pendiente=p_id)
 ORDER BY e.id_entrega FOR UPDATE;
 INSERT INTO public.sgp_pdt_cierres(id_pendiente,clave,usuario,evidencia)
 VALUES(p_id,p_clave,actor,(SELECT coalesce(jsonb_agg(to_jsonb(l)),'[]'::jsonb)
  FROM sgp_pdt_manual.entregas l JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle)
  WHERE d.id_pendiente=p_id AND l.estado='VALIDADA' AND l.asignado_en IS NOT NULL));
 IF NOT sgp_pdt_manual.cierre_acreditado(p_id) THEN RAISE EXCEPTION 'PDT_MANUAL_COBERTURA_PICKING_INCOMPLETA'; END IF;
 UPDATE public.sgp_aluminio_pendientes SET estado='RESUELTO',estado_repo='PICKING',usuario_cierre=actor,fecha_cierre=now()
 WHERE id_pendiente=p_id;
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,tipo_evento,datos_nuevos)
 VALUES(p_id,actor,'CIERRE_MANUAL_PDT',jsonb_build_object('clave',p_clave));
 RETURN jsonb_build_object('ok',true);
END $fn$;

CREATE OR REPLACE FUNCTION public.sgp_pdt_cerrar_v2(p_token text,p_id uuid,p_clave uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM sgp_pdt_manual.detalles WHERE id_pendiente=p_id)
 THEN RETURN public.sgp_pdt_manual_cerrar_v1(p_token,p_id,p_clave); END IF;
 RETURN sgp_pdt_manual.original_cerrar_v2(p_token,p_id,p_clave);
END $fn$;

-- Existing Picking event remains the authority. Once a validated manual line refers
-- to it, changing its identity/status requires explicit line annulment first.
CREATE FUNCTION sgp_pdt_manual.proteger_entrega_origen() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM sgp_pdt_manual.entregas WHERE id_entrega=OLD.id_entrega AND estado='VALIDADA') THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'PDT_MANUAL_ENTREGA_ACREDITADA'; END IF;
  IF ROW(NEW.produccion,NEW.id_programacion,NEW.estado) IS DISTINCT FROM
     ROW(OLD.produccion,OLD.id_programacion,OLD.estado)
  THEN RAISE EXCEPTION 'PDT_MANUAL_CONCILIAR_ENTREGA_ANTES_DE_CAMBIO'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER trg_pdt_manual_entrega_origen BEFORE UPDATE OR DELETE ON public.sgp_picking_entregas
FOR EACH ROW EXECUTE FUNCTION sgp_pdt_manual.proteger_entrega_origen();
CREATE FUNCTION sgp_pdt_manual.proteger_programacion_origen() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM sgp_pdt_manual.entregas l JOIN public.sgp_picking_entregas e USING(id_entrega)
  WHERE e.id_programacion=OLD.id_programacion AND l.estado='VALIDADA') THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'PDT_MANUAL_PROGRAMACION_ACREDITADA'; END IF;
  IF ROW(NEW.reserva,NEW.sistema,NEW.acabado) IS DISTINCT FROM ROW(OLD.reserva,OLD.sistema,OLD.acabado)
  THEN RAISE EXCEPTION 'PDT_MANUAL_CONCILIAR_PROGRAMACION_ANTES_DE_CAMBIO'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER trg_pdt_manual_programacion_origen BEFORE UPDATE OR DELETE ON public.sgp_mecanizado_programacion
FOR EACH ROW EXECUTE FUNCTION sgp_pdt_manual.proteger_programacion_origen();

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_pdt_manual FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sgp_pdt_manual_picking_v1(text,uuid),
 public.sgp_pdt_manual_listar_v1(text),
 public.sgp_pdt_manual_entrega_registrar_v1(text,uuid,uuid,integer,uuid),
 public.sgp_pdt_manual_entrega_validar_v1(text,uuid),
 public.sgp_pdt_manual_asignar_v1(text,uuid,uuid),
 public.sgp_pdt_manual_entrega_anular_v1(text,uuid,text),
 public.sgp_pdt_manual_cerrar_v1(text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_pdt_manual_picking_v1(text,uuid),
 public.sgp_pdt_manual_listar_v1(text),
 public.sgp_pdt_manual_entrega_registrar_v1(text,uuid,uuid,integer,uuid),
 public.sgp_pdt_manual_entrega_validar_v1(text,uuid),
 public.sgp_pdt_manual_asignar_v1(text,uuid,uuid),
 public.sgp_pdt_manual_entrega_anular_v1(text,uuid,text),
 public.sgp_pdt_manual_cerrar_v1(text,uuid,uuid) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

CREATE OR REPLACE FUNCTION public.sgp_pdt_guardar_contrato()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE has_details boolean;
BEGIN
 IF TG_OP='DELETE' AND OLD.contrato_pdt='LEGACY' THEN RETURN OLD; END IF;
 IF TG_OP='UPDATE' AND OLD.contrato_pdt='V2' AND NEW.contrato_pdt<>'V2' THEN RAISE EXCEPTION 'PDT_NO_DEGRADABLE'; END IF;
 IF TG_OP='UPDATE' AND OLD.contrato_pdt='LEGACY' AND NEW.contrato_pdt='V2' THEN
  IF OLD.validacion_estado='VALIDADO' OR NEW.validacion_estado<>'VALIDADO' OR NOT EXISTS(
   SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d JOIN public.sgp_pdt_fuentes f USING(id_detalle)
   WHERE d.id_pendiente=OLD.id_pendiente) THEN RAISE EXCEPTION 'PDT_CONVERSION_NO_CONCILIADA'; END IF;
 END IF;
 IF TG_OP<>'DELETE' AND NEW.contrato_pdt='LEGACY' THEN RETURN NEW; END IF;
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'PDT_DELETE_REQUIERE_CONCILIACION';
 END IF;
 IF (TG_OP='INSERT' AND (NEW.estado='RESUELTO' OR NEW.estado_repo='PICKING' OR NEW.fecha_cierre IS NOT NULL)) THEN
  RAISE EXCEPTION 'PDT_CIERRE_SIN_EVIDENCIA_CUANTITATIVA';
 END IF;
 IF TG_OP='UPDATE' THEN
  IF (NEW.estado='RESUELTO' AND OLD.estado IS DISTINCT FROM NEW.estado)
   OR (NEW.estado_repo='PICKING' AND OLD.estado_repo IS DISTINCT FROM NEW.estado_repo)
   OR (NEW.fecha_cierre IS NOT NULL AND OLD.fecha_cierre IS DISTINCT FROM NEW.fecha_cierre) THEN
   IF NOT public.sgp_pdt_cierre_acreditado(NEW.id_pendiente) THEN RAISE EXCEPTION 'PDT_CIERRE_SIN_EVIDENCIA_CUANTITATIVA'; END IF;
  END IF;
  IF OLD.estado IN ('RESUELTO','ANULADO') OR OLD.fecha_cierre IS NOT NULL OR OLD.estado_repo='PICKING' THEN
   IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'PDT_CERRADO_INMUTABLE'; END IF;
  END IF;
  IF NEW.cantidad IS DISTINCT FROM OLD.cantidad AND NOT EXISTS(SELECT 1 FROM sgp_picking_audit.correcciones a WHERE a.id_pendiente=OLD.id_pendiente AND a.transaccion=pg_current_xact_id()::text AND a.anterior=OLD.cantidad AND a.nueva=NEW.cantidad) THEN
   RAISE EXCEPTION 'PDT_CANTIDAD_REPORTADA_INMUTABLE';
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d
   WHERE d.id_pendiente=OLD.id_pendiente) INTO has_details;
  IF OLD.validacion_estado='VALIDADO' AND (
   NEW.validacion_estado IS DISTINCT FROM OLD.validacion_estado OR
   ROW(NEW.fabricacion,NEW.longitud,NEW.reserva,NEW.acabado_pendiente,NEW.perfil,NEW.key_produccion,NEW.produccion,NEW.id_pieza)
   IS DISTINCT FROM ROW(OLD.fabricacion,OLD.longitud,OLD.reserva,OLD.acabado_pendiente,OLD.perfil,OLD.key_produccion,OLD.produccion,OLD.id_pieza)) THEN
   RAISE EXCEPTION 'PDT_DISTRIBUCION_VALIDADA_INMUTABLE';
  END IF;
  IF has_details AND NEW.estado_repo IS DISTINCT FROM OLD.estado_repo THEN
   IF NOT coalesce((OLD.estado_repo='PENDIENTE' AND NEW.estado_repo='CORTE') OR
    (OLD.estado_repo='CORTE' AND NEW.estado_repo='MECANIZADO') OR
    (OLD.estado_repo='MECANIZADO' AND NEW.estado_repo='PROCESADO') OR
    (OLD.estado_repo='PROCESADO' AND NEW.estado_repo='MECANIZADO' AND EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_pendiente=OLD.id_pendiente AND m.tipo='REVERSO')) OR
    (OLD.estado_repo='PROCESADO' AND NEW.estado_repo='PICKING' AND public.sgp_pdt_cierre_acreditado(NEW.id_pendiente)),false) THEN
    RAISE EXCEPTION 'PDT_TRANSICION_NO_PERMITIDA';
   END IF;
   IF NEW.estado_repo='PROCESADO' AND EXISTS(
    SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d
    WHERE d.id_pendiente=OLD.id_pendiente AND d.cantidad_validada<>(
     SELECT coalesce(sum(CASE WHEN m.tipo='AVANCE' THEN m.cantidad ELSE -m.cantidad END),0)
     FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_detalle=d.id_detalle)) THEN
    RAISE EXCEPTION 'PDT_MECANIZADO_CON_SALDO';
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.sgp_pdt_proteger_identidad_v3()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE ctx jsonb;
BEGIN
 IF TG_OP='UPDATE' AND ROW(NEW.key_produccion,NEW.produccion,NEW.reserva,NEW.perfil,NEW.acabado_pendiente,NEW.id_pieza,NEW.longitud,NEW.contrato_pdt)
 IS NOT DISTINCT FROM ROW(OLD.key_produccion,OLD.produccion,OLD.reserva,OLD.perfil,OLD.acabado_pendiente,OLD.id_pieza,OLD.longitud,OLD.contrato_pdt) THEN RETURN NEW; END IF;
 ctx:=public.sgp_pdt_contexto_internal_v3(NEW.reserva,NEW.perfil,NEW.produccion,NEW.acabado_pendiente,NEW.id_pieza,NEW.key_produccion,NEW.reserva_principal,NEW.longitud);
 IF NEW.key_produccion IS DISTINCT FROM ctx->>'key_produccion' THEN RAISE EXCEPTION 'PDT_CLAVE_NO_VERIFICADA'; END IF;
 IF NEW.contrato_pdt='V2' AND ctx->>'tipo_pieza'<>'PANEL' THEN RAISE EXCEPTION 'PDT_V2_REQUIERE_PIEZA_PANEL'; END IF;
 RETURN NEW;
END $function$;

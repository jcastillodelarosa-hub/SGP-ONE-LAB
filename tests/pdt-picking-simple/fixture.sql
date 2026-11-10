-- Isolated PostgreSQL fixture only. Session tokens below are role names, never real credentials.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA sgp_pdt_manual;
CREATE SCHEMA sgp_picking_audit;
CREATE TABLE sgp_picking_audit.correcciones(id_pendiente uuid,transaccion text,anterior numeric,nueva numeric);
CREATE TABLE public.sgp_aluminio_pendientes(id_pendiente uuid PRIMARY KEY, contrato_pdt text DEFAULT 'V2',estado text DEFAULT 'PENDIENTE',validacion_estado text DEFAULT 'VALIDADO',estado_repo text DEFAULT 'PROCESADO',fecha_cierre timestamptz,usuario_cierre text,usuario_estado text,fecha_estado timestamptz,cantidad numeric,fabricacion text,longitud numeric,reserva text,acabado_pendiente text,perfil text,key_produccion text,produccion text,id_pieza text);
CREATE TABLE public.sgp_aluminio_pendiente_detalles(id_detalle uuid PRIMARY KEY,id_pendiente uuid REFERENCES public.sgp_aluminio_pendientes,cantidad_validada integer NOT NULL);
CREATE TABLE public.sgp_aluminio_pendiente_movimientos(id_movimiento uuid PRIMARY KEY DEFAULT gen_random_uuid(),id_detalle uuid REFERENCES public.sgp_aluminio_pendiente_detalles,id_pendiente uuid,tipo text,cantidad integer);
CREATE TABLE public.sgp_picking_entregas(id_entrega uuid PRIMARY KEY,estado text);
CREATE TABLE public.sgp_pdt_entrega_lineas(id_linea uuid PRIMARY KEY,id_detalle uuid REFERENCES public.sgp_aluminio_pendiente_detalles,id_entrega uuid REFERENCES public.sgp_picking_entregas,cantidad integer,estado text);
CREATE TABLE public.sgp_pdt_asignaciones(id_asignacion uuid PRIMARY KEY DEFAULT gen_random_uuid(),id_linea uuid REFERENCES public.sgp_pdt_entrega_lineas,id_detalle uuid REFERENCES public.sgp_aluminio_pendiente_detalles,cantidad integer);
CREATE TABLE sgp_pdt_manual.entregas(id_linea uuid PRIMARY KEY,id_detalle uuid REFERENCES public.sgp_aluminio_pendiente_detalles,id_entrega uuid REFERENCES public.sgp_picking_entregas,cantidad integer,estado text,asignado_en timestamptz);
CREATE TABLE sgp_pdt_manual.detalles(id_pendiente uuid);
CREATE TABLE public.sgp_pdt_fuentes(id_detalle uuid);
CREATE TABLE public.sgp_pdt_cierres(id_pendiente uuid PRIMARY KEY,clave uuid UNIQUE,usuario text,evidencia jsonb);
CREATE TABLE public.sgp_aluminio_pendientes_historial(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,id_pendiente uuid,usuario text,estado_anterior text,estado_nuevo text NOT NULL,tipo_evento text,observacion text,datos_nuevos jsonb);
CREATE FUNCTION public.sgp_pdt_validar_rol_real(p_token text,p_roles text[]) RETURNS text LANGUAGE plpgsql AS $$ BEGIN IF p_token IS NULL OR NOT p_token=ANY(p_roles) THEN RAISE EXCEPTION 'SIN_PERMISO'; END IF; RETURN p_token; END $$;
CREATE FUNCTION sgp_pdt_manual.cierre_acreditado(p_id uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION sgp_pdt_manual.original_cierre_acreditado(p_id uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE OR REPLACE FUNCTION public.sgp_pdt_cierre_acreditado(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF EXISTS(SELECT 1 FROM sgp_pdt_manual.detalles WHERE id_pendiente=p_id)
 THEN RETURN sgp_pdt_manual.cierre_acreditado(p_id); END IF;
 RETURN sgp_pdt_manual.original_cierre_acreditado(p_id);
END $function$
;
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
END $function$

;
CREATE TRIGGER original_guard BEFORE UPDATE ON public.sgp_aluminio_pendientes FOR EACH ROW EXECUTE FUNCTION public.sgp_pdt_guardar_contrato();

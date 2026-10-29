-- REVIEW ONLY. Phase 4: audit period changes without rewriting the immutable report.
-- Requires 01-03 and a certified production writer for cross-year rescheduling.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$ BEGIN
 IF to_regclass('sgp_pdt_manual.reportes') IS NULL
 OR to_regprocedure('public.sgp_pdt_manual_listar_v1(text)') IS NULL
 OR to_regclass('public.sgp_producciones') IS NULL
 OR (SELECT count(*) FROM pg_attribute WHERE attrelid='public.sgp_producciones'::regclass
  AND attname IN ('anio','semana_base','semana_actual') AND attnum>0 AND NOT attisdropped)<>3
 THEN RAISE EXCEPTION 'PDT_MANUAL_PHASE4_PERIOD_CONTRACT_MISSING'; END IF;
 IF to_regprocedure('sgp_pdt_manual.auditar_programacion()') IS NOT NULL
 THEN RAISE EXCEPTION 'PDT_MANUAL_PHASE4_ALREADY_INSTALLED'; END IF;
 IF to_regclass('sgp_pdt_manual.programacion_cambios') IS NOT NULL AND
  (SELECT count(*) FROM pg_attribute WHERE attrelid=to_regclass('sgp_pdt_manual.programacion_cambios')
   AND attname IN ('id_pendiente','key_produccion','anio_anterior','semana_anterior','anio_nuevo','semana_nueva')
   AND attnum>0 AND NOT attisdropped)<>6
 THEN RAISE EXCEPTION 'PDT_MANUAL_PHASE4_AUDIT_SCHEMA_DIFFERENT'; END IF;
END $preflight$;
CREATE TABLE IF NOT EXISTS sgp_pdt_manual.programacion_cambios(
 id_cambio uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 id_pendiente uuid NOT NULL REFERENCES public.sgp_aluminio_pendientes(id_pendiente),
 key_produccion text NOT NULL,
 anio_anterior integer NOT NULL,semana_anterior integer NOT NULL,
 anio_nuevo integer NOT NULL,semana_nueva integer NOT NULL,
 usuario_bd text NOT NULL DEFAULT current_user,
 cambiado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(anio_anterior BETWEEN 2020 AND 2100 AND anio_nuevo BETWEEN 2020 AND 2100),
 CHECK(semana_anterior BETWEEN 1 AND 53 AND semana_nueva BETWEEN 1 AND 53)
);
CREATE INDEX IF NOT EXISTS programacion_cambios_pdt_fecha ON sgp_pdt_manual.programacion_cambios(id_pendiente,cambiado_en DESC);
REVOKE ALL ON sgp_pdt_manual.programacion_cambios FROM PUBLIC,anon,authenticated;

CREATE FUNCTION sgp_pdt_manual.auditar_programacion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE before_week integer; after_week integer; item record;
BEGIN
 before_week:=coalesce(OLD.semana_actual,OLD.semana_base);
 after_week:=coalesce(NEW.semana_actual,NEW.semana_base);
 IF ROW(OLD.anio,before_week) IS NOT DISTINCT FROM ROW(NEW.anio,after_week) THEN RETURN NEW; END IF;
 IF OLD.anio NOT BETWEEN 2020 AND 2100 OR NEW.anio NOT BETWEEN 2020 AND 2100
 OR before_week NOT BETWEEN 1 AND 53 OR after_week NOT BETWEEN 1 AND 53
 THEN RAISE EXCEPTION 'PDT_MANUAL_PERIODO_INVALIDO'; END IF;
 FOR item IN SELECT DISTINCT md.id_pendiente FROM sgp_pdt_manual.reportes r
  JOIN sgp_pdt_manual.detalles md USING(id_reporte)
  WHERE r.key_produccion=NEW.key_produccion LOOP
  INSERT INTO sgp_pdt_manual.programacion_cambios
   (id_pendiente,key_produccion,anio_anterior,semana_anterior,anio_nuevo,semana_nueva)
  VALUES(item.id_pendiente,NEW.key_produccion,OLD.anio,before_week,NEW.anio,after_week);
  INSERT INTO public.sgp_aluminio_pendientes_historial
   (id_pendiente,usuario,tipo_evento,observacion,estado_anterior,estado_nuevo,datos_anteriores,datos_nuevos)
  VALUES(item.id_pendiente,current_user,'REPROGRAMACION_PDT_MANUAL',
   'Cambio de programación; el reporte original permanece inmutable',
   (SELECT estado_repo FROM public.sgp_aluminio_pendientes WHERE id_pendiente=item.id_pendiente),
   (SELECT estado_repo FROM public.sgp_aluminio_pendientes WHERE id_pendiente=item.id_pendiente),
   jsonb_build_object('anio',OLD.anio,'semana',before_week,'key_produccion',OLD.key_produccion),
   jsonb_build_object('anio',NEW.anio,'semana',after_week,'key_produccion',NEW.key_produccion));
 END LOOP;
 RETURN NEW;
END $fn$;
CREATE TRIGGER trg_pdt_manual_auditar_programacion
AFTER UPDATE OF anio,semana_base,semana_actual ON public.sgp_producciones
FOR EACH ROW EXECUTE FUNCTION sgp_pdt_manual.auditar_programacion();
REVOKE ALL ON FUNCTION sgp_pdt_manual.auditar_programacion() FROM PUBLIC,anon,authenticated;
COMMIT;

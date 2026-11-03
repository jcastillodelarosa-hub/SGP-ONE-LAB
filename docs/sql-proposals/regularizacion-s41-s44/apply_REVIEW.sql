-- ISSUE #187 / PR #188. REVIEW ONLY: execute only after separate production approval.
-- Historical TEST ledger; it never inserts a machining plan or an operational Picking delivery.
-- The 27 October date is operational, not the actual timestamp or proof of physical delivery.
BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('SGP-ISSUE-187-S41-S44',0));
LOCK TABLE public.sgp_producciones, public.sgp_mecanizado_programacion_detalle,
 public.sgp_picking_entregas, public.sgp_recepcion_reservas IN SHARE MODE;

CREATE SCHEMA IF NOT EXISTS sgp_regularizacion_187;
REVOKE ALL ON SCHEMA sgp_regularizacion_187 FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS sgp_regularizacion_187.lotes (
 id text PRIMARY KEY,
 fuente_hash text NOT NULL,
 total_producciones integer NOT NULL CHECK (total_producciones=798),
 total_ventanas numeric NOT NULL CHECK (total_ventanas=5745),
 fecha_operativa date NOT NULL CHECK (fecha_operativa=DATE '2026-10-27'),
 clase text NOT NULL CHECK (clase='REGULARIZACION_PRUEBAS'),
 creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS sgp_regularizacion_187.producciones (
 key_produccion text PRIMARY KEY,
 lote_id text NOT NULL REFERENCES sgp_regularizacion_187.lotes(id),
 fuente jsonb NOT NULL,
 entrega_previa jsonb NOT NULL,
 entrega_historica_pruebas boolean NOT NULL CHECK
   (entrega_historica_pruebas=(fuente->>'id_linea'='PANELES_2')),
 auditoria_historica_pruebas boolean NOT NULL CHECK
   (auditoria_historica_pruebas=entrega_historica_pruebas),
 fecha_operativa date NOT NULL CHECK (fecha_operativa=DATE '2026-10-27'),
 clase text NOT NULL CHECK (clase='REGULARIZACION_PRUEBAS'),
 registrado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS regularizacion_187_producciones_lote ON sgp_regularizacion_187.producciones(lote_id);
CREATE TABLE IF NOT EXISTS sgp_regularizacion_187.reservas (
 reserva text PRIMARY KEY,
 lote_id text NOT NULL REFERENCES sgp_regularizacion_187.lotes(id),
 recepcion_previa jsonb,
 fecha_operativa date NOT NULL CHECK (fecha_operativa=DATE '2026-10-27'),
 clase text NOT NULL CHECK (clase='REGULARIZACION_PRUEBAS'),
 registrado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS regularizacion_187_reservas_lote ON sgp_regularizacion_187.reservas(lote_id);
ALTER TABLE sgp_regularizacion_187.lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_regularizacion_187.producciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_regularizacion_187.reservas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_regularizacion_187 FROM PUBLIC, anon, authenticated;

DO $apply$
DECLARE
 v_id constant text := 'SGP-187-2026-S41-S44';
 v_hash text;
 v_count integer;
 v_windows numeric;
 v_reservas integer;
 v_old sgp_regularizacion_187.lotes%ROWTYPE;
BEGIN
 -- The source identity is key_produccion, never the 406 repeated display codes.
 SELECT count(*),coalesce(sum(cantidad),0),
        md5(coalesce(string_agg(key_produccion||'|'||coalesce(produccion,'')||'|'||
          coalesce(id_linea,'')||'|'||coalesce(cantidad::text,'')||'|'||
          coalesce(reserva_al,''), E'\n' ORDER BY key_produccion),''))
 INTO v_count,v_windows,v_hash
 FROM public.sgp_producciones
 WHERE anio=2026 AND semana_base BETWEEN 41 AND 44;
 IF v_count<>798 OR v_windows<>5745 THEN
  RAISE EXCEPTION 'ALCANCE_CAMBIO: expected 798/5745, got %/%',v_count,v_windows;
 END IF;
 IF EXISTS (SELECT 1 FROM public.sgp_producciones
            WHERE anio=2026 AND semana_base BETWEEN 41 AND 44
              AND (key_produccion IS NULL OR NULLIF(trim(split_part(coalesce(reserva_al,''),',',1)),'') IS NULL)) THEN
  RAISE EXCEPTION 'IDENTIDAD_O_RESERVA_NO_VERIFICABLE';
 END IF;
 SELECT count(DISTINCT trim(split_part(reserva_al,',',1))) INTO v_reservas
 FROM public.sgp_producciones WHERE anio=2026 AND semana_base BETWEEN 41 AND 44;
 IF v_reservas<>94 THEN RAISE EXCEPTION 'RESERVAS_CAMBIARON: %',v_reservas; END IF;
 SELECT * INTO v_old FROM sgp_regularizacion_187.lotes WHERE id=v_id FOR UPDATE;
 IF FOUND AND (v_old.fuente_hash<>v_hash OR v_old.total_producciones<>v_count OR
               v_old.total_ventanas<>v_windows OR v_old.fecha_operativa<>DATE '2026-10-27') THEN
  RAISE EXCEPTION 'REINTENTO_CON_FUENTE_DISTINTA';
 END IF;
 INSERT INTO sgp_regularizacion_187.lotes(id,fuente_hash,total_producciones,total_ventanas,fecha_operativa,clase)
 VALUES(v_id,v_hash,v_count,v_windows,DATE '2026-10-27','REGULARIZACION_PRUEBAS')
 ON CONFLICT (id) DO NOTHING;

 -- Capture exact pre-existing operational delivery IDs by canonical key and production.
 -- No link is invented for the 544 rows without program detail.
 INSERT INTO sgp_regularizacion_187.producciones(key_produccion,lote_id,fuente,entrega_previa,
   entrega_historica_pruebas,auditoria_historica_pruebas,fecha_operativa,clase)
 SELECT s.key_produccion,v_id,
        jsonb_build_object('key_produccion',s.key_produccion,'produccion',s.produccion,
          'anio',s.anio,'semana_base',s.semana_base,'id_linea',s.id_linea,
          'reserva_principal',trim(split_part(s.reserva_al,',',1)),'cantidad',s.cantidad),
        coalesce((SELECT jsonb_agg(DISTINCT jsonb_build_object(
          'id_entrega',e.id_entrega,'id_programacion',e.id_programacion,
          'estado',e.estado,'completa',e.completa,'fecha_operativa',e.fecha_operativa))
          FROM public.sgp_mecanizado_programacion_detalle d
          JOIN public.sgp_picking_entregas e ON e.id_programacion=d.id_programacion
             AND e.produccion=s.produccion
          WHERE d.key_produccion=s.key_produccion),'[]'::jsonb),
        s.id_linea='PANELES_2',s.id_linea='PANELES_2',
        DATE '2026-10-27','REGULARIZACION_PRUEBAS'
 FROM public.sgp_producciones s
 WHERE s.anio=2026 AND s.semana_base BETWEEN 41 AND 44
 ON CONFLICT (key_produccion) DO NOTHING;
 INSERT INTO sgp_regularizacion_187.reservas(reserva,lote_id,recepcion_previa,fecha_operativa,clase)
 SELECT r.reserva,v_id,to_jsonb(x),DATE '2026-10-27','REGULARIZACION_PRUEBAS'
 FROM (SELECT DISTINCT trim(split_part(reserva_al,',',1)) reserva
       FROM public.sgp_producciones WHERE anio=2026 AND semana_base BETWEEN 41 AND 44) r
 LEFT JOIN public.sgp_recepcion_reservas x ON x.reserva=r.reserva
 ON CONFLICT (reserva) DO NOTHING;
 IF (SELECT count(*) FROM sgp_regularizacion_187.producciones WHERE lote_id=v_id)<>798
 OR (SELECT count(*) FROM sgp_regularizacion_187.reservas WHERE lote_id=v_id)<>94 THEN
  RAISE EXCEPTION 'REGULARIZACION_INCOMPLETA';
 END IF;
 IF EXISTS (SELECT 1 FROM sgp_regularizacion_187.producciones h
            WHERE h.lote_id=v_id AND NOT EXISTS
              (SELECT 1 FROM public.sgp_producciones s WHERE s.key_produccion=h.key_produccion
               AND s.anio=2026 AND s.semana_base BETWEEN 41 AND 44)) THEN
  RAISE EXCEPTION 'FUENTE_HISTORICA_INCONSISTENTE';
 END IF;
END $apply$;
COMMIT;

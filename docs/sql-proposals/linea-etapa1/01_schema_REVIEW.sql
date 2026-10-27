-- PROPOSAL ONLY. Not an installer or automatic migration. Never run in production
-- during Etapa1. No legacy ALTER, data migration, roles or public RPC replacement.
BEGIN;
CREATE SCHEMA sgp_linea_operativa_v1;
REVOKE ALL ON SCHEMA sgp_linea_operativa_v1 FROM PUBLIC,anon,authenticated;
CREATE TABLE sgp_linea_operativa_v1.turnos(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), etapa text NOT NULL CHECK(etapa IN ('ENSAMBLE','EMPAQUE')),
 fecha_operativa date NOT NULL,turno smallint NOT NULL CHECK(turno IN (1,2)),
 revision bigint NOT NULL DEFAULT 0,estado text NOT NULL CHECK(estado IN ('ABIERTO','CERRADO','EN_REVISION')),
 UNIQUE(etapa,fecha_operativa,turno)
);
CREATE TABLE sgp_linea_operativa_v1.ordenes_turno(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),id_turno uuid NOT NULL REFERENCES sgp_linea_operativa_v1.turnos,
 key_produccion text NOT NULL, -- FK to installed canonical production contract after metadata validation
 sale bigint CHECK(sale>=0),sale_validado_por text,sale_validado_en timestamptz,
 ejecutado bigint NOT NULL DEFAULT 0 CHECK(ejecutado>=0),revision bigint NOT NULL DEFAULT 0,
 UNIQUE(id_turno,key_produccion),CHECK((sale IS NULL)=(sale_validado_por IS NULL))
);
CREATE TABLE sgp_linea_operativa_v1.eventos(
 id uuid PRIMARY KEY,actor text NOT NULL,tipo text NOT NULL,solicitud jsonb NOT NULL,
 respuesta jsonb NOT NULL,id_orden uuid REFERENCES sgp_linea_operativa_v1.ordenes_turno,
 anterior jsonb,nuevo jsonb,registrado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sgp_linea_operativa_v1.cierres(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),id_turno uuid NOT NULL REFERENCES sgp_linea_operativa_v1.turnos,
 revision bigint NOT NULL,observacion text NOT NULL CHECK(btrim(observacion)<>''),snapshot jsonb NOT NULL,
 evento uuid NOT NULL UNIQUE REFERENCES sgp_linea_operativa_v1.eventos,
 UNIQUE(id_turno,revision)
);
CREATE TABLE sgp_linea_operativa_v1.arrastres(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),origen uuid NOT NULL REFERENCES sgp_linea_operativa_v1.ordenes_turno,
 destino uuid NOT NULL REFERENCES sgp_linea_operativa_v1.ordenes_turno,
 cantidad bigint NOT NULL CHECK(cantidad>=0),revision_origen bigint NOT NULL,validado boolean NOT NULL DEFAULT false,
 UNIQUE(origen,destino),CHECK(origen<>destino)
);
CREATE TABLE sgp_linea_operativa_v1.cortes_export(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lote_fuente text NOT NULL UNIQUE,huella text NOT NULL,
 efectivo_en timestamptz NOT NULL,contenido jsonb NOT NULL,registrado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sgp_linea_operativa_v1.conciliaciones(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),id_corte uuid NOT NULL REFERENCES sgp_linea_operativa_v1.cortes_export,
 id_evento uuid NOT NULL REFERENCES sgp_linea_operativa_v1.eventos,
 evidencia jsonb NOT NULL,autorizado_por text NOT NULL,UNIQUE(id_corte,id_evento)
);
-- No browser access. Future authenticated RPCs must implement all invariants,
-- row locking, idempotency, immutable audit/closures, real role + stage scope.
DO $security$ DECLARE t record;BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='sgp_linea_operativa_v1' LOOP
 EXECUTE format('ALTER TABLE sgp_linea_operativa_v1.%I ENABLE ROW LEVEL SECURITY',t.tablename);
 END LOOP;
END $security$;
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_linea_operativa_v1 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA sgp_linea_operativa_v1 FROM PUBLIC,anon,authenticated;
COMMIT;

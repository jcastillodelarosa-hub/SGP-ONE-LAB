-- DRAFT ONLY: isolated storage proposal. Not an installable release; no public RPC/grants.
-- No historical migration, cloning from turn snapshots, PDT writes or SALE changes.
BEGIN;
CREATE SCHEMA sgp_lp_afectaciones;
REVOKE ALL ON SCHEMA sgp_lp_afectaciones FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE sgp_lp_afectaciones.ambitos (
 key text NOT NULL REFERENCES public.sgp_producciones(key_produccion),
 etapa text NOT NULL CHECK(etapa IN ('ENSAMBLE','EMPAQUE')),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 PRIMARY KEY(key,etapa)
);
CREATE TABLE sgp_lp_afectaciones.reportes (
 id uuid PRIMARY KEY,
 key text NOT NULL,
 etapa text NOT NULL,
 causa text NOT NULL CHECK(causa IN('NC_AL','NC_V','TECNO','NOVEDAD')),
 ventanas bigint NOT NULL CHECK(ventanas>=0),
 solucionadas bigint NOT NULL DEFAULT 0 CHECK(solucionadas>=0),
 confirmadas bigint NOT NULL DEFAULT 0 CHECK(confirmadas>=0),
 origen_fecha date NOT NULL, origen_turno smallint NOT NULL CHECK(origen_turno IN(1,2)),
 creado_en timestamptz NOT NULL DEFAULT clock_timestamp(), creado_por text NOT NULL,
 CHECK(confirmadas<=solucionadas AND solucionadas<=ventanas),
 FOREIGN KEY(key,etapa) REFERENCES sgp_lp_afectaciones.ambitos,
 UNIQUE(id,key,etapa)
);
-- A source record is linked once, never recreated on a shift change.
-- Only a reviewed authoritative adapter may populate this; not arbitrary browser IDs.
CREATE TABLE sgp_lp_afectaciones.fuentes (
 contrato text NOT NULL CHECK(contrato IN('LEGACY','V2','V4','MANUAL')),
 fuente_id uuid NOT NULL,
 reporte uuid NOT NULL REFERENCES sgp_lp_afectaciones.reportes,
 PRIMARY KEY(contrato,fuente_id)
);
CREATE TABLE sgp_lp_afectaciones.eventos (
 id uuid PRIMARY KEY,key text NOT NULL,etapa text NOT NULL,reporte uuid,
 revision bigint NOT NULL CHECK(revision>0),
 accion text NOT NULL CHECK(accion IN('CREATE','CORRECT','SOLVE','CONFIRM','VALIDATE')),
 cantidad bigint NOT NULL CHECK(cantidad>=0),
 observacion text NOT NULL CHECK(length(btrim(observacion)) BETWEEN 1 AND 2000),
 usuario text NOT NULL,fecha date NOT NULL,turno smallint NOT NULL CHECK(turno IN(1,2)),
 registrado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 solicitud jsonb NOT NULL,respuesta jsonb NOT NULL,
 UNIQUE(key,etapa,revision),
 FOREIGN KEY(key,etapa) REFERENCES sgp_lp_afectaciones.ambitos,
 FOREIGN KEY(reporte,key,etapa) REFERENCES sgp_lp_afectaciones.reportes(id,key,etapa),
 CHECK((accion='VALIDATE')=(reporte IS NULL))
);
CREATE TABLE sgp_lp_afectaciones.consolidados (
 key text NOT NULL,etapa text NOT NULL,revision bigint NOT NULL,
 ventanas bigint NOT NULL CHECK(ventanas>=0),saldo_export bigint NOT NULL CHECK(saldo_export>=ventanas),
 validacion uuid NOT NULL REFERENCES sgp_lp_afectaciones.eventos,
 PRIMARY KEY(key,etapa),FOREIGN KEY(key,etapa) REFERENCES sgp_lp_afectaciones.ambitos
);
CREATE FUNCTION sgp_lp_afectaciones.inmutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'HISTORIAL_INMUTABLE';END $$;
REVOKE ALL ON FUNCTION sgp_lp_afectaciones.inmutable() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER eventos_inmutables BEFORE UPDATE OR DELETE ON sgp_lp_afectaciones.eventos FOR EACH ROW EXECUTE FUNCTION sgp_lp_afectaciones.inmutable();
ALTER TABLE sgp_lp_afectaciones.ambitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_afectaciones.reportes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_afectaciones.fuentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_afectaciones.eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_afectaciones.consolidados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_lp_afectaciones FROM PUBLIC,anon,authenticated,service_role;
COMMIT;

-- EXECUTABLE MODEL ONLY, NOT A MIGRATION. Ends in ROLLBACK deliberately.
-- No existing SGP object, ACL, role, job, secret or live adapter is changed.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='20s';
DO $$ BEGIN
 IF current_setting('sgp.export_v2_test',true) IS DISTINCT FROM 'ISOLATED_ONLY'
 THEN RAISE EXCEPTION 'V2_ISOLATED_DATABASE_REQUIRED'; END IF;
 IF to_regnamespace('sgp_lp_export_v2_qa') IS NOT NULL THEN RAISE EXCEPTION 'V2_MODEL_ALREADY_EXISTS'; END IF;
END $$;
CREATE SCHEMA sgp_lp_export_v2_qa;
CREATE TABLE sgp_lp_export_v2_qa.artifact (
 id boolean PRIMARY KEY CHECK (id), version text NOT NULL CHECK (version='LP-EXPORT-PRODUCTION-2.0.0-ISOLATED'),
 enabled boolean NOT NULL DEFAULT false CHECK (enabled=false)
);
INSERT INTO sgp_lp_export_v2_qa.artifact VALUES(true,'LP-EXPORT-PRODUCTION-2.0.0-ISOLATED',false);
CREATE TABLE sgp_lp_export_v2_qa.periods (
 stage text NOT NULL CHECK(stage='ENSAMBLE'), line text NOT NULL CHECK(line='PANELES_2'),
 work_date date NOT NULL, shift smallint NOT NULL CHECK(shift IN(1,2)),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 9007199254740991),
 status text NOT NULL DEFAULT 'ABIERTO' CHECK(status IN('ABIERTO','CERRADO','EN_REVISION')),
 current_import uuid, current_closure uuid,
 CHECK((status='CERRADO')=(current_closure IS NOT NULL)),
 PRIMARY KEY(stage,line,work_date,shift)
);
CREATE TABLE sgp_lp_export_v2_qa.imports (
 id uuid PRIMARY KEY,stage text NOT NULL,line text NOT NULL,work_date date NOT NULL,shift smallint NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),
 source_revision text NOT NULL CHECK(source_revision ~ '^[a-f0-9]{64}$'),
 filename text NOT NULL CHECK(length(filename)<=255 AND filename ~* '^.+\.xlsx$'),
 original bytea NOT NULL CHECK(octet_length(original) BETWEEN 22 AND 2097152 AND encode(substring(original FROM 1 FOR 4),'hex')='504b0304'),
 sha256 text NOT NULL CHECK(sha256=encode(sha256(original),'hex')),
 adapter text NOT NULL CHECK(adapter='LP-PBI-XLSX-1'),
 actor text NOT NULL CHECK(length(btrim(actor))>0),created_at timestamptz NOT NULL,
 UNIQUE(id,stage,line,work_date,shift),UNIQUE(id,source_revision),UNIQUE(stage,line,work_date,shift,version),
 FOREIGN KEY(stage,line,work_date,shift) REFERENCES sgp_lp_export_v2_qa.periods
);
CREATE TABLE sgp_lp_export_v2_qa.import_rows (
 import_id uuid NOT NULL REFERENCES sgp_lp_export_v2_qa.imports,
 key text NOT NULL CHECK(key ~ '^.+\|PANELES_2$'),
 coverage text NOT NULL CHECK(coverage IN('PRESENT','ABSENT')),
 realized bigint CHECK(realized BETWEEN 0 AND 9007199254740991),
 source_rows jsonb NOT NULL CHECK(jsonb_typeof(source_rows)='array'),
 CHECK((coverage='PRESENT' AND realized IS NOT NULL AND jsonb_array_length(source_rows)>0)
    OR (coverage='ABSENT' AND realized IS NULL AND source_rows='[]'::jsonb)),
 PRIMARY KEY(import_id,key)
);
CREATE TABLE sgp_lp_export_v2_qa.closures (
 id uuid PRIMARY KEY,stage text NOT NULL,line text NOT NULL,work_date date NOT NULL,shift smallint NOT NULL,
 version bigint NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),
 source_revision text NOT NULL CHECK(source_revision ~ '^[a-f0-9]{64}$'),
 authority text NOT NULL CHECK(authority='EXPORT_PRODUCTION_V2'),
 type text NOT NULL CHECK(type IN('CON_ACTIVIDAD','SIN_ACTIVIDAD')),import_id uuid,
 actor text NOT NULL CHECK(length(btrim(actor))>0),created_at timestamptz NOT NULL,
 CHECK((type='SIN_ACTIVIDAD' AND import_id IS NULL) OR(type='CON_ACTIVIDAD' AND import_id IS NOT NULL)),
 UNIQUE(id,import_id),UNIQUE(id,stage,line,work_date,shift,version),UNIQUE(stage,line,work_date,shift,version),
 FOREIGN KEY(stage,line,work_date,shift) REFERENCES sgp_lp_export_v2_qa.periods,
 FOREIGN KEY(import_id,stage,line,work_date,shift) REFERENCES sgp_lp_export_v2_qa.imports(id,stage,line,work_date,shift),
 FOREIGN KEY(import_id,source_revision) REFERENCES sgp_lp_export_v2_qa.imports(id,source_revision)
);
CREATE TABLE sgp_lp_export_v2_qa.closure_rows (
 closure_id uuid NOT NULL,import_id uuid NOT NULL,key text NOT NULL,
 coverage text NOT NULL CHECK(coverage IN('PRESENT','ABSENT')),
 plan bigint NOT NULL CHECK(plan BETWEEN 0 AND 9007199254740991),
 realized bigint CHECK(realized BETWEEN 0 AND 9007199254740991),reason text,
 assignment_refs jsonb NOT NULL CHECK(jsonb_typeof(assignment_refs)='array'),
 manual_history jsonb NOT NULL CHECK(jsonb_typeof(manual_history)='object' AND (manual_history->>'authority') IS NOT DISTINCT FROM 'HISTORICAL_ONLY'),
 difference bigint GENERATED ALWAYS AS (CASE WHEN coverage='PRESENT' THEN realized-plan ELSE NULL END) STORED,
 pending_against_plan bigint GENERATED ALWAYS AS (CASE WHEN coverage='PRESENT' THEN greatest(plan-realized,0) ELSE NULL END) STORED,
 CHECK((coverage='PRESENT' AND realized IS NOT NULL) OR(coverage='ABSENT' AND realized IS NULL)),
 CHECK((coverage='PRESENT' AND realized=plan) OR length(btrim(coalesce(reason,'')))>0),
 PRIMARY KEY(closure_id,key),
 FOREIGN KEY(closure_id,import_id) REFERENCES sgp_lp_export_v2_qa.closures(id,import_id),
 FOREIGN KEY(import_id,key) REFERENCES sgp_lp_export_v2_qa.import_rows(import_id,key)
);
ALTER TABLE sgp_lp_export_v2_qa.periods ADD CONSTRAINT period_current_import FOREIGN KEY(current_import,stage,line,work_date,shift)
 REFERENCES sgp_lp_export_v2_qa.imports(id,stage,line,work_date,shift) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE sgp_lp_export_v2_qa.periods ADD CONSTRAINT period_current_closure FOREIGN KEY(current_closure,stage,line,work_date,shift,revision)
 REFERENCES sgp_lp_export_v2_qa.closures(id,stage,line,work_date,shift,version) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE sgp_lp_export_v2_qa.receipts (
 id uuid PRIMARY KEY,stage text NOT NULL,line text NOT NULL,work_date date NOT NULL,shift smallint NOT NULL,
 actor text NOT NULL CHECK(length(btrim(actor))>0),
 operation text NOT NULL CHECK(operation IN('IMPORTAR_XLSX','CERRAR','REABRIR')),
 payload_sha256 text NOT NULL CHECK(payload_sha256 ~ '^[a-f0-9]{64}$'),response jsonb NOT NULL,
 CHECK(jsonb_typeof(response)='object'),
 FOREIGN KEY(stage,line,work_date,shift) REFERENCES sgp_lp_export_v2_qa.periods
);
CREATE FUNCTION sgp_lp_export_v2_qa.validate_closure_source() RETURNS trigger
 LANGUAGE plpgsql SET search_path='' AS $$ DECLARE source sgp_lp_export_v2_qa.import_rows%rowtype; BEGIN
 SELECT * INTO source FROM sgp_lp_export_v2_qa.import_rows WHERE import_id=NEW.import_id AND key=NEW.key;
 IF NOT FOUND OR NEW.coverage IS DISTINCT FROM source.coverage OR NEW.realized IS DISTINCT FROM source.realized
 THEN RAISE EXCEPTION 'V2_CLOSE_MUST_MATCH_IMPORT'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_closure_source BEFORE INSERT ON sgp_lp_export_v2_qa.closure_rows FOR EACH ROW EXECUTE FUNCTION sgp_lp_export_v2_qa.validate_closure_source();
CREATE FUNCTION sgp_lp_export_v2_qa.immutable_history() RETURNS trigger
 LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 RAISE EXCEPTION 'V2_HISTORY_APPEND_ONLY';
END $$;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON sgp_lp_export_v2_qa.imports FOR EACH ROW EXECUTE FUNCTION sgp_lp_export_v2_qa.immutable_history();
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON sgp_lp_export_v2_qa.import_rows FOR EACH ROW EXECUTE FUNCTION sgp_lp_export_v2_qa.immutable_history();
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON sgp_lp_export_v2_qa.closures FOR EACH ROW EXECUTE FUNCTION sgp_lp_export_v2_qa.immutable_history();
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON sgp_lp_export_v2_qa.closure_rows FOR EACH ROW EXECUTE FUNCTION sgp_lp_export_v2_qa.immutable_history();
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON sgp_lp_export_v2_qa.receipts FOR EACH ROW EXECUTE FUNCTION sgp_lp_export_v2_qa.immutable_history();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON sgp_lp_export_v2_qa.imports FOR EACH STATEMENT EXECUTE FUNCTION sgp_lp_export_v2_qa.immutable_history();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON sgp_lp_export_v2_qa.import_rows FOR EACH STATEMENT EXECUTE FUNCTION sgp_lp_export_v2_qa.immutable_history();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON sgp_lp_export_v2_qa.closures FOR EACH STATEMENT EXECUTE FUNCTION sgp_lp_export_v2_qa.immutable_history();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON sgp_lp_export_v2_qa.closure_rows FOR EACH STATEMENT EXECUTE FUNCTION sgp_lp_export_v2_qa.immutable_history();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON sgp_lp_export_v2_qa.receipts FOR EACH STATEMENT EXECUTE FUNCTION sgp_lp_export_v2_qa.immutable_history();
-- Deliberate rollback. Only the in-process synthetic test replaces this terminator.
ROLLBACK;

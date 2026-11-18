-- DESIGN REVIEW ONLY. Never apply while a deployment/import outcome is unresolved.
-- Contains no real identifiers. Registry population/certification is a separate private operation.
-- Initially CLOSED: all new document/source mutations fail. Existing reads/cuts unchanged.
BEGIN;
SET LOCAL lock_timeout='1s';
LOCK TABLE sgp_opt_shared.approvals,sgp_opt_shared.documents,sgp_opt_shared.sources IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE sgp_opt_shared.import_fence_control (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 certified boolean NOT NULL DEFAULT false,
 expected_active integer NOT NULL DEFAULT 2 CHECK(expected_active>=0),
 certificate text,
 CHECK(NOT certified OR length(btrim(certificate))>=16)
);
INSERT INTO sgp_opt_shared.import_fence_control(singleton) VALUES(true);
CREATE TABLE sgp_opt_shared.import_uncertainties (
 incident_id uuid PRIMARY KEY,
 pdf_sha256 text NOT NULL CHECK(pdf_sha256~'^[a-f0-9]{64}$'),
 opt text NOT NULL CHECK(length(btrim(opt)) BETWEEN 1 AND 200 AND opt=btrim(opt)),
 index_sha256 text CHECK(index_sha256 IS NULL OR index_sha256~'^[a-f0-9]{64}$'),
 original_identity jsonb NOT NULL CHECK(jsonb_typeof(original_identity)='object'),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 closed_at timestamptz,
 closure_certificate text,
 CHECK(active OR (closed_at IS NOT NULL AND length(btrim(closure_certificate))>=16))
);
REVOKE ALL ON sgp_opt_shared.import_fence_control,sgp_opt_shared.import_uncertainties FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION sgp_opt_shared.assert_import_fence(p_hash text,p_opt text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ctl sgp_opt_shared.import_fence_control%ROWTYPE; n integer;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'OPT_IMPORT_FENCE_ISOLATION'; END IF;
 -- Shared locks held until commit serialize certification/registry changes.
 -- No automatic retries; contention aborts the requesting transaction.
 LOCK TABLE sgp_opt_shared.import_fence_control,sgp_opt_shared.import_uncertainties IN SHARE MODE NOWAIT;
 SELECT * INTO ctl FROM sgp_opt_shared.import_fence_control WHERE singleton;
 IF NOT FOUND OR NOT ctl.certified THEN RAISE EXCEPTION 'OPT_IMPORT_FENCE_CLOSED'; END IF;
 SELECT count(*) INTO n FROM sgp_opt_shared.import_uncertainties WHERE active;
 IF n<>ctl.expected_active THEN RAISE EXCEPTION 'OPT_IMPORT_FENCE_REGISTRY_MISMATCH'; END IF;
 IF EXISTS(SELECT 1 FROM sgp_opt_shared.import_uncertainties
  WHERE active AND (pdf_sha256=p_hash OR (p_opt IS NOT NULL AND opt=p_opt)))
 THEN RAISE EXCEPTION 'OPT_PREVIOUS_OUTCOME_UNRESOLVED'; END IF;
END $$;
REVOKE ALL ON FUNCTION sgp_opt_shared.assert_import_fence(text,text) FROM PUBLIC,anon,authenticated,service_role;
-- Call after actor authorization, before any cached receipt branch in every RPC.
-- This helper is not wired into existing deployed RPCs by this proposal.
CREATE FUNCTION sgp_opt_shared.assert_import_request(p_pdf bytea,p_sources jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE h text; src jsonb;
BEGIN
 IF p_pdf IS NULL OR jsonb_typeof(p_sources) IS DISTINCT FROM 'array'
 OR jsonb_array_length(p_sources) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'OPT_IMPORT_FENCE_IDENTITY_REQUIRED'; END IF;
 h:=encode(sha256(p_pdf),'hex');
 PERFORM sgp_opt_shared.assert_import_fence(h,NULL);
 FOR src IN SELECT value FROM jsonb_array_elements(p_sources) LOOP
  IF jsonb_typeof(src->'consecutivo') IS DISTINCT FROM 'string' OR btrim(src->>'consecutivo')=''
  THEN RAISE EXCEPTION 'OPT_IMPORT_FENCE_IDENTITY_REQUIRED'; END IF;
  PERFORM sgp_opt_shared.assert_import_fence(h,src->>'consecutivo');
  IF src->>'source_key' LIKE 'OPT:%' THEN PERFORM sgp_opt_shared.assert_import_fence(h,substr(src->>'source_key',5)); END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION sgp_opt_shared.assert_import_request(bytea,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION sgp_opt_shared.enforce_import_fence() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE h text; src jsonb;
BEGIN
 IF TG_TABLE_NAME='approvals' THEN
  PERFORM sgp_opt_shared.assert_import_fence(NEW.sha256,NULL);
  FOR src IN SELECT value FROM jsonb_array_elements(NEW.fuentes) LOOP
   PERFORM sgp_opt_shared.assert_import_fence(NEW.sha256,src->>'consecutivo');
   IF src->>'source_key' LIKE 'OPT:%' THEN PERFORM sgp_opt_shared.assert_import_fence(NEW.sha256,substr(src->>'source_key',5)); END IF;
  END LOOP;
 ELSIF TG_TABLE_NAME='documents' THEN
  PERFORM sgp_opt_shared.assert_import_fence(NEW.sha256,NULL);
  IF TG_OP='UPDATE' THEN PERFORM sgp_opt_shared.assert_import_fence(OLD.sha256,NULL); END IF;
 ELSE
  SELECT sha256 INTO h FROM sgp_opt_shared.documents WHERE id_documento=NEW.id_documento;
  IF h IS NULL THEN RAISE EXCEPTION 'OPT_IMPORT_FENCE_DOCUMENT_REQUIRED'; END IF;
  PERFORM sgp_opt_shared.assert_import_fence(h,NEW.consecutivo);
  IF to_jsonb(NEW)->>'source_key' LIKE 'OPT:%' THEN PERFORM sgp_opt_shared.assert_import_fence(h,substr(to_jsonb(NEW)->>'source_key',5)); END IF;
  IF TG_OP='UPDATE' THEN
   SELECT sha256 INTO h FROM sgp_opt_shared.documents WHERE id_documento=OLD.id_documento;
   PERFORM sgp_opt_shared.assert_import_fence(h,OLD.consecutivo);
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sgp_opt_shared.enforce_import_fence() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER import_fence_approval BEFORE INSERT ON sgp_opt_shared.approvals
 FOR EACH ROW EXECUTE FUNCTION sgp_opt_shared.enforce_import_fence();
CREATE TRIGGER import_fence_document BEFORE INSERT OR UPDATE ON sgp_opt_shared.documents
 FOR EACH ROW EXECUTE FUNCTION sgp_opt_shared.enforce_import_fence();
CREATE TRIGGER import_fence_source BEFORE INSERT OR UPDATE ON sgp_opt_shared.sources
 FOR EACH ROW EXECUTE FUNCTION sgp_opt_shared.enforce_import_fence();
COMMIT;

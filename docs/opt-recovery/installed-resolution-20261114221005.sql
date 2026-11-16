-- LOCAL REVIEW ONLY. Not a migration runner or an authorization to install.
-- Install as postgres after fingerprint/ACL review of ALL import writers.
BEGIN;
SET LOCAL lock_timeout='2s';
DO $$ BEGIN IF current_user<>'postgres' THEN RAISE EXCEPTION 'OPT_RESOLUTION_INSTALL_OWNER'; END IF; END $$;
-- Drain pre-trigger writes before installation; fail rather than wait indefinitely.
LOCK TABLE sgp_opt_shared.approvals,sgp_opt_shared.documents,sgp_opt_shared.sources IN ACCESS EXCLUSIVE MODE;
CREATE TABLE sgp_opt_shared.import_resolution_decisions (
 decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor text NOT NULL CHECK(length(actor)>0), identity jsonb NOT NULL,
 identity_text text NOT NULL CHECK(identity_text::jsonb=identity),
 request_hash text NOT NULL CHECK(request_hash=encode(sha256(convert_to(identity_text,'UTF8')),'hex')),
 pdf_hash text NOT NULL UNIQUE CHECK(pdf_hash=identity#>>'{pdf,sha256}'),
 consecutive text NOT NULL UNIQUE CHECK(consecutive=identity#>>'{source,opt}'),
 evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 certified_by text NOT NULL DEFAULT session_user,
 issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '1 day',
 retry_generation uuid NOT NULL UNIQUE DEFAULT gen_random_uuid()
);
CREATE TABLE sgp_opt_shared.import_resolution_ack (
 decision_id uuid PRIMARY KEY REFERENCES sgp_opt_shared.import_resolution_decisions,
 actor text NOT NULL, acknowledged_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE sgp_opt_shared.import_resolution_consumption (
 decision_id uuid PRIMARY KEY REFERENCES sgp_opt_shared.import_resolution_decisions,
 attempt_id uuid NOT NULL UNIQUE, payload_hash text NOT NULL,
 receipt jsonb NOT NULL, committed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- Transaction-local capability. Never read from GUC, JWT metadata or caller evidence.
CREATE TABLE sgp_opt_shared.import_resolution_permit (
 transaction_id bigint PRIMARY KEY, decision_id uuid NOT NULL REFERENCES sgp_opt_shared.import_resolution_decisions,
 attempt_id uuid NOT NULL
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['import_resolution_decisions','import_resolution_ack','import_resolution_consumption','import_resolution_permit'] LOOP
 EXECUTE format('ALTER TABLE sgp_opt_shared.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON sgp_opt_shared.%I FROM PUBLIC,anon,authenticated,service_role',t);
 IF t<>'import_resolution_permit' THEN
 EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON sgp_opt_shared.%I FOR EACH ROW EXECUTE FUNCTION sgp_opt_shared.immutable()',t);
 END IF;
 END LOOP;
END $$;

-- The shared/exclusive gate lasts through COMMIT, including a late legacy call.
-- READ COMMITTED is mandatory: a historical REPEATABLE READ snapshot cannot certify absence.
CREATE FUNCTION sgp_opt_shared.resolution_gate(p_exclusive boolean) RETURNS void
LANGUAGE plpgsql VOLATILE SET search_path='' AS $$ BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'OPT_RESOLUTION_ISOLATION'; END IF;
 IF p_exclusive THEN PERFORM pg_advisory_xact_lock(459,213215);
 ELSE PERFORM pg_advisory_xact_lock_shared(459,213215); END IF;
END $$;

CREATE FUNCTION sgp_opt_shared.resolution_guard() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE h text; sources jsonb; d sgp_opt_shared.import_resolution_decisions; permitted boolean;
BEGIN
 PERFORM sgp_opt_shared.resolution_gate(false);
 IF TG_TABLE_NAME='approvals' THEN h:=NEW.sha256;sources:=NEW.fuentes;
 ELSIF TG_TABLE_NAME='documents' THEN h:=NEW.sha256;sources:='[]';
 ELSE
 SELECT sha256 INTO STRICT h FROM sgp_opt_shared.documents WHERE id_documento=NEW.id_documento;
 sources:=jsonb_build_array(jsonb_build_object('consecutivo',NEW.consecutivo,'source_key',NEW.source_key));
 END IF;
 FOR d IN SELECT * FROM sgp_opt_shared.import_resolution_decisions r
 WHERE r.pdf_hash=h OR EXISTS(SELECT 1 FROM jsonb_array_elements(sources) s
 WHERE s->>'consecutivo'=r.consecutive OR s->>'source_key'='OPT:'||r.consecutive) LOOP
 SELECT EXISTS(SELECT 1 FROM sgp_opt_shared.import_resolution_permit p
 WHERE p.transaction_id=txid_current() AND p.decision_id=d.decision_id
 AND NOT EXISTS(SELECT 1 FROM sgp_opt_shared.import_resolution_consumption c WHERE c.decision_id=d.decision_id)) INTO permitted;
 IF NOT permitted OR h IS DISTINCT FROM d.pdf_hash OR clock_timestamp()>=d.expires_at
 THEN RAISE EXCEPTION 'OPT_OLD_ATTEMPT_FENCED'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER resolution_guard BEFORE INSERT ON sgp_opt_shared.approvals FOR EACH ROW EXECUTE FUNCTION sgp_opt_shared.resolution_guard();
CREATE TRIGGER resolution_guard BEFORE INSERT ON sgp_opt_shared.documents FOR EACH ROW EXECUTE FUNCTION sgp_opt_shared.resolution_guard();
CREATE TRIGGER resolution_guard BEFORE INSERT ON sgp_opt_shared.sources FOR EACH ROW EXECUTE FUNCTION sgp_opt_shared.resolution_guard();

ALTER TABLE sgp_opt_shared.approvals ENABLE ALWAYS TRIGGER resolution_guard;
ALTER TABLE sgp_opt_shared.documents ENABLE ALWAYS TRIGGER resolution_guard;
ALTER TABLE sgp_opt_shared.sources ENABLE ALWAYS TRIGGER resolution_guard;

CREATE FUNCTION sgp_opt_shared.resolution_assert_absent(p_hash text,p_opt text) RETURNS void
LANGUAGE plpgsql VOLATILE SET search_path='' AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM sgp_opt_shared.documents WHERE sha256=p_hash)
 OR EXISTS(SELECT 1 FROM sgp_opt_shared.sources WHERE consecutivo=p_opt OR source_key='OPT:'||p_opt)
 OR EXISTS(SELECT 1 FROM sgp_opt_shared.approvals a WHERE a.sha256=p_hash OR EXISTS(
 SELECT 1 FROM jsonb_array_elements(a.fuentes) s WHERE s->>'consecutivo'=p_opt OR s->>'source_key'='OPT:'||p_opt))
 THEN RAISE EXCEPTION 'OPT_RESOLUTION_EVIDENCE_CONFLICT'; END IF;
 -- Existing FKs guarantee pieces/assignments cannot exist without document/approval.
END $$;

-- Private maintenance only: the exported original identity bytes + reviewed evidence
-- fingerprint are required. No certificate can be inferred by a browser from absence.
-- Restricted to Retail INDICE; other origins need separate reviewed integration.
CREATE FUNCTION sgp_opt_shared.certify_import_absence(p_actor text,p_identity_text text,p_request_hash text,p_evidence_sha256 text)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET lock_timeout='250ms' AS $$
DECLARE i jsonb:=p_identity_text::jsonb; d sgp_opt_shared.import_resolution_decisions;
BEGIN
 IF jsonb_typeof(i) IS DISTINCT FROM 'object' OR NOT(i ?& ARRAY['scope','source','pdf','index'])
 OR i-ARRAY['scope','source','pdf','index']<>'{}'::jsonb
 OR jsonb_typeof(i->'source') IS DISTINCT FROM 'object' OR (i->'source')-ARRAY['origin','opt','mode']<>'{}'::jsonb
 OR jsonb_typeof(i->'pdf') IS DISTINCT FROM 'object' OR (i->'pdf')-ARRAY['name','sha256']<>'{}'::jsonb
 OR jsonb_typeof(i->'index') IS DISTINCT FROM 'object' OR (i->'index')-ARRAY['name','sha256','format','sheet']<>'{}'::jsonb
 OR nullif(btrim(p_actor),'') IS NULL OR p_request_hash IS DISTINCT FROM encode(sha256(convert_to(p_identity_text,'UTF8')),'hex')
 OR coalesce(p_evidence_sha256,'') !~ '^[a-f0-9]{64}$'
 OR i#>>'{source,origin}' IS DISTINCT FROM 'RETAIL' OR i#>>'{source,mode}' IS DISTINCT FROM 'INDICE'
 OR coalesce(i#>>'{source,opt}','') !~ '^OPT[0-9]{4}-[0-9]{1,2}-[0-9]+-[A-Z0-9]+-[0-9]+$'
 OR i#>>'{pdf,name}' IS DISTINCT FROM (i#>>'{source,opt}')||'.pdf'
 OR coalesce(i#>>'{pdf,sha256}','') !~ '^[a-f0-9]{64}$'
 OR coalesce(i#>>'{index,sha256}','') !~ '^[a-f0-9]{64}$'
 OR jsonb_typeof(i#>'{index,name}') IS DISTINCT FROM 'string' OR length(i#>>'{index,name}') NOT BETWEEN 1 AND 255
 OR jsonb_typeof(i#>'{index,sheet}') IS DISTINCT FROM 'string' OR length(i#>>'{index,sheet}') NOT BETWEEN 1 AND 80
 OR coalesce(i#>>'{index,format}','') NOT IN ('xlsx','csv','json')
 THEN RAISE EXCEPTION 'OPT_RESOLUTION_IDENTITY'; END IF;
 PERFORM sgp_opt_shared.validate_scope(i->'scope');
 -- NOWAIT prevents a lock cycle with existing writers; operator must inspect failure.
 LOCK TABLE sgp_opt_shared.approvals,sgp_opt_shared.documents,sgp_opt_shared.sources IN SHARE ROW EXCLUSIVE MODE NOWAIT;
 PERFORM sgp_opt_shared.resolution_gate(true);
 SELECT * INTO d FROM sgp_opt_shared.import_resolution_decisions WHERE pdf_hash=i#>>'{pdf,sha256}' OR consecutive=i#>>'{source,opt}';
 IF FOUND THEN
 IF d.actor IS DISTINCT FROM p_actor OR d.identity_text IS DISTINCT FROM p_identity_text
 OR d.request_hash IS DISTINCT FROM p_request_hash OR d.evidence_sha256 IS DISTINCT FROM p_evidence_sha256
 THEN RAISE EXCEPTION 'OPT_RESOLUTION_CERTIFICATE_CONFLICT'; END IF;
 RETURN d.decision_id; -- Never renew expiry or generation by replay.
 END IF;
 PERFORM sgp_opt_shared.resolution_assert_absent(i#>>'{pdf,sha256}',i#>>'{source,opt}');
 INSERT INTO sgp_opt_shared.import_resolution_decisions(actor,identity,identity_text,request_hash,pdf_hash,consecutive,evidence_sha256)
 VALUES(p_actor,i,p_identity_text,p_request_hash,i#>>'{pdf,sha256}',i#>>'{source,opt}',p_evidence_sha256)
 RETURNING decision_id INTO d.decision_id;
 RETURN d.decision_id;
END $$;

CREATE FUNCTION public.sgp_opt_import_resolucion_v1(p_token text,p_identity jsonb,p_request_hash text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE a text; d sgp_opt_shared.import_resolution_decisions;
BEGIN
 a:=sgp_opt_shared.actor(p_token,true); PERFORM sgp_opt_shared.validate_scope(p_identity->'scope');
 PERFORM sgp_opt_shared.resolution_gate(false);
 SELECT * INTO d FROM sgp_opt_shared.import_resolution_decisions
 WHERE actor=a AND identity=p_identity AND request_hash=p_request_hash FOR UPDATE;
 IF NOT FOUND OR clock_timestamp()>=d.expires_at
 OR EXISTS(SELECT 1 FROM sgp_opt_shared.import_resolution_consumption WHERE decision_id=d.decision_id)
 THEN RAISE EXCEPTION 'OPT_RESOLUTION_UNAVAILABLE'; END IF;
 PERFORM sgp_opt_shared.resolution_assert_absent(d.pdf_hash,d.consecutive);
 INSERT INTO sgp_opt_shared.import_resolution_ack(decision_id,actor) VALUES(d.decision_id,a) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('contract','OPT-IMPORT-RESOLUTION-1','status','ABSENT_FINAL',
 'identity',d.identity,'requestHash',d.request_hash,'decisionId',d.decision_id,
 'retryGeneration',d.retry_generation,'evidenceSha256',d.evidence_sha256,'proofKind','DURABLE_FENCE',
 'issuedAt',d.issued_at,'expiresAt',d.expires_at,'retryMode','MANUAL_EXACT_ONLY','pdfArchived',false);
END $$;

-- Backend channel only. Must be called AFTER the normal index/PDF validation,
-- with the explicit manual plan; this function never substitutes that validation.
CREATE FUNCTION public.sgp_opt_importar_retail_resuelto_v1(p_token text,p_identity jsonb,p_request_hash text,
 p_decision uuid,p_generation uuid,p_attempt uuid,p_pdf bytea,p_manifest jsonb,p_sources jsonb,p_evidence jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
SET statement_timeout='1s' SET lock_timeout='250ms' AS $$
DECLARE a text; d sgp_opt_shared.import_resolution_decisions; c sgp_opt_shared.import_resolution_consumption;
 payload text; result jsonb;
BEGIN
 a:=sgp_opt_shared.actor(p_token,true);PERFORM sgp_opt_shared.validate_scope(p_identity->'scope');
 PERFORM sgp_opt_shared.resolution_gate(false);
 SELECT * INTO d FROM sgp_opt_shared.import_resolution_decisions WHERE decision_id=p_decision FOR UPDATE;
 IF NOT FOUND OR d.actor IS DISTINCT FROM a OR d.identity IS DISTINCT FROM p_identity
 OR d.request_hash IS DISTINCT FROM p_request_hash OR d.retry_generation IS DISTINCT FROM p_generation
 OR p_attempt IS NULL OR clock_timestamp()>=d.expires_at
 OR NOT EXISTS(SELECT 1 FROM sgp_opt_shared.import_resolution_ack WHERE decision_id=d.decision_id AND actor=a)
 OR encode(sha256(p_pdf),'hex') IS DISTINCT FROM d.pdf_hash
 OR p_sources IS DISTINCT FROM jsonb_build_array(jsonb_build_object('origen','RETAIL','modo_carga','INDICE','consecutivo',d.consecutive,'source_key','OPT:'||d.consecutive))
 OR p_evidence#>'{sgp_binding,scope}' IS DISTINCT FROM d.identity->'scope'
 OR p_evidence->'original_index' IS DISTINCT FROM (CASE WHEN d.identity#>>'{index,format}'='xlsx' THEN d.identity->'index' ELSE jsonb_set(d.identity->'index','{sheet}','null'::jsonb) END)
 THEN RAISE EXCEPTION 'OPT_RESOLUTION_UNAVAILABLE'; END IF;
 payload:=encode(sha256(convert_to(jsonb_build_array(p_identity,p_request_hash,encode(sha256(p_pdf),'hex'),p_manifest,p_sources,p_evidence)::text,'UTF8')),'hex');
 SELECT * INTO c FROM sgp_opt_shared.import_resolution_consumption WHERE decision_id=d.decision_id;
 IF FOUND THEN
 IF c.attempt_id IS DISTINCT FROM p_attempt OR c.payload_hash IS DISTINCT FROM payload THEN RAISE EXCEPTION 'OPT_RESOLUTION_ALREADY_CONSUMED'; END IF;
 RETURN c.receipt;
 END IF;
 PERFORM sgp_opt_shared.resolution_assert_absent(d.pdf_hash,d.consecutive);
 INSERT INTO sgp_opt_shared.import_resolution_permit VALUES(txid_current(),d.decision_id,p_attempt);
 -- Original v3 rechecks actor, scope, programming, manifest, index and all assignments.
 result:=public.sgp_opt_importar_retail_validado_v3(p_token,p_pdf,p_manifest,p_sources,p_evidence);
 IF result->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'OPT_RESOLUTION_IMPORT_NOT_CONFIRMED'; END IF;
 DELETE FROM sgp_opt_shared.import_resolution_permit WHERE transaction_id=txid_current();
 INSERT INTO sgp_opt_shared.import_resolution_consumption(decision_id,attempt_id,payload_hash,receipt)
 VALUES(d.decision_id,p_attempt,payload,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION sgp_opt_shared.resolution_gate(boolean),sgp_opt_shared.resolution_guard(),sgp_opt_shared.resolution_assert_absent(text,text),sgp_opt_shared.certify_import_absence(text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.sgp_opt_import_resolucion_v1(text,jsonb,text),public.sgp_opt_importar_retail_resuelto_v1(text,jsonb,text,uuid,uuid,uuid,bytea,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sgp_opt_import_resolucion_v1(text,jsonb,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sgp_opt_importar_retail_resuelto_v1(text,jsonb,text,uuid,uuid,uuid,bytea,jsonb,jsonb,jsonb) TO service_role;
COMMIT;

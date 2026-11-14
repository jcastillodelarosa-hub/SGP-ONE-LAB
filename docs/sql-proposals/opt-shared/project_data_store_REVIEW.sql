-- ISOLATED PROPOSAL ONLY. No production activation or application grants.
BEGIN;
CREATE TABLE sgp_opt_shared.project_data_metadata (
 id_documento uuid PRIMARY KEY REFERENCES sgp_opt_shared.documents(id_documento),
 pdf_sha256 text NOT NULL CHECK(pdf_sha256 ~ '^[a-f0-9]{64}$'),
 manifest_sha256 text NOT NULL CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$'),
 extractor_sha256 text NOT NULL CHECK(extractor_sha256 ~ '^[a-f0-9]{64}$'),
 metadata_sha256 text NOT NULL CHECK(metadata_sha256 ~ '^[a-f0-9]{64}$'),
 project_data jsonb NOT NULL,
 recovered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 recovered_by text NOT NULL DEFAULT session_user
);
ALTER TABLE sgp_opt_shared.project_data_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_opt_shared.project_data_metadata FORCE ROW LEVEL SECURITY;
REVOKE ALL ON sgp_opt_shared.project_data_metadata FROM PUBLIC,anon,authenticated,service_role;
-- No policies and no grants. Recovery is an owner-maintenance operation only.
CREATE FUNCTION sgp_opt_shared.project_data_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'OPT_PROJECT_DATA_IMMUTABLE'; END $$;
CREATE TRIGGER project_data_no_mutation BEFORE UPDATE OR DELETE OR TRUNCATE
 ON sgp_opt_shared.project_data_metadata FOR EACH STATEMENT
 EXECUTE FUNCTION sgp_opt_shared.project_data_immutable();
REVOKE ALL ON FUNCTION sgp_opt_shared.project_data_immutable() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION sgp_opt_shared.validate_project_data(p_data jsonb) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r jsonb; k text; total numeric:=0; fraction text[];
BEGIN
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object'
 OR p_data-ARRAY['contract','scope','rows','totalQuantity']<>'{}'::jsonb
 OR p_data->>'contract' IS DISTINCT FROM 'OPT-PROJECT-DATA-1'
 OR p_data->>'scope' IS DISTINCT FROM 'DOCUMENTO'
 OR jsonb_typeof(p_data->'rows') IS DISTINCT FROM 'array'
 OR jsonb_array_length(p_data->'rows') NOT BETWEEN 1 AND 10000
 OR octet_length(p_data::text)>2097152
 OR jsonb_typeof(p_data->'totalQuantity') IS DISTINCT FROM 'number'
 THEN RAISE EXCEPTION 'OPT_PROJECT_DATA_INVALID'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_data->'rows') LOOP
  IF jsonb_typeof(r) IS DISTINCT FROM 'object'
  OR NOT(r ?& ARRAY['item','sourcePage','sourceId','profile','code','length','reference','quantity'])
  OR r-ARRAY['item','sourcePage','sourceId','profile','code','length','reference','quantity']<>'{}'::jsonb
  THEN RAISE EXCEPTION 'OPT_PROJECT_DATA_ROW_INVALID'; END IF;
  FOREACH k IN ARRAY ARRAY['item','sourcePage','quantity'] LOOP
   IF jsonb_typeof(r->k) IS DISTINCT FROM 'number' OR r->>k !~ '^[1-9][0-9]{0,15}$'
   OR (r->>k)::numeric>9007199254740991 THEN RAISE EXCEPTION 'OPT_PROJECT_DATA_NUMBER_INVALID'; END IF;
  END LOOP;
  IF (r->>'sourcePage')::numeric>500 OR r->>'sourceId' IS DISTINCT FROM 'project-p'||(r->>'sourcePage')||'-item'||(r->>'item')
  THEN RAISE EXCEPTION 'OPT_PROJECT_DATA_PROVENANCE'; END IF;
  FOREACH k IN ARRAY ARRAY['sourceId','profile','code','length','reference'] LOOP
   IF jsonb_typeof(r->k) IS DISTINCT FROM 'string' OR length(btrim(r->>k))=0
   OR length(r->>k)>(CASE k WHEN 'sourceId' THEN 200 WHEN 'profile' THEN 255 WHEN 'code' THEN 2000 WHEN 'length' THEN 100 ELSE 8000 END)
   OR regexp_replace(r->>k,E'[\t\n\r]','','g') ~ '[[:cntrl:]]'
   THEN RAISE EXCEPTION 'OPT_PROJECT_DATA_TEXT_INVALID'; END IF;
  END LOOP;
  fraction:=regexp_match(r->>'length','^([0-9]+)(?:[[:space:]]+([0-9]+)/([0-9]+))?"$');
  IF fraction IS NULL OR coalesce(fraction[3],'1')::numeric<=0
   OR coalesce(fraction[2],'0')::numeric>=coalesce(fraction[3],'1')::numeric
   OR fraction[1]::numeric>9007199254740991 OR coalesce(fraction[2],'0')::numeric>9007199254740991 OR coalesce(fraction[3],'1')::numeric>9007199254740991
   OR fraction[1]::numeric+coalesce(fraction[2],'0')::numeric<=0
  THEN RAISE EXCEPTION 'OPT_PROJECT_DATA_LENGTH_INVALID'; END IF;
  total:=total+(r->>'quantity')::numeric;
 END LOOP;
 IF total>9007199254740991 OR total<>(p_data->>'totalQuantity')::numeric
 OR (SELECT count(DISTINCT x->>'sourceId') FROM jsonb_array_elements(p_data->'rows') x)<>jsonb_array_length(p_data->'rows')
 OR (SELECT count(DISTINCT x->>'item') FROM jsonb_array_elements(p_data->'rows') x)<>jsonb_array_length(p_data->'rows')
 THEN RAISE EXCEPTION 'OPT_PROJECT_DATA_TOTAL_OR_DUPLICATE'; END IF;
END $$;
REVOKE ALL ON FUNCTION sgp_opt_shared.validate_project_data(jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION sgp_opt_shared.recover_project_data_reviewed(p_batch jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE input jsonb; doc record; existing record; pdf bytea; actual_hash text; data_hash text;
 inserted integer:=0; duplicates integer:=0;
BEGIN
 IF jsonb_typeof(p_batch) IS DISTINCT FROM 'array' OR jsonb_array_length(p_batch) NOT BETWEEN 1 AND 20
 OR octet_length(p_batch::text)>67108864
 OR (SELECT count(DISTINCT x->>'id_documento') FROM jsonb_array_elements(p_batch) x)<>jsonb_array_length(p_batch)
 THEN RAISE EXCEPTION 'OPT_PROJECT_DATA_BATCH_INVALID'; END IF;
 FOR input IN SELECT value FROM jsonb_array_elements(p_batch) ORDER BY value->>'id_documento' LOOP
  IF jsonb_typeof(input) IS DISTINCT FROM 'object'
   OR NOT(input ?& ARRAY['id_documento','pdf_hex','expected_sha256','expected_manifest_sha256','extractor_sha256','projectData'])
   OR input-ARRAY['id_documento','pdf_hex','expected_sha256','expected_manifest_sha256','extractor_sha256','projectData']<>'{}'::jsonb
   OR jsonb_typeof(input->'pdf_hex') IS DISTINCT FROM 'string'
   OR length(input->>'pdf_hex') NOT BETWEEN 10 AND 2097152 OR input->>'pdf_hex' !~ '^[0-9a-f]+$'
   OR jsonb_typeof(input->'extractor_sha256') IS DISTINCT FROM 'string'
   OR coalesce(input->>'extractor_sha256','') !~ '^[a-f0-9]{64}$'
  THEN RAISE EXCEPTION 'OPT_PROJECT_DATA_INPUT_INVALID'; END IF;
  pdf:=decode(input->>'pdf_hex','hex');actual_hash:=encode(sha256(pdf),'hex');
  IF substring(pdf FROM 1 FOR 5)<>convert_to('%PDF-','UTF8') OR actual_hash IS DISTINCT FROM input->>'expected_sha256'
  THEN RAISE EXCEPTION 'OPT_PROJECT_DATA_PDF_HASH'; END IF;
  SELECT * INTO STRICT doc FROM sgp_opt_shared.documents WHERE id_documento=(input->>'id_documento')::uuid FOR UPDATE;
  IF doc.sha256 IS DISTINCT FROM actual_hash OR doc.manifest_sha256 IS DISTINCT FROM input->>'expected_manifest_sha256'
  THEN RAISE EXCEPTION 'OPT_PROJECT_DATA_DOCUMENT_CHANGED'; END IF;
  PERFORM sgp_opt_shared.validate_project_data(input->'projectData');
  data_hash:=encode(sha256(convert_to((input->'projectData')::text,'UTF8')),'hex');
  SELECT * INTO existing FROM sgp_opt_shared.project_data_metadata WHERE id_documento=doc.id_documento;
  IF FOUND THEN
   IF existing.pdf_sha256<>actual_hash OR existing.manifest_sha256<>doc.manifest_sha256
    OR existing.metadata_sha256<>data_hash OR existing.project_data IS DISTINCT FROM input->'projectData'
    OR existing.extractor_sha256<>input->>'extractor_sha256'
   THEN RAISE EXCEPTION 'OPT_PROJECT_DATA_REPLAY_MISMATCH'; END IF;
   duplicates:=duplicates+1;
  ELSE
   INSERT INTO sgp_opt_shared.project_data_metadata(id_documento,pdf_sha256,manifest_sha256,extractor_sha256,metadata_sha256,project_data)
    VALUES(doc.id_documento,actual_hash,doc.manifest_sha256,input->>'extractor_sha256',data_hash,input->'projectData');
   inserted:=inserted+1;
  END IF;
 END LOOP;
 RETURN jsonb_build_object('inserted',inserted,'duplicates',duplicates);
END $$;
REVOKE ALL ON FUNCTION sgp_opt_shared.recover_project_data_reviewed(jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- Reader is installed separately with existing-document admission and existing ACL.
-- See project_data_document_reader_REVIEW.sql. No new reader grant is introduced.
COMMIT;

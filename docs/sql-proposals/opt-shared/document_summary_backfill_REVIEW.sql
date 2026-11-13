-- LOCAL OWNER-ONLY PROPOSAL. Do not apply without private reviewed nine-document
-- SHA/snapshot payload reconstructed from original PDF bytes by trusted extractor.
-- No browser/service_role grants, no reimport, no piece/assignment/cut writes.
BEGIN;
CREATE FUNCTION sgp_opt_shared.backfill_document_summaries_reviewed(p_batch jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE item jsonb; doc record; old_evidence jsonb; summary jsonb; count_updated integer:=0;
BEGIN
 IF jsonb_typeof(p_batch) IS DISTINCT FROM 'array' OR jsonb_array_length(p_batch)<>9
 THEN RAISE EXCEPTION 'OPT_BACKFILL_EXPECT_NINE'; END IF;
 IF (SELECT count(DISTINCT x->>'sha256') FROM jsonb_array_elements(p_batch) x)<>9
 OR (SELECT count(DISTINCT x->>'id_documento') FROM jsonb_array_elements(p_batch) x)<>9
 THEN RAISE EXCEPTION 'OPT_BACKFILL_DUPLICATE'; END IF;
 -- Stable order avoids deadlocks. All errors roll back the whole batch.
 FOR item IN SELECT value FROM jsonb_array_elements(p_batch) ORDER BY value->>'id_documento' LOOP
  SELECT * INTO STRICT doc FROM sgp_opt_shared.documents
   WHERE id_documento=(item->>'id_documento')::uuid FOR UPDATE;
  IF doc.sha256 IS DISTINCT FROM item->>'sha256'
   OR doc.id_aprobacion::text IS DISTINCT FROM item->>'id_aprobacion'
   OR doc.manifest_sha256 IS DISTINCT FROM item->>'manifest_sha256'
  THEN RAISE EXCEPTION 'OPT_BACKFILL_DOCUMENT_CHANGED'; END IF;
  SELECT evidencia INTO STRICT old_evidence FROM sgp_opt_shared.approvals
   WHERE id_aprobacion=doc.id_aprobacion AND sha256=doc.sha256 FOR UPDATE;
  -- Snapshot uses PostgreSQL JSONB canonical serialization, not JS JSON.stringify.
  IF encode(sha256(convert_to(old_evidence::text,'UTF8')),'hex') IS DISTINCT FROM item->>'expected_evidence_sha256'
  THEN RAISE EXCEPTION 'OPT_BACKFILL_EVIDENCE_CHANGED'; END IF;
  IF old_evidence ? 'documentary_summary' AND old_evidence->'documentary_summary'<>'null'::jsonb
  THEN RAISE EXCEPTION 'OPT_BACKFILL_SUMMARY_EXISTS'; END IF;
  summary:=item->'summary';
  IF summary->>'contract' IS DISTINCT FROM 'OPT-DOCUMENT-SUMMARY-1'
   OR summary->>'scope' IS DISTINCT FROM 'DOCUMENTO'
   OR jsonb_typeof(summary->'cutRows') IS DISTINCT FROM 'array'
   OR jsonb_typeof(summary->'materialRows') IS DISTINCT FROM 'array'
   OR jsonb_array_length(summary->'cutRows')>10000
   OR jsonb_array_length(summary->'materialRows')>10000
   OR octet_length(summary::text)>2097152
  THEN RAISE EXCEPTION 'OPT_BACKFILL_SUMMARY_INVALID'; END IF;
  UPDATE sgp_opt_shared.approvals SET evidencia=jsonb_set(old_evidence,'{documentary_summary}',summary,true)
   WHERE id_aprobacion=doc.id_aprobacion;
  count_updated:=count_updated+1;
 END LOOP;
 RETURN count_updated;
END $$;
REVOKE ALL ON FUNCTION sgp_opt_shared.backfill_document_summaries_reviewed(jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;

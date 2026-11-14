-- PROPOSAL ONLY: Johan explicitly authorizes complete Project data to existing
-- legitimate document readers. No anonymous session bypass, role or scope expansion.
-- Requires project_data_store_REVIEW.sql; replaces only exact known reader versions.
BEGIN;
DO $review$
DECLARE fingerprint text;
BEGIN
 SELECT encode(sha256(convert_to(pg_get_functiondef('public.sgp_opt_resumen_documental_v1(text,jsonb,text,text)'::regprocedure),'UTF8')),'hex') INTO fingerprint;
 IF fingerprint='a80734f680f5cffc6b5eef94b595fefc3aa19debc1ab6fb04debb52551ff38fb' THEN RETURN; END IF;
 IF fingerprint NOT IN ('4809da617dff4279be9729b6df88d4a7e9b5c6c103e03efdbaafc97145c61875','6073f58c1c2500c20ceff653b16a5dbc4e054e8e86a8a05203b4f1140504e27c') THEN RAISE EXCEPTION 'OPT_SUMMARY_READER_CHANGED'; END IF;
 EXECUTE $reader$
CREATE OR REPLACE FUNCTION public.sgp_opt_resumen_documental_v1(p_token text, p_scope jsonb, p_reserva text, p_sistema text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE docs jsonb;
BEGIN
 PERFORM sgp_opt_shared.actor(p_token,false);
 PERFORM sgp_opt_shared.validate_scope(p_scope);
 IF coalesce(btrim(p_reserva),'')='' OR coalesce(btrim(p_sistema),'')='' THEN RAISE EXCEPTION 'OPT_RESUMEN_SCOPE_INVALIDO'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id_documento',d.id_documento,'sha256',d.sha256,
  'opt',(SELECT min(s.consecutivo) FROM sgp_opt_shared.sources s WHERE s.id_documento=d.id_documento),
  'scope','DOCUMENTO','status',CASE WHEN v.summary->>'contract'='OPT-DOCUMENT-SUMMARY-1' THEN CASE WHEN jsonb_array_length(v.summary->'cutRows')>0 AND jsonb_array_length(v.summary->'materialRows')>0 THEN 'AVAILABLE' ELSE 'PARTIAL' END ELSE 'NOT_PERSISTED' END,
  'summary',CASE WHEN v.summary->>'contract'='OPT-DOCUMENT-SUMMARY-1' THEN v.summary ELSE null END
 ) ORDER BY d.id_documento),'[]'::jsonb) INTO docs
 FROM sgp_opt_shared.documents d JOIN sgp_opt_shared.approvals a USING(id_aprobacion)
 LEFT JOIN sgp_opt_shared.document_summaries h ON h.id_documento=d.id_documento AND h.sha256=d.sha256 AND h.id_aprobacion=d.id_aprobacion AND h.manifest_sha256=d.manifest_sha256
 AND h.evidence_sha256=encode(sha256(convert_to(a.evidencia::text,'UTF8')),'hex')

 LEFT JOIN sgp_opt_shared.project_data_metadata pd ON pd.id_documento=d.id_documento
 AND pd.pdf_sha256=d.sha256 AND pd.manifest_sha256=d.manifest_sha256
 AND pd.metadata_sha256=encode(sha256(convert_to(pd.project_data::text,'UTF8')),'hex')
CROSS JOIN LATERAL (SELECT CASE WHEN a.evidencia#>>'{documentary_summary,contract}'='OPT-DOCUMENT-SUMMARY-1' THEN a.evidencia->'documentary_summary' ELSE h.summary END summary) e

 CROSS JOIN LATERAL (SELECT CASE WHEN pd.id_documento IS NOT NULL THEN
  coalesce(CASE WHEN e.summary->>'contract'='OPT-DOCUMENT-SUMMARY-1' THEN e.summary-'projectData' END,
   jsonb_build_object('contract','OPT-DOCUMENT-SUMMARY-1','scope','DOCUMENTO','cutRows','[]'::jsonb,'materialRows','[]'::jsonb))
   ||jsonb_build_object('projectData',pd.project_data)
  ELSE e.summary-'projectData' END summary) v
WHERE EXISTS(SELECT 1 FROM sgp_opt_shared.pieces p JOIN sgp_opt_shared.assignments x USING(id_pieza)
 WHERE p.id_documento=d.id_documento AND x.reserva=p_reserva AND x.sistema=p_sistema
 AND sgp_opt_shared.in_scope(x.key_produccion,p_scope));
 RETURN jsonb_build_object('contract','OPT-DOCUMENT-SUMMARIES-1','scope',p_scope,'reservation',p_reserva,'system',p_sistema,'documents',docs);
END $function$
$reader$;
END $review$;
COMMIT;

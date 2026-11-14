-- REVIEW ONLY: containment after approved Project data reader activation.
-- Pause disclosure, retain private metadata and all existing summaries/permissions.
BEGIN;
DO $review$
DECLARE fingerprint text;
BEGIN
 SELECT encode(sha256(convert_to(pg_get_functiondef('public.sgp_opt_resumen_documental_v1(text,jsonb,text,text)'::regprocedure),'UTF8')),'hex') INTO fingerprint;
 IF fingerprint='6073f58c1c2500c20ceff653b16a5dbc4e054e8e86a8a05203b4f1140504e27c' THEN RETURN; END IF;
 IF fingerprint<>'a80734f680f5cffc6b5eef94b595fefc3aa19debc1ab6fb04debb52551ff38fb' THEN RAISE EXCEPTION 'OPT_SUMMARY_READER_CHANGED'; END IF;
 EXECUTE $guarded$
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
  'scope','DOCUMENTO','status',CASE WHEN e.summary->>'contract'='OPT-DOCUMENT-SUMMARY-1' THEN CASE WHEN jsonb_array_length(e.summary->'cutRows')>0 AND jsonb_array_length(e.summary->'materialRows')>0 THEN 'AVAILABLE' ELSE 'PARTIAL' END ELSE 'NOT_PERSISTED' END,
  'summary',CASE WHEN e.summary->>'contract'='OPT-DOCUMENT-SUMMARY-1' THEN e.summary-'projectData' ELSE null END
 ) ORDER BY d.id_documento),'[]'::jsonb) INTO docs
 FROM sgp_opt_shared.documents d JOIN sgp_opt_shared.approvals a USING(id_aprobacion)
 LEFT JOIN sgp_opt_shared.document_summaries h ON h.id_documento=d.id_documento AND h.sha256=d.sha256 AND h.id_aprobacion=d.id_aprobacion AND h.manifest_sha256=d.manifest_sha256
 AND h.evidence_sha256=encode(sha256(convert_to(a.evidencia::text,'UTF8')),'hex')
 CROSS JOIN LATERAL (SELECT CASE WHEN a.evidencia#>>'{documentary_summary,contract}'='OPT-DOCUMENT-SUMMARY-1' THEN a.evidencia->'documentary_summary' ELSE h.summary END summary) e
 WHERE EXISTS(SELECT 1 FROM sgp_opt_shared.pieces p JOIN sgp_opt_shared.assignments x USING(id_pieza)
 WHERE p.id_documento=d.id_documento AND x.reserva=p_reserva AND x.sistema=p_sistema
 AND sgp_opt_shared.in_scope(x.key_produccion,p_scope));
 RETURN jsonb_build_object('contract','OPT-DOCUMENT-SUMMARIES-1','scope',p_scope,'reservation',p_reserva,'system',p_sistema,'documents',docs);
END $function$
$guarded$;
END $review$;
COMMIT;

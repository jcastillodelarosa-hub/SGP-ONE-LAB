-- LOCAL REVIEW ONLY; no deployment/grants. Requires updated private import channels.
-- Unapproved full Project data references are omitted even when inline.
-- Existing documents remain NOT_PERSISTED. Never reconstruct printed totals from pieces.
BEGIN;
CREATE FUNCTION public.sgp_opt_resumen_documental_v1(p_token text,p_scope jsonb,p_reserva text,p_sistema text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE docs jsonb;
BEGIN
 PERFORM sgp_opt_shared.actor(p_token,false);
 PERFORM sgp_opt_shared.validate_scope(p_scope);
 IF coalesce(btrim(p_reserva),'')='' OR coalesce(btrim(p_sistema),'')='' THEN RAISE EXCEPTION 'OPT_RESUMEN_SCOPE_INVALIDO'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id_documento',d.id_documento,'sha256',d.sha256,
  'opt',(SELECT min(s.consecutivo) FROM sgp_opt_shared.sources s WHERE s.id_documento=d.id_documento),
  'scope','DOCUMENTO','status',CASE WHEN a.evidencia#>>'{documentary_summary,contract}'='OPT-DOCUMENT-SUMMARY-1' THEN CASE WHEN jsonb_array_length(a.evidencia#>'{documentary_summary,cutRows}')>0 AND jsonb_array_length(a.evidencia#>'{documentary_summary,materialRows}')>0 THEN 'AVAILABLE' ELSE 'PARTIAL' END ELSE 'NOT_PERSISTED' END,
  'summary',CASE WHEN a.evidencia#>>'{documentary_summary,contract}'='OPT-DOCUMENT-SUMMARY-1' THEN (a.evidencia->'documentary_summary')-'projectData' ELSE null END
 ) ORDER BY d.id_documento),'[]'::jsonb) INTO docs
 FROM sgp_opt_shared.documents d JOIN sgp_opt_shared.approvals a USING(id_aprobacion)
 WHERE EXISTS(SELECT 1 FROM sgp_opt_shared.pieces p JOIN sgp_opt_shared.assignments x USING(id_pieza)
 WHERE p.id_documento=d.id_documento AND x.reserva=p_reserva AND x.sistema=p_sistema
 AND sgp_opt_shared.in_scope(x.key_produccion,p_scope));
 RETURN jsonb_build_object('contract','OPT-DOCUMENT-SUMMARIES-1','scope',p_scope,'reservation',p_reserva,'system',p_sistema,'documents',docs);
END $$;
REVOKE ALL ON FUNCTION public.sgp_opt_resumen_documental_v1(text,jsonb,text,text) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;

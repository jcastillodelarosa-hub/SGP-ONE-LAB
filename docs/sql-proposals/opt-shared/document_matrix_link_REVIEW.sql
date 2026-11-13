-- REVIEW ONLY: v452. Requires separate authorization before applying to LAB.
-- Replaces only documentary metadata reader; preserves signature, ACL and actor/scope.
-- No grants, data changes, writer changes or new assignment permissions.
BEGIN;
CREATE OR REPLACE FUNCTION public.sgp_opt_referencias_documentales_v1(p_token text,p_scope jsonb,p_reserva text,p_sistema text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result_refs jsonb;
BEGIN
 PERFORM sgp_opt_shared.actor(p_token,false);
 PERFORM sgp_opt_shared.validate_scope(p_scope);
 IF coalesce(btrim(p_reserva),'')='' OR coalesce(btrim(p_sistema),'')='' THEN RAISE EXCEPTION 'OPT_DOCUMENT_SCOPE_DENIED'; END IF;
 -- Existing in-scope assignment authorizes this document, not other documents or writes.
 WITH authorized AS (
  SELECT DISTINCT p.id_documento FROM sgp_opt_shared.pieces p JOIN sgp_opt_shared.assignments a USING(id_pieza)
  WHERE a.reserva=p_reserva AND a.sistema=p_sistema AND sgp_opt_shared.in_scope(a.key_produccion,p_scope)
 ), refs AS (
  SELECT d.id_documento,d.sha256,p.referencia,count(*) piezas_documento,
   CASE WHEN count(DISTINCT a.sistema)=1 THEN min(a.sistema)
    WHEN count(DISTINCT a.sistema)=0 THEN (
     -- Exact reference in the reviewed library, never prefix/name inference.
     -- Pending or multiple live candidates block selection, including same-system duplicates.
     SELECT CASE WHEN count(*)=1 AND bool_and(m.status='APPROVED') THEN min(m.sistema) ELSE null END
     FROM sgp_opt_matrices.entries m WHERE m.referencia=p.referencia AND m.status<>'RETIRED'
    ) ELSE null END sistema
  FROM authorized ad JOIN sgp_opt_shared.documents d USING(id_documento)
  JOIN sgp_opt_shared.pieces p USING(id_documento) LEFT JOIN sgp_opt_shared.assignments a USING(id_pieza)
  GROUP BY d.id_documento,d.sha256,p.referencia
 ) SELECT coalesce(jsonb_agg(to_jsonb(refs) ORDER BY id_documento,referencia),'[]') INTO result_refs FROM refs;
 RETURN jsonb_build_object('contract','OPT-DOCUMENT-REFERENCES-1','scope',p_scope,'reservation',p_reserva,'system',p_sistema,'references',result_refs);
END $$;
COMMIT;

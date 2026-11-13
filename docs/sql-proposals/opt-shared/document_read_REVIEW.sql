-- REVIEW ONLY. Additive documentary read contract; no writes or role changes.
-- Requires the existing private document_plans extension. Never apply automatically.
BEGIN;
CREATE FUNCTION public.sgp_opt_referencias_documentales_v1(p_token text,p_scope jsonb,p_reserva text,p_sistema text)
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
   CASE WHEN count(DISTINCT a.sistema)=1 THEN min(a.sistema) ELSE null END sistema
  FROM authorized ad JOIN sgp_opt_shared.documents d USING(id_documento)
  JOIN sgp_opt_shared.pieces p USING(id_documento) LEFT JOIN sgp_opt_shared.assignments a USING(id_pieza)
  GROUP BY d.id_documento,d.sha256,p.referencia
 ) SELECT coalesce(jsonb_agg(to_jsonb(refs) ORDER BY id_documento,referencia),'[]') INTO result_refs FROM refs;
 RETURN jsonb_build_object('contract','OPT-DOCUMENT-REFERENCES-1','scope',p_scope,'reservation',p_reserva,'system',p_sistema,'references',result_refs);
END $$;
CREATE FUNCTION public.sgp_opt_esquema_documental_v2(p_token text,p_scope jsonb,p_reserva text,p_sistema text,p_id_documento uuid,p_referencia text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE doc record; evidence jsonb; result jsonb; allowed uuid[];
BEGIN
 PERFORM sgp_opt_shared.actor(p_token,false); PERFORM sgp_opt_shared.validate_scope(p_scope);
 IF NOT EXISTS(SELECT 1 FROM sgp_opt_shared.pieces p JOIN sgp_opt_shared.assignments x USING(id_pieza)
 WHERE p.id_documento=p_id_documento AND x.reserva=p_reserva AND x.sistema=p_sistema AND sgp_opt_shared.in_scope(x.key_produccion,p_scope))
 OR NOT EXISTS(SELECT 1 FROM sgp_opt_shared.pieces p WHERE p.id_documento=p_id_documento AND p.referencia=p_referencia)
 THEN RAISE EXCEPTION 'OPT_DOCUMENT_SCOPE_DENIED'; END IF;
 SELECT coalesce(array_agg(p.id_pieza),'{}'::uuid[]) INTO allowed FROM sgp_opt_shared.pieces p JOIN sgp_opt_shared.assignments x USING(id_pieza)
 WHERE p.id_documento=p_id_documento AND p.referencia=p_referencia AND x.reserva=p_reserva AND x.sistema=p_sistema AND sgp_opt_shared.in_scope(x.key_produccion,p_scope);
 SELECT * INTO STRICT doc FROM sgp_opt_shared.documents WHERE id_documento=p_id_documento;
 SELECT h.geometry INTO evidence FROM sgp_opt_shared.document_plans h JOIN sgp_opt_shared.approvals a ON a.id_aprobacion=h.id_aprobacion
 WHERE h.id_documento=doc.id_documento AND h.sha256=doc.sha256 AND h.manifest_sha256=doc.manifest_sha256 AND h.id_aprobacion=doc.id_aprobacion
 AND h.evidence_sha256=encode(sha256(convert_to(a.evidencia::text,'UTF8')),'hex');
 -- Explicit projection: no foreign piece IDs, production keys or project labels.
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',plan->'id','ref',plan->'ref','finish',plan->'finish','length',plan->'length',
 'page',plan->'page','barqty',plan->'barqty','rest',plan->'rest','code',plan->'code','location',plan->'location',
 'restDisposition',plan->'restDisposition','sourceSettings',plan->'sourceSettings','cuts',(
 SELECT jsonb_agg(jsonb_build_object('length',c->'length','profileInstance',c->'profileInstance',
 'id_pieza',CASE WHEN (c->>'id_pieza')::uuid=ANY(allowed) THEN c->>'id_pieza' ELSE null END,
 'selectedReservation',(c->>'id_pieza')::uuid=ANY(allowed),
 'project',CASE WHEN (c->>'id_pieza')::uuid=ANY(allowed) THEN coalesce(c->>'project','') ELSE '' END) ORDER BY bi,ci)
 FROM jsonb_array_elements(plan->'bars') WITH ORDINALITY b(bar,bi) CROSS JOIN LATERAL jsonb_array_elements(bar->'cuts') WITH ORDINALITY cc(c,ci)
 )) ORDER BY pi),'[]') INTO result FROM jsonb_array_elements(evidence->'plans') WITH ORDINALITY pp(plan,pi) WHERE plan->>'ref'=p_referencia;
 RETURN jsonb_build_object('contract','OPT-DOCUMENT-PLANS-2','scope',p_scope,'reservation',p_reserva,'system',p_sistema,'id_documento',doc.id_documento,
 'sha256',doc.sha256,'reference',p_referencia,'status',CASE WHEN evidence IS NULL OR jsonb_array_length(result)=0 THEN 'NOT_PERSISTED' ELSE 'AVAILABLE' END,'plans',result);
END $$;
REVOKE ALL ON FUNCTION public.sgp_opt_referencias_documentales_v1(text,jsonb,text,text),public.sgp_opt_esquema_documental_v2(text,jsonb,text,text,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;

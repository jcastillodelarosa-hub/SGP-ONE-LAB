-- PREPARED ONLY. Read-only observation; absence is NEVER a retry authorization.
-- No PDF, no mutation, no import call, no resolution of an old in-flight request.
BEGIN;
CREATE FUNCTION public.sgp_opt_import_observacion_v1(p_token text,p_identity jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE scope jsonb; doc uuid; matched boolean; src jsonb; idx jsonb;
BEGIN
 PERFORM sgp_opt_shared.actor(p_token,true);
 scope:=p_identity->'scope'; PERFORM sgp_opt_shared.validate_scope(scope);
 IF jsonb_typeof(p_identity) IS DISTINCT FROM 'object' OR NOT(p_identity ?& ARRAY['scope','source','pdf','index'])
 OR p_identity-ARRAY['scope','source','pdf','index']<>'{}'::jsonb
 OR jsonb_typeof(p_identity->'source') IS DISTINCT FROM 'object'
 OR NOT((p_identity->'source') ?& ARRAY['origin','opt','mode'])
 OR (p_identity->'source')-ARRAY['origin','opt','mode']<>'{}'::jsonb
 OR coalesce(p_identity#>>'{source,origin}','') NOT IN ('RETAIL','PROYECTO')
 OR p_identity#>>'{source,mode}' IS DISTINCT FROM 'INDICE'
 OR coalesce(p_identity#>>'{source,opt}','') !~ '^OPT[0-9]{4}-[0-9]{1,2}-[0-9]+-[A-Z0-9]+-[0-9]+$'
 OR jsonb_typeof(p_identity->'pdf') IS DISTINCT FROM 'object'
 OR NOT((p_identity->'pdf') ?& ARRAY['name','sha256'])
 OR (p_identity->'pdf')-ARRAY['name','sha256']<>'{}'::jsonb
 OR p_identity#>>'{pdf,name}' IS DISTINCT FROM (p_identity#>>'{source,opt}')||'.pdf'
 OR coalesce(p_identity#>>'{pdf,sha256}','') !~ '^[a-f0-9]{64}$'
 OR jsonb_typeof(p_identity->'index') IS DISTINCT FROM 'object'
 OR NOT((p_identity->'index') ?& ARRAY['name','sha256','format','sheet'])
 OR (p_identity->'index')-ARRAY['name','sha256','format','sheet']<>'{}'::jsonb
 OR coalesce(p_identity#>>'{index,sha256}','') !~ '^[a-f0-9]{64}$'
 OR coalesce(p_identity#>>'{index,format}','') NOT IN ('xlsx','csv','json')
 OR jsonb_typeof(p_identity#>'{index,name}') IS DISTINCT FROM 'string'
 OR length(p_identity#>>'{index,name}') NOT BETWEEN 1 AND 255
 OR jsonb_typeof(p_identity#>'{index,sheet}') IS DISTINCT FROM 'string'
 OR length(p_identity#>>'{index,sheet}') NOT BETWEEN 1 AND 80
 THEN RAISE EXCEPTION 'OPT_OBSERVACION_IDENTIDAD_INVALIDA'; END IF;
 src:=p_identity->'source';idx:=p_identity->'index';
 -- Admit only documents already readable through exact operational assignment.
 -- No global hash/consecutive existence oracle for documents outside this scope.
 SELECT d.id_documento,
   a.evidencia#>'{sgp_binding,scope}'=scope
   AND a.evidencia->'original_index'=idx
 INTO doc,matched
 FROM sgp_opt_shared.documents d
 JOIN sgp_opt_shared.sources s USING(id_documento)
 JOIN sgp_opt_shared.approvals a ON a.id_aprobacion=s.id_aprobacion
 WHERE d.sha256=p_identity#>>'{pdf,sha256}'
 AND s.origen=src->>'origin' AND s.modo_carga='INDICE'
 AND s.consecutivo=src->>'opt' AND s.source_key='OPT:'||(src->>'opt')
 AND EXISTS(SELECT 1 FROM sgp_opt_shared.pieces p JOIN sgp_opt_shared.assignments x USING(id_pieza)
   WHERE p.id_documento=d.id_documento AND sgp_opt_shared.bound(p.id_pieza)
   AND sgp_opt_shared.in_scope(x.key_produccion,scope));
 RETURN jsonb_build_object('contract','OPT-IMPORT-OBSERVATION-1','identity',p_identity,
  'status',CASE WHEN doc IS NULL THEN 'NOT_OBSERVED' WHEN matched IS TRUE THEN 'COMMITTED_MATCH' ELSE 'EVIDENCE_MISMATCH' END,
  'retryAuthorized',false,'pdfArchived',false);
END $$;
REVOKE ALL ON FUNCTION public.sgp_opt_import_observacion_v1(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
-- Existing application uses SGP session tokens; roles alone never authorize a read.
GRANT EXECUTE ON FUNCTION public.sgp_opt_import_observacion_v1(text,jsonb) TO anon,authenticated;
COMMIT;

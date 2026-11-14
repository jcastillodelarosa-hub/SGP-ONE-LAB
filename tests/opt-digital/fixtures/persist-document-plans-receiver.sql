-- Observed receiver definition only, no business rows. Local tests; NOT a migration.
CREATE OR REPLACE FUNCTION sgp_opt_shared.persist_document_plans(p_doc uuid, p_geometry jsonb, p_extractor text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE d record; old record; plan jsonb; bar jsonb; cut jsonb; piece record; plans jsonb:='[]'; bars jsonb; cuts jsonb; seen uuid[]:='{}'; normalized jsonb; bar_index integer; cut_index integer; previous_position integer[]; current_position integer[];
BEGIN
 SELECT doc.*,encode(sha256(convert_to(a.evidencia::text,'UTF8')),'hex') evidence_sha INTO STRICT d
 FROM sgp_opt_shared.documents doc JOIN sgp_opt_shared.approvals a USING(id_aprobacion) WHERE doc.id_documento=p_doc AND a.sha256=doc.sha256 FOR UPDATE OF doc;
 IF p_extractor IS NULL OR p_extractor !~ '^[0-9a-f]{64}$' OR p_geometry->>'contract' IS DISTINCT FROM 'OPT-DOCUMENT-PLANS-1'
 OR p_geometry->>'scope' IS DISTINCT FROM 'DOCUMENTO' OR jsonb_typeof(p_geometry->'plans') IS DISTINCT FROM 'array'
 OR jsonb_array_length(p_geometry->'plans') NOT BETWEEN 1 AND 1000 OR octet_length(p_geometry::text)>8388608
 THEN RAISE EXCEPTION 'OPT_PLANS_INVALID'; END IF;
 FOR plan IN SELECT value FROM jsonb_array_elements(p_geometry->'plans') LOOP
  IF jsonb_typeof(plan->'bars') IS DISTINCT FROM 'array' OR jsonb_array_length(plan->'bars')<>(plan->>'barqty')::integer
   OR plan->'issues' IS DISTINCT FROM '[]'::jsonb OR plan->'unresolvedCells' IS DISTINCT FROM '[]'::jsonb
   THEN RAISE EXCEPTION 'OPT_PLANS_INCOMPLETE'; END IF;
  bars:='[]';bar_index:=0;
  FOR bar IN SELECT value FROM jsonb_array_elements(plan->'bars') LOOP
   bar_index:=bar_index+1;
   IF (bar->>'barra')::int IS DISTINCT FROM bar_index THEN RAISE EXCEPTION 'OPT_PLANS_BAR_ORDER'; END IF;
   IF jsonb_typeof(bar->'cuts') IS DISTINCT FROM 'array' OR jsonb_array_length(bar->'cuts')=0
    OR (bar->>'barra')::int NOT BETWEEN 1 AND (plan->>'barqty')::int THEN RAISE EXCEPTION 'OPT_PLANS_BAR_INVALID'; END IF;
   cuts:='[]';cut_index:=0;previous_position:=NULL;
   FOR cut IN SELECT value FROM jsonb_array_elements(bar->'cuts') LOOP
    cut_index:=cut_index+1;
    current_position:=ARRAY[(cut->>'sourceColumn')::int,(cut->>'sourceSlot')::int,(cut->>'unitInstance')::int];
    IF (cut->>'corte')::int IS DISTINCT FROM cut_index OR array_position(current_position,NULL) IS NOT NULL
      OR (previous_position IS NOT NULL AND current_position<=previous_position) THEN RAISE EXCEPTION 'OPT_PLANS_CUT_ORDER'; END IF;
    previous_position:=current_position;
    IF cut->'uncertain' IS DISTINCT FROM 'false'::jsonb OR (cut->>'qty')::int IS DISTINCT FROM 1
     OR (cut->>'profileInstance')::int IS DISTINCT FROM (bar->>'barra')::int THEN RAISE EXCEPTION 'OPT_PLANS_CUT_INVALID'; END IF;
    SELECT * INTO STRICT piece FROM sgp_opt_shared.pieces p WHERE p.id_documento=p_doc AND p.referencia=plan->>'ref'
     AND p.pagina=(plan->>'page')::int AND p.patron=(plan->>'sourceRow')::int AND p.barra=(bar->>'barra')::int
     AND p.corte=(cut->>'corte')::int AND p.longitud_mm=(cut->>'longitud_mm')::numeric;
    IF (cut->>'id_pieza' IS NOT NULL AND (cut->>'id_pieza')::uuid<>piece.id_pieza) OR piece.id_pieza=ANY(seen)
     THEN RAISE EXCEPTION 'OPT_PLANS_PIECE_MISMATCH'; END IF;
    seen:=array_append(seen,piece.id_pieza);
    cuts:=cuts||jsonb_build_array(cut||jsonb_build_object('id_pieza',piece.id_pieza));
   END LOOP;
   bars:=bars||jsonb_build_array(bar||jsonb_build_object('cuts',cuts));
  END LOOP;
  plans:=plans||jsonb_build_array(plan||jsonb_build_object('bars',bars));
 END LOOP;
 IF cardinality(seen)<>(SELECT count(*) FROM sgp_opt_shared.pieces WHERE id_documento=p_doc)
 THEN RAISE EXCEPTION 'OPT_PLANS_COVERAGE_MISMATCH'; END IF;
 normalized:=jsonb_build_object('contract','OPT-DOCUMENT-PLANS-1','scope','DOCUMENTO','plans',plans);
 SELECT * INTO old FROM sgp_opt_shared.document_plans WHERE id_documento=p_doc;
 IF FOUND THEN
  IF old.geometry IS DISTINCT FROM normalized OR old.sha256 IS DISTINCT FROM d.sha256 OR old.manifest_sha256 IS DISTINCT FROM d.manifest_sha256
   OR old.id_aprobacion IS DISTINCT FROM d.id_aprobacion OR old.evidence_sha256 IS DISTINCT FROM d.evidence_sha
  THEN RAISE EXCEPTION 'OPT_PLANS_REPLAY_MISMATCH'; END IF; RETURN false;
 END IF;
 INSERT INTO sgp_opt_shared.document_plans(id_documento,sha256,id_aprobacion,manifest_sha256,evidence_sha256,extractor_sha256,geometry)
 VALUES(p_doc,d.sha256,d.id_aprobacion,d.manifest_sha256,d.evidence_sha,p_extractor,normalized);
 RETURN true;
END $function$
;


-- Preparation only. Requires the reviewed base install and real server validator.
-- No client may submit its own extraction, bindings or validation evidence.
-- No activation, data load or change to existing productive permissions.
BEGIN;
CREATE FUNCTION public.sgp_opt_importar_proyecto_validado_v2(
 p_token text,p_pdf bytea,p_manifest jsonb,p_sources jsonb,p_evidence jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text; approval uuid; pdf_hash text; manifest_hash text; receipt jsonb;
 binding jsonb; current_context jsonb; source jsonb; selectors jsonb; refs text[];
BEGIN
 actor:=sgp_opt_shared.actor(p_token,true);
 IF p_pdf IS NULL OR octet_length(p_pdf) NOT BETWEEN 5 AND 33554432 THEN RAISE EXCEPTION 'OPT_PDF_INVALIDO'; END IF;
 pdf_hash:=encode(sha256(p_pdf),'hex');
 IF p_evidence IS NULL OR jsonb_typeof(p_evidence)<>'object'
 OR p_evidence->>'contract' IS DISTINCT FROM 'OPT-SERVER-VALIDATION-PROYECTO-2'
 OR p_evidence->>'algorithm' IS DISTINCT FROM 'opt-import-manifest-project-v2'
 OR p_evidence->>'pdf_sha256' IS DISTINCT FROM pdf_hash
 OR p_evidence->>'validation' IS DISTINCT FROM 'DOCUMENTARY_MANIFEST_READY'
 OR p_evidence->'physical_completion_verified' IS DISTINCT FROM 'false'::jsonb
 OR jsonb_typeof(p_evidence->'original_document_title') IS DISTINCT FROM 'string'
 OR length(p_evidence->>'original_document_title') NOT BETWEEN 1 AND 2000
 OR btrim(p_evidence->>'original_document_title')=''
 OR p_evidence->>'original_document_title' ~ '[[:cntrl:]]'
 OR NOT(p_evidence ? 'sgp_binding') OR jsonb_typeof(p_evidence->'sgp_binding')<>'object'
 OR (p_evidence ? 'documentary_source_groups' AND jsonb_typeof(p_evidence->'documentary_source_groups') IS DISTINCT FROM 'array')
 THEN RAISE EXCEPTION 'OPT_VALIDACION_SERVIDOR_REQUERIDA'; END IF;
 -- Server-only rounding provenance, not a browser override or tolerance switch.
 -- The private parser/validator must construct this from the original PDF.
 IF jsonb_typeof(p_evidence->'rounding_policy') IS DISTINCT FROM 'object'
 OR p_evidence#>>'{rounding_policy,version}' IS DISTINCT FROM 'OPT-PRINTED-ROUNDING-1'
 OR p_evidence#>>'{rounding_policy,model}' IS DISTINCT FROM 'INDEPENDENT_NEAREST_1_32_CLOSED_ENVELOPE'
 OR p_evidence#>'{rounding_policy,originalPrecisionVerified}' IS DISTINCT FROM 'false'::jsonb
 OR p_evidence#>'{rounding_policy,originalsPreserved}' IS DISTINCT FROM 'true'::jsonb
 OR jsonb_typeof(p_evidence->'rounding_evidence') IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_evidence->'validation_warnings') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'OPT_REDONDEO_EVIDENCIA_INVALIDA'; END IF;
 IF jsonb_array_length(p_evidence->'rounding_evidence') NOT BETWEEN 1 AND 1000
 OR jsonb_array_length(p_evidence->'validation_warnings')>1
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_evidence->'rounding_evidence') r WHERE
  jsonb_typeof(r) IS DISTINCT FROM 'object'
  OR jsonb_typeof(r->'reference') IS DISTINCT FROM 'string' OR btrim(r->>'reference')=''
  OR jsonb_typeof(r->'finish') IS DISTINCT FROM 'string' OR btrim(r->>'finish')=''
  OR jsonb_typeof(r->'printedSummary') IS DISTINCT FROM 'object'
  OR jsonb_typeof(r->'diagnostic') IS DISTINCT FROM 'object'
  OR r#>>'{diagnostic,status}' IS NULL
  OR r#>>'{diagnostic,status}' NOT IN ('PRINTED_EQUALITY','ROUNDING_COMPATIBLE')
  OR r#>'{diagnostic,originalPrecisionVerified}' IS DISTINCT FROM 'false'::jsonb
  OR r#>'{diagnostic,authorizesImport}' IS DISTINCT FROM 'false'::jsonb
  OR jsonb_typeof(r#>'{diagnostic,intervals}') IS DISTINCT FROM 'object'
  OR jsonb_typeof(r#>'{diagnostic,printedDelta32}') IS DISTINCT FROM 'object'
  OR NOT ((r#>'{diagnostic,printedDelta32}') ?& ARRAY['stock','cuts','balance'])
  OR EXISTS(SELECT 1 FROM unnest(ARRAY['stock','cuts','balance']) k WHERE
   jsonb_typeof(r#>ARRAY['diagnostic','printedDelta32',k]) IS DISTINCT FROM 'string'
   OR r#>>ARRAY['diagnostic','printedDelta32',k] !~ '^-?[0-9]+$')
  OR r#>>'{diagnostic,schema}' IS DISTINCT FROM 'sgp.opt.rounding-diagnostic.v1'
  OR r#>>'{diagnostic,model}' IS DISTINCT FROM 'INDEPENDENT_NEAREST_1_32_CLOSED_ENVELOPE'
  OR r#>'{diagnostic,physicalCompletionVerified}' IS DISTINCT FROM 'false'::jsonb)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_evidence->'validation_warnings') w WHERE
  jsonb_typeof(w) IS DISTINCT FROM 'object'
  OR w->>'code' IS DISTINCT FROM 'OPT_PRINTED_ROUNDING_COMPATIBLE'
  OR jsonb_typeof(w->'message') IS DISTINCT FROM 'string' OR btrim(w->>'message')='')
 THEN RAISE EXCEPTION 'OPT_REDONDEO_EVIDENCIA_INVALIDA'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_evidence->'rounding_evidence') r
  WHERE r#>>'{diagnostic,status}'='ROUNDING_COMPATIBLE')
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_evidence->'validation_warnings') w
  WHERE w->>'code'='OPT_PRINTED_ROUNDING_COMPATIBLE')
 THEN RAISE EXCEPTION 'OPT_REDONDEO_ADVERTENCIA_REQUERIDA'; END IF;
 IF p_manifest IS NULL OR jsonb_typeof(p_manifest)<>'array'
 OR p_sources IS NULL OR jsonb_typeof(p_sources)<>'array' THEN RAISE EXCEPTION 'OPT_MANIFIESTO_INVALIDO'; END IF;
 IF jsonb_array_length(p_sources)<>1 THEN RAISE EXCEPTION 'OPT_FUENTE_INVALIDA'; END IF;
 FOR source IN SELECT value FROM jsonb_array_elements(p_sources) ORDER BY value->>'consecutivo',value->>'origen' LOOP
  IF jsonb_typeof(source)<>'object' OR NOT(source ?& ARRAY['origen','source_key','consecutivo','modo_carga'])
  OR source-ARRAY['origen','source_key','consecutivo','modo_carga']<>'{}'::jsonb
  OR EXISTS(SELECT 1 FROM unnest(ARRAY['origen','source_key','consecutivo','modo_carga']) k
    WHERE jsonb_typeof(source->k) IS DISTINCT FROM 'string' OR btrim(source->>k)='')
  OR source->>'origen' IS DISTINCT FROM 'PROYECTO'
  OR source->>'modo_carga' IS DISTINCT FROM 'INDICE'
  THEN RAISE EXCEPTION 'OPT_FUENTE_INVALIDA'; END IF;
  -- One logical OPT cannot acquire fresh physical units by changing mode/origin
  -- to DESCONOCIDO. Serialize all origins of this consecutive before observing.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(source->>'consecutivo',440));
 END LOOP;
 FOR source IN SELECT value FROM jsonb_array_elements(p_sources) LOOP
  IF EXISTS(SELECT 1 FROM sgp_opt_shared.sources s JOIN sgp_opt_shared.documents d USING(id_documento)
    WHERE s.consecutivo=source->>'consecutivo' AND d.sha256<>pdf_hash
    AND (s.origen=source->>'origen' OR s.origen='DESCONOCIDO' OR source->>'origen'='DESCONOCIDO'))
  THEN RAISE EXCEPTION 'OPT_CONSECUTIVO_REQUIERE_RECONCILIACION'; END IF;
 END LOOP;
 binding:=p_evidence->'sgp_binding';
 IF binding->>'contract' IS DISTINCT FROM 'OPT-IMPORT-CONTEXT-PROYECTO-2'
 OR jsonb_typeof(binding->'revision') IS DISTINCT FROM 'string'
 OR (binding->>'revision')!~'^[a-f0-9]{32}$'
 OR binding->>'opt' IS DISTINCT FROM p_sources->0->>'consecutivo'
 OR p_sources->0->>'source_key' IS DISTINCT FROM 'OPT:'||(binding->>'opt')
 OR jsonb_typeof(binding->'referencias') IS DISTINCT FROM 'array'
 OR p_evidence->'original_index' IS NULL
 OR jsonb_typeof(p_evidence->'original_index') IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'OPT_CONTEXTO_SERVIDOR_REQUERIDO'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(binding->'referencias') r WHERE jsonb_typeof(r) IS DISTINCT FROM 'string')
 THEN RAISE EXCEPTION 'OPT_REFERENCIAS_INVALIDAS'; END IF;
 SELECT array_agg(r) INTO refs FROM jsonb_array_elements_text(binding->'referencias') r;
 -- Validate selectors using exactly the same private read contract before locks.
 current_context:=public.sgp_opt_import_contexto_proyecto_v2(
  p_token,binding->'scope',binding->>'opt',binding->'selectores',refs);
 selectors:=current_context->'selectores';
 -- Existing assignment rows stay locked until commit. The final re-read below
 -- is the observation point; this does not claim predicate/gap locking.
 PERFORM 1 FROM sgp_opt_shared.config WHERE singleton FOR SHARE;
 PERFORM m.codigo_sap FROM public.sgp_maestro_piezas m
 WHERE m.codigo_sap=ANY(refs) ORDER BY m.codigo_sap FOR SHARE OF m;
 PERFORM p.key_produccion FROM public.sgp_producciones p
 WHERE EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v r,
  jsonb_array_elements(selectors) s WHERE r.key_produccion=p.key_produccion
  AND s->>'reserva'=r.reserva AND s->>'sistema'=p.sistema)
 ORDER BY p.key_produccion FOR SHARE OF p;
 PERFORM mp.id_programacion FROM public.sgp_producciones p
 JOIN public.sgp_mecanizado_programacion_detalle d USING(key_produccion)
 JOIN public.sgp_mecanizado_programacion mp USING(id_programacion)
 WHERE EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v r,
  jsonb_array_elements(selectors) s WHERE r.key_produccion=p.key_produccion
  AND s->>'reserva'=r.reserva AND s->>'sistema'=p.sistema)
 ORDER BY mp.id_programacion,p.key_produccion FOR SHARE OF mp,d;
 current_context:=public.sgp_opt_import_contexto_proyecto_v2(
  p_token,binding->'scope',binding->>'opt',selectors,refs);
 IF current_context->>'revision' IS DISTINCT FROM binding->>'revision'
 THEN RAISE EXCEPTION 'OPT_CONTEXTO_CAMBIO_REINTENTAR'; END IF;
 IF sgp_opt_shared.actor(p_token,true) IS DISTINCT FROM actor THEN RAISE EXCEPTION 'OPT_NO_AUTORIZADO'; END IF;
 manifest_hash:=encode(sha256(convert_to(p_manifest::text,'UTF8')),'hex');
 -- This is an automatic record of the private validator result, not an extra
 -- human approval and never an assertion that any cut was physically completed.
 INSERT INTO sgp_opt_shared.approvals(sha256,manifest_sha256,fuentes,evidencia,reviewed_by)
 VALUES(pdf_hash,manifest_hash,p_sources,
  jsonb_build_object('sgp_binding',p_evidence->'sgp_binding','contract','OPT-SERVER-VALIDATION-PROYECTO-2',
   'algorithm','opt-import-manifest-project-v2','validation','DOCUMENTARY_MANIFEST_READY',
   'physical_completion_verified',false,'validated_for_actor',actor,'original_index',p_evidence->'original_index',
   'documentary_source_groups',p_evidence->'documentary_source_groups',
   'original_document_title',p_evidence->'original_document_title',
   'profile_destinations',current_context->'profileDestinations',
   'rounding_policy',p_evidence->'rounding_policy','rounding_evidence',p_evidence->'rounding_evidence',
   'validation_warnings',p_evidence->'validation_warnings'),actor)
 RETURNING id_aprobacion INTO approval;
 receipt:=sgp_opt_shared.import_manifest(approval,p_pdf,p_manifest);
 RETURN receipt||jsonb_build_object('import_contract','OPT-IMPORT-1','contract_version',2,'ok',true,'physical_completion_verified',false);
END $$;
REVOKE ALL ON FUNCTION public.sgp_opt_importar_proyecto_validado_v2(text,bytea,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sgp_opt_importar_proyecto_validado_v2(text,bytea,jsonb,jsonb,jsonb) TO service_role;
COMMIT;

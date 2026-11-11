-- Preparation only. Requires the reviewed base install and real server validator.
-- No client may submit its own extraction, bindings or validation evidence.
-- No activation, data load or change to existing productive permissions.
BEGIN;
CREATE FUNCTION public.sgp_opt_importar_validado_v1(
 p_token text,p_pdf bytea,p_manifest jsonb,p_sources jsonb,p_evidence jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text; approval uuid; pdf_hash text; manifest_hash text; receipt jsonb;
 binding jsonb; current_context jsonb; productions text[]; source jsonb;
BEGIN
 actor:=sgp_opt_shared.actor(p_token,true);
 IF p_pdf IS NULL OR octet_length(p_pdf) NOT BETWEEN 5 AND 33554432 THEN RAISE EXCEPTION 'OPT_PDF_INVALIDO'; END IF;
 pdf_hash:=encode(sha256(p_pdf),'hex');
 IF p_evidence IS NULL OR jsonb_typeof(p_evidence)<>'object'
 OR p_evidence->>'contract' IS DISTINCT FROM 'OPT-SERVER-VALIDATION-1'
 OR p_evidence->>'algorithm' IS DISTINCT FROM 'opt-import-manifest-v1'
 OR p_evidence->>'pdf_sha256' IS DISTINCT FROM pdf_hash
 OR p_evidence->>'validation' IS DISTINCT FROM 'DOCUMENTARY_MANIFEST_READY'
 OR p_evidence->'physical_completion_verified' IS DISTINCT FROM 'false'::jsonb
 OR NOT(p_evidence ? 'sgp_binding') OR jsonb_typeof(p_evidence->'sgp_binding')<>'object'
 THEN RAISE EXCEPTION 'OPT_VALIDACION_SERVIDOR_REQUERIDA'; END IF;
 IF p_manifest IS NULL OR jsonb_typeof(p_manifest)<>'array'
 OR p_sources IS NULL OR jsonb_typeof(p_sources)<>'array' THEN RAISE EXCEPTION 'OPT_MANIFIESTO_INVALIDO'; END IF;
 IF jsonb_array_length(p_sources) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'OPT_FUENTE_INVALIDA'; END IF;
 FOR source IN SELECT value FROM jsonb_array_elements(p_sources) ORDER BY value->>'consecutivo',value->>'origen' LOOP
  IF jsonb_typeof(source)<>'object' OR NOT(source ?& ARRAY['origen','source_key','consecutivo','modo_carga'])
  OR source-ARRAY['origen','source_key','consecutivo','modo_carga']<>'{}'::jsonb
  OR EXISTS(SELECT 1 FROM unnest(ARRAY['origen','source_key','consecutivo','modo_carga']) k
    WHERE jsonb_typeof(source->k) IS DISTINCT FROM 'string' OR btrim(source->>k)='')
  OR source->>'origen' NOT IN ('RETAIL','PROYECTO','DESCONOCIDO')
  OR source->>'modo_carga' NOT IN ('INDICE','INDIVIDUAL')
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
 IF binding->>'contract' IS DISTINCT FROM 'OPT-IMPORT-CONTEXT-1'
 OR jsonb_typeof(binding->'revision') IS DISTINCT FROM 'string'
 OR (binding->>'revision')!~'^[a-f0-9]{32}$'
 OR jsonb_typeof(binding->'producciones') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'OPT_CONTEXTO_SERVIDOR_REQUERIDO'; END IF;
 PERFORM sgp_opt_shared.validate_scope(binding->'scope');
 SELECT array_agg(value) INTO productions FROM jsonb_array_elements_text(binding->'producciones');
 IF productions IS NULL OR cardinality(productions) NOT BETWEEN 1 AND 1000
 OR EXISTS(SELECT 1 FROM unnest(productions) x WHERE x IS NULL OR x!~'^[0-9]{1,30}$')
 THEN RAISE EXCEPTION 'OPT_PRODUCCIONES_INVALIDAS'; END IF;
 -- Existing assignment rows stay locked until commit. The full re-read below
 -- is the observation point, including all lines/weeks and competing programs.
 -- A newly inserted program committed before that read changes the revision.
 -- Concurrent inserts after that snapshot do not rewrite this original binding;
 -- this is not a claim of predicate/gap locking or global serializability.
 PERFORM 1 FROM sgp_opt_shared.config WHERE singleton FOR SHARE;
 PERFORM p.key_produccion FROM public.sgp_producciones p
 WHERE p.id=ANY(productions) ORDER BY p.key_produccion FOR SHARE OF p;
 PERFORM mp.id_programacion FROM public.sgp_producciones p
 JOIN public.sgp_mecanizado_programacion_detalle d USING(key_produccion)
 JOIN public.sgp_mecanizado_programacion mp USING(id_programacion)
 WHERE p.id=ANY(productions) ORDER BY mp.id_programacion,p.key_produccion FOR SHARE OF mp,d;
 current_context:=public.sgp_opt_import_contexto_v1(p_token,binding->'scope',productions);
 IF current_context->>'revision' IS DISTINCT FROM binding->>'revision'
 THEN RAISE EXCEPTION 'OPT_CONTEXTO_CAMBIO_REINTENTAR'; END IF;
 IF sgp_opt_shared.actor(p_token,true) IS DISTINCT FROM actor THEN RAISE EXCEPTION 'OPT_NO_AUTORIZADO'; END IF;
 manifest_hash:=encode(sha256(convert_to(p_manifest::text,'UTF8')),'hex');
 -- This is an automatic record of the private validator result, not an extra
 -- human approval and never an assertion that any cut was physically completed.
 INSERT INTO sgp_opt_shared.approvals(sha256,manifest_sha256,fuentes,evidencia,reviewed_by)
 VALUES(pdf_hash,manifest_hash,p_sources,
  jsonb_build_object('sgp_binding',p_evidence->'sgp_binding','contract','OPT-SERVER-VALIDATION-1',
   'algorithm','opt-import-manifest-v1','validation','DOCUMENTARY_MANIFEST_READY',
   'physical_completion_verified',false,'validated_for_actor',actor,'original_index',p_evidence->'original_index'),actor)
 RETURNING id_aprobacion INTO approval;
 receipt:=sgp_opt_shared.import_manifest(approval,p_pdf,p_manifest);
 RETURN receipt||jsonb_build_object('import_contract','OPT-IMPORT-1','ok',true,'physical_completion_verified',false);
END $$;
REVOKE ALL ON FUNCTION public.sgp_opt_importar_validado_v1(text,bytea,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sgp_opt_importar_validado_v1(text,bytea,jsonb,jsonb,jsonb) TO service_role;
COMMIT;

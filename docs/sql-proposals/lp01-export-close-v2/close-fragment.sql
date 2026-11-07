   IF v2_close THEN
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_cmd) field WHERE field NOT IN('op','id','stage','line','date','shift','revision','turn_revision','file_id','import_id','close_authority','reasons','observation','close_type')) THEN RAISE EXCEPTION 'EXPORT_V2_CAMPOS_NO_PERMITIDOS'; END IF;
    IF coalesce(p_cmd->>'close_type','CON_ACTIVIDAD')<>'CON_ACTIVIDAD' OR p_cmd ? 'confirmed'
     OR k IS NOT NULL OR part IS NOT NULL OR jsonb_typeof(p_cmd->'reasons') IS DISTINCT FROM 'object'
     OR p_cmd->>'import_id' IS NULL OR p_cmd->>'file_id' IS NULL THEN RAISE EXCEPTION 'EXPORT_V2_CIERRE_CONTEXTO_INVALIDO'; END IF;
    IF p_cmd ? 'turn_revision' THEN
     IF jsonb_typeof(p_cmd->'turn_revision') IS DISTINCT FROM 'number' OR coalesce(p_cmd->>'turn_revision','') !~ '^[0-9]+$'
      OR (p_cmd->>'turn_revision')::numeric>9007199254740991 THEN RAISE EXCEPTION 'EXPORT_V2_REVISION_TURNO_INVALIDA'; END IF;
     IF (p_cmd->>'turn_revision')::numeric IS DISTINCT FROM rv OR (p_cmd->>'turn_revision')::numeric IS DISTINCT FROM tr.revision
      THEN RAISE EXCEPTION 'CONFLICTO_REVISION_TURNO'; END IF;
    END IF;
    BEGIN
     LOCK TABLE public.sgp_producciones,public.sgp_linea_plan_asignaciones IN SHARE MODE NOWAIT;
    EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='EXPORT_V2_FUENTES_EN_ACTUALIZACION_RECONSULTAR'; END;
    s:=sgp_lp_operacion.sesion(p_token,et,NULL,line_id);
    PERFORM sgp_lp_operacion.verificar_temporal(u,et,line_id,d,t,NULL,'CERRAR');
    IF s->>'usuario' IS DISTINCT FROM u THEN RAISE EXCEPTION 'EXPORT_V2_SESION_CAMBIO'; END IF;
    SELECT * INTO v2_import FROM sgp_lp_operacion.auditoria a WHERE a.operacion='IMPORTAR_XLSX'
     AND a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t
     ORDER BY (a.respuesta->>'turnRevision')::bigint DESC,a.id DESC LIMIT 1;
    IF NOT FOUND OR v2_import.id IS DISTINCT FROM (p_cmd->>'import_id')::uuid
     OR v2_import.respuesta->>'contract' IS DISTINCT FROM 'LP-EXPORT-IMPORT-3'
     OR v2_import.respuesta->>'authority' IS DISTINCT FROM 'EXPORT_PRODUCTION_V2'
     OR (v2_import.respuesta->>'turnRevision')::bigint IS DISTINCT FROM tr.revision
     OR v2_import.respuesta->>'fileId' IS DISTINCT FROM p_cmd->>'file_id'
    THEN RAISE EXCEPTION 'EXPORT_V2_IMPORTACION_VIGENTE_REQUERIDA'; END IF;
    SELECT * INTO file FROM sgp_lp_operacion.archivos a WHERE a.id=(p_cmd->>'file_id')::uuid
     AND a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t;
    IF NOT FOUND OR file.adaptador<>'LP-PBI-XLSX-1' OR file.sha256 IS DISTINCT FROM v2_import.respuesta->>'sha256'
     OR file.contenido_binario IS NULL OR file.sha256 IS DISTINCT FROM encode(sha256(file.contenido_binario),'hex')
    THEN RAISE EXCEPTION 'EXPORT_V2_ARCHIVO_INCOMPATIBLE'; END IF;
    -- Same canonical universe as the import; no browser-created source digest.
    SELECT jsonb_build_object('stage',et,'line',line_id,'date',d,'shift',t,
     'orders',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.key,a.parte) FROM sgp_lp_operacion.ordenes a
      WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t),'[]'::jsonb),
     'productions',coalesce((SELECT jsonb_agg(jsonb_build_object('key',p.key_produccion,'name',p.produccion,'line',p.id_linea) ORDER BY p.key_produccion)
      FROM public.sgp_producciones p WHERE EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND a.key=p.key_produccion)),'[]'::jsonb),
     'scheduled',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.key_produccion,a.id) FROM public.sgp_linea_plan_asignaciones a
      JOIN public.sgp_producciones p USING(key_produccion) WHERE p.id_linea=line_id AND a.fecha=d AND a.turno=t AND a.estado IS DISTINCT FROM 'CANCELADA'),'[]'::jsonb)) INTO v2_universe;
    IF encode(sha256(convert_to(v2_universe::text,'UTF8')),'hex') IS DISTINCT FROM v2_import.respuesta->>'universeRevision'
    THEN RAISE EXCEPTION 'EXPORT_V2_UNIVERSO_CAMBIO_REIMPORTAR'; END IF;
    v2_coverage:=v2_import.respuesta->'rows';
    IF jsonb_typeof(v2_coverage) IS DISTINCT FROM 'array' OR jsonb_array_length(v2_coverage)=0
     OR jsonb_array_length(v2_coverage)<>(SELECT count(DISTINCT key) FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t)
     OR (SELECT count(DISTINCT x->>'key') FROM jsonb_array_elements(v2_coverage) x)<>jsonb_array_length(v2_coverage)
    THEN RAISE EXCEPTION 'EXPORT_V2_COBERTURA_INCOMPATIBLE'; END IF;
    v3_import_id:=v2_import.id;v3_import_version:=(v2_import.respuesta->>'turnRevision')::bigint;
    v3_universe_sha:=v2_import.respuesta->>'universeRevision';v3_current_file:=file;v3_groups:=file.filas;
-- PROJECT_PARTIAL_ROWS_V3
    IF v2_coverage IS DISTINCT FROM v3_coverage THEN RAISE EXCEPTION 'EXPORT_V3_PROYECCION_NO_ACREDITADA'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_each(p_cmd->'reasons') x WHERE jsonb_typeof(x.value)<>'string' OR length(x.value#>>'{}')>2000
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v2_coverage) c WHERE c->>'key'=x.key))
    THEN RAISE EXCEPTION 'EXPORT_V2_MOTIVOS_INVALIDOS'; END IF;
    FOR g IN SELECT DISTINCT a.key FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t ORDER BY a.key LOOP
     SELECT x INTO v2_row FROM jsonb_array_elements(v2_coverage) x WHERE x->>'key'=g.key;
     IF v2_row IS NULL OR coalesce(v2_row->>'coverage','') NOT IN('PRESENT','ABSENT')
      OR jsonb_typeof(v2_row->'sourceRows') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'EXPORT_V2_COBERTURA_INCOMPATIBLE'; END IF;
     -- Projection was reconstructed and verified against every original receipt/file.
     v:=(v2_row->>'quantity')::bigint;
     IF v2_row->>'coverage'='ABSENT' AND nullif(btrim(p_cmd->'reasons'->>g.key),'') IS NULL THEN RAISE EXCEPTION 'EXPORT_V2_AUSENCIA_SIN_MOTIVO'; END IF;
     SELECT jsonb_agg(to_jsonb(a) ORDER BY a.parte),jsonb_agg(a.parte ORDER BY a.parte) INTO assignments,v2_refs FROM sgp_lp_operacion.ordenes a
      WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND a.key=g.key;
     -- Freeze report identity at close time from the locked source, including null system.
     rows:=rows||jsonb_build_array(jsonb_build_object('key',g.key,
      'identity',(SELECT jsonb_build_object('key',p.key_produccion,'line',p.id_linea,'production',p.produccion,'system',p.sistema)
       FROM public.sgp_producciones p WHERE p.key_produccion=g.key AND p.id_linea=line_id),'coverage',v2_row->>'coverage','realized',v,'plan',NULL,'planStatus','PLAN_SOURCE_REQUIRED',
      'difference',NULL,'pendingAgainstPlan',NULL,
      'scheduledReference',jsonb_build_object('authority','HISTORICAL_REFERENCE_ONLY','quantity',NULL,'assignments',
       coalesce((SELECT jsonb_agg(a) FROM jsonb_array_elements(v2_universe->'scheduled') a WHERE a->>'key_produccion'=g.key),'[]'::jsonb)),
      'preserve',v2_row->'preserve','sourceRows',v2_row->'sourceRows','valueStatus',v2_row->>'valueStatus','valueSource',v2_row->'valueSource','reason',nullif(btrim(p_cmd->'reasons'->>g.key),''),
      'assignmentRefs',v2_refs,'manualHistory',jsonb_build_object('authority','HISTORICAL_ONLY','assignments',assignments),
      'budget',jsonb_build_object('status','RECONCILIATION_REQUIRED','available',NULL),
      'continuity',jsonb_build_object('status','RECONCILIATION_REQUIRED','quantity',NULL,'allocation','NONE')));
    END LOOP;
    res:=jsonb_build_object('ok',true,'contract','LP-EXPORT-CLOSE-3','authority','EXPORT_PRODUCTION_V2','id',rid,'stage',et,'line',line_id,'date',d,'shift',t,
     'type','CON_ACTIVIDAD','version',tr.revision+1,'importId',v2_import.id,'universeRevision',v2_import.respuesta->>'universeRevision',
     'rows',rows,'file',jsonb_build_object('id',file.id,'name',file.nombre,'sha256',file.sha256,'adapter',file.adaptador),
     'reasons',p_cmd->'reasons','observation',p_cmd->>'observation','user',u,'canContinue',false,'comparisonComplete',false,'planComparison','PLAN_SOURCE_REQUIRED','reconciliation','RECONCILIATION_REQUIRED');
    INSERT INTO sgp_lp_operacion.cierres(id,etapa,linea,fecha,turno,version,archivo,tipo,snapshot,usuario)
     VALUES(rid,et,line_id,d,t,tr.revision+1,file.id,'CON_ACTIVIDAD',res,u);
   ELSIF p_cmd->>'close_type'='SIN_ACTIVIDAD' THEN

 -- Rebuild the partial projection from committed PRESENT receipts, never a
 -- browser total or an ABSENT chain. Shared by IMPORTAR and CERRAR under locks.
 v3_context:=jsonb_build_object('stage',et,'line',line_id,'date',d,'shift',t);
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.auditoria a WHERE a.operacion='IMPORTAR_XLSX'
  AND a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t
  AND a.respuesta->>'authority'='EXPORT_PRODUCTION_V2' AND a.respuesta->>'contract' IS DISTINCT FROM 'LP-EXPORT-IMPORT-3')
 OR EXISTS(SELECT 1 FROM sgp_lp_operacion.cierres c WHERE c.etapa=et AND c.linea=line_id AND c.fecha=d AND c.turno=t
  AND c.snapshot->>'authority'='EXPORT_PRODUCTION_V2' AND c.snapshot->>'contract' IS DISTINCT FROM 'LP-EXPORT-CLOSE-3')
 THEN RAISE EXCEPTION 'EXPORT_V3_HISTORIAL_INCOMPATIBLE'; END IF;
 IF v3_current_file.id IS NULL OR v3_current_file.etapa IS DISTINCT FROM et OR v3_current_file.linea IS DISTINCT FROM line_id
  OR v3_current_file.fecha IS DISTINCT FROM d OR v3_current_file.turno IS DISTINCT FROM t
  OR v3_current_file.adaptador IS DISTINCT FROM 'LP-PBI-XLSX-1' OR v3_current_file.contenido_binario IS NULL
  OR v3_current_file.sha256 IS DISTINCT FROM encode(sha256(v3_current_file.contenido_binario),'hex')
  OR v3_groups IS DISTINCT FROM v3_current_file.filas THEN RAISE EXCEPTION 'EXPORT_V3_FUENTE_ACTUAL_INCOMPATIBLE'; END IF;
 v3_coverage:='[]'::jsonb;
 FOR v3_key IN SELECT DISTINCT v3_order.key FROM sgp_lp_operacion.ordenes v3_order WHERE v3_order.etapa=et AND v3_order.linea=line_id AND v3_order.fecha=d AND v3_order.turno=t ORDER BY v3_order.key LOOP
  SELECT x INTO v3_group FROM jsonb_array_elements(v3_groups) x WHERE x->>'key'=v3_key;
  v3_source:=NULL;v3_quantity:=NULL;v3_status:='NEVER_REPORTED';
  IF v3_group IS NOT NULL THEN
   IF jsonb_typeof(v3_group->'quantity') IS DISTINCT FROM 'number' OR coalesce(v3_group->>'quantity','') !~ '^[0-9]+$'
    OR (v3_group->>'quantity')::numeric>9007199254740991 OR jsonb_typeof(v3_group->'source_rows') IS DISTINCT FROM 'array'
    OR jsonb_array_length(v3_group->'source_rows')=0 THEN RAISE EXCEPTION 'EXPORT_V3_CANTIDAD_ACTUAL_INCOMPATIBLE'; END IF;
   v3_quantity:=(v3_group->>'quantity')::bigint;v3_status:='CURRENT_FILE';
   v3_source:=jsonb_build_object('importId',v3_import_id,'importVersion',v3_import_version,'universeRevision',v3_universe_sha,'context',v3_context,
    'file',jsonb_build_object('id',v3_current_file.id,'name',v3_current_file.nombre,'sha256',v3_current_file.sha256,'adapter',v3_current_file.adaptador),'sourceRows',v3_group->'source_rows');
  ELSE
   SELECT a.* INTO v3_origin FROM sgp_lp_operacion.auditoria a WHERE a.operacion='IMPORTAR_XLSX'
    AND a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND a.respuesta->>'authority'='EXPORT_PRODUCTION_V2'
    AND (a.respuesta->>'turnRevision')::bigint<v3_import_version
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(a.respuesta->'rows') x WHERE x->>'key'=v3_key AND x->>'coverage'='PRESENT')
    ORDER BY (a.respuesta->>'turnRevision')::bigint DESC,a.id DESC LIMIT 1;
   IF FOUND THEN
    SELECT x INTO v3_origin_row FROM jsonb_array_elements(v3_origin.respuesta->'rows') x WHERE x->>'key'=v3_key;
    SELECT a.* INTO v3_origin_file FROM sgp_lp_operacion.archivos a WHERE a.id=(v3_origin.respuesta->>'fileId')::uuid
     AND a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t;
    IF NOT FOUND OR v3_origin.respuesta->>'contract' IS DISTINCT FROM 'LP-EXPORT-IMPORT-3'
     OR v3_origin.respuesta->>'importId' IS DISTINCT FROM v3_origin.id::text
     OR coalesce(v3_origin.respuesta->>'universeRevision','') !~ '^[a-f0-9]{64}$'
     OR v3_origin_file.adaptador IS DISTINCT FROM 'LP-PBI-XLSX-1' OR v3_origin_file.contenido_binario IS NULL
     OR v3_origin_file.sha256 IS DISTINCT FROM v3_origin.respuesta->>'sha256'
     OR v3_origin_file.sha256 IS DISTINCT FROM encode(sha256(v3_origin_file.contenido_binario),'hex')
     OR v3_origin_row->>'valueStatus' IS DISTINCT FROM 'CURRENT_FILE' OR v3_origin_row->'preserve' IS DISTINCT FROM 'false'::jsonb
     OR jsonb_typeof(v3_origin_row->'quantity') IS DISTINCT FROM 'number' OR coalesce(v3_origin_row->>'quantity','') !~ '^[0-9]+$'
     OR (v3_origin_row->>'quantity')::numeric>9007199254740991
     OR (SELECT count(*) FROM jsonb_array_elements(v3_origin.respuesta->'rows') x WHERE x->>'key'=v3_key)<>1
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v3_origin_file.filas) f WHERE f->>'key'=v3_key
      AND f->'quantity'=v3_origin_row->'quantity' AND f->'source_rows'=v3_origin_row->'sourceRows')
    THEN RAISE EXCEPTION 'EXPORT_V3_PROCEDENCIA_NO_ACREDITADA'; END IF;
    v3_source:=jsonb_build_object('importId',v3_origin.id,'importVersion',(v3_origin.respuesta->>'turnRevision')::bigint,
     'universeRevision',v3_origin.respuesta->>'universeRevision','context',v3_context,
     'file',jsonb_build_object('id',v3_origin_file.id,'name',v3_origin_file.nombre,'sha256',v3_origin_file.sha256,'adapter',v3_origin_file.adaptador),'sourceRows',v3_origin_row->'sourceRows');
    IF v3_origin_row->'valueSource' IS DISTINCT FROM v3_source THEN RAISE EXCEPTION 'EXPORT_V3_PROCEDENCIA_NO_ACREDITADA'; END IF;
    v3_quantity:=(v3_origin_row->>'quantity')::bigint;v3_status:='PRESERVED';
   END IF;
  END IF;
  v3_coverage:=v3_coverage||jsonb_build_array(jsonb_build_object('key',v3_key,'coverage',CASE WHEN v3_group IS NULL THEN 'ABSENT' ELSE 'PRESENT' END,
   'quantity',v3_quantity,'sourceRows',coalesce(v3_group->'source_rows','[]'::jsonb),'preserve',v3_group IS NULL,'valueStatus',v3_status,'valueSource',v3_source));
 END LOOP;

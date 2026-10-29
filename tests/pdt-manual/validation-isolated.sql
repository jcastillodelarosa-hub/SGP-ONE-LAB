-- Synthetic PostgreSQL 17 QA. Phase 1 and Phase 2 installed only in isolated DB.
BEGIN;
DO $qa$ DECLARE response jsonb; pending uuid; report uuid; before_count int; legacy_id uuid; legacy_error text; delegated_error text; BEGIN
 response:=public.sgp_pdt_manual_registrar_v1('COORDINADOR','PICKING',
  '{"key_produccion":"QA|PANELES_2","reserva":"R","produccion":"QA ORDER"}'::jsonb,
  '[{"perfil":"PANEL-REF","fabricacion":"E17","marca":"","longitud":100,"acabado":"DS","cantidad":2,"nc":"","observacion":"Original"}]'::jsonb,
  'Reporte inmutable',gen_random_uuid());
 pending:=(response->'ids_pendientes'->>0)::uuid;report:=(response->>'id_reporte')::uuid;
 IF (SELECT validacion_estado FROM public.sgp_aluminio_pendientes WHERE id_pendiente=pending)<>'POR_VALIDAR' THEN RAISE EXCEPTION 'POR_VALIDAR_MISSING'; END IF;
 BEGIN
  PERFORM public.sgp_aluminio_pendiente_validar_detalles_v1('CONSULTA',pending,
   '[{"fabricacion":"E17","marca":"","longitud":100,"acabado":"DS","cantidad":2}]'::jsonb,'R',NULL);
  RAISE EXCEPTION 'UNAUTHORIZED_ROLE_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='UNAUTHORIZED_ROLE_ACCEPTED' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=pending) THEN RAISE EXCEPTION 'UNAUTHORIZED_ROLE_WROTE_DETAIL'; END IF;
 BEGIN
  PERFORM public.sgp_aluminio_pendiente_validar_detalles_v1('COORDINADOR',pending,
   '[{"fabricacion":"E17-1","marca":"","longitud":100,"acabado":"DS","cantidad":2}]'::jsonb,'R',NULL);
  RAISE EXCEPTION 'CORRECTION_NOTE_NOT_REQUIRED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_MANUAL_CORRECCION_REQUIERE_OBSERVACION' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=pending) THEN RAISE EXCEPTION 'PARTIAL_VALIDATION_WRITE'; END IF;
 response:=public.sgp_aluminio_pendiente_validar_detalles_v1('COORDINADOR',pending,
  '[{"fabricacion":"E17-1","marca":"","longitud":100,"acabado":"DS","cantidad":2}]'::jsonb,'R','Fabricación corregida');
 IF response->>'correccion'<>'true' OR (SELECT validacion_estado FROM public.sgp_aluminio_pendientes WHERE id_pendiente=pending)<>'VALIDADO'
 OR (SELECT cantidad FROM public.sgp_aluminio_pendientes WHERE id_pendiente=pending)<>2
 OR (SELECT fabricacion FROM sgp_pdt_manual.detalles WHERE id_pendiente=pending)<>'E17'
 OR (SELECT count(*) FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=pending AND fabricacion='E17-1' AND cantidad_validada=2)<>1
 OR (SELECT count(*) FROM sgp_pdt_manual.fuentes_validadas f JOIN public.sgp_aluminio_pendiente_detalles d USING(id_detalle) WHERE d.id_pendiente=pending)<>1
 THEN RAISE EXCEPTION 'VALIDATION_INCONSISTENT'; END IF;
 IF (SELECT count(*) FROM public.sgp_aluminio_pendientes_historial WHERE id_pendiente=pending AND tipo_evento='VALIDACION_MANUAL_PDT'
  AND datos_anteriores->>'fabricacion'='E17' AND datos_nuevos->>'cantidad_validada'='2' AND observacion='Fabricación corregida')<>1
 THEN RAISE EXCEPTION 'AUDIT_MISSING'; END IF;
 BEGIN UPDATE sgp_pdt_manual.reportes SET observacion='changed' WHERE id_reporte=report;RAISE EXCEPTION 'ORIGINAL_MUTABLE';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_MANUAL_ORIGINAL_IMMUTABLE' THEN RAISE; END IF; END;
 BEGIN PERFORM public.sgp_aluminio_pendiente_validar_detalles_v1('COORDINADOR',pending,
  '[{"fabricacion":"E17-1","marca":"","longitud":100,"acabado":"DS","cantidad":2}]'::jsonb,'R','retry');RAISE EXCEPTION 'REVALIDATION_ALLOWED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_MANUAL_NO_APTO_PARA_VALIDAR' THEN RAISE; END IF; END;
 -- Public dispatcher delegates every nonmanual PDT to its captured original body.
 SELECT id_pendiente INTO legacy_id FROM public.sgp_aluminio_pendientes WHERE contrato_pdt='LEGACY' AND estado='RESUELTO' LIMIT 1;
 BEGIN PERFORM sgp_pdt_manual.original_validar('COORDINADOR',legacy_id,'[]'::jsonb,'R',NULL);
 EXCEPTION WHEN OTHERS THEN legacy_error:=SQLERRM; END;
 BEGIN PERFORM public.sgp_aluminio_pendiente_validar_detalles_v1('COORDINADOR',legacy_id,'[]'::jsonb,'R',NULL);
 EXCEPTION WHEN OTHERS THEN delegated_error:=SQLERRM; END;
 IF legacy_error IS NULL OR delegated_error IS DISTINCT FROM legacy_error THEN RAISE EXCEPTION 'LEGACY_DISPATCH_CHANGED'; END IF;
 SELECT count(*) INTO before_count FROM public.sgp_aluminio_pendientes;
 BEGIN PERFORM public.sgp_aluminio_pendiente_validar_detalles_v1('RECEPCION',pending,
  '[{"fabricacion":"E17-1","marca":"","longitud":100,"acabado":"DS","cantidad":1}]'::jsonb,'R','x');
 EXCEPTION WHEN OTHERS THEN NULL; END;
 IF (SELECT count(*) FROM public.sgp_aluminio_pendientes)<>before_count THEN RAISE EXCEPTION 'ROLE_OR_RETRY_PARTIAL_WRITE'; END IF;
 INSERT INTO public.sgp_aluminio
 SELECT 'P4',id_carga,4,key_produccion,produccion,codigo_sap,sistema,activo,tipo_pieza,fabricacion,101,acabado,4,marca,uso
 FROM public.sgp_aluminio WHERE id_pieza='P1';
 response:=public.sgp_pdt_manual_registrar_v1('COORDINADOR','PICKING',
  '{"key_produccion":"QA|PANELES_2","reserva":"R","produccion":"QA ORDER"}'::jsonb,
  '[{"perfil":"PANEL-REF","fabricacion":"E17","marca":"","longitud":100,"acabado":"DS","cantidad":2}]'::jsonb,
  NULL,gen_random_uuid());pending:=(response->'ids_pendientes'->>0)::uuid;
 response:=public.sgp_aluminio_pendiente_validar_detalles_v1('COORDINADOR',pending,
  '[{"fabricacion":"E17","marca":"","longitud":101,"acabado":"DS","cantidad":3}]'::jsonb,'R','Longitud y cantidad corregidas');
 IF response->>'cantidad_reportada'<>'2' OR response->>'cantidad_validada'<>'3'
 OR (SELECT cantidad FROM public.sgp_aluminio_pendientes WHERE id_pendiente=pending)<>2
 OR (SELECT count(*) FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=pending AND longitud=101 AND cantidad_validada=3)<>1
 THEN RAISE EXCEPTION 'LENGTH_QUANTITY_CORRECTION_FAILED'; END IF;
 RAISE NOTICE 'QA PHASE2 PASS: POR_VALIDAR, fabrication/length/quantity correction, immutable original, audit, no retry, LEGACY dispatch';
END $qa$;
ROLLBACK;

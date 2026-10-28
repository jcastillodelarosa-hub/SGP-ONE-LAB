-- PostgreSQL 17 synthetic QA only. Caller wraps everything in ROLLBACK.
BEGIN;
DO $qa$ DECLARE response jsonb; report uuid; before_count integer; BEGIN
 INSERT INTO public.sgp_aluminio
 SELECT 'P3',id_carga,3,key_produccion,produccion,codigo_sap,sistema,activo,tipo_pieza,fabricacion,longitud,acabado,4,marca,uso
 FROM public.sgp_aluminio WHERE id_pieza='P1';
 response:=public.sgp_pdt_manual_registrar_v1('COORDINADOR','PICKING',
  '{"key_produccion":"QA|PANELES_2","reserva":"R","produccion":"QA ORDER"}'::jsonb,
  '[{"perfil":"PANEL-REF","fabricacion":"E17","marca":"","longitud":100,"acabado":"DS","cantidad":6,"nc":"","observacion":"Parcial"},{"perfil":"PANEL-REF","fabricacion":"E17-1","marca":"","longitud":100,"acabado":"DS","cantidad":1,"nc":"","observacion":""}]'::jsonb,
  'QA synthetic','10000000-0000-0000-0000-000000000141');
 report:=(response->>'id_reporte')::uuid;
 IF jsonb_array_length(response->'ids_pendientes')<>2 THEN RAISE EXCEPTION 'TWO_DETAILS_MISSING'; END IF;
 IF (SELECT count(*) FROM sgp_pdt_manual.reportes WHERE id_reporte=report AND anio=2026 AND semana=44 AND linea='PANELES_2' AND produccion='QA ORDER' AND reserva='R' AND sistema='ES' AND acabado='DS' AND origen='PICKING' AND usuario='COORDINADOR')<>1 THEN RAISE EXCEPTION 'HEADER_INCOMPLETE'; END IF;
 IF (SELECT count(*) FROM sgp_pdt_manual.fuentes f JOIN sgp_pdt_manual.detalles d USING(id_detalle) WHERE d.id_reporte=report AND d.fabricacion='E17')<>2 THEN RAISE EXCEPTION 'DUPLICATE_SOURCE_TRACE_MISSING'; END IF;
 IF (SELECT sum(cantidad) FROM sgp_pdt_manual.detalles WHERE id_reporte=report)<>7 THEN RAISE EXCEPTION 'QUANTITY_MULTIPLIED'; END IF;
 SELECT count(*) INTO before_count FROM public.sgp_aluminio_pendientes;
 IF public.sgp_pdt_manual_registrar_v1('COORDINADOR','PICKING',
  '{"key_produccion":"QA|PANELES_2","reserva":"R","produccion":"QA ORDER"}'::jsonb,
  '[{"perfil":"PANEL-REF","fabricacion":"E17","marca":"","longitud":100,"acabado":"DS","cantidad":6,"nc":"","observacion":"Parcial"},{"perfil":"PANEL-REF","fabricacion":"E17-1","marca":"","longitud":100,"acabado":"DS","cantidad":1,"nc":"","observacion":""}]'::jsonb,
  'QA synthetic','10000000-0000-0000-0000-000000000141')->>'duplicado' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'RETRY_FAILED'; END IF;
 IF (SELECT count(*) FROM public.sgp_aluminio_pendientes)<>before_count THEN RAISE EXCEPTION 'RETRY_DUPLICATED_PENDING'; END IF;
 BEGIN
  PERFORM public.sgp_pdt_manual_registrar_v1('COORDINADOR','PICKING','{"key_produccion":"QA|PANELES_2","reserva":"R","produccion":"QA ORDER"}'::jsonb,
   '[{"perfil":"PANEL-REF","fabricacion":"E17","marca":"","longitud":100,"acabado":"DS","cantidad":1},{"perfil":"PANEL-REF","fabricacion":"e17","marca":"","longitud":100,"acabado":"ds","cantidad":1}]'::jsonb,NULL,gen_random_uuid());
  RAISE EXCEPTION 'DUPLICATE_REJECTION_MISSING';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_MANUAL_DETALLE_REPETIDO' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.sgp_pdt_manual_registrar_v1('RECEPCION','PICKING','{"key_produccion":"QA|PANELES_2","reserva":"R","produccion":"QA ORDER"}'::jsonb,
   '[{"perfil":"PANEL-REF","fabricacion":"E17","marca":"","longitud":100,"acabado":"DS","cantidad":1}]'::jsonb,NULL,gen_random_uuid());
  RAISE EXCEPTION 'ROLE_REJECTION_MISSING';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='ROLE_REJECTION_MISSING' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.sgp_pdt_manual_registrar_v1('COORDINADOR','PICKING','{"key_produccion":"QA|PANELES_2","reserva":"R","produccion":"QA ORDER"}'::jsonb,
   '[{"perfil":"FRAME-REF","fabricacion":"F1","marca":"","longitud":100,"acabado":"DS","cantidad":1}]'::jsonb,NULL,gen_random_uuid());
  RAISE EXCEPTION 'FRAME_REJECTION_MISSING';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='FRAME_REJECTION_MISSING' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM public.sgp_aluminio_pendientes)<>before_count THEN RAISE EXCEPTION 'REJECTION_LEFT_WRITES'; END IF;
 INSERT INTO public.sgp_nc_aluminio(consecutivo,cod_nc,activo,estado) VALUES('QA-NC','QA-NC',true,'ABIERTA');
 response:=public.sgp_pdt_manual_registrar_v1('COORDINADOR','ENSAMBLE',
  '{"key_produccion":"QA|PANELES_2","reserva":"R","produccion":"QA ORDER"}'::jsonb,
  '[{"perfil":"PANEL-REF","fabricacion":"E17","marca":"","longitud":100,"acabado":"DS","cantidad":1,"nc":"QA-NC"}]'::jsonb,
  NULL,'10000000-0000-0000-0000-000000000142');
 IF (SELECT count(*) FROM public.sgp_aluminio_pendiente_ncs WHERE id_pendiente=(response->'ids_pendientes'->>0)::uuid AND consecutivo='QA-NC')<>1 THEN RAISE EXCEPTION 'NC_LINK_MISSING'; END IF;
 IF public.sgp_pdt_manual_nc_consultar_v1('COORDINADOR','QA-NC')->'nc'->>'estado'<>'ABIERTA' THEN RAISE EXCEPTION 'NC_STATE_MISSING'; END IF;
 RAISE NOTICE 'QA MANUAL PASS: multi-source, quantities, header, idempotency, role, FRAME rejection, NC link/read';
END $qa$;
ROLLBACK;

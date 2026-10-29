-- PostgreSQL 17 fixture only. The runner inserts 05_export_year_REVIEW.sql
-- between the two marked blocks and replaces its guard with the fixture hash.
BEGIN;
CREATE FUNCTION public.sgp_aplicar_export_diario(
 p_token text,p_linea text,p_nombre_archivo text,p_datos jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $fn$
DECLARE item jsonb;
BEGIN
 FOR item IN SELECT value FROM jsonb_array_elements(p_datos) LOOP
  UPDATE public.sgp_producciones SET semana_actual=(item->>'semana_actual')::integer
   WHERE key_produccion=item->>'key_produccion';
 END LOOP;
 RETURN '{"ok":true}'::jsonb;
END $fn$;
-- INSTALL_REVIEW_HERE
DO $qa$ DECLARE result jsonb; original_year integer; original_week integer; pending uuid;
BEGIN
 UPDATE public.sgp_producciones SET anio=2026,semana_base=41,semana_actual=41
 WHERE key_produccion='QA|PANELES_2';
 EXECUTE 'SET CONSTRAINTS trg_pdt_manual_auditar_programacion IMMEDIATE';
 EXECUTE 'SET CONSTRAINTS trg_pdt_manual_auditar_programacion DEFERRED';
 result:=public.sgp_pdt_manual_registrar_v1('COORDINADOR','PICKING',
  '{"key_produccion":"QA|PANELES_2","reserva":"R","produccion":"QA ORDER"}'::jsonb,
  '[{"perfil":"PANEL-REF","fabricacion":"E17","marca":"","longitud":100,"acabado":"DS","cantidad":2,"nc":""}]'::jsonb,
  'Original 2026/41',gen_random_uuid());
 pending:=(result->'ids_pendientes'->>0)::uuid;
 SELECT r.anio,r.semana INTO STRICT original_year,original_week
 FROM sgp_pdt_manual.reportes r JOIN sgp_pdt_manual.detalles d ON d.id_reporte=r.id_reporte
 WHERE d.id_pendiente=pending;
 PERFORM public.sgp_aplicar_export_diario('QA','PANELES_2','qa.xlsx',
  '[{"key_produccion":"QA|PANELES_2","id_linea":"PANELES_2","anio":2027,"semana_actual":1}]'::jsonb);
 EXECUTE 'SET CONSTRAINTS trg_pdt_manual_auditar_programacion IMMEDIATE';
 IF (SELECT anio::text||'/'||semana_actual::text FROM public.sgp_producciones
  WHERE key_produccion='QA|PANELES_2')<>'2027/1'
 OR (SELECT count(*) FROM sgp_pdt_manual.programacion_cambios
  WHERE id_pendiente=pending AND anio_anterior=2026 AND semana_anterior=41
   AND anio_nuevo=2027 AND semana_nueva=1)<>1
 OR original_year<>2026 OR original_week<>41
 THEN RAISE EXCEPTION 'CROSS_YEAR_IMPORT_FAILED'; END IF;
 EXECUTE 'SET CONSTRAINTS trg_pdt_manual_auditar_programacion DEFERRED';
 PERFORM public.sgp_aplicar_export_diario('QA','PANELES_2','qa.xlsx',
  '[{"key_produccion":"QA|PANELES_2","id_linea":"PANELES_2","anio":2027,"semana_actual":1}]'::jsonb);
 EXECUTE 'SET CONSTRAINTS trg_pdt_manual_auditar_programacion IMMEDIATE';
 IF (SELECT count(*) FROM sgp_pdt_manual.programacion_cambios WHERE id_pendiente=pending)<>1
 THEN RAISE EXCEPTION 'REPEATED_IMPORT_DUPLICATED_AUDIT'; END IF;
 EXECUTE 'SET CONSTRAINTS trg_pdt_manual_auditar_programacion DEFERRED';
 PERFORM public.sgp_aplicar_export_diario('QA','PANELES_2','qa.xlsx',
  '[{"key_produccion":"QA|PANELES_2","id_linea":"PANELES_2","anio":2027,"semana_actual":2}]'::jsonb);
 EXECUTE 'SET CONSTRAINTS trg_pdt_manual_auditar_programacion IMMEDIATE';
 IF (SELECT anio::text||'/'||semana_actual::text FROM public.sgp_producciones
  WHERE key_produccion='QA|PANELES_2')<>'2027/2'
 THEN RAISE EXCEPTION 'SAME_YEAR_IMPORT_FAILED'; END IF;
 RAISE NOTICE 'QA EXPORT YEAR PASS: cross-year, original immutable, repeated load, same-year value';
END $qa$;
SAVEPOINT missing_year;
DO $reject$ BEGIN
 PERFORM public.sgp_aplicar_export_diario('QA','PANELES_2','qa.xlsx',
  '[{"key_produccion":"QA|PANELES_2","id_linea":"PANELES_2","semana_actual":3}]'::jsonb);
 RAISE EXCEPTION 'MISSING_YEAR_ACCEPTED';
EXCEPTION WHEN OTHERS THEN
 IF SQLERRM='MISSING_YEAR_ACCEPTED' THEN RAISE; END IF;
 IF SQLERRM<>'PDT_EXPORT_YEAR_EXPLICIT_PERIOD_REQUIRED' THEN RAISE; END IF;
END $reject$;
ROLLBACK TO SAVEPOINT missing_year;
DO $verify$ BEGIN
 IF (SELECT semana_actual FROM public.sgp_producciones WHERE key_produccion='QA|PANELES_2')<>2
 THEN RAISE EXCEPTION 'REJECTED_IMPORT_WROTE_DATA'; END IF;
 RAISE NOTICE 'QA EXPORT YEAR PASS: missing year rejected without writes';
END $verify$;
ROLLBACK;

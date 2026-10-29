-- PostgreSQL 17 isolated QA. No production writes. All synthetic changes roll back.
BEGIN;
DO $qa$ DECLARE response jsonb; pending_one uuid; pending_shared uuid; initial_quantity integer; initial_nc text;
BEGIN
 UPDATE public.sgp_producciones SET anio=2026,semana_base=41,semana_actual=42
 WHERE key_produccion='QA|PANELES_2';
 IF (SELECT anio::text||'-'||semana::text FROM sgp_pdt_manual.programacion('QA|PANELES_2','R'))<>'2026-42'
 THEN RAISE EXCEPTION 'CURRENT_2026_PERIOD_WRONG'; END IF;
 response:=public.sgp_pdt_manual_registrar_v1('COORDINADOR','PICKING',
  '{"key_produccion":"QA|PANELES_2","reserva":"R","produccion":"QA ORDER"}'::jsonb,
  '[{"perfil":"PANEL-REF","fabricacion":"E17","marca":"","longitud":100,"acabado":"DS","cantidad":2,"nc":""}]'::jsonb,
  'Reporte R',gen_random_uuid());
 pending_one:=(response->'ids_pendientes'->>0)::uuid;
 response:=public.sgp_pdt_manual_registrar_v1('COORDINADOR','PICKING',
  '{"key_produccion":"QA|PANELES_2","reserva":"SHARED","produccion":"QA ORDER"}'::jsonb,
  '[{"perfil":"PANEL-REF","fabricacion":"E17","marca":"","longitud":100,"acabado":"DS","cantidad":1,"nc":""}]'::jsonb,
  'Reporte reserva compartida',gen_random_uuid());
 pending_shared:=(response->'ids_pendientes'->>0)::uuid;
 IF (SELECT count(*) FROM sgp_pdt_manual.reportes WHERE anio=2026 AND semana=42
  AND reserva IN ('R','SHARED'))<>2 THEN RAISE EXCEPTION 'ORIGINAL_REPORT_PERIOD_WRONG'; END IF;
 SELECT cantidad INTO STRICT initial_quantity FROM public.sgp_aluminio_pendientes WHERE id_pendiente=pending_one;
 SELECT nc INTO initial_nc FROM public.sgp_aluminio_pendientes WHERE id_pendiente=pending_one;
 UPDATE public.sgp_producciones SET semana_actual=43 WHERE key_produccion='QA|PANELES_2';
 UPDATE public.sgp_producciones SET semana_actual=43 WHERE key_produccion='QA|PANELES_2';
 IF (SELECT count(*) FROM sgp_pdt_manual.programacion_cambios
  WHERE id_pendiente IN (pending_one,pending_shared) AND anio_anterior=2026 AND semana_anterior=42
   AND anio_nuevo=2026 AND semana_nueva=43)<>2
 THEN RAISE EXCEPTION 'SAME_YEAR_CHANGE_NOT_AUDITED_ONCE_PER_RESERVE'; END IF;
 UPDATE public.sgp_producciones SET anio=2027,semana_actual=1 WHERE key_produccion='QA|PANELES_2';
 UPDATE public.sgp_producciones SET anio=2027,semana_actual=1 WHERE key_produccion='QA|PANELES_2';
 IF (SELECT count(*) FROM sgp_pdt_manual.programacion_cambios
  WHERE id_pendiente IN (pending_one,pending_shared) AND anio_anterior=2026 AND semana_anterior=43
   AND anio_nuevo=2027 AND semana_nueva=1)<>2
 THEN RAISE EXCEPTION 'CROSS_YEAR_CHANGE_NOT_AUDITED_ONCE_PER_RESERVE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.sgp_pdt_manual_listar_v1('COORDINADOR')->'pendientes') x
  WHERE x->>'id_pendiente'=pending_one::text AND x->>'anio'='2027' AND x->>'semana'='1'
   AND x->>'anio_original'='2026' AND x->>'semana_original'='42')
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.sgp_pdt_manual_listar_v1('COORDINADOR')->'pendientes') x
  WHERE x->>'id_pendiente'=pending_shared::text AND x->>'reserva'='SHARED' AND x->>'anio'='2027' AND x->>'semana'='1')
 THEN RAISE EXCEPTION 'CURRENT_PERIOD_OR_SHARED_RESERVE_WRONG'; END IF;
 IF (SELECT cantidad FROM public.sgp_aluminio_pendientes WHERE id_pendiente=pending_one)<>initial_quantity
 OR (SELECT nc FROM public.sgp_aluminio_pendientes WHERE id_pendiente=pending_one) IS DISTINCT FROM initial_nc
 OR (SELECT count(*) FROM sgp_pdt_manual.reportes WHERE anio=2026 AND semana=42
  AND reserva IN ('R','SHARED'))<>2
 OR (SELECT count(*) FROM public.sgp_aluminio_pendientes_historial WHERE id_pendiente IN (pending_one,pending_shared)
  AND tipo_evento='REPROGRAMACION_PDT_MANUAL')<>4
 OR EXISTS(SELECT 1 FROM public.sgp_aluminio_pendientes_historial h
  LEFT JOIN sgp_pdt_manual.detalles md USING(id_pendiente)
  WHERE h.tipo_evento='REPROGRAMACION_PDT_MANUAL' AND md.id_pendiente IS NULL)
 THEN RAISE EXCEPTION 'ORIGINAL_QUANTITY_OR_AUDIT_CHANGED'; END IF;
 RAISE NOTICE 'QA PHASE4 PASS: current period, 2026-2027, shared reserve, immutable original, no duplicate events';
END $qa$;
ROLLBACK;

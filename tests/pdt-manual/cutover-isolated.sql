-- PostgreSQL 17 synthetic fixture, after manual 01-04 and integration 06.
-- Exercises only the cut contract and manual header; always ROLLBACK.
BEGIN;
DO $qa$ DECLARE result jsonb; pending uuid; reported timestamptz; cutoff timestamptz;
BEGIN
 result:=public.sgp_pdt_manual_registrar_v1('COORDINADOR','PICKING',
  '{"key_produccion":"QA|PANELES_2","reserva":"R","produccion":"QA ORDER"}'::jsonb,
  '[{"perfil":"PANEL-REF","fabricacion":"E17","marca":"","longitud":100,"acabado":"DS","cantidad":1,"nc":""}]'::jsonb,
  'Corte QA',gen_random_uuid());
 pending:=(result->'ids_pendientes'->>0)::uuid;
 SELECT fecha INTO STRICT reported FROM sgp_pdt_manual.reportes WHERE id_reporte=(result->>'id_reporte')::uuid;
 cutoff:=reported - interval '1 second';
 INSERT INTO sgp_pdt_manual.corte_operativo(id,desde,activado_por) VALUES(1,cutoff,'QA');
 IF (public.sgp_pdt_corte_operativo_v1('COORDINADOR')->>'desde')::timestamptz IS DISTINCT FROM cutoff
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.sgp_pdt_manual_listar_v1('COORDINADOR')->'pendientes') x
  WHERE x->>'id_pendiente'=pending::text AND (x->>'fecha_reporte')::timestamptz>=cutoff)
 THEN RAISE EXCEPTION 'POST_CUT_MANUAL_PDT_NOT_VISIBLE'; END IF;
 RAISE NOTICE 'QA CUT PASS: new manual PDT carries creation time and passes operational cutoff';
END $qa$;
ROLLBACK;

-- Exact empty-model rollback only. Never destroy imported evidence.
BEGIN;
DO $restore$
DECLARE actual text;t text;n bigint;
BEGIN
 IF current_setting('sgp.export_v2_test',true) IS DISTINCT FROM 'ISOLATED_ONLY' THEN RAISE EXCEPTION 'V2_ISOLATED_DATABASE_REQUIRED'; END IF;
 IF to_regnamespace('sgp_lp_export_v2_qa') IS NULL THEN RAISE EXCEPTION 'V2_MODEL_NOT_FOUND'; END IF;
 IF NOT EXISTS(SELECT 1 FROM sgp_lp_export_v2_qa.artifact WHERE id AND version='LP-EXPORT-PRODUCTION-2.0.0-ISOLATED' AND enabled=false) THEN RAISE EXCEPTION 'V2_MODEL_VERSION_CHANGED'; END IF;
 SELECT md5(jsonb_build_object(
 'perimeter',(SELECT jsonb_agg(jsonb_build_array(c.relname,pg_get_userbyid(c.relowner),c.relacl::text,c.relrowsecurity,c.relforcerowsecurity) ORDER BY c.relname) FROM pg_class c WHERE c.relnamespace='sgp_lp_export_v2_qa'::regnamespace AND c.relkind='r'),
 'namespace',(SELECT jsonb_build_array(pg_get_userbyid(nspowner),nspacl::text) FROM pg_namespace WHERE nspname='sgp_lp_export_v2_qa'),
 'columns',(SELECT jsonb_agg(jsonb_build_array(c.relname,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) ORDER BY c.relname,a.attnum) FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE c.relnamespace='sgp_lp_export_v2_qa'::regnamespace AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.conname,pg_get_constraintdef(c.oid)) ORDER BY c.conname,pg_get_constraintdef(c.oid)) FROM pg_constraint c WHERE c.connamespace='sgp_lp_export_v2_qa'::regnamespace),
 'functions',(SELECT jsonb_agg(jsonb_build_array(p.proname,p.prosrc,p.prosecdef,p.proconfig) ORDER BY p.proname) FROM pg_proc p WHERE p.pronamespace='sgp_lp_export_v2_qa'::regnamespace),
 'triggers',(SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY pg_get_triggerdef(t.oid)) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='sgp_lp_export_v2_qa'::regnamespace AND NOT t.tgisinternal)
 )::text) INTO actual;
 IF actual IS DISTINCT FROM '551be81d9814489c5a0a84ceedbda79b' THEN RAISE EXCEPTION 'V2_MODEL_SOURCE_CHANGED'; END IF;
 FOREACH t IN ARRAY ARRAY['periods','imports','import_rows','closures','closure_rows','receipts'] LOOP
  EXECUTE format('SELECT count(*) FROM sgp_lp_export_v2_qa.%I',t) INTO n;
  IF n<>0 THEN RAISE EXCEPTION 'V2_HISTORY_PRESERVE_NOT_EMPTY'; END IF;
 END LOOP;
END $restore$;
ALTER TABLE sgp_lp_export_v2_qa.periods DROP CONSTRAINT period_current_import;
ALTER TABLE sgp_lp_export_v2_qa.periods DROP CONSTRAINT period_current_closure;
DROP TABLE sgp_lp_export_v2_qa.receipts,sgp_lp_export_v2_qa.closure_rows,sgp_lp_export_v2_qa.closures,sgp_lp_export_v2_qa.import_rows,sgp_lp_export_v2_qa.imports,sgp_lp_export_v2_qa.periods,sgp_lp_export_v2_qa.artifact;
DROP FUNCTION sgp_lp_export_v2_qa.immutable_history(),sgp_lp_export_v2_qa.validate_closure_source();
DROP SCHEMA sgp_lp_export_v2_qa;
COMMIT;

-- Additive current-turn materialization for EMPAQUE/PANELES_2. No activation/job.
-- Requires installed v410. Does not replace or relax the Ensamble endpoint.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $guard$ DECLARE src text; BEGIN
 PERFORM 1 FROM sgp_lp_operacion.config WHERE id FOR UPDATE;
 IF to_regprocedure('public.sgp_lp_empaque_turno_actual(text)') IS NOT NULL THEN RAISE EXCEPTION 'HORARIO_EMPAQUE_YA_INSTALADO'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.sgp_lp_ensamble_turno_actual(text)')) IS DISTINCT FROM '1739475a4cef5af12ef97aaa42a31e20'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('sgp_lp_operacion.confirmar_apertura_horario()')) IS DISTINCT FROM 'a8392dc58767be7ce6ad287bb089b1e4'
 THEN RAISE EXCEPTION 'HORARIO_BASE_CAMBIO_REVISAR'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='sgp_lp_operacion.confirmar_apertura_horario()'::regprocedure
 AND prosecdef AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""']) THEN RAISE EXCEPTION 'HORARIO_TRIGGER_METADATA_INCOMPATIBLE'; END IF;
 SELECT pg_get_expr(conbin,conrelid) INTO src FROM pg_constraint
 WHERE conrelid='sgp_lp_operacion.aperturas_horario'::regclass AND conname='aperturas_horario_etapa_check';
 IF src IS DISTINCT FROM '(etapa = ''ENSAMBLE''::text)' THEN RAISE EXCEPTION 'HORARIO_CHECK_ETAPA_CAMBIO'; END IF;
END $guard$;
ALTER TABLE sgp_lp_operacion.config ADD COLUMN turno_horario_empaque boolean NOT NULL DEFAULT false;
ALTER TABLE sgp_lp_operacion.aperturas_horario DROP CONSTRAINT aperturas_horario_etapa_check;
ALTER TABLE sgp_lp_operacion.aperturas_horario ADD CONSTRAINT aperturas_horario_etapa_check CHECK(etapa IN('ENSAMBLE','EMPAQUE'));
DO $patch$ DECLARE def text;b text;candidate text; BEGIN
 SELECT pg_get_functiondef(oid),prosrc INTO def,b FROM pg_proc WHERE oid='sgp_lp_operacion.confirmar_apertura_horario()'::regprocedure;
 candidate:=replace(b,'''ENSAMBLE''', 'NEW.etapa');
 candidate:=replace(candidate,$old$rol IN('LIDER LINEA','SUPERVISOR ENSAMBLE','COORDINADOR','ADMINISTRADOR')$old$,
 $new$(rol IN('LIDER LINEA','COORDINADOR','ADMINISTRADOR') OR (NEW.etapa='ENSAMBLE' AND rol='SUPERVISOR ENSAMBLE') OR (NEW.etapa='EMPAQUE' AND rol='SUPERVISOR EMPAQUE'))$new$);
 EXECUTE replace(def,b,candidate);
 SELECT pg_get_functiondef(oid),prosrc INTO def,b FROM pg_proc WHERE oid='public.sgp_lp_ensamble_turno_actual(text)'::regprocedure;
 candidate:=replace(replace(b,'ENSAMBLE','EMPAQUE'),'ensamble','empaque');
 EXECUTE replace(replace(def,'sgp_lp_ensamble_turno_actual','sgp_lp_empaque_turno_actual'),b,candidate);
END $patch$;
ALTER FUNCTION public.sgp_lp_empaque_turno_actual(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sgp_lp_empaque_turno_actual(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sgp_lp_empaque_turno_actual(text) TO anon,authenticated;
-- Existing private trigger metadata/ACL remain unchanged; no schema/table GRANT.
DO $$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_lp_ensamble_turno_actual(text)'::regprocedure) <> '1739475a4cef5af12ef97aaa42a31e20' THEN RAISE EXCEPTION 'HORARIO_ENSAMBLE_ALTERADO'; END IF;
END $$;
COMMIT;

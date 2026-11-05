-- REVIEW ONLY: targeted read-only preflight; no grants or flag changes.
BEGIN READ ONLY;
SET LOCAL search_path='';
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regnamespace('sgp_lp_order_details') IS NOT NULL THEN RAISE EXCEPTION 'INSTALL_STATE_CONFLICT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('sgp_lp_afectaciones.actor(text,text,text,text,date,integer)') AND md5(pg_get_functiondef(p.oid))='966f726aeee7c22d0fa58d21e1bd28ee' AND pg_get_userbyid(p.proowner)='postgres') THEN RAISE EXCEPTION 'DEFINITION_OR_OWNER_DRIFT: %','sgp_lp_afectaciones.actor(text,text,text,text,date,integer)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.sgp_lp_afectaciones_comando_v1(text,text,text,date,integer,jsonb)') AND md5(pg_get_functiondef(p.oid))='b4ad8c7fde29fc66f7fb796d83d40548' AND pg_get_userbyid(p.proowner)='postgres') THEN RAISE EXCEPTION 'DEFINITION_OR_OWNER_DRIFT: %','public.sgp_lp_afectaciones_comando_v1(text,text,text,date,integer,jsonb)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('sgp_lp_operacion.admitir()') AND md5(pg_get_functiondef(p.oid))='3794f2d755ceb0dab4e102dce18e838c' AND pg_get_userbyid(p.proowner)='postgres') THEN RAISE EXCEPTION 'DEFINITION_OR_OWNER_DRIFT: %','sgp_lp_operacion.admitir()';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('sgp_lp_operacion.puede_operar(text,text,text)') AND md5(pg_get_functiondef(p.oid))='45288fff62b8afc504a5373f9c4d18f2' AND pg_get_userbyid(p.proowner)='postgres') THEN RAISE EXCEPTION 'DEFINITION_OR_OWNER_DRIFT: %','sgp_lp_operacion.puede_operar(text,text,text)';END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sgp_producciones' AND column_name='porc_vidrio' AND data_type='numeric') THEN RAISE EXCEPTION 'EXPORT_PERCENTAGE_COLUMN_MISSING';END IF;
END $$;
SELECT escrituras FROM sgp_lp_operacion.config WHERE id;
SELECT writes FROM sgp_lp_afectaciones.config WHERE id;
ROLLBACK;

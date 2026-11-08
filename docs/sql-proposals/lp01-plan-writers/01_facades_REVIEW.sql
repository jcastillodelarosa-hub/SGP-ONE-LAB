-- Requires the private journal installer. Does not enable its flag.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
DO $$BEGIN
 IF current_user<>'postgres' OR to_regprocedure('sgp_lp_operacion.plan_programar(text,text,date,integer,integer,integer,text,uuid)') IS NULL OR to_regprocedure('sgp_lp_operacion.plan_mover(text,uuid,date,integer,integer,integer,text,uuid)') IS NULL THEN RAISE EXCEPTION 'PLAN_WRITER_PREREQUISITE';END IF;
 IF to_regprocedure('public.sgp_linea_plan_programar(text,text,date,integer,integer,integer,text,uuid)') IS NOT NULL OR to_regprocedure('public.sgp_linea_plan_mover(text,uuid,date,integer,integer,integer,text,uuid)') IS NOT NULL THEN RAISE EXCEPTION 'PLAN_WRITERS_ALREADY_INSTALLED';END IF;
END $$;
-- Deferred COMMIT runs after the RPC has returned to anon/authenticated.
-- Only this private trigger receives its owner's authority; EXECUTE stays revoked.
ALTER FUNCTION sgp_lp_operacion.plan_contexto_completo() SECURITY DEFINER;
REVOKE ALL ON FUNCTION sgp_lp_operacion.plan_contexto_completo() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.sgp_linea_plan_programar(p_token text,p_key_produccion text,p_fecha date,p_turno integer,p_cantidad integer,p_prioridad integer,p_motivo text,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;u text;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['COORDINADOR','ADMINISTRADOR']);
 result:=sgp_lp_operacion.plan_programar(p_token,p_key_produccion,p_fecha,p_turno,p_cantidad,p_prioridad,p_motivo,p_request_id);
 IF public.sgp_validar_sesion_rol(p_token,ARRAY['COORDINADOR','ADMINISTRADOR']) IS DISTINCT FROM u THEN RAISE EXCEPTION 'PLAN_SESSION_CHANGED';END IF;
 PERFORM sgp_lp_operacion.verificar_temporal(u,'ENSAMBLE','PANELES_2',p_fecha,p_turno,p_key_produccion,'LEER');
 RETURN result;
END $$;
CREATE FUNCTION public.sgp_linea_plan_mover(p_token text,p_asignacion uuid,p_fecha date,p_turno integer,p_cantidad integer,p_prioridad integer,p_motivo text,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;u text;a public.sgp_linea_plan_asignaciones%rowtype;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['COORDINADOR','ADMINISTRADOR']);
 SELECT * INTO a FROM public.sgp_linea_plan_asignaciones WHERE id=p_asignacion;
 IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_ASSIGNMENT_MISSING';END IF;
 result:=sgp_lp_operacion.plan_mover(p_token,p_asignacion,p_fecha,p_turno,p_cantidad,p_prioridad,p_motivo,p_request_id);
 IF public.sgp_validar_sesion_rol(p_token,ARRAY['COORDINADOR','ADMINISTRADOR']) IS DISTINCT FROM u THEN RAISE EXCEPTION 'PLAN_SESSION_CHANGED';END IF;
 PERFORM sgp_lp_operacion.verificar_temporal(u,'ENSAMBLE','PANELES_2',a.fecha,a.turno,a.key_produccion,'LEER');
 PERFORM sgp_lp_operacion.verificar_temporal(u,'ENSAMBLE','PANELES_2',p_fecha,p_turno,a.key_produccion,'LEER');
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.sgp_linea_plan_programar(text,text,date,integer,integer,integer,text,uuid),public.sgp_linea_plan_mover(text,uuid,date,integer,integer,integer,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sgp_linea_plan_programar(text,text,date,integer,integer,integer,text,uuid),public.sgp_linea_plan_mover(text,uuid,date,integer,integer,integer,text,uuid) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

-- Additive proposal. Creates no operational rows during installation; flag false.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
DO $$BEGIN
 IF current_user<>'postgres' OR to_regclass('sgp_lp_operacion.turnos') IS NULL OR to_regprocedure('sgp_lp_operacion.periodo(date,integer)') IS NULL THEN RAISE EXCEPTION 'HISTORICAL_PREREQUISITE';END IF;
 PERFORM 1 FROM sgp_lp_operacion.config WHERE id FOR UPDATE;
 IF to_regclass('sgp_lp_operacion.preparaciones_historicas') IS NOT NULL THEN RAISE EXCEPTION 'HISTORICAL_ALREADY_INSTALLED';END IF;
END $$;
ALTER TABLE sgp_lp_operacion.config ADD COLUMN preparar_historico boolean NOT NULL DEFAULT false;
CREATE TABLE sgp_lp_operacion.preparaciones_historicas(
 id uuid PRIMARY KEY,etapa text NOT NULL CHECK(etapa IN('ENSAMBLE','EMPAQUE')),linea text NOT NULL CHECK(linea='PANELES_2'),fecha date NOT NULL,turno integer NOT NULL CHECK(turno IN(1,2)),
 usuario text NOT NULL,motivo text NOT NULL CHECK(length(btrim(motivo)) BETWEEN 1 AND 2000),periodo jsonb NOT NULL,respuesta jsonb NOT NULL,creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(etapa,linea,fecha,turno),FOREIGN KEY(etapa,linea,fecha,turno) REFERENCES sgp_lp_operacion.turnos(etapa,linea,fecha,turno));
ALTER TABLE sgp_lp_operacion.preparaciones_historicas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sgp_lp_operacion.preparaciones_historicas FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION sgp_lp_operacion.preparacion_historica_inmutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN RAISE EXCEPTION 'HISTORICAL_IMMUTABLE';END $$;
CREATE TRIGGER inmutable BEFORE UPDATE OR DELETE ON sgp_lp_operacion.preparaciones_historicas FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.preparacion_historica_inmutable();
CREATE FUNCTION sgp_lp_operacion.confirmar_preparacion_historica() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.sgp_usuarios WHERE usuario=NEW.usuario AND activo AND rol IN('COORDINADOR','ADMINISTRADOR')) OR NOT sgp_lp_operacion.puede_operar(NEW.usuario,NEW.etapa,'CERRAR') THEN RAISE EXCEPTION 'HISTORICAL_ROLE_REVOKED';END IF;
 PERFORM sgp_lp_operacion.verificar_temporal(NEW.usuario,NEW.etapa,NEW.linea,NEW.fecha,NEW.turno,NULL,'LEER');RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER confirmar AFTER INSERT ON sgp_lp_operacion.preparaciones_historicas DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.confirmar_preparacion_historica();
REVOKE ALL ON FUNCTION sgp_lp_operacion.preparacion_historica_inmutable(),sgp_lp_operacion.confirmar_preparacion_historica() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.sgp_lp_turno_historico_preparar(p_token text,p_id uuid,p_etapa text,p_linea text,p_fecha date,p_turno integer,p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;u text;enabled boolean;prior sgp_lp_operacion.preparaciones_historicas%rowtype;slot jsonb;tr sgp_lp_operacion.turnos%rowtype;res jsonb;observed timestamptz;
BEGIN
 IF p_id IS NULL OR p_etapa IS NULL OR p_etapa NOT IN('ENSAMBLE','EMPAQUE') OR p_linea IS DISTINCT FROM 'PANELES_2' OR p_fecha IS NULL OR p_turno IS NULL OR p_turno NOT IN(1,2) OR nullif(btrim(p_motivo),'') IS NULL OR length(btrim(p_motivo))>2000 THEN RAISE EXCEPTION 'HISTORICAL_INVALID_REQUEST';END IF;
 s:=sgp_lp_operacion.sesion(p_token,p_etapa,NULL,p_linea);u:=s->>'usuario';
 IF s->>'rol' NOT IN('COORDINADOR','ADMINISTRADOR') OR NOT sgp_lp_operacion.puede_operar(u,p_etapa,'CERRAR') THEN RAISE EXCEPTION 'HISTORICAL_ROLE_DENIED';END IF;
 SELECT preparar_historico AND escrituras INTO enabled FROM sgp_lp_operacion.config WHERE id FOR SHARE;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,123));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_etapa||'|'||p_linea,184));
 s:=sgp_lp_operacion.sesion(p_token,p_etapa,NULL,p_linea);
 IF s->>'usuario' IS DISTINCT FROM u OR s->>'rol' NOT IN('COORDINADOR','ADMINISTRADOR') OR NOT sgp_lp_operacion.puede_operar(u,p_etapa,'CERRAR') THEN RAISE EXCEPTION 'HISTORICAL_ROLE_DENIED';END IF;
 PERFORM sgp_lp_operacion.verificar_temporal(u,p_etapa,p_linea,p_fecha,p_turno,NULL,'LEER');
 SELECT * INTO prior FROM sgp_lp_operacion.preparaciones_historicas WHERE id=p_id;
 IF FOUND THEN
  IF prior.usuario<>u OR prior.etapa<>p_etapa OR prior.linea<>p_linea OR prior.fecha<>p_fecha OR prior.turno<>p_turno OR prior.motivo<>btrim(p_motivo) THEN RAISE EXCEPTION 'HISTORICAL_REQUEST_REUSED';END IF;
  RETURN prior.respuesta||jsonb_build_object('duplicate',true);
 END IF;
 IF enabled IS DISTINCT FROM true THEN RAISE EXCEPTION 'HISTORICAL_DISABLED';END IF;
 PERFORM 1 FROM public.sgp_configuracion_general WHERE clave='HORARIOS_TURNOS' FOR SHARE;
 observed:=clock_timestamp();slot:=sgp_lp_operacion.periodo(p_fecha,p_turno);
 IF p_fecha>=(observed AT TIME ZONE 'America/Bogota')::date OR slot->>'end' IS NULL OR (slot->>'end')::timestamptz>=observed THEN RAISE EXCEPTION 'HISTORICAL_PERIOD_NOT_PAST';END IF;
 SELECT * INTO tr FROM sgp_lp_operacion.turnos WHERE etapa=p_etapa AND linea=p_linea AND fecha=p_fecha AND turno=p_turno FOR UPDATE;
 IF FOUND THEN RAISE EXCEPTION 'HISTORICAL_TURN_ALREADY_EXISTS';END IF;
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.archivos WHERE etapa=p_etapa AND linea=p_linea AND fecha=p_fecha AND turno=p_turno) OR EXISTS(SELECT 1 FROM sgp_lp_operacion.auditoria WHERE etapa=p_etapa AND linea=p_linea AND fecha=p_fecha AND turno=p_turno) OR EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes WHERE etapa=p_etapa AND linea=p_linea AND fecha=p_fecha AND turno=p_turno) OR EXISTS(SELECT 1 FROM sgp_lp_operacion.cierres WHERE etapa=p_etapa AND linea=p_linea AND fecha=p_fecha AND turno=p_turno) THEN RAISE EXCEPTION 'HISTORICAL_EXISTING_ACTIVITY';END IF;
 INSERT INTO sgp_lp_operacion.turnos(etapa,linea,fecha,turno) VALUES(p_etapa,p_linea,p_fecha,p_turno) RETURNING * INTO tr;
 res:=jsonb_build_object('ok',true,'contract','LP-TURNO-HISTORICO-1','requestId',p_id,'stage',p_etapa,'line',p_linea,'date',p_fecha,'shift',p_turno,'state','PREPARED','created',true,'turn',to_jsonb(tr),'historicalPlan','UNAVAILABLE','ordersCreated',0,'quantitiesChanged',false,'closed',false);
 INSERT INTO sgp_lp_operacion.preparaciones_historicas(id,etapa,linea,fecha,turno,usuario,motivo,periodo,respuesta) VALUES(p_id,p_etapa,p_linea,p_fecha,p_turno,u,btrim(p_motivo),slot,res);
 RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.sgp_lp_turno_historico_preparar(text,uuid,text,text,date,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sgp_lp_turno_historico_preparar(text,uuid,text,text,date,integer,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

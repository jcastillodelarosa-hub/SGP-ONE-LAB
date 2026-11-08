-- REVIEW ONLY: authenticated on-entry materialization, not a scheduler/job.
-- Does not change ABRIR, its permissions, prior turns, quantities or Export.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF to_regprocedure('public.sgp_lp_ensamble_turno_actual(text)') IS NOT NULL THEN RAISE EXCEPTION 'INSTALACION_EXISTENTE_REVISAR'; END IF;
 IF to_regprocedure('sgp_lp_operacion.sesion(text,text,text,text)') IS NULL
 OR to_regprocedure('sgp_lp_operacion.periodo(date,integer)') IS NULL
 OR to_regprocedure('sgp_lp_operacion.puede_operar(text,text,text)') IS NULL
 OR to_regprocedure('sgp_lp_operacion.verificar_temporal(text,text,text,date,integer,text,text)') IS NULL
 THEN RAISE EXCEPTION 'CONTRATO_BASE_AUSENTE'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='sgp_lp_operacion.puede_operar(text,text,text)'::regprocedure) <> 'b0b7459a0be0a7ea5a4a392eecb2afde' THEN RAISE EXCEPTION 'GUARD_PERMISOS_CAMBIO_REVISAR'; END IF;
END $$;
ALTER TABLE sgp_lp_operacion.config ADD COLUMN turno_horario_ensamble boolean NOT NULL DEFAULT false;
CREATE TABLE sgp_lp_operacion.aperturas_horario(
 etapa text NOT NULL CHECK(etapa='ENSAMBLE'),linea text NOT NULL CHECK(linea='PANELES_2'),
 fecha date NOT NULL,turno integer NOT NULL CHECK(turno IN(1,2)),usuario text NOT NULL,
 observado_en timestamptz NOT NULL,periodo jsonb NOT NULL,
 PRIMARY KEY(etapa,linea,fecha,turno),
 FOREIGN KEY(etapa,linea,fecha,turno) REFERENCES sgp_lp_operacion.turnos);
ALTER TABLE sgp_lp_operacion.aperturas_horario ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sgp_lp_operacion.aperturas_horario FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION sgp_lp_operacion.confirmar_apertura_horario() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT sgp_lp_operacion.puede_operar(NEW.usuario,'ENSAMBLE','CERRAR')
 OR NOT EXISTS(SELECT 1 FROM public.sgp_usuarios WHERE usuario=NEW.usuario AND activo
 AND rol IN('LIDER LINEA','SUPERVISOR ENSAMBLE','COORDINADOR','ADMINISTRADOR'))
 THEN RAISE EXCEPTION 'APERTURA_HORARIO_PERMISO_REVOCADO'; END IF;
 PERFORM sgp_lp_operacion.verificar_temporal(NEW.usuario,'ENSAMBLE','PANELES_2',NEW.fecha,NEW.turno,NULL,'LEER');
 RETURN NEW;
END $$;
ALTER FUNCTION sgp_lp_operacion.confirmar_apertura_horario() OWNER TO postgres;
CREATE FUNCTION sgp_lp_operacion.apertura_horario_inmutable() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'HISTORIAL_INMUTABLE'; END $$;
CREATE TRIGGER inmutable BEFORE UPDATE OR DELETE ON sgp_lp_operacion.aperturas_horario
FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.apertura_horario_inmutable();
CREATE CONSTRAINT TRIGGER confirmar AFTER INSERT ON sgp_lp_operacion.aperturas_horario
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.confirmar_apertura_horario();
REVOKE ALL ON FUNCTION sgp_lp_operacion.confirmar_apertura_horario(),sgp_lp_operacion.apertura_horario_inmutable() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.sgp_lp_ensamble_turno_actual(p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;u text;enabled boolean;writes boolean;observed timestamptz;day date;
 slot jsonb;target jsonb;hits integer:=0;offset_day integer;shift_id integer;
 created boolean:=false;tr sgp_lp_operacion.turnos%rowtype;result jsonb;
BEGIN
 s:=sgp_lp_operacion.sesion(p_token,'ENSAMBLE',NULL,'PANELES_2');u:=s->>'usuario';
 IF s->>'rol' NOT IN('LIDER LINEA','SUPERVISOR ENSAMBLE','COORDINADOR','ADMINISTRADOR')
 OR NOT sgp_lp_operacion.puede_operar(u,'ENSAMBLE','CERRAR') THEN RAISE EXCEPTION 'APERTURA_HORARIO_ROL_DENEGADO'; END IF;
 -- Same admission lock/mutex order as the LP writer. Config containment waits for us.
 SELECT turno_horario_ensamble,escrituras INTO enabled,writes FROM sgp_lp_operacion.config WHERE id FOR SHARE;
 result:=jsonb_build_object('contract','LP-TURNO-HORARIO-1','stage','ENSAMBLE','line','PANELES_2',
  'mode','AUTHENTICATED_ON_ENTRY','scheduledJob',false,'created',false,'enabled',coalesce(enabled AND writes,false));
 IF enabled IS DISTINCT FROM true OR writes IS DISTINCT FROM true THEN RETURN result||jsonb_build_object('state','DISABLED'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ENSAMBLE|PANELES_2',184));
 -- Take the schedule row before sampling time: a wait cannot choose a stale shift.
 PERFORM 1 FROM public.sgp_configuracion_general WHERE clave='HORARIOS_TURNOS' FOR SHARE;
 observed:=clock_timestamp();day:=(observed AT TIME ZONE 'America/Bogota')::date;
 FOR offset_day IN -1..0 LOOP FOR shift_id IN 1..2 LOOP
  slot:=sgp_lp_operacion.periodo(day+offset_day,shift_id);
  IF observed>=(slot->>'start')::timestamptz AND observed<(slot->>'end')::timestamptz THEN target:=slot;hits:=hits+1;END IF;
 END LOOP;END LOOP;
 IF hits=0 THEN RETURN result||jsonb_build_object('state','OUTSIDE_SCHEDULE','serverTime',observed); END IF;
 IF hits<>1 THEN RAISE EXCEPTION 'HORARIOS_OPERATIVOS_SUPERPUESTOS'; END IF;
 -- Revalidate the actual session after waits. Caller never supplies date/clock/actor.
 s:=sgp_lp_operacion.sesion(p_token,'ENSAMBLE',NULL,'PANELES_2');
 IF s->>'usuario' IS DISTINCT FROM u OR s->>'rol' NOT IN('LIDER LINEA','SUPERVISOR ENSAMBLE','COORDINADOR','ADMINISTRADOR')
 OR NOT sgp_lp_operacion.puede_operar(u,'ENSAMBLE','CERRAR') THEN RAISE EXCEPTION 'APERTURA_HORARIO_ROL_DENEGADO'; END IF;
 PERFORM sgp_lp_operacion.verificar_temporal(u,'ENSAMBLE','PANELES_2',(target->>'date')::date,(target->>'shift')::int,NULL,'LEER');
 INSERT INTO sgp_lp_operacion.turnos(etapa,linea,fecha,turno)
 VALUES('ENSAMBLE','PANELES_2',(target->>'date')::date,(target->>'shift')::int)
 ON CONFLICT DO NOTHING RETURNING * INTO tr;
 created:=FOUND;
 IF created THEN
  INSERT INTO sgp_lp_operacion.aperturas_horario(etapa,linea,fecha,turno,usuario,observado_en,periodo)
  VALUES(tr.etapa,tr.linea,tr.fecha,tr.turno,u,observed,target);
 ELSE
  SELECT * INTO STRICT tr FROM sgp_lp_operacion.turnos WHERE etapa='ENSAMBLE' AND linea='PANELES_2'
   AND fecha=(target->>'date')::date AND turno=(target->>'shift')::int FOR SHARE;
 END IF;
 RETURN result||jsonb_build_object('state','MATERIALIZED','created',created,'currentPeriod',target,'serverTime',observed,
  'turn',to_jsonb(tr),'ordersCopied',0,'previousTurnModified',false,'continuity','RECONCILIATION_REQUIRED');
END $$;
REVOKE ALL ON FUNCTION public.sgp_lp_ensamble_turno_actual(text) FROM PUBLIC,anon,authenticated,service_role;
-- Narrow API uses the same browser roles; token + actual role/scope remain mandatory.
GRANT EXECUTE ON FUNCTION public.sgp_lp_ensamble_turno_actual(text) TO anon,authenticated;
COMMIT;

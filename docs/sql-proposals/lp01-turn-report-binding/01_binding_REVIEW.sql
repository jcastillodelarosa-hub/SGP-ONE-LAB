-- Automatic turn-scoped Disponible; no backfill and disabled on installation.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
DO $$BEGIN
 IF current_user<>'postgres' OR to_regclass('sgp_lp_sale_orden.eventos') IS NULL OR to_regclass('sgp_lp_operacion.preparaciones_historicas') IS NULL THEN RAISE EXCEPTION 'REPORT_BINDING_PREREQUISITE';END IF;
 PERFORM 1 FROM sgp_lp_operacion.config WHERE id FOR UPDATE;
END $$;
ALTER TABLE sgp_lp_operacion.config ADD COLUMN report_turn_binding boolean NOT NULL DEFAULT false,ADD COLUMN report_binding_epoch bigint NOT NULL DEFAULT 0;
CREATE TABLE sgp_lp_operacion.report_turn_bindings(
 etapa text NOT NULL,linea text NOT NULL,fecha date NOT NULL,turno integer NOT NULL,key text NOT NULL REFERENCES public.sgp_producciones(key_produccion),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),source text NOT NULL,
 PRIMARY KEY(etapa,linea,fecha,turno,key),FOREIGN KEY(etapa,linea,fecha,turno) REFERENCES sgp_lp_operacion.turnos);
CREATE TABLE sgp_lp_operacion.report_available_revisions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),etapa text NOT NULL,linea text NOT NULL,fecha date NOT NULL,turno integer NOT NULL,key text NOT NULL,
 source_event uuid NOT NULL REFERENCES sgp_lp_sale_orden.eventos(id),source_revision bigint NOT NULL,quantity bigint NOT NULL CHECK(quantity>=0),source_author text NOT NULL,
 captured_at timestamptz NOT NULL,epoch bigint NOT NULL,mechanism text NOT NULL CHECK(mechanism='AUTOMATIC_TURN_BINDING'),
 UNIQUE(etapa,linea,fecha,turno,key,source_event,epoch),FOREIGN KEY(etapa,linea,fecha,turno,key) REFERENCES sgp_lp_operacion.report_turn_bindings);
ALTER TABLE sgp_lp_operacion.report_turn_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_operacion.report_available_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sgp_lp_operacion.report_turn_bindings,sgp_lp_operacion.report_available_revisions FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON sgp_lp_operacion.report_turn_bindings FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.preparacion_historica_inmutable();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON sgp_lp_operacion.report_available_revisions FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.preparacion_historica_inmutable();
CREATE FUNCTION sgp_lp_operacion.report_binding_control() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN
 IF NEW.report_turn_binding IS DISTINCT FROM OLD.report_turn_binding THEN NEW.report_binding_epoch:=OLD.report_binding_epoch+1;
 ELSIF NEW.report_binding_epoch<>OLD.report_binding_epoch THEN RAISE EXCEPTION 'REPORT_EPOCH_SYSTEM_ONLY';END IF;RETURN NEW;
END $$;
CREATE TRIGGER report_binding_epoch BEFORE UPDATE ON sgp_lp_operacion.config FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.report_binding_control();
CREATE FUNCTION sgp_lp_operacion.report_bind(et text,ln text,d date,t integer,k text,origin text,event_id uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE enabled boolean;generation bigint;period jsonb;stamp timestamptz;tr sgp_lp_operacion.turnos%rowtype;e sgp_lp_sale_orden.eventos%rowtype;
BEGIN
 SELECT report_turn_binding,report_binding_epoch INTO enabled,generation FROM sgp_lp_operacion.config WHERE id FOR SHARE;
 IF enabled IS DISTINCT FROM true OR et NOT IN('ENSAMBLE','EMPAQUE') OR ln IS DISTINCT FROM 'PANELES_2' OR sgp_lp_operacion.export_es_historico(et,ln,d,t) THEN RETURN;END IF;
 stamp:=clock_timestamp();period:=sgp_lp_operacion.periodo(d,t);
 IF stamp<(period->>'start')::timestamptz OR stamp>=(period->>'end')::timestamptz THEN RETURN;END IF;
 -- Fail/retry instead of reverse-order waiting against incorporation or close.
 BEGIN SELECT * INTO tr FROM sgp_lp_operacion.turnos WHERE etapa=et AND linea=ln AND fecha=d AND turno=t FOR UPDATE NOWAIT;
 EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='REPORT_TURN_BUSY_RETRY_SOURCE_WRITE';END;
 IF NOT FOUND OR tr.estado<>'ABIERTO' THEN RETURN;END IF;
 stamp:=clock_timestamp();period:=sgp_lp_operacion.periodo(d,t);
 IF stamp<(period->>'start')::timestamptz OR stamp>=(period->>'end')::timestamptz THEN RETURN;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sgp_producciones WHERE key_produccion=k AND id_linea=ln AND NOT excluida_export) THEN RETURN;END IF;
 INSERT INTO sgp_lp_operacion.report_turn_bindings VALUES(et,ln,d,t,k,stamp,origin) ON CONFLICT DO NOTHING;
 IF event_id IS NULL THEN
  SELECT ev.* INTO e FROM sgp_lp_sale_orden.definiciones def JOIN sgp_lp_sale_orden.eventos ev ON ev.key=def.key AND ev.etapa=def.etapa AND ev.revision=def.revision AND ev.cantidad=def.cantidad WHERE def.key=k AND def.etapa=et FOR SHARE OF def;
 ELSE
  SELECT ev.* INTO e FROM sgp_lp_sale_orden.eventos ev JOIN sgp_lp_sale_orden.definiciones def ON def.key=ev.key AND def.etapa=ev.etapa AND def.revision=ev.revision AND def.cantidad=ev.cantidad WHERE ev.id=event_id AND ev.key=k AND ev.etapa=et;
 END IF;
 IF e.id IS NULL THEN RETURN;END IF;
 INSERT INTO sgp_lp_operacion.report_available_revisions(etapa,linea,fecha,turno,key,source_event,source_revision,quantity,source_author,captured_at,epoch,mechanism)
 VALUES(et,ln,d,t,k,e.id,e.revision,e.cantidad,e.usuario,stamp,generation,'AUTOMATIC_TURN_BINDING') ON CONFLICT DO NOTHING;
END $$;
CREATE FUNCTION sgp_lp_operacion.report_binding_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b record;ln text;
BEGIN
 IF TG_TABLE_SCHEMA='sgp_lp_sale_orden' THEN
  FOR b IN SELECT x.* FROM sgp_lp_operacion.report_turn_bindings x JOIN sgp_lp_operacion.turnos tr USING(etapa,linea,fecha,turno) WHERE x.key=NEW.key AND x.etapa=NEW.etapa AND tr.estado='ABIERTO' ORDER BY x.fecha,x.turno LOOP
   PERFORM sgp_lp_operacion.report_bind(b.etapa,b.linea,b.fecha,b.turno,b.key,'AVAILABLE_REVISION',NEW.id);
  END LOOP;
 ELSIF TG_TABLE_NAME='turnos' THEN
  FOR b IN SELECT DISTINCT a.key_produccion key FROM public.sgp_linea_plan_asignaciones a JOIN public.sgp_producciones p USING(key_produccion)
   WHERE NEW.etapa='ENSAMBLE' AND a.fecha=NEW.fecha AND a.turno=NEW.turno AND a.estado IS DISTINCT FROM 'CANCELADA' AND p.id_linea=NEW.linea
   UNION SELECT o.key FROM sgp_lp_operacion.ordenes o WHERE o.etapa=NEW.etapa AND o.linea=NEW.linea AND o.fecha=NEW.fecha AND o.turno=NEW.turno
   UNION SELECT i.key FROM sgp_lp_operacion.inclusiones_empaque i WHERE NEW.etapa='EMPAQUE' AND i.linea=NEW.linea AND i.fecha=NEW.fecha AND i.turno=NEW.turno LOOP
   PERFORM sgp_lp_operacion.report_bind(NEW.etapa,NEW.linea,NEW.fecha,NEW.turno,b.key,'TURN_MATERIALIZATION');
  END LOOP;
 ELSIF TG_TABLE_NAME='sgp_linea_plan_asignaciones' THEN
  IF NEW.estado IS DISTINCT FROM 'CANCELADA' THEN
   SELECT id_linea INTO ln FROM public.sgp_producciones WHERE key_produccion=NEW.key_produccion;
   PERFORM sgp_lp_operacion.report_bind('ENSAMBLE',ln,NEW.fecha,NEW.turno,NEW.key_produccion,'PROGRAMMING');
  END IF;
 ELSE
  PERFORM sgp_lp_operacion.report_bind(NEW.etapa,NEW.linea,NEW.fecha,NEW.turno,NEW.key,TG_TABLE_NAME);
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER report_binding AFTER INSERT ON sgp_lp_operacion.turnos FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.report_binding_event();
CREATE TRIGGER report_binding AFTER INSERT ON sgp_lp_operacion.ordenes FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.report_binding_event();
CREATE TRIGGER report_binding AFTER INSERT ON sgp_lp_operacion.inclusiones_empaque FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.report_binding_event();
CREATE TRIGGER report_binding AFTER INSERT OR UPDATE OF fecha,turno,key_produccion,estado ON public.sgp_linea_plan_asignaciones FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.report_binding_event();
CREATE TRIGGER report_binding AFTER INSERT ON sgp_lp_sale_orden.eventos FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.report_binding_event();
CREATE FUNCTION sgp_lp_operacion.report_evidence(et text,ln text,d date,t integer,close_id uuid,actual jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE result jsonb;enabled boolean;generation bigint;
BEGIN
 SELECT report_turn_binding,report_binding_epoch INTO enabled,generation FROM sgp_lp_operacion.config WHERE id;
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',x->>'key','available',CASE WHEN r.id IS NULL THEN jsonb_build_object('status','UNAVAILABLE','quantity',NULL) ELSE jsonb_build_object(
  'status','ACCREDITED_TURN','quantity',r.quantity,'referenceId',r.id,'sourceEventId',r.source_event,'revision',r.source_revision,'sourceAuthor',r.source_author,
  'capturedBy','SYSTEM','capturedRole','SYSTEM','mechanism','AUTOMATIC_TURN_BINDING','capturedAt',r.captured_at,'cut',jsonb_build_object('id',r.id,'at',r.captured_at)) END) ORDER BY x->>'key'),'[]'::jsonb) INTO result
 FROM jsonb_array_elements(actual)x LEFT JOIN LATERAL(SELECT ev.* FROM sgp_lp_operacion.report_available_revisions ev WHERE enabled AND ev.epoch=generation AND ev.etapa=et AND ev.linea=ln AND ev.fecha=d AND ev.turno=t AND ev.key=x->>'key' ORDER BY ev.source_revision DESC,ev.captured_at DESC LIMIT 1)r ON true;
 RETURN jsonb_build_object('contract','LP-TURN-REPORT-EVIDENCE-1','stage',et,'line',ln,'date',d,'shift',t,'closureId',close_id,'rows',result);
END $$;
REVOKE ALL ON FUNCTION sgp_lp_operacion.report_binding_control(),sgp_lp_operacion.report_bind(text,text,date,integer,text,text,uuid),sgp_lp_operacion.report_binding_event(),sgp_lp_operacion.report_evidence(text,text,date,integer,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;

-- Private factual key registry. No operational order, assignment or inclusion is created.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
DO $$BEGIN
 IF current_user<>'postgres' OR to_regclass('sgp_lp_operacion.preparaciones_historicas') IS NULL THEN RAISE EXCEPTION 'HISTORICAL_SOURCE_PREREQUISITE';END IF;
 PERFORM 1 FROM sgp_lp_operacion.config WHERE id FOR UPDATE;
 IF (SELECT preparar_historico FROM sgp_lp_operacion.config WHERE id) IS DISTINCT FROM false THEN RAISE EXCEPTION 'HISTORICAL_INSTALL_REQUIRES_DISABLED';END IF;
END $$;
CREATE TABLE sgp_lp_operacion.export_historical_keys(
 etapa text NOT NULL,linea text NOT NULL,fecha date NOT NULL,turno integer NOT NULL,key text NOT NULL REFERENCES public.sgp_producciones(key_produccion),
 first_file uuid NOT NULL REFERENCES sgp_lp_operacion.archivos(id),usuario text NOT NULL,
 PRIMARY KEY(etapa,linea,fecha,turno,key),FOREIGN KEY(etapa,linea,fecha,turno) REFERENCES sgp_lp_operacion.preparaciones_historicas(etapa,linea,fecha,turno));
ALTER TABLE sgp_lp_operacion.export_historical_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sgp_lp_operacion.export_historical_keys FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER inmutable BEFORE UPDATE OR DELETE ON sgp_lp_operacion.export_historical_keys FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.preparacion_historica_inmutable();
CREATE FUNCTION sgp_lp_operacion.export_es_historico(et text,ln text,d date,t integer) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$SELECT EXISTS(SELECT 1 FROM sgp_lp_operacion.preparaciones_historicas h WHERE h.etapa=et AND h.linea=ln AND h.fecha=d AND h.turno=t)$$;
CREATE FUNCTION sgp_lp_operacion.export_historical_confirmar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN
 IF NOT sgp_lp_operacion.puede_operar(NEW.usuario,NEW.etapa,'IMPORTAR_XLSX') THEN RAISE EXCEPTION 'HISTORICAL_IMPORT_PERMISSION_REVOKED';END IF;
 PERFORM sgp_lp_operacion.verificar_temporal(NEW.usuario,NEW.etapa,NEW.linea,NEW.fecha,NEW.turno,NEW.key,'IMPORTAR_XLSX');
 IF NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.archivos f WHERE f.id=NEW.first_file AND f.etapa=NEW.etapa AND f.linea=NEW.linea AND f.fecha=NEW.fecha AND f.turno=NEW.turno AND f.usuario=NEW.usuario AND EXISTS(SELECT 1 FROM jsonb_array_elements(f.filas) r WHERE r->>'key'=NEW.key)) THEN RAISE EXCEPTION 'HISTORICAL_FILE_KEY_MISMATCH';END IF;RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER confirmar AFTER INSERT ON sgp_lp_operacion.export_historical_keys DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.export_historical_confirmar();
CREATE FUNCTION sgp_lp_operacion.export_historical_universo(et text,ln text,d date,t integer) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('stage',et,'line',ln,'date',d,'shift',t,'orders','[]'::jsonb,'scheduled','[]'::jsonb,
 'historicalKeys',coalesce(jsonb_agg(k.key ORDER BY k.key),'[]'::jsonb),
 'productions',coalesce(jsonb_agg(jsonb_build_object('key',p.key_produccion,'name',p.produccion,'line',p.id_linea) ORDER BY k.key),'[]'::jsonb))
 FROM sgp_lp_operacion.export_historical_keys k JOIN public.sgp_producciones p ON p.key_produccion=k.key WHERE k.etapa=et AND k.linea=ln AND k.fecha=d AND k.turno=t
$$;
REVOKE ALL ON FUNCTION sgp_lp_operacion.export_es_historico(text,text,date,integer),sgp_lp_operacion.export_historical_confirmar(),sgp_lp_operacion.export_historical_universo(text,text,date,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE CONSTRAINT TRIGGER export_historical_import_scope AFTER INSERT ON sgp_lp_operacion.auditoria DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN(NEW.respuesta->>'writerScope'='LP-EXPORT-HISTORICAL-1' AND NEW.respuesta->>'contract'='LP-EXPORT-IMPORT-3') EXECUTE FUNCTION sgp_lp_operacion.export_v4_confirmar_plan();
CREATE FUNCTION sgp_lp_operacion.export_historical_no_operational_rows() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN
 IF sgp_lp_operacion.export_es_historico(NEW.etapa,NEW.linea,NEW.fecha,NEW.turno) THEN RAISE EXCEPTION 'HISTORICAL_FACTUAL_ONLY_NO_OPERATIONAL_ROWS';END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sgp_lp_operacion.export_historical_no_operational_rows() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER historical_factual_only BEFORE INSERT OR UPDATE ON sgp_lp_operacion.ordenes FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.export_historical_no_operational_rows();
CREATE TRIGGER historical_factual_only BEFORE INSERT OR UPDATE ON sgp_lp_operacion.inclusiones_empaque FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.export_historical_no_operational_rows();
COMMIT;

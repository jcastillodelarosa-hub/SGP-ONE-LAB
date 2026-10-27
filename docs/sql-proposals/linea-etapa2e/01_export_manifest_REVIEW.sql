-- PROPOSAL / REVIEW ONLY. Requires 2B + 2D ACK; isolated PG17.
-- No installed Export field or type is invented. External IDs remain opaque.
BEGIN;
DO $$BEGIN
 IF to_regclass('sgp_linea_d2.export_ack') IS NULL OR to_regclass('sgp_linea_b2.eventos') IS NULL THEN RAISE EXCEPTION 'BASE_ACK_NO_DISPONIBLE';END IF;
END$$;
CREATE SCHEMA sgp_linea_e2;
REVOKE ALL ON SCHEMA sgp_linea_e2 FROM PUBLIC,anon,authenticated;
CREATE TABLE sgp_linea_e2.manifiestos(
 carga text NOT NULL,key text NOT NULL REFERENCES sgp_linea_b2.producciones,
 revision_corte text NOT NULL CHECK(btrim(revision_corte)<>''),
 history_ref text NOT NULL CHECK(btrim(history_ref)<>''),
 cut_hash text NOT NULL CHECK(btrim(cut_hash)<>''),
 writer_contract_ref text NOT NULL CHECK(btrim(writer_contract_ref)<>''),
 eventos jsonb NOT NULL CHECK(jsonb_typeof(eventos)='array'),
 creado_en timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(carga,key));
CREATE TRIGGER inmutable BEFORE UPDATE OR DELETE ON sgp_linea_e2.manifiestos FOR EACH ROW EXECUTE FUNCTION sgp_linea_b2.inmutable();
-- Private trusted writer only. No RPC accepts browser inclusion flags.
-- The actual importer must bind history, cut hash and this receipt atomically
-- under the same production lock before it can become a productive certificate.
CREATE FUNCTION sgp_linea_e2.sellar(k text,load text,rev text,hist text,cut text,writer text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE prior sgp_linea_e2.manifiestos%rowtype;ev jsonb;BEGIN
 IF nullif(btrim(k),'') IS NULL OR nullif(btrim(load),'') IS NULL OR nullif(btrim(rev),'') IS NULL OR nullif(btrim(hist),'') IS NULL OR nullif(btrim(cut),'') IS NULL OR nullif(btrim(writer),'') IS NULL THEN RAISE EXCEPTION 'MANIFIESTO_INCOMPLETO';END IF;
 PERFORM 1 FROM sgp_linea_b2.producciones WHERE key=k FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCCION_NO_EXISTE';END IF;
 SELECT * INTO prior FROM sgp_linea_e2.manifiestos WHERE carga=load AND key=k;
 IF FOUND THEN
 IF prior.revision_corte<>rev OR prior.history_ref<>hist OR prior.cut_hash<>cut OR prior.writer_contract_ref<>writer THEN RAISE EXCEPTION 'CORTE_SELLADO_INMUTABLE';END IF;
 RETURN jsonb_build_object('status','SELLADO_NO_CERTIFICADO','duplicate',true,'eventCount',jsonb_array_length(prior.eventos));END IF;
 IF EXISTS(SELECT 1 FROM sgp_linea_d2.export_ack a LEFT JOIN sgp_linea_b2.eventos e ON e.id=a.evento WHERE a.carga=load AND a.key=k AND (a.cut_revision<>rev OR e.key IS DISTINCT FROM k OR a.event_hash<>md5(to_jsonb(e)::text)))
 OR EXISTS(SELECT 1 FROM sgp_linea_b2.eventos e WHERE e.key=k AND NOT EXISTS(SELECT 1 FROM sgp_linea_d2.export_ack a WHERE a.carga=load AND a.key=k AND a.evento=e.id)) THEN RAISE EXCEPTION 'INCLUSION_EXPLICITA_INCOMPLETA';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.evento,'disposition',a.disposition,'sourceRef',a.source_ref,'eventHash',a.event_hash) ORDER BY a.evento),'[]') INTO ev FROM sgp_linea_d2.export_ack a WHERE a.carga=load AND a.key=k;
 INSERT INTO sgp_linea_e2.manifiestos VALUES(load,k,rev,hist,cut,writer,ev,now());
 RETURN jsonb_build_object('status','SELLADO_NO_CERTIFICADO','duplicate',false,'eventCount',jsonb_array_length(ev));
END$$;
CREATE FUNCTION sgp_linea_e2.proteger_ack() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN
 PERFORM 1 FROM sgp_linea_b2.producciones WHERE key=NEW.key FOR UPDATE;
 IF EXISTS(SELECT 1 FROM sgp_linea_e2.manifiestos WHERE key=NEW.key AND carga=NEW.carga) THEN RAISE EXCEPTION 'ACK_POSTERIOR_A_SELLADO';END IF;
 RETURN NEW;END$$;
CREATE TRIGGER e2_sellado BEFORE INSERT ON sgp_linea_d2.export_ack FOR EACH ROW EXECUTE FUNCTION sgp_linea_e2.proteger_ack();
CREATE FUNCTION sgp_linea_e2.leer(token text,k text,load text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$DECLARE m sgp_linea_e2.manifiestos%rowtype;BEGIN
 PERFORM sgp_linea_b2.autorizar(token,'ENSAMBLE',k);
 PERFORM sgp_linea_b2.autorizar(token,'EMPAQUE',k);
 SELECT * INTO m FROM sgp_linea_e2.manifiestos WHERE key=k AND carga=load;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','SIN_CONCILIAR','available',NULL,'reason','MANIFIESTO_NO_DISPONIBLE');END IF;
 RETURN jsonb_build_object('status','PENDIENTE_CERTIFICACION_EXPORT','available',NULL,'production',k,'loadId',load,'cutRevision',m.revision_corte,'historyRef',m.history_ref,'events',m.eventos,'reason','VINCULO_ATOMICO_CON_IMPORTADOR_NO_IMPLEMENTADO');
END$$;
ALTER TABLE sgp_linea_e2.manifiestos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_linea_e2 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_linea_e2 FROM PUBLIC,anon,authenticated;
COMMIT;

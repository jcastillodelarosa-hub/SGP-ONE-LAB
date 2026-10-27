-- PROPOSAL ONLY: additive acknowledgement ledger. NOT integration with importer.
-- id_carga_diaria stored as opaque text pending real installed type contract.
BEGIN;
CREATE TABLE sgp_linea_d2.export_ack(
 carga text NOT NULL CHECK(btrim(carga)<>''),key text NOT NULL REFERENCES sgp_linea_b2.producciones,
 evento uuid NOT NULL REFERENCES sgp_linea_b2.eventos(id),
 disposition text NOT NULL CHECK(disposition IN('INCLUDED','EXCLUDED')),
 source_ref text NOT NULL CHECK(btrim(source_ref)<>''),
 cut_revision text NOT NULL CHECK(btrim(cut_revision)<>''),
 event_hash text NOT NULL,usuario_servidor text NOT NULL,
 creado_en timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(carga,key,evento));
CREATE FUNCTION sgp_linea_d2.verificar_ack() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE e record;BEGIN
 PERFORM 1 FROM sgp_linea_b2.producciones WHERE key=NEW.key FOR UPDATE;
 IF EXISTS(SELECT 1 FROM sgp_linea_d2.export_ack WHERE carga=NEW.carga AND key=NEW.key AND cut_revision<>NEW.cut_revision) THEN RAISE EXCEPTION 'ACK_CORTE_INCONSISTENTE';END IF;
 SELECT * INTO STRICT e FROM sgp_linea_b2.eventos WHERE id=NEW.evento;
 IF e.key<>NEW.key OR md5(to_jsonb(e)::text)<>NEW.event_hash THEN RAISE EXCEPTION 'ACK_EVENTO_AJENO_O_MODIFICADO';END IF;
 RETURN NEW;END$$;
CREATE TRIGGER validar BEFORE INSERT ON sgp_linea_d2.export_ack FOR EACH ROW EXECUTE FUNCTION sgp_linea_d2.verificar_ack();
CREATE TRIGGER fijo BEFORE UPDATE OR DELETE ON sgp_linea_d2.export_ack FOR EACH ROW EXECUTE FUNCTION sgp_linea_b2.inmutable();
ALTER TABLE sgp_linea_d2.export_ack ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sgp_linea_d2.export_ack FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION sgp_linea_d2.verificar_ack() FROM PUBLIC,anon,authenticated;
COMMIT;
-- Not usable as production proof until an authorized importer atomically binds
-- these rows to verified official cut records and enumerates every local event.

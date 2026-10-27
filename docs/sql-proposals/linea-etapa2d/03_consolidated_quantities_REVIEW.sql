-- REVIEW ONLY. Isolated PG17, additive to 2B/2C/2D. No productive readers/hooks.
-- Counts apply only to explicitly opted-in productions. Unit path stays optional.
BEGIN;
DO $base$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('sgp_linea_b2.disponible(text)')) IS DISTINCT FROM '5cd090333a7bc929a2199c22e6f7a667'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('sgp_linea_b2.snapshot(text)')) IS DISTINCT FROM 'd4e226c6c8776e6f4cd2e1aa023a1bfe' THEN RAISE EXCEPTION 'BASE_CUANTITATIVA_NO_REVISADA';END IF;
END$base$;
CREATE SCHEMA sgp_linea_d2q;
REVOKE ALL ON SCHEMA sgp_linea_d2q FROM PUBLIC,anon,authenticated;
-- Server-owned capture, not a browser payload. A certified producer must prove
-- coverage (including shared/keyless records) and the accounting basis first.
CREATE TABLE sgp_linea_d2q.fuentes(
 key text PRIMARY KEY REFERENCES sgp_linea_b2.producciones,
 identity jsonb NOT NULL,revision bigint NOT NULL CHECK(revision>0),
 production_units bigint NOT NULL CHECK(production_units BETWEEN 0 AND 9007199254740991),
 assembly_basis text NOT NULL CHECK(assembly_basis IN('GROSS_REQUIRES_DEDUCTION','NET_EXCLUDES_BLOCKED')),
 complete boolean NOT NULL DEFAULT false,
 pending_stages jsonb NOT NULL CHECK(jsonb_typeof(pending_stages)='array'),
 estimate bigint CHECK(estimate BETWEEN 0 AND 9007199254740991),
 evidence jsonb NOT NULL CHECK(evidence<>'{}'::jsonb),
 source_ref text NOT NULL CHECK(btrim(source_ref)<>''));
CREATE TABLE sgp_linea_d2q.validaciones(
 id uuid PRIMARY KEY,key text NOT NULL REFERENCES sgp_linea_d2q.fuentes,
 etapa text NOT NULL CHECK(etapa IN('ENSAMBLE','EMPAQUE')),revision bigint NOT NULL CHECK(revision>0),
 estimacion bigint,cantidad bigint NOT NULL CHECK(cantidad BETWEEN 0 AND 9007199254740991),
 usuario text NOT NULL,rol text NOT NULL,fecha timestamptz NOT NULL DEFAULT now(),
 dia date NOT NULL,turno int NOT NULL CHECK(turno IN(1,2)),motivo text NOT NULL CHECK(btrim(motivo)<>''),
 huella text NOT NULL,fuente jsonb NOT NULL,solicitud jsonb NOT NULL,UNIQUE(key,etapa,revision));
CREATE TRIGGER inmutable BEFORE UPDATE OR DELETE ON sgp_linea_d2q.validaciones FOR EACH ROW EXECUTE FUNCTION sgp_linea_b2.inmutable();
CREATE FUNCTION sgp_linea_d2q.fuente(k text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE f sgp_linea_d2q.fuentes%rowtype;ex jsonb;pe jsonb;pd jsonb;delivery jsonb;detail jsonb;pending_ids uuid[];j jsonb;BEGIN
 SELECT * INTO STRICT f FROM sgp_linea_d2q.fuentes WHERE key=k;
 ex:=sgp_linea_c2.leer('EXPORT',k);pe:=sgp_linea_c2.leer('PERMISOS',k);
 IF NOT f.complete OR f.identity IS DISTINCT FROM ex->'identity' OR f.identity IS DISTINCT FROM pe->'identity' THEN RAISE EXCEPTION 'COBERTURA_NO_DEMOSTRADA';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(f.pending_stages) x WHERE x->>'stage' IS NULL OR x->>'stage' NOT IN('ENSAMBLE','EMPAQUE') OR x->>'id' IS NULL)
 OR jsonb_array_length(f.pending_stages)<>(SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(f.pending_stages)) THEN RAISE EXCEPTION 'ETAPAS_NO_DEMOSTRADAS';END IF;
 SELECT coalesce(array_agg((value->>'id')::uuid),'{}') INTO pending_ids FROM jsonb_array_elements(f.pending_stages);
 -- Explicit inventory: do not sum per-PDT windows; closed items stay covered.
 IF EXISTS(SELECT 1 FROM public.sgp_aluminio_pendientes p WHERE p.key_produccion=k AND NOT p.id_pendiente=ANY(pending_ids))
 OR EXISTS(SELECT 1 FROM unnest(pending_ids) id WHERE NOT EXISTS(SELECT 1 FROM public.sgp_aluminio_pendientes p WHERE p.id_pendiente=id AND p.key_produccion=k)) THEN RAISE EXCEPTION 'COBERTURA_NO_DEMOSTRADA';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id_pendiente),'[]') INTO pd FROM public.sgp_aluminio_pendientes p WHERE p.key_produccion=k;
 -- Conservative production/reserve selection: irrelevant changes may invalidate,
 -- but a complementary delivery must never silently release a validation.
 SELECT coalesce(jsonb_agg(jsonb_build_array(to_jsonb(e),coalesce((SELECT jsonb_agg(to_jsonb(z) ORDER BY z.id_faltante) FROM public.sgp_picking_faltantes z WHERE z.id_entrega=e.id_entrega),'[]'),coalesce((SELECT jsonb_agg(to_jsonb(z) ORDER BY z.id_linea) FROM public.sgp_pdt_entrega_lineas z WHERE z.id_entrega=e.id_entrega),'[]')) ORDER BY e.id_entrega),'[]') INTO delivery
 FROM public.sgp_picking_entregas e JOIN public.sgp_mecanizado_programacion mp USING(id_programacion)
 WHERE EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v v WHERE v.key_produccion=k AND v.produccion=e.produccion AND v.reserva_principal=mp.reserva);
 SELECT coalesce(jsonb_agg(jsonb_build_array(to_jsonb(d),to_jsonb(s)) ORDER BY d.id_detalle),'[]') INTO detail FROM public.sgp_aluminio_pendiente_detalles d JOIN public.sgp_aluminio_pendientes p USING(id_pendiente) LEFT JOIN public.sgp_pdt_fuentes s USING(id_detalle) WHERE p.key_produccion=k;
 j:=jsonb_build_object('capture',to_jsonb(f),'pending',pd,'deliveries',delivery,'details',detail,'export',ex,'permissions',pe);
 RETURN jsonb_build_object('hash',md5(j::text),'snapshot',j);
END$$;
CREATE FUNCTION sgp_linea_d2q.estado(k text,et text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE f jsonb;v sgp_linea_d2q.validaciones%rowtype;c sgp_linea_d2q.fuentes%rowtype;BEGIN
 SELECT * INTO c FROM sgp_linea_d2q.fuentes WHERE key=k;
 IF NOT FOUND THEN RETURN jsonb_build_object('state','SIN_EVIDENCIA','available',NULL);END IF;
 SELECT * INTO v FROM sgp_linea_d2q.validaciones WHERE key=k AND etapa=et ORDER BY revision DESC LIMIT 1;
 IF NOT FOUND THEN RETURN jsonb_build_object('state',CASE WHEN c.estimate IS NULL THEN 'SIN_EVIDENCIA' ELSE 'ESTIMACION' END,'estimated',c.estimate,'available',NULL);END IF;
 BEGIN f:=sgp_linea_d2q.fuente(k);EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('state','REVISION_PENDIENTE','available',NULL,'revision',v.revision);END;
 IF v.huella IS DISTINCT FROM f->>'hash' THEN RETURN jsonb_build_object('state','REVISION_PENDIENTE','available',NULL,'revision',v.revision);END IF;
 RETURN jsonb_build_object('production',k,'stage',et,'state','VALIDACION_VIGENTE','estimated',v.estimacion,'validated',v.cantidad,'revision',v.revision,'validationId',v.id,'productionUnits',c.production_units,'assemblyBasis',c.assembly_basis,'sourceRef',c.source_ref,'sourceRevision',v.huella);
END$$;
CREATE FUNCTION sgp_linea_d2q.validar(token text,k text,et text,n bigint,esperada bigint,huella text,evento uuid,d date,t int,motivo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;pe jsonb;f jsonb;v sgp_linea_d2q.validaciones%rowtype;c sgp_linea_d2q.fuentes%rowtype;r bigint;payload jsonb;ex jsonb;a bigint;packed bigint;ded bigint;BEGIN
 s:=public.sgp_sesion_actual(token);
 IF s->>'valida' IS DISTINCT FROM 'true' OR nullif(s->>'usuario','') IS NULL OR s->>'rol' IS NULL OR s->>'rol' NOT IN('LIDER','LIDER PICKING','LIDER ENSAMBLE','COORDINADOR') THEN RAISE EXCEPTION 'OPERACION_NO_AUTORIZADA';END IF;
 IF et IS NULL OR et NOT IN('ENSAMBLE','EMPAQUE') OR evento IS NULL OR esperada IS NULL OR esperada<0 OR n IS NULL OR n<0 OR d IS NULL OR t IS NULL OR t NOT IN(1,2) OR nullif(btrim(motivo),'') IS NULL THEN RAISE EXCEPTION 'SOLICITUD_INVALIDA';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(evento::text,123));
 PERFORM 1 FROM sgp_linea_b2.producciones WHERE key=k FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCCION_NO_EXISTE';END IF;
 pe:=sgp_linea_c2.leer('PERMISOS',k);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pe->'grants') g WHERE g->>'user'=s->>'usuario' AND g->>'stage'=et AND (s->>'rol'='COORDINADOR' OR g->>'validationRole' IN('PICKING','ENSAMBLE'))) THEN RAISE EXCEPTION 'AMBITO_DENEGADO';END IF;
 -- Explicit real stage/day/shift. Closed snapshots never changed here.
 PERFORM 1 FROM sgp_linea_b2.turnos WHERE etapa=et AND fecha=d AND turno=t AND (estado='ABIERTO' OR (estado='EN_REVISION' AND s->>'rol'='COORDINADOR')) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TURNO_NO_AUTORIZADO';END IF;
 payload:=jsonb_build_array(k,et,n,esperada,huella,d,t,motivo,s->>'usuario');
 SELECT * INTO v FROM sgp_linea_d2q.validaciones WHERE id=evento;
 IF FOUND THEN IF v.solicitud IS DISTINCT FROM payload THEN RAISE EXCEPTION 'IDEMPOTENCIA_REUTILIZADA';END IF;RETURN jsonb_build_object('ok',true,'duplicate',true,'revision',v.revision);END IF;
 SELECT coalesce(max(revision),0) INTO r FROM sgp_linea_d2q.validaciones WHERE key=k AND etapa=et;
 IF r<>esperada THEN RAISE EXCEPTION 'CONFLICTO_REVISION';END IF;
 SELECT * INTO STRICT c FROM sgp_linea_d2q.fuentes WHERE key=k;
 f:=sgp_linea_d2q.fuente(k);
 IF f->>'hash' IS DISTINCT FROM huella THEN RAISE EXCEPTION 'FUENTE_OBSOLETA';END IF;
 ex:=f->'snapshot'->'export';
 IF ex->>'applied' IS DISTINCT FROM 'true' OR ex->>'assembled' IS NULL OR ex->>'packed' IS NULL OR jsonb_typeof(ex->'events') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'CORTE_SIN_CONCILIAR';END IF;
 SELECT (ex->>'assembled')::bigint+coalesce(sum(delta) FILTER(WHERE etapa='ENSAMBLE'),0),(ex->>'packed')::bigint+coalesce(sum(delta) FILTER(WHERE etapa='EMPAQUE'),0) INTO a,packed FROM sgp_linea_b2.eventos e WHERE key=k AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(ex->'events') i WHERE i->>'id'=e.id::text AND i->>'disposition'='INCLUDED');
 ded:=CASE WHEN et='ENSAMBLE' AND c.assembly_basis='GROSS_REQUIRES_DEDUCTION' THEN n ELSE 0 END;
 IF n>c.production_units OR a>c.production_units OR a<0 OR packed<0 OR a-packed-ded<0 OR (et='ENSAMBLE' AND c.assembly_basis='NET_EXCLUDES_BLOCKED' AND a>c.production_units-n) THEN RAISE EXCEPTION 'CANTIDAD_FUERA_DE_SALDO';END IF;
 INSERT INTO sgp_linea_d2q.validaciones VALUES(evento,k,et,r+1,c.estimate,n,s->>'usuario',s->>'rol',now(),d,t,motivo,f->>'hash',f->'snapshot',payload);
 PERFORM sgp_linea_c2.notificar(k,'PDT');
 RETURN jsonb_build_object('ok',true,'duplicate',false,'revision',r+1);
END$$;
-- Counts source for the same C2 contract. No unitMap; active unit path cannot be
-- combined with this consolidated source (otherwise discount would be doubled).
CREATE FUNCTION sgp_linea_d2q.impacto(k text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c sgp_linea_d2q.fuentes%rowtype;e jsonb;BEGIN
 SELECT * INTO STRICT c FROM sgp_linea_d2q.fuentes WHERE key=k;
 e:=sgp_linea_d2q.estado(k,'ENSAMBLE');
 IF e->>'state'<>'VALIDACION_VIGENTE' THEN RAISE EXCEPTION 'VALIDACION_CONSOLIDADA_REQUERIDA';END IF;
 RETURN jsonb_build_object('production',k,'identity',c.identity,'generation',c.revision+(e->>'revision')::bigint,'revision',md5(e::text),'complete',true,'sourceRef',c.source_ref,'items','[]'::jsonb,'consolidatedImpact',e);
END$$;
-- Preserve originals byte-for-byte in private isolated fallback functions.
DO $copy$ DECLARE n text;def text;BEGIN
 FOREACH n IN ARRAY ARRAY['disponible','snapshot'] LOOP
 def:=pg_get_functiondef(to_regprocedure('sgp_linea_b2.'||n||'(text)'));
 EXECUTE replace(def,'FUNCTION sgp_linea_b2.'||n||'(', 'FUNCTION sgp_linea_d2q.base_'||n||'(');
 END LOOP;
END$copy$;
CREATE OR REPLACE FUNCTION sgp_linea_b2.disponible(k text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;e jsonb;n bigint;a bigint;p bigint;b bigint;ded bigint;BEGIN
 v:=sgp_linea_d2q.base_disponible(k);
 IF NOT EXISTS(SELECT 1 FROM sgp_linea_d2q.fuentes WHERE key=k) THEN RETURN v;END IF;
 IF v->>'status'<>'READY' THEN RETURN v;END IF;
 IF EXISTS(SELECT 1 FROM sgp_linea_b2.bloqueos WHERE key=k AND activo AND etapa IN('ENSAMBLE','DESCONOCIDA')) THEN RETURN jsonb_build_object('status','UNKNOWN','available',NULL,'reason','MODOS_IMPACTO_MEZCLADOS');END IF;
 e:=sgp_linea_d2q.estado(k,'ENSAMBLE');
 IF e->>'state'<>'VALIDACION_VIGENTE' THEN RETURN jsonb_build_object('status','UNKNOWN','available',NULL,'reason',e->>'state');END IF;
 a:=(v->>'assembled')::bigint;p:=(v->>'packed')::bigint;n:=(e->>'validated')::bigint;b:=(e->>'productionUnits')::bigint;
 ded:=CASE e->>'assemblyBasis' WHEN 'GROSS_REQUIRES_DEDUCTION' THEN n ELSE 0 END;
 IF n>b OR a>b OR a-p-ded<0 OR (e->>'assemblyBasis'='NET_EXCLUDES_BLOCKED' AND a>b-n) THEN RETURN jsonb_build_object('status','DISCREPANCY','available',NULL,'reason','CANTIDAD_CONSOLIDADA_INCOHERENTE');END IF;
 RETURN v||jsonb_build_object('available',a-p-ded,'blocked',n,'deduction',ded,'eligibleAssembled',a-ded,'impactMode','CONSOLIDATED');
END$$;
CREATE OR REPLACE FUNCTION sgp_linea_b2.snapshot(k text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE s jsonb;BEGIN
 s:=sgp_linea_d2q.base_snapshot(k);
 IF EXISTS(SELECT 1 FROM sgp_linea_d2q.fuentes WHERE key=k) THEN s:=s||jsonb_build_object('consolidatedImpact',sgp_linea_d2q.estado(k,'ENSAMBLE'));END IF;
 RETURN s;END$$;
-- Additional protection even for direct B2 native RPCs (not just Node adapter).
CREATE FUNCTION sgp_linea_d2q.guardar_ejecucion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE q jsonb;e jsonb;a bigint;p bigint;n bigint;b bigint;ded bigint;BEGIN
 IF NOT EXISTS(SELECT 1 FROM sgp_linea_d2q.fuentes WHERE key=NEW.key) THEN RETURN NEW;END IF;
 PERFORM 1 FROM sgp_linea_b2.producciones WHERE key=NEW.key FOR UPDATE;
 q:=sgp_linea_b2.disponible(NEW.key);IF q->>'status'<>'READY' THEN RAISE EXCEPTION 'EVIDENCIA_CONSOLIDADA_INSUFICIENTE';END IF;
 e:=sgp_linea_d2q.estado(NEW.key,'ENSAMBLE');
 a:=(q->>'assembled')::bigint+CASE WHEN NEW.etapa='ENSAMBLE' THEN NEW.delta ELSE 0 END;
 p:=(q->>'packed')::bigint+CASE WHEN NEW.etapa='EMPAQUE' THEN NEW.delta ELSE 0 END;
 n:=(e->>'validated')::bigint;b:=(e->>'productionUnits')::bigint;ded:=(q->>'deduction')::bigint;
 IF a<0 OR p<0 OR a>b OR a-p-ded<0 OR (e->>'assemblyBasis'='NET_EXCLUDES_BLOCKED' AND a>b-n) THEN RAISE EXCEPTION 'EJECUCION_SIN_RESPALDO_CONSOLIDADO';END IF;
 RETURN NEW;END$$;
CREATE TRIGGER d2q_respaldo BEFORE INSERT ON sgp_linea_b2.eventos FOR EACH ROW EXECUTE FUNCTION sgp_linea_d2q.guardar_ejecucion();
-- Trusted source writers must lock production BEFORE changing this capture or
-- operational PDT/Picking/Export sources. No productive trigger attached here.
CREATE TABLE sgp_linea_d2q.historial_fuentes(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,key text NOT NULL,antes jsonb,despues jsonb,fecha timestamptz NOT NULL DEFAULT now(),actor text NOT NULL);
CREATE TRIGGER inmutable BEFORE UPDATE OR DELETE ON sgp_linea_d2q.historial_fuentes FOR EACH ROW EXECUTE FUNCTION sgp_linea_b2.inmutable();
CREATE FUNCTION sgp_linea_d2q.auditar_fuente() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN
 INSERT INTO sgp_linea_d2q.historial_fuentes(key,antes,despues,actor) VALUES(NEW.key,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) END,to_jsonb(NEW),session_user);RETURN NULL;END$$;
CREATE TRIGGER auditar AFTER INSERT OR UPDATE ON sgp_linea_d2q.fuentes FOR EACH ROW EXECUTE FUNCTION sgp_linea_d2q.auditar_fuente();
CREATE FUNCTION sgp_linea_d2q.invalidar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN
 IF TG_OP='DELETE' OR NEW.key IS DISTINCT FROM OLD.key OR NEW.revision<=OLD.revision THEN RAISE EXCEPTION 'FUENTE_REQUIERE_REVISION_NUEVA';END IF;
 PERFORM sgp_linea_c2.notificar(NEW.key,'PDT');RETURN NEW;END$$;
CREATE TRIGGER invalidar BEFORE UPDATE OR DELETE ON sgp_linea_d2q.fuentes FOR EACH ROW EXECUTE FUNCTION sgp_linea_d2q.invalidar();
ALTER TABLE sgp_linea_d2q.historial_fuentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_linea_d2q.fuentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_linea_d2q.validaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_linea_d2q FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_linea_d2q FROM PUBLIC,anon,authenticated;
COMMIT;

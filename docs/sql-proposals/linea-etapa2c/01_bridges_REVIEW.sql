-- REVIEW ONLY. Requires 2B; no real readers are registered by this proposal.
-- Install exclusively in isolated PG17. No legacy objects/official balances modified.
BEGIN;
DO $base$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.sgp_linea_motor_b2(text,jsonb)')) IS DISTINCT FROM 'ac0f54bd69c2936ef57ca57712edd290'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.sgp_linea_disponible_b2(text,text)')) IS DISTINCT FROM 'c1b828f7644548ce695efa5b196dad19' THEN RAISE EXCEPTION 'BASE_122_INCOMPATIBLE';END IF;
END$base$;
CREATE SCHEMA sgp_linea_c2;
REVOKE ALL ON SCHEMA sgp_linea_c2 FROM PUBLIC,anon,authenticated;
CREATE TABLE sgp_linea_c2.lectores(
 componente text PRIMARY KEY CHECK(componente IN ('EXPORT','PDT','PERMISOS')),
 firma text NOT NULL,huella text NOT NULL CHECK(huella ~ '^[a-f0-9]{32}$'),
 catalogo_huella text NOT NULL CHECK(catalogo_huella ~ '^[a-f0-9]{32}$'),
 protocolo text NOT NULL CHECK(protocolo='PRODUCCION_B2_V1'),
 evidencia text NOT NULL CHECK(btrim(evidencia)<>''));
-- Reader certifies real provenance and participation of ALL source writers in the
-- production lock protocol. Empty by default. Never grant reader registration to a pool/browser.
CREATE TABLE sgp_linea_c2.estado(
 key text PRIMARY KEY REFERENCES sgp_linea_b2.producciones,
 status text NOT NULL DEFAULT 'SIN_CONCILIAR',motivo text,contenido boolean NOT NULL DEFAULT false,
 fuentes jsonb,contratos jsonb,revision bigint NOT NULL DEFAULT 0);
CREATE TABLE sgp_linea_c2.historial(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,key text NOT NULL,
 revision bigint NOT NULL,accion text NOT NULL,motivo text,fuentes jsonb,
 registrado_en timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER fijo BEFORE UPDATE OR DELETE ON sgp_linea_c2.historial FOR EACH ROW EXECUTE FUNCTION sgp_linea_b2.inmutable();
CREATE FUNCTION sgp_linea_c2.leer(componente text,k text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cfg sgp_linea_c2.lectores%rowtype;f record;r jsonb;BEGIN
 SELECT * INTO STRICT cfg FROM sgp_linea_c2.lectores WHERE lectores.componente=leer.componente;
 SELECT p.oid,n.nspname,p.proname,p.prorettype,p.proargtypes,p.pronargs,p.prokind,p.provolatile,p.proowner,p.proacl,p.prosecdef,p.proconfig INTO STRICT f
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.oid=to_regprocedure(cfg.firma);
 IF f.pronargs<>1 OR f.proargtypes[0]<>'text'::regtype OR f.prorettype<>'jsonb'::regtype OR f.prokind<>'f' OR f.provolatile<>'s'
 OR md5(pg_get_functiondef(f.oid))<>cfg.huella
 OR md5(jsonb_build_object('owner',pg_get_userbyid(f.proowner),'acl',coalesce(f.proacl::text,'DEFAULT'),'definer',f.prosecdef,'config',f.proconfig)::text)<>cfg.catalogo_huella THEN RAISE EXCEPTION 'LECTOR_NO_CERTIFICADO';END IF;
 EXECUTE format('SELECT %I.%I($1)',f.nspname,f.proname) INTO r USING k;
 IF jsonb_typeof(r) IS DISTINCT FROM 'object' OR r->>'production' IS DISTINCT FROM k OR nullif(r->>'revision','') IS NULL OR r->>'complete' IS DISTINCT FROM 'true'
 OR jsonb_typeof(r->'identity') IS DISTINCT FROM 'object' OR r->'identity'->>'production' IS DISTINCT FROM k
 OR nullif(r->'identity'->>'line','') IS NULL OR nullif(r->'identity'->>'part','') IS NULL
 OR jsonb_typeof(r->'identity'->'reserves') IS DISTINCT FROM 'array' OR jsonb_array_length(r->'identity'->'reserves')=0
 OR nullif(r->>'sourceRef','') IS NULL OR coalesce(r->>'generation','')!~'^[1-9][0-9]*$' OR (r->>'generation')::numeric>9007199254740991 THEN RAISE EXCEPTION 'FUENTE_INCOMPLETA';END IF;
 RETURN r;END$$;
CREATE FUNCTION sgp_linea_c2.invalidar(k text,causa text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN
 PERFORM 1 FROM sgp_linea_b2.producciones WHERE key=k FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCCION_NO_EXISTE';END IF;
 INSERT INTO sgp_linea_c2.estado(key) VALUES(k) ON CONFLICT DO NOTHING;
 UPDATE sgp_linea_b2.producciones SET corte=NULL,pdt_completo=false,pdt_prueba=NULL,unit_revision=NULL,revision=revision+1 WHERE key=k;
 DELETE FROM sgp_linea_b2.permisos WHERE key=k;
 UPDATE sgp_linea_c2.estado SET status='SIN_CONCILIAR',motivo=causa,revision=revision+1 WHERE key=k;
 INSERT INTO sgp_linea_c2.historial(key,revision,accion,motivo) SELECT key,revision,'INVALIDAR',causa FROM sgp_linea_c2.estado WHERE key=k;
 RETURN jsonb_build_object('status','SIN_CONCILIAR','available',NULL,'reason',causa);END$$;
-- Private writer hook: MUST be called inside the same source-write transaction,
-- before any source mutation; it locks the production until commit. No productive
-- trigger attachment without the real schema/writer review.
CREATE FUNCTION sgp_linea_c2.notificar(k text,componente text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN
 IF componente NOT IN ('EXPORT','PDT','PERMISOS') OR componente IS NULL THEN RAISE EXCEPTION 'COMPONENTE_INVALIDO';END IF;
 RETURN sgp_linea_c2.invalidar(k,'CAMBIO_'||componente);END$$;
CREATE FUNCTION sgp_linea_c2.reconciliar(k text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ex jsonb;pd jsonb;pe jsonb;bundle jsonb;pins jsonb;old sgp_linea_c2.estado%rowtype;
 x jsonb;y jsonb;c sgp_linea_b2.cortes%rowtype;cid uuid;a bigint;e bigint;inc uuid[];eventos uuid[];
 u text[];packed text[];ids text[];r bigint;v jsonb;reason text;BEGIN
 PERFORM 1 FROM sgp_linea_b2.producciones WHERE key=k FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCCION_NO_EXISTE';END IF;
 INSERT INTO sgp_linea_c2.estado(key) VALUES(k) ON CONFLICT DO NOTHING;
 SELECT * INTO old FROM sgp_linea_c2.estado WHERE key=k;
 IF old.contenido THEN RETURN sgp_linea_c2.invalidar(k,'CONTENCION_MANUAL');END IF;
 BEGIN
 ex:=sgp_linea_c2.leer('EXPORT',k);pd:=sgp_linea_c2.leer('PDT',k);pe:=sgp_linea_c2.leer('PERMISOS',k);
 IF ex->'identity'<>pd->'identity' OR ex->'identity'<>pe->'identity' THEN RAISE EXCEPTION 'IDENTIDAD_INCONSISTENTE';END IF;
 bundle:=jsonb_build_object('EXPORT',ex,'PDT',pd,'PERMISOS',pe);
 SELECT jsonb_object_agg(componente,to_jsonb(t)) INTO pins FROM sgp_linea_c2.lectores t;
 IF old.status='READY' AND old.fuentes=bundle AND old.contratos=pins THEN RETURN jsonb_build_object('status','READY','duplicate',true);END IF;
 FOR x,y IN SELECT to_jsonb(key),value FROM jsonb_each(bundle) LOOP
 IF old.fuentes->(x#>>'{}') IS NOT NULL THEN
 IF (y->>'generation')::bigint<(old.fuentes->(x#>>'{}')->>'generation')::bigint THEN RAISE EXCEPTION 'FUENTE_OBSOLETA';END IF;
 IF ((y->>'generation')::bigint=(old.fuentes->(x#>>'{}')->>'generation')::bigint OR y->>'revision'=old.fuentes->(x#>>'{}')->>'revision') AND y<>old.fuentes->(x#>>'{}') THEN RAISE EXCEPTION 'REVISION_REUTILIZADA';END IF;
 END IF;END LOOP;
 IF ex->>'applied' IS DISTINCT FROM 'true' OR nullif(ex->>'loadId','') IS NULL OR nullif(ex->>'historyId','') IS NULL
 OR jsonb_typeof(ex->'events') IS DISTINCT FROM 'array' OR (ex->>'assembled')!~'^[0-9]+$' OR (ex->>'packed')!~'^[0-9]+$'
 OR ex->>'assembled' IS NULL OR ex->>'packed' IS NULL THEN RAISE EXCEPTION 'CORTE_INCOMPLETO';END IF;
 a:=(ex->>'assembled')::bigint;e:=(ex->>'packed')::bigint;
 IF a>9007199254740991 OR e>a THEN RAISE EXCEPTION 'CORTE_CONTRADICTORIO';END IF;
 -- Classification is mandatory for every event existing at a NEW source cut;
 -- no timestamps, watermarks, numerical matches or browser flags infer inclusion.
 IF old.fuentes->'EXPORT' IS DISTINCT FROM ex THEN
 SELECT coalesce(array_agg(id ORDER BY id),'{}') INTO eventos FROM sgp_linea_b2.eventos WHERE key=k;
 IF jsonb_array_length(ex->'events')<>cardinality(eventos) THEN RAISE EXCEPTION 'INCLUSION_NO_DEMOSTRADA';END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(ex->'events') LOOP
 IF x->>'disposition' NOT IN ('INCLUDED','EXCLUDED') OR x->>'disposition' IS NULL OR nullif(x->>'sourceRef','') IS NULL
 OR NOT EXISTS(SELECT 1 FROM sgp_linea_b2.eventos WHERE key=k AND id=(x->>'id')::uuid) THEN RAISE EXCEPTION 'INCLUSION_NO_DEMOSTRADA';END IF;END LOOP;
 IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(ex->'events'))<>cardinality(eventos) THEN RAISE EXCEPTION 'EVENTO_DUPLICADO';END IF;
 END IF;
 SELECT coalesce(array_agg((value->>'id')::uuid ORDER BY (value->>'id')::uuid),'{}') INTO inc FROM jsonb_array_elements(ex->'events') WHERE value->>'disposition'='INCLUDED';
 SELECT * INTO c FROM sgp_linea_b2.cortes WHERE key=k AND id_carga_diaria=ex->>'loadId';
 IF FOUND THEN
 IF c.ensamblado<>a OR c.empacado<>e OR c.prueba->>'historyId' IS DISTINCT FROM ex->>'historyId'
 OR (SELECT coalesce(array_agg(evento ORDER BY evento),'{}') FROM sgp_linea_b2.incluidos WHERE corte=c.id)<>inc THEN RAISE EXCEPTION 'CORTE_MUTADO';END IF;
 cid:=c.id;
 ELSE
 cid:=gen_random_uuid();
 INSERT INTO sgp_linea_b2.cortes VALUES(cid,k,ex->>'loadId',a,e,true,jsonb_build_object('historyId',ex->>'historyId','sourceRef',ex->>'sourceRef','revision',ex->>'revision'),now());
 INSERT INTO sgp_linea_b2.incluidos SELECT cid,unnest(inc);
 END IF;
 IF jsonb_typeof(pd->'items') IS DISTINCT FROM 'array' OR jsonb_typeof(pe->'grants') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'FUENTE_INCOMPLETA';END IF;
 DELETE FROM sgp_linea_b2.bloqueos WHERE key=k;
 DELETE FROM sgp_linea_b2.unidades WHERE key=k;
 FOR x IN SELECT value FROM jsonb_array_elements(pd->'items') LOOP
 IF x->>'stage' NOT IN ('ENSAMBLE','EMPAQUE') OR x->>'stage' IS NULL OR jsonb_typeof(x->'active') IS DISTINCT FROM 'boolean'
 OR nullif(x->>'sourceRef','') IS NULL OR nullif(x->>'sourceVersion','') IS NULL THEN RAISE EXCEPTION 'PDT_NO_VERIFICADO';END IF;
 IF x->>'stage'='ENSAMBLE' AND (x->>'active')::boolean AND (jsonb_typeof(x->'unitIds') IS DISTINCT FROM 'array' OR jsonb_array_length(x->'unitIds')=0) THEN RAISE EXCEPTION 'UNIDADES_PDT_DESCONOCIDAS';END IF;
 ids:=NULL;IF jsonb_typeof(x->'unitIds')='array' THEN SELECT array_agg(value) INTO ids FROM jsonb_array_elements_text(x->'unitIds');END IF;
 INSERT INTO sgp_linea_b2.bloqueos VALUES(k,(x->>'id')::uuid,x->>'stage',(x->>'active')::boolean,ids,jsonb_build_object('sourceRef',x->>'sourceRef','version',x->>'sourceVersion'));
 END LOOP;
 IF EXISTS(SELECT 1 FROM sgp_linea_b2.bloqueos WHERE key=k AND activo AND etapa='ENSAMBLE') THEN
 IF jsonb_typeof(pd->'unitMap'->'assembled') IS DISTINCT FROM 'array' OR jsonb_typeof(pd->'unitMap'->'packed') IS DISTINCT FROM 'array'
 OR nullif(pd->'unitMap'->>'sourceRef','') IS NULL THEN RAISE EXCEPTION 'MAPA_NO_VERIFICADO';END IF;
 SELECT coalesce(array_agg(value),'{}') INTO u FROM jsonb_array_elements_text(pd->'unitMap'->'assembled');
 SELECT coalesce(array_agg(value),'{}') INTO packed FROM jsonb_array_elements_text(pd->'unitMap'->'packed');
 IF cardinality(u)<>(SELECT count(DISTINCT z) FROM unnest(u) z) OR cardinality(packed)<>(SELECT count(DISTINCT z) FROM unnest(packed) z) OR NOT packed<@u
 OR EXISTS(SELECT 1 FROM unnest(u) z WHERE nullif(btrim(z),'') IS NULL) THEN RAISE EXCEPTION 'MAPA_INCONSISTENTE';END IF;
 INSERT INTO sgp_linea_b2.unidades SELECT k,z,z=ANY(packed) FROM unnest(u) z;
 END IF;
 DELETE FROM sgp_linea_b2.permisos WHERE key=k;
 FOR x IN SELECT value FROM jsonb_array_elements(pe->'grants') LOOP
 IF x->>'stage' NOT IN ('ENSAMBLE','EMPAQUE') OR x->>'stage' IS NULL OR nullif(x->>'user','') IS NULL OR nullif(x->>'sourceRef','') IS NULL OR nullif(x->>'sourceVersion','') IS NULL THEN RAISE EXCEPTION 'AMBITO_NO_VERIFICADO';END IF;
 INSERT INTO sgp_linea_b2.permisos VALUES(x->>'user',x->>'stage',k);END LOOP;
 UPDATE sgp_linea_b2.producciones SET corte=cid,pdt_completo=true,pdt_prueba=jsonb_build_object('revision',pd->>'revision','sourceRef',pd->>'sourceRef'),revision=revision+1,unit_revision=revision+1 WHERE key=k RETURNING revision INTO r;
 v:=sgp_linea_b2.disponible(k);IF v->>'status' IS DISTINCT FROM 'READY' THEN RAISE EXCEPTION 'CONCILIACION_INSEGURA';END IF;
 UPDATE sgp_linea_c2.estado SET status='READY',motivo=NULL,fuentes=bundle,contratos=pins,revision=revision+1 WHERE key=k;
 INSERT INTO sgp_linea_c2.historial(key,revision,accion,fuentes) SELECT key,revision,'CONCILIAR',bundle FROM sgp_linea_c2.estado WHERE key=k;
 RETURN jsonb_build_object('status','READY','productionRevision',r,'available',v->'available');
 EXCEPTION WHEN OTHERS THEN
 -- Do not return database details or source data to callers. Retain only bounded
 -- controlled errors; all staged writes were rolled back by this subtransaction.
 reason:=CASE WHEN SQLERRM IN ('LECTOR_NO_CERTIFICADO','FUENTE_OBSOLETA','FUENTE_INCOMPLETA','IDENTIDAD_INCONSISTENTE','REVISION_REUTILIZADA','CORTE_INCOMPLETO','CORTE_CONTRADICTORIO','INCLUSION_NO_DEMOSTRADA','EVENTO_DUPLICADO','CORTE_MUTADO','PDT_NO_VERIFICADO','UNIDADES_PDT_DESCONOCIDAS','MAPA_NO_VERIFICADO','MAPA_INCONSISTENTE','AMBITO_NO_VERIFICADO','CONCILIACION_INSEGURA') THEN SQLERRM ELSE 'FUENTE_NO_VERIFICABLE' END;
 END;
 RETURN sgp_linea_c2.invalidar(k,reason);
END$$;
-- Server-only entry; no quantities, snapshots, roles or scope flags from caller.
CREATE FUNCTION sgp_linea_c2.preparar(token text,k text,etapa text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE s jsonb;r jsonb;BEGIN
 s:=sgp_linea_b2.sesion(token);
 r:=sgp_linea_c2.reconciliar(k);
 IF r->>'status'<>'READY' THEN RETURN r;END IF;
 PERFORM sgp_linea_b2.autorizar(token,etapa,k);
 RETURN r;END$$;
-- Guard only NEW 2B engine objects managed by C2; no legacy functions changed.
CREATE FUNCTION sgp_linea_c2.exigir_vigencia(k text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE st sgp_linea_c2.estado%rowtype;b jsonb;p jsonb;BEGIN
 SELECT * INTO st FROM sgp_linea_c2.estado WHERE key=k;
 IF NOT FOUND THEN RETURN;END IF;
 IF st.status<>'READY' OR st.contenido THEN RAISE EXCEPTION 'SIN_CONCILIAR';END IF;
 b:=jsonb_build_object('EXPORT',sgp_linea_c2.leer('EXPORT',k),'PDT',sgp_linea_c2.leer('PDT',k),'PERMISOS',sgp_linea_c2.leer('PERMISOS',k));
 SELECT jsonb_object_agg(componente,to_jsonb(t)) INTO p FROM sgp_linea_c2.lectores t;
 IF b IS DISTINCT FROM st.fuentes OR p IS DISTINCT FROM st.contratos THEN RAISE EXCEPTION 'SIN_CONCILIAR';END IF;
 IF NOT EXISTS(SELECT 1 FROM sgp_linea_b2.producciones pr JOIN sgp_linea_b2.cortes c ON c.id=pr.corte AND c.key=pr.key WHERE pr.key=k AND c.id_carga_diaria=st.fuentes->'EXPORT'->>'loadId' AND c.ensamblado=(st.fuentes->'EXPORT'->>'assembled')::bigint AND c.empacado=(st.fuentes->'EXPORT'->>'packed')::bigint) THEN RAISE EXCEPTION 'SIN_CONCILIAR';END IF;
END$$;
CREATE FUNCTION sgp_linea_c2.guardar_vigencia() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE k text;r record;BEGIN
 IF TG_TABLE_NAME='eventos' THEN PERFORM sgp_linea_c2.exigir_vigencia(NEW.key);
 ELSE
 k:=NEW.payload->>'key';
 IF k IS NOT NULL THEN PERFORM sgp_linea_c2.exigir_vigencia(k);
 ELSE FOR r IN SELECT key FROM sgp_linea_b2.ordenes WHERE etapa=NEW.payload->>'stage' AND fecha=(NEW.payload->>'date')::date AND turno=(NEW.payload->>'shift')::int LOOP
 PERFORM sgp_linea_c2.exigir_vigencia(r.key);END LOOP;END IF;END IF;
 RETURN NEW;END$$;
CREATE TRIGGER c2_vigencia BEFORE INSERT ON sgp_linea_b2.eventos FOR EACH ROW EXECUTE FUNCTION sgp_linea_c2.guardar_vigencia();
CREATE TRIGGER c2_vigencia BEFORE INSERT ON sgp_linea_b2.auditoria FOR EACH ROW EXECUTE FUNCTION sgp_linea_c2.guardar_vigencia();
ALTER TABLE sgp_linea_c2.lectores ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_linea_c2.estado ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_linea_c2.historial ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_linea_c2 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_linea_c2 FROM PUBLIC,anon,authenticated;
COMMIT;

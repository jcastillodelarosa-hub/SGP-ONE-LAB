-- REVIEW ONLY. PostgreSQL17 isolated implementation; NOT automatic migration.
-- No legacy function/table alteration. Export source bridge is NOT installed here.
BEGIN;
CREATE SCHEMA sgp_linea_b2;
REVOKE ALL ON SCHEMA sgp_linea_b2 FROM PUBLIC,anon,authenticated;
CREATE TABLE sgp_linea_b2.config(id integer PRIMARY KEY CHECK(id=1),escrituras boolean NOT NULL);
INSERT INTO sgp_linea_b2.config VALUES(1,true);
CREATE TABLE sgp_linea_b2.producciones(
 key text PRIMARY KEY REFERENCES public.sgp_producciones(key_produccion),revision bigint NOT NULL DEFAULT 0,
 corte uuid,unit_revision bigint,pdt_completo boolean NOT NULL DEFAULT false,pdt_prueba jsonb
);
CREATE TABLE sgp_linea_b2.permisos(usuario text NOT NULL,etapa text NOT NULL CHECK(etapa IN ('ENSAMBLE','EMPAQUE')),key text NOT NULL REFERENCES sgp_linea_b2.producciones,PRIMARY KEY(usuario,etapa,key));
CREATE TABLE sgp_linea_b2.turnos(etapa text NOT NULL CHECK(etapa IN ('ENSAMBLE','EMPAQUE')),fecha date NOT NULL,turno integer NOT NULL CHECK(turno IN(1,2)),estado text NOT NULL DEFAULT 'ABIERTO' CHECK(estado IN('ABIERTO','CERRADO','EN_REVISION')),revision bigint NOT NULL DEFAULT 0,PRIMARY KEY(etapa,fecha,turno));
CREATE TABLE sgp_linea_b2.ordenes(etapa text NOT NULL,fecha date NOT NULL,turno integer NOT NULL,key text NOT NULL REFERENCES sgp_linea_b2.producciones,sale bigint CHECK(sale>=0),ejecutado bigint NOT NULL DEFAULT 0 CHECK(ejecutado>=0),revision bigint NOT NULL DEFAULT 0,PRIMARY KEY(etapa,fecha,turno,key),FOREIGN KEY(etapa,fecha,turno) REFERENCES sgp_linea_b2.turnos);
CREATE TABLE sgp_linea_b2.eventos(id uuid PRIMARY KEY,key text NOT NULL REFERENCES sgp_linea_b2.producciones,etapa text NOT NULL,fecha date NOT NULL,turno integer NOT NULL,delta bigint NOT NULL,usuario text NOT NULL,motivo text,registrado_en timestamptz NOT NULL DEFAULT now(),unidades text[] NOT NULL DEFAULT '{}');
CREATE TABLE sgp_linea_b2.solicitudes(id uuid PRIMARY KEY,usuario text NOT NULL,payload jsonb NOT NULL,respuesta jsonb NOT NULL);
CREATE TABLE sgp_linea_b2.auditoria(id uuid PRIMARY KEY,usuario text NOT NULL,operacion text NOT NULL,payload jsonb NOT NULL,antes jsonb,despues jsonb,registrado_en timestamptz NOT NULL DEFAULT now());
CREATE TABLE sgp_linea_b2.cierres(id uuid PRIMARY KEY,etapa text NOT NULL,fecha date NOT NULL,turno integer NOT NULL,revision bigint NOT NULL,snapshot jsonb NOT NULL,usuario text NOT NULL,motivo text NOT NULL CHECK(btrim(motivo)<>''),UNIQUE(etapa,fecha,turno,revision));
CREATE TABLE sgp_linea_b2.arrastres(key text NOT NULL REFERENCES sgp_linea_b2.producciones,etapa text NOT NULL,fecha date NOT NULL,turno integer NOT NULL,destino_fecha date NOT NULL,destino_turno integer NOT NULL,cantidad bigint NOT NULL CHECK(cantidad>=0),revision_origen bigint NOT NULL,validado boolean NOT NULL DEFAULT false,PRIMARY KEY(key,etapa,fecha,turno));
-- Trusted server evidence only: no public RPC can insert quantities/mappings here.
CREATE TABLE sgp_linea_b2.cortes(id uuid PRIMARY KEY,key text NOT NULL REFERENCES sgp_linea_b2.producciones,id_carga_diaria text NOT NULL,ensamblado bigint NOT NULL CHECK(ensamblado>=0),empacado bigint NOT NULL CHECK(empacado>=0),inclusion_completa boolean NOT NULL DEFAULT false,prueba jsonb NOT NULL,creado_en timestamptz NOT NULL DEFAULT now(),UNIQUE(key,id_carga_diaria));
ALTER TABLE sgp_linea_b2.producciones ADD FOREIGN KEY(corte) REFERENCES sgp_linea_b2.cortes;
CREATE TABLE sgp_linea_b2.incluidos(corte uuid NOT NULL REFERENCES sgp_linea_b2.cortes,evento uuid NOT NULL REFERENCES sgp_linea_b2.eventos,PRIMARY KEY(corte,evento));
CREATE TABLE sgp_linea_b2.unidades(key text NOT NULL REFERENCES sgp_linea_b2.producciones,id text NOT NULL,empacada boolean NOT NULL DEFAULT false,PRIMARY KEY(key,id));
CREATE TABLE sgp_linea_b2.bloqueos(key text NOT NULL REFERENCES sgp_linea_b2.producciones,pdt uuid NOT NULL,etapa text NOT NULL CHECK(etapa IN ('ENSAMBLE','EMPAQUE','DESCONOCIDA')),activo boolean NOT NULL,unidades text[],prueba jsonb,PRIMARY KEY(key,pdt));
CREATE FUNCTION sgp_linea_b2.inmutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN RAISE EXCEPTION 'HISTORIAL_INMUTABLE';END$$;
CREATE TRIGGER fijo BEFORE UPDATE OR DELETE ON sgp_linea_b2.eventos FOR EACH ROW EXECUTE FUNCTION sgp_linea_b2.inmutable();
CREATE TRIGGER fijo BEFORE UPDATE OR DELETE ON sgp_linea_b2.auditoria FOR EACH ROW EXECUTE FUNCTION sgp_linea_b2.inmutable();
CREATE TRIGGER fijo BEFORE UPDATE OR DELETE ON sgp_linea_b2.cierres FOR EACH ROW EXECUTE FUNCTION sgp_linea_b2.inmutable();
CREATE TRIGGER fijo BEFORE UPDATE OR DELETE ON sgp_linea_b2.cortes FOR EACH ROW EXECUTE FUNCTION sgp_linea_b2.inmutable();
CREATE TRIGGER fijo BEFORE UPDATE OR DELETE ON sgp_linea_b2.incluidos FOR EACH ROW EXECUTE FUNCTION sgp_linea_b2.inmutable();
CREATE TRIGGER fijo BEFORE UPDATE OR DELETE ON sgp_linea_b2.solicitudes FOR EACH ROW EXECUTE FUNCTION sgp_linea_b2.inmutable();
CREATE FUNCTION sgp_linea_b2.invalidar_pdt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN
 UPDATE sgp_linea_b2.producciones SET revision=revision+1,pdt_completo=false,pdt_prueba=NULL,unit_revision=NULL WHERE key=CASE WHEN TG_OP='DELETE' THEN OLD.key ELSE NEW.key END;
 IF TG_OP='UPDATE' AND OLD.key<>NEW.key THEN UPDATE sgp_linea_b2.producciones SET revision=revision+1,pdt_completo=false,pdt_prueba=NULL,unit_revision=NULL WHERE key=OLD.key;END IF;
 RETURN NULL;END$$;
CREATE TRIGGER invalidar AFTER INSERT OR UPDATE OR DELETE ON sgp_linea_b2.bloqueos FOR EACH ROW EXECUTE FUNCTION sgp_linea_b2.invalidar_pdt();
CREATE FUNCTION sgp_linea_b2.sellar_inclusion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN
 IF EXISTS(SELECT 1 FROM sgp_linea_b2.producciones WHERE corte=NEW.corte) OR EXISTS(SELECT 1 FROM sgp_linea_b2.auditoria WHERE operacion='CONCILIAR' AND payload->>'cut_id'=NEW.corte::text) THEN RAISE EXCEPTION 'CORTE_SELLADO';END IF;
 RETURN NEW;END$$;
CREATE TRIGGER sellar BEFORE INSERT ON sgp_linea_b2.incluidos FOR EACH ROW EXECUTE FUNCTION sgp_linea_b2.sellar_inclusion();
CREATE FUNCTION sgp_linea_b2.sesion(token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;BEGIN
 s:=public.sgp_sesion_actual(token);
 IF s->>'valida' IS DISTINCT FROM 'true' OR nullif(s->>'usuario','') IS NULL OR s->>'rol' NOT IN ('LIDER','LIDER LINEA','COORDINADOR','ADMINISTRADOR','CONSULTA') OR s->>'rol' IS NULL THEN RAISE EXCEPTION 'PERMISO_DENEGADO';END IF;
 RETURN s;
END$$;
CREATE FUNCTION sgp_linea_b2.autorizar(token text,etapa text,k text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;BEGIN s:=sgp_linea_b2.sesion(token);
 IF etapa NOT IN ('ENSAMBLE','EMPAQUE') OR etapa IS NULL OR NOT EXISTS(SELECT 1 FROM sgp_linea_b2.permisos p WHERE p.usuario=s->>'usuario' AND p.etapa=autorizar.etapa AND (k IS NULL OR p.key=k)) THEN RAISE EXCEPTION 'AMBITO_DENEGADO';END IF;
 RETURN s;END$$;
CREATE FUNCTION sgp_linea_b2.disponible(k text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p sgp_linea_b2.producciones%rowtype;c sgp_linea_b2.cortes%rowtype;a bigint;e bigint;n bigint;ids text[];b record;
BEGIN
 SELECT * INTO p FROM sgp_linea_b2.producciones WHERE key=k;
 IF p.pdt_completo IS DISTINCT FROM true OR p.pdt_prueba IS NULL OR p.pdt_prueba='{}'::jsonb THEN RETURN jsonb_build_object('status','UNKNOWN','available',NULL,'reason','PDT_NO_CONTRASTADO');END IF;
 SELECT * INTO c FROM sgp_linea_b2.cortes WHERE id=p.corte AND key=k;
 IF NOT FOUND OR NOT c.inclusion_completa OR c.prueba='{}'::jsonb THEN RETURN jsonb_build_object('status','UNKNOWN','available',NULL,'reason','CORTE_SIN_CONCILIAR');END IF;
 IF EXISTS(SELECT 1 FROM sgp_linea_b2.incluidos i JOIN sgp_linea_b2.eventos v ON v.id=i.evento WHERE i.corte=c.id AND v.key<>k) THEN RETURN jsonb_build_object('status','DISCREPANCY','available',NULL,'reason','INCLUSION_AJENA');END IF;
 SELECT c.ensamblado+coalesce(sum(delta) FILTER(WHERE etapa='ENSAMBLE'),0),c.empacado+coalesce(sum(delta) FILTER(WHERE etapa='EMPAQUE'),0) INTO a,e FROM sgp_linea_b2.eventos v WHERE v.key=k AND NOT EXISTS(SELECT 1 FROM sgp_linea_b2.incluidos i WHERE i.corte=c.id AND i.evento=v.id);
 IF a<0 OR e<0 OR e>a THEN RETURN jsonb_build_object('status','DISCREPANCY','available',NULL,'reason','CANTIDADES_INCONSISTENTES');END IF;
 IF EXISTS(SELECT 1 FROM sgp_linea_b2.bloqueos WHERE key=k AND activo AND etapa='DESCONOCIDA') THEN RETURN jsonb_build_object('status','UNKNOWN','available',NULL,'reason','IMPACTO_LEGACY_DESCONOCIDO');END IF;
 ids:='{}';
 IF EXISTS(SELECT 1 FROM sgp_linea_b2.bloqueos WHERE key=k AND activo AND etapa='ENSAMBLE') THEN
 IF p.unit_revision IS DISTINCT FROM p.revision OR (SELECT count(*) FROM sgp_linea_b2.unidades WHERE key=k)<>a OR (SELECT count(*) FROM sgp_linea_b2.unidades WHERE key=k AND empacada)<>e THEN RETURN jsonb_build_object('status','UNKNOWN','available',NULL,'reason','MAPA_UNIDADES_NO_VERIFICADO');END IF;
 FOR b IN SELECT * FROM sgp_linea_b2.bloqueos WHERE key=k AND activo AND etapa='ENSAMBLE' LOOP
 IF b.unidades IS NULL OR cardinality(b.unidades)=0 OR b.prueba IS NULL OR b.prueba='{}'::jsonb THEN RETURN jsonb_build_object('status','UNKNOWN','available',NULL,'reason','IMPACTO_PDT_DESCONOCIDO');END IF;
 ids:=ids||b.unidades;END LOOP;
 IF EXISTS(SELECT 1 FROM unnest(ids) x WHERE NOT EXISTS(SELECT 1 FROM sgp_linea_b2.unidades u WHERE u.key=k AND u.id=x AND NOT u.empacada)) THEN RETURN jsonb_build_object('status','DISCREPANCY','available',NULL,'reason','UNIDAD_BLOQUEADA_INCONSISTENTE');END IF;
 END IF;
 SELECT count(DISTINCT x) INTO n FROM unnest(ids) x;
 RETURN jsonb_build_object('status','READY','available',a-e-n,'assembled',a,'packed',e,'blocked',n,'revision',p.revision,'cutId',c.id,'blockedIds',to_jsonb(ids));
END$$;
CREATE FUNCTION public.sgp_linea_disponible_b2(p_token text,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN
 PERFORM sgp_linea_b2.autorizar(p_token,'EMPAQUE',p_key);
 PERFORM 1 FROM sgp_linea_b2.producciones WHERE key=p_key FOR UPDATE;
 RETURN sgp_linea_b2.disponible(p_key);END$$;
CREATE FUNCTION public.sgp_linea_motor_b2(p_token text,p_cmd jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE op text:=p_cmd->>'op';k text:=p_cmd->>'key';et text:=p_cmd->>'stage';d date:=(p_cmd->>'date')::date;t integer:=(p_cmd->>'shift')::int;request_id uuid:=(p_cmd->>'id')::uuid;rev bigint:=(p_cmd->>'revision')::bigint;s jsonb;u text;prior sgp_linea_b2.solicitudes%rowtype;tr sgp_linea_b2.turnos%rowtype;o sgp_linea_b2.ordenes%rowtype;r record;v bigint;delta bigint;res jsonb;before_state jsonb;qty jsonb;row_snapshot jsonb;new_ids text[]:='{}';p_rev bigint;
BEGIN
 IF jsonb_typeof(p_cmd)<>'object' OR op NOT IN ('ABRIR','SALE','EJECUTAR','CERRAR','REABRIR','ARRASTRAR','CONCILIAR','INFORME') OR op IS NULL THEN RAISE EXCEPTION 'COMANDO_INVALIDO';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_cmd) x WHERE x NOT IN ('op','key','stage','date','shift','id','revision','quantity','observation','reasons','cut_id','close_id')) THEN RAISE EXCEPTION 'CAMPOS_NO_PERMITIDOS';END IF;
 s:=sgp_linea_b2.autorizar(p_token,et,k);u:=s->>'usuario';
 IF op<>'INFORME' AND NOT coalesce((SELECT escrituras FROM sgp_linea_b2.config WHERE id=1),false) THEN RAISE EXCEPTION 'ESCRITURAS_CONTENIDAS';END IF;
 IF op<>'INFORME' AND (request_id IS NULL OR rev IS NULL OR rev<0 OR s->>'rol'='CONSULTA') THEN RAISE EXCEPTION 'PERMISO_O_REVISION_INVALIDA';END IF;
 IF op IN ('ABRIR','SALE','REABRIR','CONCILIAR') AND s->>'rol' NOT IN ('COORDINADOR','ADMINISTRADOR') THEN RAISE EXCEPTION 'REQUIERE_COORDINADOR';END IF;
 IF op IN ('SALE','EJECUTAR','ARRASTRAR','CONCILIAR') AND k IS NULL THEN RAISE EXCEPTION 'PRODUCCION_REQUERIDA';END IF;
 IF op='CONCILIAR' THEN PERFORM sgp_linea_b2.autorizar(p_token,'ENSAMBLE',k);PERFORM sgp_linea_b2.autorizar(p_token,'EMPAQUE',k);END IF;
 IF op='INFORME' THEN
 SELECT snapshot INTO res FROM sgp_linea_b2.cierres WHERE sgp_linea_b2.cierres.id=(p_cmd->>'close_id')::uuid AND etapa=et;
 IF NOT FOUND THEN RAISE EXCEPTION 'CIERRE_NO_EXISTE';END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(res->'rows') LOOP PERFORM sgp_linea_b2.autorizar(p_token,et,r.value->>'key');END LOOP;
 RETURN res;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(request_id::text,123));
 SELECT * INTO prior FROM sgp_linea_b2.solicitudes WHERE sgp_linea_b2.solicitudes.id=request_id;
 IF FOUND THEN IF prior.usuario<>u OR prior.payload<>p_cmd THEN RAISE EXCEPTION 'IDEMPOTENCIA_REUTILIZADA';END IF;IF op='CERRAR' THEN FOR r IN SELECT value FROM jsonb_array_elements(prior.respuesta->'rows') LOOP PERFORM sgp_linea_b2.autorizar(p_token,et,r.value->>'key');END LOOP;END IF;RETURN prior.respuesta||jsonb_build_object('duplicate',true);END IF;
 -- Source/CAS lock shared by every shift and every writer in this new engine.
 IF k IS NOT NULL THEN SELECT revision INTO p_rev FROM sgp_linea_b2.producciones WHERE key=k FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCCION_NO_EXISTE';END IF;END IF;
 IF op='CONCILIAR' THEN
 IF p_rev<>rev THEN RAISE EXCEPTION 'CONFLICTO_REVISION';END IF;
 IF NOT EXISTS(SELECT 1 FROM sgp_linea_b2.cortes WHERE sgp_linea_b2.cortes.id=(p_cmd->>'cut_id')::uuid AND key=k AND inclusion_completa AND prueba<>'{}'::jsonb) THEN RAISE EXCEPTION 'CORTE_NO_VERIFICADO';END IF;
 before_state:=to_jsonb((SELECT p FROM sgp_linea_b2.producciones p WHERE key=k));
 UPDATE sgp_linea_b2.producciones SET corte=(p_cmd->>'cut_id')::uuid,revision=revision+1,unit_revision=NULL WHERE key=k;
 qty:=sgp_linea_b2.disponible(k);IF qty->>'status'='DISCREPANCY' THEN RAISE EXCEPTION 'CORTE_DISCREPANTE';END IF;
 res:=jsonb_build_object('ok',true,'productionRevision',p_rev+1);
 ELSE
 IF d IS NULL OR t IS NULL OR t NOT IN (1,2) THEN RAISE EXCEPTION 'TURNO_INVALIDO';END IF;
 IF op='ABRIR' THEN INSERT INTO sgp_linea_b2.turnos(etapa,fecha,turno) VALUES(et,d,t) ON CONFLICT DO NOTHING;END IF;
 SELECT * INTO tr FROM sgp_linea_b2.turnos WHERE etapa=et AND fecha=d AND turno=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TURNO_NO_EXISTE';END IF;
 before_state:=to_jsonb(tr);
 IF op IN ('ABRIR','CERRAR','REABRIR') THEN
 IF tr.revision<>rev THEN RAISE EXCEPTION 'CONFLICTO_REVISION';END IF;
 IF op='ABRIR' THEN IF tr.estado<>'ABIERTO' THEN RAISE EXCEPTION 'TURNO_NO_ABIERTO';END IF;res:=jsonb_build_object('ok',true,'turnRevision',tr.revision);
 ELSE
 IF nullif(btrim(p_cmd->>'observation'),'') IS NULL THEN RAISE EXCEPTION 'OBSERVACION_REQUERIDA';END IF;
 FOR r IN SELECT * FROM sgp_linea_b2.ordenes WHERE etapa=et AND fecha=d AND turno=t ORDER BY key LOOP
 PERFORM sgp_linea_b2.autorizar(p_token,et,r.key);
 IF op='CERRAR' AND (r.sale IS NULL OR (r.ejecutado<r.sale AND nullif(btrim(p_cmd->'reasons'->>r.key),'') IS NULL)) THEN RAISE EXCEPTION 'SALE_O_JUSTIFICACION_REQUERIDA';END IF;END LOOP;
 IF op='CERRAR' THEN
 IF tr.estado='CERRADO' THEN RAISE EXCEPTION 'TURNO_CERRADO';END IF;
 SELECT jsonb_agg(to_jsonb(x) ORDER BY x.key) INTO row_snapshot FROM sgp_linea_b2.ordenes x WHERE etapa=et AND fecha=d AND turno=t;
 IF row_snapshot IS NULL THEN RAISE EXCEPTION 'TURNO_VACIO';END IF;
 res:=jsonb_build_object('ok',true,'id',request_id,'stage',et,'date',d,'shift',t,'rows',row_snapshot,'reasons',coalesce(p_cmd->'reasons','{}'::jsonb),'observation',p_cmd->>'observation','user',u,'revision',tr.revision+1);
 INSERT INTO sgp_linea_b2.cierres VALUES(request_id,et,d,t,tr.revision+1,res,u,p_cmd->>'observation');
 UPDATE sgp_linea_b2.turnos SET estado='CERRADO',revision=revision+1 WHERE etapa=et AND fecha=d AND turno=t;
 ELSE
 IF tr.estado<>'CERRADO' THEN RAISE EXCEPTION 'TURNO_NO_CERRADO';END IF;
 UPDATE sgp_linea_b2.turnos SET estado='EN_REVISION',revision=revision+1 WHERE etapa=et AND fecha=d AND turno=t;
 res:=jsonb_build_object('ok',true,'turnRevision',tr.revision+1,'state','EN_REVISION');END IF;
 END IF;
 ELSE
 IF tr.estado='CERRADO' AND op<>'ARRASTRAR' THEN RAISE EXCEPTION 'REAPERTURA_REQUERIDA';END IF;
 IF tr.estado='EN_REVISION' AND op='EJECUTAR' AND (s->>'rol' NOT IN ('COORDINADOR','ADMINISTRADOR') OR nullif(btrim(p_cmd->>'observation'),'') IS NULL) THEN RAISE EXCEPTION 'CORRECCION_NO_AUTORIZADA';END IF;
 IF op='SALE' THEN INSERT INTO sgp_linea_b2.ordenes(etapa,fecha,turno,key) VALUES(et,d,t,k) ON CONFLICT DO NOTHING;END IF;
 SELECT * INTO o FROM sgp_linea_b2.ordenes WHERE etapa=et AND fecha=d AND turno=t AND key=k;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDEN_NO_EXISTE';END IF;
 IF o.revision<>rev THEN RAISE EXCEPTION 'CONFLICTO_REVISION';END IF;
 before_state:=to_jsonb(o);
 IF op IN ('SALE','EJECUTAR') THEN
 v:=(p_cmd->>'quantity')::bigint;IF v IS NULL OR v<0 OR v>9007199254740991 THEN RAISE EXCEPTION 'CANTIDAD_INVALIDA';END IF;
 IF (op='SALE' OR v<o.ejecutado) AND nullif(btrim(p_cmd->>'observation'),'') IS NULL THEN RAISE EXCEPTION 'MOTIVO_REQUERIDO';END IF;
 IF op='SALE' THEN UPDATE sgp_linea_b2.ordenes SET sale=v,revision=revision+1 WHERE etapa=et AND fecha=d AND turno=t AND key=k;
 ELSE
 delta:=v-o.ejecutado;
 IF (et='EMPAQUE' AND delta>0) OR (et='ENSAMBLE' AND delta<0) THEN
 qty:=sgp_linea_b2.disponible(k);IF qty->>'status'<>'READY' THEN RAISE EXCEPTION 'EVIDENCIA_INSUFICIENTE';END IF;
 IF et='EMPAQUE' AND delta>(qty->>'available')::bigint THEN RAISE EXCEPTION 'SALDO_INSUFICIENTE';END IF;
 IF et='ENSAMBLE' AND ((qty->>'assembled')::bigint+delta<(qty->>'packed')::bigint OR EXISTS(SELECT 1 FROM sgp_linea_b2.bloqueos WHERE key=k AND activo AND etapa IN ('ENSAMBLE','DESCONOCIDA'))) THEN RAISE EXCEPTION 'CORRECCION_SIN_RESPALDO';END IF;
 IF et='EMPAQUE' AND EXISTS(SELECT 1 FROM sgp_linea_b2.bloqueos WHERE key=k AND activo AND etapa='ENSAMBLE') THEN
 SELECT array_agg(z.id) INTO new_ids FROM (SELECT x.id FROM sgp_linea_b2.unidades x WHERE x.key=k AND NOT x.empacada AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(qty->'blockedIds','[]'::jsonb)) z WHERE z.value=x.id) ORDER BY x.id LIMIT delta) z;
 IF cardinality(new_ids) IS DISTINCT FROM delta THEN RAISE EXCEPTION 'UNIDADES_INSUFICIENTES';END IF;
 UPDATE sgp_linea_b2.unidades SET empacada=true WHERE key=k AND sgp_linea_b2.unidades.id=ANY(new_ids);
 END IF;END IF;
 IF et='EMPAQUE' AND delta<0 THEN qty:=sgp_linea_b2.disponible(k);IF qty->>'status'<>'READY' OR (qty->>'packed')::bigint+delta<0 OR EXISTS(SELECT 1 FROM sgp_linea_b2.bloqueos WHERE key=k AND activo AND etapa IN ('ENSAMBLE','DESCONOCIDA')) THEN RAISE EXCEPTION 'CORRECCION_REQUIERE_CONCILIACION';END IF;END IF;
 INSERT INTO sgp_linea_b2.eventos VALUES(request_id,k,et,d,t,delta,u,p_cmd->>'observation',now(),coalesce(new_ids,'{}'));
 UPDATE sgp_linea_b2.ordenes SET ejecutado=v,revision=revision+1 WHERE etapa=et AND fecha=d AND turno=t AND key=k;
 UPDATE sgp_linea_b2.producciones SET revision=revision+1,unit_revision=CASE WHEN cardinality(new_ids)>0 THEN revision+1 ELSE NULL END WHERE key=k;
 END IF;
 UPDATE sgp_linea_b2.arrastres SET cantidad=greatest(0,(CASE WHEN op='SALE' THEN v ELSE o.sale END)-CASE WHEN op='EJECUTAR' THEN v ELSE o.ejecutado END),revision_origen=o.revision+1,validado=false WHERE key=k AND etapa=et AND fecha=d AND turno=t;
 ELSE
 IF o.sale IS NULL THEN RAISE EXCEPTION 'SALE_NO_VALIDADO';END IF;
 PERFORM 1 FROM sgp_linea_b2.turnos WHERE etapa=et AND fecha=CASE WHEN t=1 THEN d ELSE d+1 END AND turno=CASE WHEN t=1 THEN 2 ELSE 1 END FOR SHARE;
 IF EXISTS(SELECT 1 FROM sgp_linea_b2.turnos WHERE etapa=et AND fecha=CASE WHEN t=1 THEN d ELSE d+1 END AND turno=CASE WHEN t=1 THEN 2 ELSE 1 END AND estado='CERRADO') THEN RAISE EXCEPTION 'DESTINO_CERRADO';END IF;
 INSERT INTO sgp_linea_b2.arrastres VALUES(k,et,d,t,CASE WHEN t=1 THEN d ELSE d+1 END,CASE WHEN t=1 THEN 2 ELSE 1 END,greatest(o.sale-o.ejecutado,0),o.revision+1,false)
 ON CONFLICT(key,etapa,fecha,turno) DO UPDATE SET cantidad=excluded.cantidad,revision_origen=excluded.revision_origen,validado=false;
 UPDATE sgp_linea_b2.ordenes SET revision=revision+1 WHERE etapa=et AND fecha=d AND turno=t AND key=k;
 END IF;
 UPDATE sgp_linea_b2.turnos SET revision=revision+1 WHERE etapa=et AND fecha=d AND turno=t;
 res:=jsonb_build_object('ok',true,'orderRevision',o.revision+1,'turnRevision',tr.revision+1);
 END IF;END IF;
 INSERT INTO sgp_linea_b2.auditoria VALUES(request_id,u,op,p_cmd,before_state,res,now());
 INSERT INTO sgp_linea_b2.solicitudes VALUES(request_id,u,p_cmd,res);
 RETURN res;
END$$;
CREATE TABLE sgp_linea_b2.adaptador_solicitudes(id uuid PRIMARY KEY,signature text NOT NULL,response jsonb NOT NULL);
CREATE TRIGGER fijo BEFORE UPDATE OR DELETE ON sgp_linea_b2.adaptador_solicitudes FOR EACH ROW EXECUTE FUNCTION sgp_linea_b2.inmutable();
CREATE FUNCTION sgp_linea_b2.contexto(token text,k text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;etapas jsonb;BEGIN
 s:=sgp_linea_b2.sesion(token);SELECT jsonb_agg(etapa) INTO etapas FROM sgp_linea_b2.permisos WHERE usuario=s->>'usuario' AND key=k;
 IF etapas IS NULL THEN RAISE EXCEPTION 'AMBITO_DENEGADO';END IF;
 RETURN jsonb_build_object('active',true,'user',s->>'usuario','role',s->>'rol','stages',etapas,'productions',jsonb_build_array(k));END$$;
CREATE FUNCTION sgp_linea_b2.snapshot(k text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p sgp_linea_b2.producciones%rowtype;c sgp_linea_b2.cortes%rowtype;BEGIN
 SELECT * INTO STRICT p FROM sgp_linea_b2.producciones WHERE key=k;
 SELECT * INTO c FROM sgp_linea_b2.cortes WHERE id=p.corte AND key=k;
 RETURN jsonb_build_object('production',k,'unit','UNIDAD_PRODUCCION','revision',p.revision,
 'complete',jsonb_build_object('production',true,'cut',c.id IS NOT NULL,'events',true,'pdts',p.pdt_completo AND p.pdt_prueba IS NOT NULL AND p.pdt_prueba<>'{}'::jsonb,'turns',true),
 'cut',jsonb_build_object('id',c.id,'unit','UNIDAD_PRODUCCION','assembled',c.ensamblado,'packed',c.empacado,'inclusionComplete',coalesce(c.inclusion_completa,false) AND c.prueba<>'{}'::jsonb,'includedEventIds',coalesce((SELECT jsonb_agg(evento) FROM sgp_linea_b2.incluidos WHERE corte=c.id),'[]')),
 'events',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'production',key,'unit','UNIDAD_PRODUCCION','stage',etapa,'delta',delta)) FROM sgp_linea_b2.eventos WHERE key=k),'[]'),
 'pdts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',pdt,'production',key,'origin',CASE WHEN etapa='DESCONOCIDA' THEN 'PRODUCCION' ELSE etapa END,'active',activo,'affectedUnitIds',CASE WHEN prueba IS NOT NULL AND prueba<>'{}'::jsonb THEN to_jsonb(unidades) ELSE NULL END,'mappingRevision',p.revision)) FROM sgp_linea_b2.bloqueos WHERE key=k),'[]'),
 'relations','[]'::jsonb,'turns',coalesce((SELECT jsonb_agg(jsonb_build_object('stage',tr.etapa,'date',tr.fecha,'shift',tr.turno,'state',tr.estado,'production',k)) FROM sgp_linea_b2.turnos tr WHERE EXISTS(SELECT 1 FROM sgp_linea_b2.ordenes o WHERE o.key=k AND o.etapa=tr.etapa AND o.fecha=tr.fecha AND o.turno=tr.turno)),'[]'),
 'unitMap',jsonb_build_object('production',k,'unit','UNIDAD_PRODUCCION','revision',p.unit_revision,'assembledIds',coalesce((SELECT jsonb_agg(id) FROM sgp_linea_b2.unidades WHERE key=k),'[]'),'packedIds',coalesce((SELECT jsonb_agg(id) FROM sgp_linea_b2.unidades WHERE key=k AND empacada),'[]')));
END$$;
DO $security$ DECLARE t record;BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='sgp_linea_b2' LOOP EXECUTE format('ALTER TABLE sgp_linea_b2.%I ENABLE ROW LEVEL SECURITY',t.tablename);END LOOP;END$security$;
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_linea_b2 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_linea_b2 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sgp_linea_motor_b2(text,jsonb),public.sgp_linea_disponible_b2(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_linea_motor_b2(text,jsonb),public.sgp_linea_disponible_b2(text,text) TO anon,authenticated;
COMMIT;

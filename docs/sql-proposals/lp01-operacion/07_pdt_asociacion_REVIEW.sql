-- PROPOSAL ONLY. After 01. No grants, source adapters, productive activation or historical backfill.
BEGIN;
CREATE TABLE sgp_lp_operacion.pdt_evidencias(
 id uuid PRIMARY KEY,key text NOT NULL REFERENCES public.sgp_producciones,etapa text NOT NULL CHECK(etapa IN('ENSAMBLE','EMPAQUE')),
 contrato text NOT NULL CHECK(contrato IN('LEGACY','V2','V4')),evento uuid NOT NULL,version bigint NOT NULL CHECK(version>0),
 entrega uuid NOT NULL,entrega_version bigint NOT NULL CHECK(entrega_version>0),historial uuid NOT NULL,
 alcance text NOT NULL CHECK(alcance='PRODUCTION_STAGE_UNION'),antes bigint NOT NULL CHECK(antes>=0),despues bigint NOT NULL CHECK(despues>=0 AND despues<antes),
 anterior uuid REFERENCES sgp_lp_operacion.pdt_evidencias,acreditado_en timestamptz NOT NULL,emisor text NOT NULL CHECK(btrim(emisor)<>''),
 UNIQUE(contrato,evento,version),UNIQUE(entrega,entrega_version,key,etapa));
CREATE TABLE sgp_lp_operacion.pdt_solicitudes(id uuid PRIMARY KEY,usuario text NOT NULL,key text NOT NULL REFERENCES public.sgp_producciones,etapa text NOT NULL,linea text NOT NULL,payload jsonb NOT NULL,estado text NOT NULL DEFAULT 'PENDIENTE_COORDINADOR',evidencia uuid UNIQUE REFERENCES sgp_lp_operacion.pdt_evidencias,motivo text);
CREATE TABLE sgp_lp_operacion.pdt_asociaciones(liberacion uuid PRIMARY KEY REFERENCES sgp_lp_operacion.liberaciones,solicitud uuid NOT NULL REFERENCES sgp_lp_operacion.pdt_solicitudes,raiz uuid NOT NULL REFERENCES public.sgp_linea_plan_asignaciones,fecha date NOT NULL,turno int NOT NULL CHECK(turno IN(1,2)));
CREATE TABLE sgp_lp_operacion.pdt_bitacora(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,solicitud uuid NOT NULL REFERENCES sgp_lp_operacion.pdt_solicitudes,usuario text NOT NULL,accion text NOT NULL,detalle jsonb NOT NULL,creado_en timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TRIGGER fixed BEFORE UPDATE OR DELETE ON sgp_lp_operacion.pdt_evidencias FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.inmutable();
CREATE TRIGGER fixed BEFORE UPDATE OR DELETE ON sgp_lp_operacion.pdt_asociaciones FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.inmutable();
CREATE TRIGGER fixed BEFORE UPDATE OR DELETE ON sgp_lp_operacion.pdt_bitacora FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.inmutable();
ALTER TABLE sgp_lp_operacion.pdt_evidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_operacion.pdt_solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_operacion.pdt_asociaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_operacion.pdt_bitacora ENABLE ROW LEVEL SECURITY;
-- No browser endpoint accepts physical evidence. Only a future reviewed server emitter can populate pdt_evidencias.
CREATE FUNCTION sgp_lp_operacion.pdt_asociar(token text,request uuid,k text,et text,targets jsonb,evidence uuid DEFAULT NULL,reason text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE actor jsonb;line_id text;s sgp_lp_operacion.pdt_solicitudes%rowtype;e sgp_lp_operacion.pdt_evidencias%rowtype;prev sgp_lp_operacion.pdt_evidencias%rowtype;x jsonb;root uuid;qty bigint;total bigint:=0;relid uuid;expected jsonb;BEGIN
 SELECT id_linea INTO line_id FROM public.sgp_producciones WHERE key_produccion=k;
 actor:=sgp_lp_operacion.sesion(token,et,k,line_id);
 IF actor->>'rol' NOT IN('COORDINADOR','ADMINISTRADOR') THEN RAISE EXCEPTION 'REQUIERE_COORDINADOR';END IF;
 PERFORM sgp_lp_operacion.admitir();
 IF request IS NULL OR jsonb_typeof(targets) IS DISTINCT FROM 'array' OR jsonb_array_length(targets)=0 THEN RAISE EXCEPTION 'ASOCIACION_EXPLICITA_REQUERIDA';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(et||'|'||line_id,184));
 PERFORM 1 FROM public.sgp_producciones WHERE key_produccion=k FOR UPDATE;
 actor:=sgp_lp_operacion.sesion(token,et,k,line_id);
 IF actor->>'rol' NOT IN('COORDINADOR','ADMINISTRADOR') THEN RAISE EXCEPTION 'REQUIERE_COORDINADOR';END IF;
 expected:=jsonb_build_object('key',k,'stage',et,'targets',targets);
 SELECT * INTO s FROM sgp_lp_operacion.pdt_solicitudes WHERE id=request FOR UPDATE;
 IF FOUND THEN
  IF s.usuario<>actor->>'usuario' OR s.payload<>expected THEN RAISE EXCEPTION 'IDEMPOTENCIA_REUTILIZADA';END IF;
  IF s.estado<>'PENDIENTE_COORDINADOR' THEN
   IF s.evidencia IS DISTINCT FROM evidence THEN RAISE EXCEPTION 'IDEMPOTENCIA_REUTILIZADA';END IF;
   RETURN jsonb_build_object('status',s.estado,'duplicate',true);
  END IF;
 ELSE
  INSERT INTO sgp_lp_operacion.pdt_solicitudes(id,usuario,key,etapa,linea,payload) VALUES(request,actor->>'usuario',k,et,line_id,expected);
  INSERT INTO sgp_lp_operacion.pdt_bitacora(solicitud,usuario,accion,detalle) VALUES(request,actor->>'usuario','SOLICITADA',expected);
 END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(targets) LOOP
  IF jsonb_typeof(x) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) f WHERE f NOT IN('root','date','shift','quantity')) OR coalesce(x->>'quantity','') !~ '^[1-9][0-9]{0,8}$' OR coalesce(x->>'shift','') NOT IN('1','2') THEN RAISE EXCEPTION 'DESTINO_INVALIDO';END IF;
  root:=(x->>'root')::uuid;qty:=(x->>'quantity')::bigint;
  IF root IS NULL OR sgp_lp_operacion.raiz(root,k) IS DISTINCT FROM root OR NOT EXISTS(SELECT 1 FROM public.sgp_linea_plan_asignaciones a WHERE a.id=root AND a.key_produccion=k) THEN RAISE EXCEPTION 'RAIZ_NO_CORRESPONDE';END IF;
  IF NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes o JOIN sgp_lp_operacion.turnos t USING(etapa,linea,fecha,turno) WHERE o.key=k AND o.etapa=et AND o.linea=line_id AND o.parte=root AND o.fecha=(x->>'date')::date AND o.turno=(x->>'shift')::int AND t.estado='ABIERTO') THEN RAISE EXCEPTION 'DESTINO_NO_ABIERTO';END IF;
  IF qty>(SELECT a.cantidad-coalesce((SELECT sum(o.ejecutado) FROM sgp_lp_operacion.ordenes o WHERE o.key=k AND o.etapa=et AND o.parte=root),0) FROM public.sgp_linea_plan_asignaciones a WHERE a.id=root) THEN RAISE EXCEPTION 'SUPERA_CANTIDAD_DE_PARTE';END IF;
  total:=total+qty;
 END LOOP;
 IF (SELECT count(*) FROM jsonb_array_elements(targets))<>(SELECT count(DISTINCT value->>'root') FROM jsonb_array_elements(targets)) THEN RAISE EXCEPTION 'RAIZ_DUPLICADA';END IF;
 SELECT * INTO e FROM sgp_lp_operacion.pdt_evidencias WHERE id=evidence;
 IF NOT FOUND OR e.key<>k OR e.etapa<>et OR e.acreditado_en>clock_timestamp() OR nullif(btrim(reason),'') IS NULL THEN RETURN jsonb_build_object('status','PENDIENTE_COORDINADOR','credited',0);END IF;
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.pdt_solicitudes WHERE key=k AND etapa=et AND estado='REQUIERE_CONCILIACION') THEN RAISE EXCEPTION 'CADENA_REQUIERE_CONCILIACION';END IF;
 SELECT pe.* INTO prev FROM sgp_lp_operacion.pdt_solicitudes ps JOIN sgp_lp_operacion.pdt_evidencias pe ON pe.id=ps.evidencia JOIN sgp_lp_operacion.pdt_bitacora b ON b.solicitud=ps.id AND b.accion='ACREDITADA' WHERE ps.key=k AND ps.etapa=et AND ps.estado='ACREDITADA' ORDER BY b.id DESC LIMIT 1;
 IF FOUND THEN
  IF e.anterior IS DISTINCT FROM prev.id OR e.antes<>prev.despues THEN RAISE EXCEPTION 'CONSOLIDACION_NO_CONTINUA';END IF;
 ELSIF e.anterior IS NOT NULL THEN RAISE EXCEPTION 'CONSOLIDACION_NO_CONTINUA';END IF;
 IF total>e.antes-e.despues THEN RAISE EXCEPTION 'REPARTO_SUPERA_LIBERACION_NETA';END IF;
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.pdt_solicitudes WHERE evidencia=e.id AND id<>request) THEN RAISE EXCEPTION 'EVENTO_YA_ASOCIADO';END IF;
 UPDATE sgp_lp_operacion.pdt_solicitudes SET estado='ACREDITADA',evidencia=e.id,motivo=reason WHERE id=request;
 FOR x IN SELECT value FROM jsonb_array_elements(targets) LOOP
  relid:=md5(request::text||'|'||(x->>'root'))::uuid;
  INSERT INTO sgp_lp_operacion.liberaciones(id,key,etapa,ventanas,evidencia,consolidado) VALUES(relid,k,et,(x->>'quantity')::bigint,jsonb_build_object('contract','LP-PDT-LIBERACION/1','receipt',e.id,'event',e.evento,'version',e.version,'delivery',e.entrega,'history',e.historial),true);
  INSERT INTO sgp_lp_operacion.pdt_asociaciones VALUES(relid,request,(x->>'root')::uuid,(x->>'date')::date,(x->>'shift')::int);
 END LOOP;
 INSERT INTO sgp_lp_operacion.pdt_bitacora(solicitud,usuario,accion,detalle) VALUES(request,actor->>'usuario','ACREDITADA',jsonb_build_object('receipt',e.id,'allocated',total,'net',e.antes-e.despues,'reason',reason));
 RETURN jsonb_build_object('status','ACREDITADA','allocated',total,'unassigned',e.antes-e.despues-total);
END $$;
CREATE FUNCTION sgp_lp_operacion.pdt_guard_consumo() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.operacion='LIBERAR' AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.pdt_asociaciones a JOIN sgp_lp_operacion.pdt_solicitudes s ON s.id=a.solicitud WHERE a.liberacion=(NEW.payload->>'release_id')::uuid AND a.raiz=NEW.parte AND s.key=NEW.key AND s.etapa=NEW.etapa AND s.linea=NEW.linea AND a.fecha=NEW.fecha AND a.turno=NEW.turno AND s.estado='ACREDITADA' AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.pdt_solicitudes blocked WHERE blocked.key=s.key AND blocked.etapa=s.etapa AND blocked.estado='REQUIERE_CONCILIACION')) THEN RAISE EXCEPTION 'LIBERACION_SIN_ASOCIACION_VIGENTE';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER pdt_binding AFTER INSERT ON sgp_lp_operacion.auditoria FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.pdt_guard_consumo();
CREATE FUNCTION sgp_lp_operacion.pdt_anular(token text,request uuid,reason text) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE s sgp_lp_operacion.pdt_solicitudes%rowtype;actor jsonb;state text;BEGIN
 SELECT * INTO s FROM sgp_lp_operacion.pdt_solicitudes WHERE id=request;
 actor:=sgp_lp_operacion.sesion(token,s.etapa,s.key,s.linea);
 IF actor->>'rol' NOT IN('COORDINADOR','ADMINISTRADOR') OR nullif(btrim(reason),'') IS NULL THEN RAISE EXCEPTION 'ANULACION_NO_AUTORIZADA';END IF;
 PERFORM sgp_lp_operacion.admitir();PERFORM pg_advisory_xact_lock(hashtextextended(s.etapa||'|'||s.linea,184));PERFORM 1 FROM public.sgp_producciones WHERE key_produccion=s.key FOR UPDATE;
 SELECT * INTO s FROM sgp_lp_operacion.pdt_solicitudes WHERE id=request FOR UPDATE;
 actor:=sgp_lp_operacion.sesion(token,s.etapa,s.key,s.linea);
 IF actor->>'rol' NOT IN('COORDINADOR','ADMINISTRADOR') THEN RAISE EXCEPTION 'ANULACION_NO_AUTORIZADA';END IF;
 IF s.estado IN('ANULADA','REQUIERE_CONCILIACION') THEN RETURN jsonb_build_object('status',s.estado,'duplicate',true);END IF;
 state:=CASE WHEN EXISTS(SELECT 1 FROM sgp_lp_operacion.pdt_asociaciones a JOIN sgp_lp_operacion.liberaciones l ON l.id=a.liberacion WHERE a.solicitud=request AND l.consumido_por IS NOT NULL) THEN 'REQUIERE_CONCILIACION' ELSE 'ANULADA' END;
 UPDATE sgp_lp_operacion.pdt_solicitudes SET estado=state,motivo=reason WHERE id=request;
 INSERT INTO sgp_lp_operacion.pdt_bitacora(solicitud,usuario,accion,detalle) VALUES(request,actor->>'usuario',state,jsonb_build_object('reason',reason,'saleAdjusted',false));
 RETURN jsonb_build_object('status',state,'saleAdjusted',false);
END $$;
REVOKE ALL ON FUNCTION sgp_lp_operacion.pdt_asociar(text,uuid,text,text,jsonb,uuid,text),sgp_lp_operacion.pdt_anular(text,uuid,text),sgp_lp_operacion.pdt_guard_consumo() FROM PUBLIC,anon,authenticated;
COMMIT;

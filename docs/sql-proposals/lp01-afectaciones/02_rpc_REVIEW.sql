-- REVIEW ONLY. Requires 01_storage_DRAFT.sql and current LP role/temporal contracts.
-- New RPCs have no anon/authenticated grants. All new writes disabled by default.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $preflight$ BEGIN
 IF current_user<>(SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='sgp_lp_operacion.sesion(text,text,text,text)'::regprocedure)
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='sgp_lp_operacion.operaciones_rol(text,text)'::regprocedure) IS DISTINCT FROM '69274f528a2fed8001da535856649036'
 THEN RAISE EXCEPTION 'CONTRATO_ROLES_OWNER_INCOMPATIBLE';END IF;
END $preflight$;
CREATE TABLE sgp_lp_afectaciones.config (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),writes boolean NOT NULL DEFAULT false,
 physical boolean NOT NULL DEFAULT false,pdt_links boolean NOT NULL DEFAULT false
);
INSERT INTO sgp_lp_afectaciones.config(id) VALUES(true);
CREATE TABLE sgp_lp_afectaciones.cobertura (
 key text NOT NULL REFERENCES public.sgp_producciones(key_produccion),
 etapa text NOT NULL CHECK(etapa IN('ENSAMBLE','EMPAQUE')),
 primer_evento uuid NOT NULL REFERENCES sgp_lp_operacion.auditoria(id),
 evidencia text NOT NULL CHECK(length(btrim(evidencia))>0),
 acreditado_por text NOT NULL,acreditado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(key,etapa)
);
-- Private attestations only; no browser RPC writes this table. No PDT source adapter exists yet.
CREATE TABLE sgp_lp_afectaciones.pdt_fuentes_acreditadas (
 contrato text NOT NULL CHECK(contrato IN('LEGACY','V2','V4','MANUAL')),fuente_id uuid NOT NULL,
 key text NOT NULL REFERENCES public.sgp_producciones(key_produccion),
 origen text NOT NULL CHECK(origen IN('PICKING','ENSAMBLE','EMPAQUE')),
 evidencia text NOT NULL CHECK(length(btrim(evidencia))>0),vigente boolean NOT NULL DEFAULT true,
 PRIMARY KEY(contrato,fuente_id)
);
-- Reconciliation attestation binds to unchanged legacy snapshots; never sum/backfill them.
CREATE TABLE sgp_lp_afectaciones.conciliacion (
 key text NOT NULL REFERENCES public.sgp_producciones(key_produccion),etapa text NOT NULL,
 firma_legado text NOT NULL,evidencia text NOT NULL CHECK(length(btrim(evidencia))>0),
 PRIMARY KEY(key,etapa)
);
ALTER TABLE sgp_lp_afectaciones.conciliacion ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION sgp_lp_afectaciones.firma_legado(k text,et text) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT md5(coalesce(jsonb_agg(jsonb_build_array(x.parte,x.afectaciones,x.consolidado,x.validado) ORDER BY x.parte)::text,'[]'))
 FROM (SELECT DISTINCT ON(o.parte) o.parte,o.afectaciones,o.consolidado,o.validado FROM sgp_lp_operacion.ordenes o WHERE o.key=k AND o.etapa=et ORDER BY o.parte,o.fecha DESC,o.turno DESC) x;
$$;
ALTER TABLE sgp_lp_afectaciones.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_afectaciones.cobertura ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_afectaciones.pdt_fuentes_acreditadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_afectaciones.eventos ADD COLUMN antes jsonb;
CREATE TRIGGER cobertura_inmutable BEFORE UPDATE OR DELETE ON sgp_lp_afectaciones.cobertura FOR EACH ROW EXECUTE FUNCTION sgp_lp_afectaciones.inmutable();
CREATE FUNCTION sgp_lp_afectaciones.actor(token text,k text,et text,op text,d date DEFAULT NULL,t int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE s jsonb;ln text; BEGIN
 SELECT id_linea INTO ln FROM public.sgp_producciones WHERE key_produccion=k;
 s:=sgp_lp_operacion.sesion(token,et,k,ln);
 PERFORM sgp_lp_operacion.verificar_temporal(s->>'usuario',et,ln,d,t,k,op);
 RETURN s||jsonb_build_object('line',ln);
END $$;
CREATE FUNCTION sgp_lp_afectaciones.avances(k text,et text,ln text) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE ev jsonb;first_id uuid;valid boolean;opening jsonb;BEGIN
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'key',a.key,'line',a.linea,'stage',a.etapa,'assignment',a.parte,'date',a.fecha,'shift',a.turno,'quantity',a.payload->'quantity','before',a.antes->'ejecutado','at',a.creado_en,'user',a.usuario,'observation',a.payload->'observation') ORDER BY a.fecha,a.turno,a.creado_en,a.id),'[]'::jsonb) INTO ev
 FROM sgp_lp_operacion.auditoria a WHERE a.key=k AND a.etapa=et AND a.linea=ln AND a.operacion='EJECUTAR';
 SELECT a.id INTO first_id FROM sgp_lp_operacion.auditoria a WHERE a.key=k AND a.etapa=et AND a.linea=ln AND a.operacion='EJECUTAR' AND CASE WHEN coalesce(a.payload->>'quantity','')~'^[0-9]+$' THEN (a.payload->>'quantity')::numeric ELSE NULL END>0 ORDER BY a.fecha,a.turno,a.creado_en,a.id LIMIT 1;
 valid:=EXISTS(SELECT 1 FROM sgp_lp_afectaciones.cobertura c WHERE c.key=k AND c.etapa=et AND c.primer_evento=first_id)
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(ev) e WHERE e->>'assignment' IS NULL OR coalesce(e->>'quantity','')!~'^[0-9]+$' OR coalesce(e->>'before','')!~'^[0-9]+$')
 AND NOT EXISTS(SELECT 1 FROM (SELECT DISTINCT ON(a.parte) a.antes FROM sgp_lp_operacion.auditoria a WHERE a.key=k AND a.etapa=et AND a.linea=ln AND a.operacion='EJECUTAR' ORDER BY a.parte,a.fecha,a.turno,a.creado_en,a.id) x WHERE (x.antes->>'ejecutado')::numeric>0);
 IF valid THEN SELECT jsonb_build_object('date',a.fecha,'shift',a.turno,'eventId',a.id,'at',a.creado_en) INTO opening FROM sgp_lp_operacion.auditoria a WHERE a.id=first_id;END IF;
 RETURN jsonb_build_object('events',ev,'coverage',CASE WHEN valid THEN 'FROM_ORIGIN' ELSE 'UNKNOWN' END,'opening',opening,'openingReason',CASE WHEN opening IS NULL THEN 'No disponible: primer avance no acreditado' ELSE NULL END);
END $$;
CREATE FUNCTION public.sgp_lp_afectaciones_consultar_v1(p_token text,p_key text,p_stage text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;ln text;rev bigint;bal bigint;con jsonb;rep jsonb;hist jsonb;caps text[]:=ARRAY['READ'];st text;shared jsonb:='[]';progress jsonb:='{}';cfg sgp_lp_afectaciones.config%rowtype; BEGIN
 s:=sgp_lp_afectaciones.actor(p_token,p_key,p_stage,'LEER');ln:=s->>'line';
 PERFORM 1 FROM public.sgp_producciones WHERE key_produccion=p_key FOR SHARE;
 SELECT * INTO cfg FROM sgp_lp_afectaciones.config WHERE id;
 BEGIN bal:=sgp_lp_operacion.saldo(p_key,p_stage);EXCEPTION WHEN OTHERS THEN bal:=NULL;END;
 SELECT revision INTO rev FROM sgp_lp_afectaciones.ambitos WHERE key=p_key AND etapa=p_stage;
 SELECT jsonb_build_object('quantity',c.ventanas,'balance',c.saldo_export,'revision',c.revision) INTO con FROM sgp_lp_afectaciones.consolidados c WHERE c.key=p_key AND c.etapa=p_stage AND c.revision=rev AND c.saldo_export=bal AND EXISTS(SELECT 1 FROM sgp_lp_afectaciones.conciliacion z WHERE z.key=p_key AND z.etapa=p_stage AND z.firma_legado=sgp_lp_afectaciones.firma_legado(p_key,p_stage));
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'cause',r.causa,'quantity',r.ventanas,'solved',r.solucionadas,'confirmed',r.confirmadas,'originStage',r.etapa,'originDate',r.origen_fecha,'originShift',r.origen_turno,'createdAt',r.creado_en,'createdBy',r.creado_por,'sources',coalesce((SELECT jsonb_agg(jsonb_build_object('contract',f.contrato,'id',f.fuente_id)) FROM sgp_lp_afectaciones.fuentes f WHERE f.reporte=r.id),'[]')) ORDER BY r.creado_en,r.id),'[]') INTO rep FROM sgp_lp_afectaciones.reportes r WHERE r.key=p_key AND r.etapa=p_stage;
 FOREACH st IN ARRAY ARRAY['ENSAMBLE','EMPAQUE'] LOOP
  IF EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo() p WHERE p.usuario=s->>'usuario' AND p.key=p_key AND p.etapa=st) AND sgp_lp_operacion.puede_operar(s->>'usuario',st,'LEER') THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'reportId',e.reporte,'action',e.accion,'quantity',e.cantidad,'observation',e.observacion,'user',e.usuario,'stage',e.etapa,'date',e.fecha,'shift',e.turno,'at',e.registrado_en,'revision',e.revision) ORDER BY e.registrado_en,e.id),'[]') INTO hist FROM sgp_lp_afectaciones.eventos e WHERE e.key=p_key AND e.etapa=st;
   shared:=shared||hist;progress:=progress||jsonb_build_object(st,sgp_lp_afectaciones.avances(p_key,st,ln));
  END IF;
 END LOOP;
 SELECT coalesce(jsonb_agg(e ORDER BY e->>'at',e->>'id'),'[]') INTO shared FROM jsonb_array_elements(shared) e;
 IF cfg.writes AND (SELECT escrituras FROM sgp_lp_operacion.config WHERE id) THEN
  IF sgp_lp_operacion.puede_operar(s->>'usuario',p_stage,'AFECTAR') THEN
   caps:=caps||ARRAY['REPORT','SOLVE'];IF cfg.physical THEN caps:=caps||ARRAY['CONFIRM'];END IF;
  END IF;
  IF s->>'rol'='COORDINADOR' AND sgp_lp_operacion.puede_operar(s->>'usuario',p_stage,'VALIDAR') AND EXISTS(SELECT 1 FROM sgp_lp_afectaciones.conciliacion z WHERE z.key=p_key AND z.etapa=p_stage AND z.firma_legado=sgp_lp_afectaciones.firma_legado(p_key,p_stage)) THEN caps:=caps||ARRAY['VALIDATE'];END IF;
 END IF;
 RETURN jsonb_build_object('contract','LP-AFFECTATIONS-1','key',p_key,'line',ln,'stage',p_stage,'revision',coalesce(rev,0),'reports',rep,'events',shared,'progress',progress,'consolidated',con,'available',bal-(con->>'quantity')::bigint,'capabilities',to_jsonb(caps));
END $$;
CREATE FUNCTION public.sgp_lp_afectaciones_comando_v1(p_token text,p_key text,p_stage text,p_date date,p_shift int,p_cmd jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;ln text;uid text;op text:=p_cmd->>'action';rid uuid:=(p_cmd->>'id')::uuid;target uuid:=(p_cmd->>'reportId')::uuid;q bigint;rv bigint;rev bigint;bal bigint;lo bigint;hi numeric;result jsonb;prior sgp_lp_afectaciones.eventos%rowtype;r sgp_lp_afectaciones.reportes%rowtype;before_state jsonb;cfg sgp_lp_afectaciones.config%rowtype;request jsonb; BEGIN
 IF jsonb_typeof(p_cmd) IS DISTINCT FROM 'object' OR op IS NULL OR op NOT IN('CREATE','CORRECT','SOLVE','CONFIRM','VALIDATE') OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_cmd) f WHERE f NOT IN('id','action','reportId','quantity','revision','cause','observation','sourceContract','sourceId')) THEN RAISE EXCEPTION 'COMANDO_INVALIDO';END IF;
 IF rid IS NULL OR coalesce(p_cmd->>'quantity','')!~'^[0-9]{1,9}$' OR coalesce(p_cmd->>'revision','')!~'^[0-9]{1,16}$' OR p_date IS NULL OR p_shift IS NULL OR p_shift NOT IN(1,2) OR length(btrim(coalesce(p_cmd->>'observation',''))) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'CANTIDAD_CONTEXTO_OBSERVACION_INVALIDOS';END IF;
 q:=(p_cmd->>'quantity')::bigint;rv:=(p_cmd->>'revision')::bigint;
 s:=sgp_lp_afectaciones.actor(p_token,p_key,p_stage,CASE WHEN op='VALIDATE' THEN 'VALIDAR' ELSE 'AFECTAR' END,p_date,p_shift);ln:=s->>'line';uid:=s->>'usuario';
 IF op='VALIDATE' AND s->>'rol' IS DISTINCT FROM 'COORDINADOR' THEN RAISE EXCEPTION 'SOLO_COORDINADOR';END IF;
 PERFORM sgp_lp_operacion.admitir();SELECT * INTO cfg FROM sgp_lp_afectaciones.config WHERE id FOR SHARE;
 IF cfg.writes IS DISTINCT FROM true THEN RAISE EXCEPTION 'ESCRITURA_NO_HABILITADA';END IF;
 IF op='CONFIRM' AND cfg.physical IS DISTINCT FROM true THEN RAISE EXCEPTION 'CONFIRMACION_NO_HABILITADA';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,382));
 request:=jsonb_build_object('key',p_key,'stage',p_stage,'date',p_date,'shift',p_shift,'command',p_cmd);
 SELECT * INTO prior FROM sgp_lp_afectaciones.eventos WHERE id=rid;
 IF FOUND THEN
  IF prior.usuario<>uid OR prior.solicitud<>request THEN RAISE EXCEPTION 'IDEMPOTENCIA_REUTILIZADA';END IF;
  RETURN prior.respuesta||jsonb_build_object('duplicate',true);
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_stage||'|'||ln,184));
 PERFORM 1 FROM sgp_lp_operacion.turnos WHERE etapa=p_stage AND linea=ln AND fecha=p_date AND turno=p_shift AND estado='ABIERTO' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TURNO_NO_ABIERTO';END IF;
 PERFORM 1 FROM public.sgp_producciones WHERE key_produccion=p_key FOR UPDATE;
 s:=sgp_lp_afectaciones.actor(p_token,p_key,p_stage,CASE WHEN op='VALIDATE' THEN 'VALIDAR' ELSE 'AFECTAR' END,p_date,p_shift);
 INSERT INTO sgp_lp_afectaciones.ambitos(key,etapa) VALUES(p_key,p_stage) ON CONFLICT DO NOTHING;
 SELECT revision INTO rev FROM sgp_lp_afectaciones.ambitos WHERE key=p_key AND etapa=p_stage FOR UPDATE;
 IF rv<>rev THEN RAISE EXCEPTION 'REVISION_DESACTUALIZADA';END IF;
 bal:=sgp_lp_operacion.saldo(p_key,p_stage);
 IF op='CREATE' THEN
  IF p_cmd->>'cause' IS NULL OR p_cmd->>'cause' NOT IN('NC_AL','NC_V','TECNO','NOVEDAD') OR q=0 OR q>bal OR target IS NOT NULL THEN RAISE EXCEPTION 'REPORTE_INVALIDO';END IF;
  target:=rid;
  INSERT INTO sgp_lp_afectaciones.reportes(id,key,etapa,causa,ventanas,origen_fecha,origen_turno,creado_por) VALUES(rid,p_key,p_stage,p_cmd->>'cause',q,p_date,p_shift,uid);
 ELSIF op='VALIDATE' THEN
  IF NOT EXISTS(SELECT 1 FROM sgp_lp_afectaciones.conciliacion z WHERE z.key=p_key AND z.etapa=p_stage AND z.firma_legado=sgp_lp_afectaciones.firma_legado(p_key,p_stage)) THEN RAISE EXCEPTION 'LEGADO_SIN_CONCILIAR';END IF;
  IF target IS NOT NULL THEN RAISE EXCEPTION 'REPORTE_NO_ADMITIDO';END IF;
  SELECT coalesce(max(ventanas-confirmadas),0),least(bal,coalesce(sum(ventanas-confirmadas),0)) INTO lo,hi FROM sgp_lp_afectaciones.reportes WHERE key=p_key AND etapa=p_stage;
  IF q<lo OR q>hi THEN RAISE EXCEPTION 'CONSOLIDADO_INCONSISTENTE';END IF;
 ELSE
  SELECT * INTO r FROM sgp_lp_afectaciones.reportes WHERE id=target AND key=p_key AND etapa=p_stage FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REPORTE_NO_ENCONTRADO';END IF;before_state:=to_jsonb(r);
  IF op='CORRECT' THEN
   IF q<r.solucionadas OR q<r.confirmadas OR q>bal THEN RAISE EXCEPTION 'CORRECCION_INCONSISTENTE';END IF;
   UPDATE sgp_lp_afectaciones.reportes SET ventanas=q WHERE id=target;
  ELSIF op='SOLVE' THEN
   IF q=0 OR q+r.solucionadas>r.ventanas THEN RAISE EXCEPTION 'SOLUCION_SUPERA_REPORTE';END IF;
   UPDATE sgp_lp_afectaciones.reportes SET solucionadas=solucionadas+q WHERE id=target;
  ELSIF op='CONFIRM' THEN
   IF q=0 OR q+r.confirmadas>r.solucionadas THEN RAISE EXCEPTION 'CONFIRMACION_SIN_SOLUCION';END IF;
   UPDATE sgp_lp_afectaciones.reportes SET confirmadas=confirmadas+q WHERE id=target;
  END IF;
 END IF;
 IF op='CREATE' AND p_cmd->>'cause'='NC_AL' AND (NOT(p_cmd ? 'sourceId') OR NOT(p_cmd ? 'sourceContract')) THEN RAISE EXCEPTION 'NC_AL_REQUIERE_PDT';END IF;
 IF p_cmd ? 'sourceId' OR p_cmd ? 'sourceContract' THEN
  IF cfg.pdt_links IS DISTINCT FROM true OR op<>'CREATE' OR p_cmd->>'cause'<>'NC_AL' THEN RAISE EXCEPTION 'VINCULO_PDT_NO_HABILITADO';END IF;
  PERFORM 1 FROM sgp_lp_afectaciones.pdt_fuentes_acreditadas f WHERE f.contrato=p_cmd->>'sourceContract' AND f.fuente_id=(p_cmd->>'sourceId')::uuid AND f.key=p_key AND f.origen IN('PICKING',p_stage) AND f.vigente FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FUENTE_PDT_NO_ACREDITADA';END IF;
  INSERT INTO sgp_lp_afectaciones.fuentes VALUES(p_cmd->>'sourceContract',(p_cmd->>'sourceId')::uuid,target);
 END IF;
 UPDATE sgp_lp_afectaciones.ambitos SET revision=revision+1 WHERE key=p_key AND etapa=p_stage;
 DELETE FROM sgp_lp_afectaciones.consolidados WHERE key=p_key AND etapa=p_stage;
 result:=jsonb_build_object('contract','LP-AFFECTATIONS-COMMAND-1','id',rid,'revision',rev+1,'reportId',target,'duplicate',false);
 INSERT INTO sgp_lp_afectaciones.eventos(id,key,etapa,reporte,revision,accion,cantidad,observacion,usuario,fecha,turno,solicitud,respuesta,antes) VALUES(rid,p_key,p_stage,target,rev+1,op,q,btrim(p_cmd->>'observation'),uid,p_date,p_shift,request,result,before_state);
 IF op='VALIDATE' THEN INSERT INTO sgp_lp_afectaciones.consolidados VALUES(p_key,p_stage,rev+1,q,bal,rid);END IF;
 RETURN result;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_lp_afectaciones FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_lp_afectaciones FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sgp_lp_afectaciones_consultar_v1(text,text,text),public.sgp_lp_afectaciones_comando_v1(text,text,text,date,int,jsonb) FROM PUBLIC,anon,authenticated;
COMMIT;

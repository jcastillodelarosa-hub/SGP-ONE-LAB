-- PROPOSED / DISABLED. No public endpoint, GRANT, existing function replacement or activation.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
DO $$BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'PLAN_OWNER_REQUIRED';END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sgp_producciones' AND column_name='excluida_export' AND data_type='boolean' AND is_nullable='NO') THEN RAISE EXCEPTION 'PLAN_EXPORT_APPROVAL_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM (VALUES
 ('public.sgp_linea_plan_programar(text,text,date,integer,integer,integer)','248f9feb45f1c2d260896aa95c3e1569'),
 ('public.sgp_linea_plan_mover(text,uuid,date,integer,integer,integer)','52752c4887c68f8336e38c08a58cc38b'),
 ('sgp_lp_operacion.sesion(text,text,text,text)','3416a2f6e5640577a4a07c554e26c55e'),
 ('sgp_lp_operacion.verificar_temporal(text,text,text,date,integer,text,text)','c39ce5692affad2b1edc4a7dbf66faf2')
 ) pin(sig,hash) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(pin.sig) WHERE md5(p.prosrc) IS DISTINCT FROM pin.hash) THEN RAISE EXCEPTION 'PLAN_SOURCE_CHANGED'; END IF;
 IF to_regclass('sgp_lp_operacion.plan_control') IS NOT NULL THEN RAISE EXCEPTION 'PLAN_ALREADY_INSTALLED'; END IF;
END $$;
CREATE TABLE sgp_lp_operacion.plan_control(id boolean PRIMARY KEY DEFAULT true CHECK(id),enabled boolean NOT NULL DEFAULT false,generation bigint NOT NULL DEFAULT 0);
INSERT INTO sgp_lp_operacion.plan_control DEFAULT VALUES;
CREATE TABLE sgp_lp_operacion.plan_versiones(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),fecha date NOT NULL,turno integer NOT NULL CHECK(turno IN(1,2)),generation bigint NOT NULL,version bigint NOT NULL,
 anterior uuid REFERENCES sgp_lp_operacion.plan_versiones(id),baseline uuid REFERENCES sgp_lp_operacion.plan_versiones(id),
 fuente jsonb NOT NULL,fingerprint text NOT NULL,operacion text NOT NULL,usuario text,motivo text,request_id uuid,creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(fecha,turno,generation,version));
CREATE TABLE sgp_lp_operacion.plan_cabezas(fecha date NOT NULL,turno integer NOT NULL CHECK(turno IN(1,2)),generation bigint NOT NULL,version_id uuid NOT NULL REFERENCES sgp_lp_operacion.plan_versiones(id),dirty boolean NOT NULL DEFAULT false,PRIMARY KEY(fecha,turno));
CREATE TABLE sgp_lp_operacion.plan_contexto(tx bigint PRIMARY KEY,request_id uuid NOT NULL UNIQUE,usuario text NOT NULL,operacion text NOT NULL,motivo text NOT NULL,payload jsonb NOT NULL,generation bigint NOT NULL,periodos jsonb NOT NULL);
CREATE TABLE sgp_lp_operacion.plan_recibos(request_id uuid PRIMARY KEY,usuario text NOT NULL,operacion text NOT NULL,motivo text NOT NULL,payload jsonb NOT NULL,resultado jsonb NOT NULL,creado_en timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE sgp_lp_operacion.plan_mutaciones(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,generation bigint NOT NULL,request_id uuid,acreditada boolean NOT NULL,source text NOT NULL,operacion text NOT NULL,antes jsonb,despues jsonb,creado_en timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE sgp_lp_operacion.plan_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_operacion.plan_versiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_operacion.plan_cabezas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_operacion.plan_contexto ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_operacion.plan_recibos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_operacion.plan_mutaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sgp_lp_operacion.plan_control,sgp_lp_operacion.plan_versiones,sgp_lp_operacion.plan_cabezas,sgp_lp_operacion.plan_contexto,sgp_lp_operacion.plan_recibos,sgp_lp_operacion.plan_mutaciones FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE sgp_lp_operacion.plan_mutaciones_id_seq FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION sgp_lp_operacion.plan_generation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN
 IF NEW.enabled IS DISTINCT FROM OLD.enabled THEN NEW.generation:=OLD.generation+1;
 ELSIF NEW.generation IS DISTINCT FROM OLD.generation THEN RAISE EXCEPTION 'PLAN_GENERATION_MANAGED'; END IF;RETURN NEW;
END $$;
CREATE TRIGGER plan_generation BEFORE UPDATE ON sgp_lp_operacion.plan_control FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.plan_generation();
CREATE FUNCTION sgp_lp_operacion.plan_inmutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN RAISE EXCEPTION 'PLAN_IMMUTABLE_HISTORY';END $$;
CREATE TRIGGER plan_versiones_inmutables BEFORE UPDATE OR DELETE ON sgp_lp_operacion.plan_versiones FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.plan_inmutable();
CREATE TRIGGER plan_mutaciones_inmutables BEFORE UPDATE OR DELETE ON sgp_lp_operacion.plan_mutaciones FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.plan_inmutable();
CREATE TRIGGER plan_recibos_inmutables BEFORE UPDATE OR DELETE ON sgp_lp_operacion.plan_recibos FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.plan_inmutable();

-- Private source: existing planner means ENSAMBLE only, never inferred for EMPAQUE.
-- All rows/flags remain in the fingerprint; targets below omit CANCELADA/excluded only.
CREATE FUNCTION sgp_lp_operacion.plan_fuente(d date,t integer) RETURNS jsonb LANGUAGE sql SET search_path='' SET timezone='UTC' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('assignment',to_jsonb(a),'excluded',p.excluida_export,'line',p.id_linea) ORDER BY a.key_produccion,a.id),'[]'::jsonb)
 FROM public.sgp_linea_plan_asignaciones a JOIN public.sgp_producciones p USING(key_produccion)
 WHERE p.id_linea='PANELES_2' AND a.fecha=d AND a.turno=t
$$;
CREATE FUNCTION sgp_lp_operacion.plan_huella(v jsonb) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$SELECT encode(sha256(convert_to(v::text,'UTF8')),'hex')$$;
CREATE FUNCTION sgp_lp_operacion.plan_periodos(v jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(x ORDER BY x->>'date',x->>'shift'),'[]'::jsonb) FROM (SELECT DISTINCT x FROM jsonb_array_elements(v) x) q
$$;

-- A baseline is an observation NOW, not a reconstructed original program.
-- Must be called under the same source write lock as the tracked mutation.
CREATE FUNCTION sgp_lp_operacion.plan_base(d date,t integer,g bigint) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE h sgp_lp_operacion.plan_cabezas%rowtype;f jsonb;v uuid;
BEGIN
 IF d IS NULL OR t IS NULL OR t NOT IN(1,2) THEN RAISE EXCEPTION 'PLAN_PERIOD_INVALID'; END IF;
 SELECT * INTO h FROM sgp_lp_operacion.plan_cabezas WHERE fecha=d AND turno=t;
 f:=sgp_lp_operacion.plan_fuente(d,t);
 IF FOUND AND h.generation=g THEN
  IF h.dirty OR (SELECT fingerprint FROM sgp_lp_operacion.plan_versiones WHERE id=h.version_id) IS DISTINCT FROM sgp_lp_operacion.plan_huella(f) THEN RAISE EXCEPTION 'PLAN_UNTRACKED_CHANGE'; END IF;
  RETURN;
 END IF;
 INSERT INTO sgp_lp_operacion.plan_versiones(fecha,turno,generation,version,fuente,fingerprint,operacion)
 VALUES(d,t,g,0,f,sgp_lp_operacion.plan_huella(f),'OBSERVED_AT_ENROLLMENT') RETURNING id INTO v;
 INSERT INTO sgp_lp_operacion.plan_cabezas(fecha,turno,generation,version_id) VALUES(d,t,g,v)
 ON CONFLICT(fecha,turno) DO UPDATE SET generation=g,version_id=v,dirty=false;
END $$;

-- Actor is supplied ONLY by a trusted, already authenticated server writer.
-- No technical client role can execute this helper or write its context table.
CREATE FUNCTION sgp_lp_operacion.plan_iniciar_cambio(u text,op text,m text,rid uuid,periodos jsonb,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE cfg sgp_lp_operacion.plan_control%rowtype;prior sgp_lp_operacion.plan_recibos%rowtype;p jsonb;
BEGIN
 SELECT * INTO cfg FROM sgp_lp_operacion.plan_control WHERE id FOR SHARE;
 IF cfg.enabled IS DISTINCT FROM true THEN RAISE EXCEPTION 'PLAN_DISABLED'; END IF;
 IF nullif(btrim(u),'') IS NULL OR nullif(btrim(m),'') IS NULL OR length(m)>2000 OR rid IS NULL OR op IS NULL OR op NOT IN('PROGRAMAR','MOVER','INCORPORAR','ACREDITAR_BASE') OR payload IS NULL THEN RAISE EXCEPTION 'PLAN_CHANGE_INVALID'; END IF;
 IF jsonb_typeof(periodos) IS DISTINCT FROM 'array' OR jsonb_array_length(periodos) NOT BETWEEN 1 AND 2 THEN RAISE EXCEPTION 'PLAN_SCOPE_INVALID'; END IF;
 FOR p IN SELECT * FROM jsonb_array_elements(periodos) LOOP
  IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR p->>'date' IS NULL OR p->>'shift' IS NULL OR p->>'shift' NOT IN('1','2') OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN('date','shift')) THEN RAISE EXCEPTION 'PLAN_SCOPE_INVALID'; END IF;
 END LOOP;
 PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,718));
 SELECT * INTO prior FROM sgp_lp_operacion.plan_recibos WHERE request_id=rid;
 IF FOUND THEN
  IF prior.usuario<>u OR prior.operacion<>op OR prior.motivo<>m OR prior.payload<>payload THEN RAISE EXCEPTION 'PLAN_REQUEST_REUSED'; END IF;
  RETURN prior.resultado;
 END IF;
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.plan_contexto WHERE tx=txid_current()) THEN RAISE EXCEPTION 'PLAN_NESTED_CHANGE'; END IF;
 BEGIN LOCK TABLE public.sgp_linea_plan_asignaciones IN SHARE ROW EXCLUSIVE MODE NOWAIT;
 EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='PLAN_SOURCE_BUSY';END;
 periodos:=sgp_lp_operacion.plan_periodos(periodos);
 FOR p IN SELECT * FROM jsonb_array_elements(periodos) LOOP PERFORM sgp_lp_operacion.plan_base((p->>'date')::date,(p->>'shift')::integer,cfg.generation);END LOOP;
 INSERT INTO sgp_lp_operacion.plan_contexto VALUES(txid_current(),rid,u,op,m,payload,cfg.generation,periodos);
 RETURN NULL;
END $$;

-- Never guess an actor/reason for legacy changes. Even change+undo poisons the head.
CREATE FUNCTION sgp_lp_operacion.plan_observar_mutacion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cfg sgp_lp_operacion.plan_control%rowtype;c sgp_lp_operacion.plan_contexto%rowtype;b jsonb;a jsonb;p jsonb;periodos jsonb:='[]';ok boolean;
BEGIN
 SELECT * INTO cfg FROM sgp_lp_operacion.plan_control WHERE id;
 IF cfg.enabled IS DISTINCT FROM true THEN RETURN NULL; END IF;
 IF TG_OP<>'INSERT' THEN b:=to_jsonb(OLD);END IF;
 IF TG_OP<>'DELETE' THEN a:=to_jsonb(NEW);END IF;
 IF a IS NOT DISTINCT FROM b THEN RETURN NULL;END IF;
 FOR p IN SELECT x FROM jsonb_array_elements(jsonb_build_array(b,a)) x WHERE jsonb_typeof(x)='object' LOOP
  IF EXISTS(SELECT 1 FROM public.sgp_producciones WHERE key_produccion=p->>'key_produccion' AND id_linea='PANELES_2') THEN periodos:=periodos||jsonb_build_array(jsonb_build_object('date',p->>'fecha','shift',(p->>'turno')::integer));END IF;
 END LOOP;
 periodos:=sgp_lp_operacion.plan_periodos(periodos);IF jsonb_array_length(periodos)=0 THEN RETURN NULL;END IF;
 SELECT * INTO c FROM sgp_lp_operacion.plan_contexto WHERE tx=txid_current();
 ok:=FOUND AND c.generation=cfg.generation AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(periodos) period WHERE NOT c.periodos @> jsonb_build_array(period));
 INSERT INTO sgp_lp_operacion.plan_mutaciones(generation,request_id,acreditada,source,operacion,antes,despues) VALUES(cfg.generation,CASE WHEN ok THEN c.request_id END,ok,'ASSIGNMENTS',TG_OP,b,a);
 IF NOT ok THEN
  FOR p IN SELECT * FROM jsonb_array_elements(periodos) LOOP UPDATE sgp_lp_operacion.plan_cabezas SET dirty=true WHERE fecha=(p->>'date')::date AND turno=(p->>'shift')::integer AND generation=cfg.generation;END LOOP;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER lp_plan_observar AFTER INSERT OR UPDATE OR DELETE ON public.sgp_linea_plan_asignaciones FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.plan_observar_mutacion();

-- Export approval or line reassignment changes the active target universe too.
-- Preserve its evidence without claiming that a planner actor/motive approved it.
CREATE FUNCTION sgp_lp_operacion.plan_observar_catalogo() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE g bigint;
BEGIN
 IF OLD.excluida_export IS NOT DISTINCT FROM NEW.excluida_export AND OLD.id_linea IS NOT DISTINCT FROM NEW.id_linea THEN RETURN NULL;END IF;
 IF OLD.id_linea IS DISTINCT FROM 'PANELES_2' AND NEW.id_linea IS DISTINCT FROM 'PANELES_2' THEN RETURN NULL;END IF;
 SELECT generation INTO g FROM sgp_lp_operacion.plan_control WHERE id AND enabled;IF NOT FOUND THEN RETURN NULL;END IF;
 INSERT INTO sgp_lp_operacion.plan_mutaciones(generation,acreditada,source,operacion,antes,despues) VALUES(g,false,'CATALOG','UPDATE',to_jsonb(OLD),to_jsonb(NEW));
 UPDATE sgp_lp_operacion.plan_cabezas h SET dirty=true WHERE h.generation=g AND EXISTS(SELECT 1 FROM public.sgp_linea_plan_asignaciones a WHERE a.key_produccion=NEW.key_produccion AND a.fecha=h.fecha AND a.turno=h.turno);
 RETURN NULL;
END $$;
CREATE TRIGGER lp_plan_catalogo AFTER UPDATE OF excluida_export,id_linea ON public.sgp_producciones FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.plan_observar_catalogo();

CREATE FUNCTION sgp_lp_operacion.plan_finalizar_cambio(resultado jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE c sgp_lp_operacion.plan_contexto%rowtype;p jsonb;h sgp_lp_operacion.plan_cabezas%rowtype;old sgp_lp_operacion.plan_versiones%rowtype;f jsonb;v uuid;versions jsonb:='[]';outcome jsonb;
BEGIN
 SELECT * INTO c FROM sgp_lp_operacion.plan_contexto WHERE tx=txid_current();IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_CONTEXT_MISSING';END IF;
 FOR p IN SELECT * FROM jsonb_array_elements(c.periodos) LOOP
  SELECT * INTO h FROM sgp_lp_operacion.plan_cabezas WHERE fecha=(p->>'date')::date AND turno=(p->>'shift')::integer FOR UPDATE;
  IF h.dirty OR h.generation IS DISTINCT FROM c.generation THEN RAISE EXCEPTION 'PLAN_UNTRACKED_CHANGE';END IF;
  SELECT * INTO old FROM sgp_lp_operacion.plan_versiones WHERE id=h.version_id;f:=sgp_lp_operacion.plan_fuente(h.fecha,h.turno);v:=old.id;
  IF f IS DISTINCT FROM old.fuente THEN
   INSERT INTO sgp_lp_operacion.plan_versiones(fecha,turno,generation,version,anterior,baseline,fuente,fingerprint,operacion,usuario,motivo,request_id)
   VALUES(h.fecha,h.turno,c.generation,old.version+1,old.id,coalesce(old.baseline,old.id),f,sgp_lp_operacion.plan_huella(f),c.operacion,c.usuario,c.motivo,c.request_id) RETURNING id INTO v;
   UPDATE sgp_lp_operacion.plan_cabezas SET version_id=v WHERE fecha=h.fecha AND turno=h.turno;
  END IF;
  versions:=versions||jsonb_build_array(jsonb_build_object('date',h.fecha,'shift',h.turno,'versionId',v));
 END LOOP;
 outcome:=jsonb_build_object('requestId',c.request_id,'result',resultado,'planVersions',versions);
 INSERT INTO sgp_lp_operacion.plan_recibos VALUES(c.request_id,c.usuario,c.operacion,c.motivo,c.payload,outcome,clock_timestamp());
 DELETE FROM sgp_lp_operacion.plan_contexto WHERE tx=txid_current();RETURN outcome;
END $$;
-- A writer cannot commit a half-finished certification context.
CREATE FUNCTION sgp_lp_operacion.plan_contexto_completo() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.plan_contexto WHERE tx=NEW.tx) THEN RAISE EXCEPTION 'PLAN_UNFINISHED_CHANGE';END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER plan_contexto_completo AFTER INSERT ON sgp_lp_operacion.plan_contexto DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.plan_contexto_completo();

-- Private adapters prepare the minimum new input: reason + durable request ID.
-- No endpoint is installed/granted. Existing planner signatures/bodies stay untouched.
CREATE FUNCTION sgp_lp_operacion.plan_programar(p_token text,k text,d date,t integer,q integer,priority integer,m text,rid uuid) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE u text;prior jsonb;assigned uuid;payload jsonb;auth jsonb;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['COORDINADOR','ADMINISTRADOR']);
 auth:=sgp_lp_operacion.sesion(p_token,'ENSAMBLE',k,'PANELES_2');
 IF auth->>'usuario' IS DISTINCT FROM u THEN RAISE EXCEPTION 'PLAN_SESSION_CHANGED';END IF;
 PERFORM sgp_lp_operacion.verificar_temporal(u,'ENSAMBLE','PANELES_2',d,t,k,'LEER');
 PERFORM 1 FROM public.sgp_producciones WHERE key_produccion=k AND id_linea='PANELES_2' AND NOT excluida_export FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_PRODUCTION_UNAVAILABLE';END IF;
 payload:=jsonb_build_object('key',k,'date',d,'shift',t,'quantity',q,'priority',priority);
 prior:=sgp_lp_operacion.plan_iniciar_cambio(u,'PROGRAMAR',m,rid,jsonb_build_array(jsonb_build_object('date',d,'shift',t)),payload);IF prior IS NOT NULL THEN RETURN prior;END IF;
 assigned:=public.sgp_linea_plan_programar(p_token,k,d,t,q,priority);
 RETURN sgp_lp_operacion.plan_finalizar_cambio(jsonb_build_object('assignmentId',assigned));
END $$;
CREATE FUNCTION sgp_lp_operacion.plan_mover(p_token text,assignment uuid,d date,t integer,q integer,priority integer,m text,rid uuid) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE u text;a public.sgp_linea_plan_asignaciones%rowtype;prior jsonb;assigned uuid;payload jsonb;auth jsonb;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['COORDINADOR','ADMINISTRADOR']);
 SELECT * INTO a FROM public.sgp_linea_plan_asignaciones WHERE id=assignment FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_ASSIGNMENT_MISSING';END IF;
 auth:=sgp_lp_operacion.sesion(p_token,'ENSAMBLE',a.key_produccion,'PANELES_2');
 IF auth->>'usuario' IS DISTINCT FROM u THEN RAISE EXCEPTION 'PLAN_SESSION_CHANGED';END IF;
 PERFORM sgp_lp_operacion.verificar_temporal(u,'ENSAMBLE','PANELES_2',a.fecha,a.turno,a.key_produccion,'LEER');
 PERFORM sgp_lp_operacion.verificar_temporal(u,'ENSAMBLE','PANELES_2',d,t,a.key_produccion,'LEER');
 PERFORM 1 FROM public.sgp_producciones WHERE key_produccion=a.key_produccion AND id_linea='PANELES_2' AND NOT excluida_export FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_PRODUCTION_UNAVAILABLE';END IF;
 payload:=jsonb_build_object('assignmentId',assignment,'date',d,'shift',t,'quantity',q,'priority',priority);
 prior:=sgp_lp_operacion.plan_iniciar_cambio(u,'MOVER',m,rid,jsonb_build_array(jsonb_build_object('date',a.fecha,'shift',a.turno),jsonb_build_object('date',d,'shift',t)),payload);IF prior IS NOT NULL THEN RETURN prior;END IF;
 assigned:=public.sgp_linea_plan_mover(p_token,assignment,d,t,q,priority);
 RETURN sgp_lp_operacion.plan_finalizar_cambio(jsonb_build_object('assignmentId',assigned));
END $$;

-- Trusted close calls this in its own transaction AFTER scope reauthorization.
-- Source locks live through the close INSERT/COMMIT, not merely through this call.
CREATE FUNCTION sgp_lp_operacion.plan_snapshot(d date,t integer) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE cfg sgp_lp_operacion.plan_control%rowtype;h sgp_lp_operacion.plan_cabezas%rowtype;v sgp_lp_operacion.plan_versiones%rowtype;b sgp_lp_operacion.plan_versiones%rowtype;f jsonb;targets jsonb;hist jsonb;
BEGIN
 SELECT * INTO cfg FROM sgp_lp_operacion.plan_control WHERE id FOR SHARE;
 IF cfg.enabled IS DISTINCT FROM true THEN RAISE EXCEPTION 'PLAN_DISABLED';END IF;
 BEGIN LOCK TABLE public.sgp_producciones,public.sgp_linea_plan_asignaciones IN SHARE MODE NOWAIT;
 EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='PLAN_SOURCE_BUSY';END;
 SELECT * INTO h FROM sgp_lp_operacion.plan_cabezas WHERE fecha=d AND turno=t;
 IF NOT FOUND OR h.generation<>cfg.generation THEN RAISE EXCEPTION 'PLAN_ENROLLMENT_REQUIRED';END IF;
 IF h.dirty THEN RAISE EXCEPTION 'PLAN_UNTRACKED_CHANGE';END IF;
 SELECT * INTO v FROM sgp_lp_operacion.plan_versiones WHERE id=h.version_id;f:=sgp_lp_operacion.plan_fuente(d,t);
 IF sgp_lp_operacion.plan_huella(f) IS DISTINCT FROM v.fingerprint THEN RAISE EXCEPTION 'PLAN_SOURCE_CHANGED';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(f) x WHERE x->'assignment'->>'cantidad' IS NULL OR x->'assignment'->>'estado' IS NULL OR (x->'assignment'->>'cantidad')::numeric<=0 OR (x->'assignment'->>'cantidad')::numeric<>trunc((x->'assignment'->>'cantidad')::numeric)) THEN RAISE EXCEPTION 'PLAN_QUANTITY_INVALID';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',key,'quantity',quantity,'assignmentIds',ids) ORDER BY key),'[]'::jsonb) INTO targets FROM (
 SELECT x->'assignment'->>'key_produccion' AS key,sum((x->'assignment'->>'cantidad')::numeric) quantity,jsonb_agg(x->'assignment'->>'id' ORDER BY x->'assignment'->>'id') ids
 FROM jsonb_array_elements(f) x WHERE x->>'excluded'='false' AND x->'assignment'->>'estado'<>'CANCELADA' GROUP BY x->'assignment'->>'key_produccion') q;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(targets) x WHERE (x->>'quantity')::numeric>9007199254740991) THEN RAISE EXCEPTION 'PLAN_QUANTITY_OVERFLOW';END IF;
 SELECT * INTO b FROM sgp_lp_operacion.plan_versiones WHERE id=coalesce(v.baseline,v.id);
 SELECT coalesce(jsonb_agg(jsonb_build_object('versionId',id,'version',version,'previousVersionId',anterior,'operation',operacion,'actor',usuario,'motive',motivo,'at',creado_en,'requestId',request_id,'fingerprint',fingerprint) ORDER BY version),'[]'::jsonb) INTO hist FROM sgp_lp_operacion.plan_versiones WHERE fecha=d AND turno=t AND generation=cfg.generation AND version<=v.version;
 RETURN jsonb_build_object('contract','LP-ENSAMBLE-PLAN-1','status','ACCREDITED_CURRENT','source','PROGRAMACION_LINEA','stage','ENSAMBLE','line','PANELES_2','date',d,'shift',t,'generation',cfg.generation,'versionId',v.id,'version',v.version,'capturedAt',v.creado_en,'fingerprint',v.fingerprint,'sourceRows',v.fuente,'targets',targets,'baseline',jsonb_build_object('versionId',b.id,'kind','OBSERVED_AT_ENROLLMENT','capturedAt',b.creado_en,'sourceRows',b.fuente,'historyBefore','UNKNOWN'),'historyComplete',false,'historySinceEnrollment','COMPLETE','changes',hist);
END $$;

-- p_realized must be the close's already accredited Export projection, never a browser proof.
CREATE FUNCTION sgp_lp_operacion.plan_comparar(d date,t integer,p_realized jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE plan jsonb;rows jsonb;complete boolean;
BEGIN
 plan:=sgp_lp_operacion.plan_snapshot(d,t);
 IF jsonb_typeof(p_realized) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'PLAN_REALIZED_INVALID';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_realized) x WHERE jsonb_typeof(x) IS DISTINCT FROM 'object' OR nullif(x->>'key','') IS NULL
  OR NOT x ? 'realized' OR (jsonb_typeof(x->'realized') NOT IN('number','null'))
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) k WHERE k NOT IN('key','realized')))
  OR (SELECT count(DISTINCT x->>'key') FROM jsonb_array_elements(p_realized) x)<>jsonb_array_length(p_realized) THEN RAISE EXCEPTION 'PLAN_REALIZED_INVALID';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_realized) x WHERE jsonb_typeof(x->'realized')='number' AND ((x->>'realized')::numeric<0 OR (x->>'realized')::numeric>9007199254740991 OR (x->>'realized')::numeric<>trunc((x->>'realized')::numeric))) THEN RAISE EXCEPTION 'PLAN_REALIZED_INVALID';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_realized) x WHERE NOT EXISTS(SELECT 1 FROM public.sgp_producciones p WHERE p.key_produccion=x->>'key' AND p.id_linea='PANELES_2' AND NOT p.excluida_export)) THEN RAISE EXCEPTION 'PLAN_REALIZED_SCOPE';END IF;
 WITH targets AS (SELECT x->>'key' key,(x->>'quantity')::numeric quantity FROM jsonb_array_elements(plan->'targets') x),
 actual AS (SELECT x->>'key' key,(x->>'realized')::numeric quantity FROM jsonb_array_elements(p_realized) x),
 universe AS (SELECT coalesce(a.key,b.key) key,coalesce(a.quantity,0) target,b.quantity actual FROM targets a FULL JOIN actual b USING(key))
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',key,'plan',target,'planStatus','ACCREDITED_CURRENT','realized',actual,'difference',actual-target,'pendingAgainstPlan',CASE WHEN actual IS NULL THEN NULL ELSE greatest(target-actual,0) END) ORDER BY key),'[]'::jsonb),coalesce(bool_and(actual IS NOT NULL),false)
 INTO rows,complete FROM universe;
 RETURN jsonb_build_object('contract','LP-ENSAMBLE-PLAN-COMPARISON-1','planSnapshot',plan,'planComparison','ACCREDITED_CURRENT','comparisonComplete',complete,'rows',rows);
END $$;

-- No privileges added: new internals unavailable to all application roles.
DO $$DECLARE p record;BEGIN FOR p IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE pronamespace='sgp_lp_operacion'::regnamespace AND proname IN('plan_generation','plan_inmutable','plan_fuente','plan_huella','plan_periodos','plan_base','plan_iniciar_cambio','plan_observar_mutacion','plan_observar_catalogo','plan_finalizar_cambio','plan_contexto_completo','plan_programar','plan_mover','plan_snapshot','plan_comparar') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',p.sig);END LOOP;END $$;
COMMIT;

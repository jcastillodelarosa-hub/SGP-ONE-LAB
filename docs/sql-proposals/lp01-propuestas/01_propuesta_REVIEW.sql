-- Isolated B12 proposal. NOT installed/authorized for production. No grants here.
BEGIN;
CREATE SCHEMA sgp_lp_propuestas;
REVOKE ALL ON SCHEMA sgp_lp_propuestas FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE sgp_lp_propuestas.config(id boolean PRIMARY KEY CHECK(id), enabled boolean NOT NULL DEFAULT false);
INSERT INTO sgp_lp_propuestas.config VALUES(true,false);
CREATE TABLE sgp_lp_propuestas.eventos(
 id uuid PRIMARY KEY, key text NOT NULL REFERENCES public.sgp_producciones(key_produccion),
 linea text NOT NULL, fecha date NOT NULL, turno integer NOT NULL CHECK(turno IN(1,2)),
 revision bigint NOT NULL, usuario text NOT NULL, solicitud jsonb NOT NULL,
 respuesta jsonb NOT NULL, creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(key,linea,fecha,turno,revision));
ALTER TABLE sgp_lp_propuestas.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_propuestas.eventos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_lp_propuestas FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER fijo BEFORE UPDATE OR DELETE ON sgp_lp_propuestas.eventos FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.inmutable();
CREATE FUNCTION public.sgp_lp_propuesta_v1(p_token text,p_key text,p_linea text,p_fecha date,p_turno integer,p_cmd jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb; u text; action text:=CASE WHEN p_cmd IS NULL THEN 'LEER' ELSE 'NOTA' END;
 enabled boolean; tr sgp_lp_operacion.turnos%rowtype; prior sgp_lp_propuestas.eventos%rowtype;
 rv bigint; rid uuid; amount bigint; available bigint; evidence jsonb; req jsonb; result jsonb; target jsonb;
BEGIN
 s:=sgp_lp_operacion.sesion(p_token,'ENSAMBLE',p_key,p_linea);u:=s->>'usuario';
 PERFORM sgp_lp_operacion.verificar_temporal(u,'ENSAMBLE',p_linea,p_fecha,p_turno,p_key,action);
 IF p_fecha IS NULL OR p_turno IS NULL OR p_turno NOT IN(1,2) OR p_key IS NULL OR NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes WHERE etapa='ENSAMBLE' AND linea=p_linea AND fecha=p_fecha AND turno=p_turno AND key=p_key) THEN RAISE EXCEPTION 'ORDEN_NO_INCORPORADA';END IF;
 SELECT c.enabled INTO enabled FROM sgp_lp_propuestas.config c WHERE id FOR SHARE;
 IF p_cmd IS NOT NULL THEN
  IF enabled IS DISTINCT FROM true THEN RAISE EXCEPTION 'PROPUESTA_NO_HABILITADA';END IF;
  PERFORM sgp_lp_operacion.admitir();
  IF jsonb_typeof(p_cmd) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_cmd) k WHERE k NOT IN('id','revision','quantity','observation')) OR coalesce(p_cmd->>'quantity','') !~ '^(0|[1-9][0-9]*)$' OR coalesce(p_cmd->>'revision','') !~ '^(0|[1-9][0-9]*)$' OR length(btrim(coalesce(p_cmd->>'observation',''))) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'PROPUESTA_INVALIDA';END IF;
  rid:=(p_cmd->>'id')::uuid;IF rid IS NULL THEN RAISE EXCEPTION 'ID_REQUERIDO';END IF;
  amount:=(p_cmd->>'quantity')::bigint;
  IF amount>9007199254740991 THEN RAISE EXCEPTION 'CANTIDAD_INVALIDA';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,384));
  PERFORM pg_advisory_xact_lock(hashtextextended('ENSAMBLE|'||p_linea,184));
  SELECT * INTO tr FROM sgp_lp_operacion.turnos WHERE etapa='ENSAMBLE' AND linea=p_linea AND fecha=p_fecha AND turno=p_turno FOR UPDATE;
  PERFORM 1 FROM public.sgp_producciones WHERE key_produccion=p_key FOR UPDATE;
  -- Never retain authorization while waiting for a conflicting write/revocation.
  s:=sgp_lp_operacion.sesion(p_token,'ENSAMBLE',p_key,p_linea);
  IF s->>'usuario' IS DISTINCT FROM u THEN RAISE EXCEPTION 'SESION_CAMBIO';END IF;
  PERFORM sgp_lp_operacion.verificar_temporal(u,'ENSAMBLE',p_linea,p_fecha,p_turno,p_key,action);
  req:=jsonb_build_object('key',p_key,'line',p_linea,'date',p_fecha,'shift',p_turno,'command',p_cmd);
  SELECT * INTO prior FROM sgp_lp_propuestas.eventos WHERE id=rid;
  IF FOUND THEN IF prior.usuario<>u OR prior.solicitud<>req THEN RAISE EXCEPTION 'IDEMPOTENCIA_REUTILIZADA';END IF;RETURN prior.respuesta||jsonb_build_object('duplicate',true);END IF;
  IF tr.estado IS DISTINCT FROM 'ABIERTO' THEN RAISE EXCEPTION 'TURNO_NO_ABIERTO';END IF;
 END IF;
 SELECT coalesce(max(revision),0) INTO rv FROM sgp_lp_propuestas.eventos WHERE key=p_key AND linea=p_linea AND fecha=p_fecha AND turno=p_turno;
 target:=sgp_lp_operacion.siguiente(p_fecha,p_turno);
 evidence:=public.sgp_lp_afectaciones_consultar_v2(p_token,p_key,'ENSAMBLE');available:=(evidence->>'available')::bigint;
 IF p_cmd IS NOT NULL THEN
  IF rv<>(p_cmd->>'revision')::bigint THEN RAISE EXCEPTION 'CONFLICTO_REVISION_PROPUESTA';END IF;
  IF available IS NULL OR amount>available THEN RAISE EXCEPTION 'DISPONIBILIDAD_NO_ACREDITADA';END IF;
  rv:=rv+1;
  result:=jsonb_build_object('contract','LP-PROPOSAL-1','id',rid,'key',p_key,'line',p_linea,'date',p_fecha,'shift',p_turno,'target',target,'revision',rv,'quantity',amount,'observation',p_cmd->>'observation','user',u,'evidenceRevision',evidence->'revision','availableAtProposal',available,'status','PROPUESTA');
  INSERT INTO sgp_lp_propuestas.eventos(id,key,linea,fecha,turno,revision,usuario,solicitud,respuesta) VALUES(rid,p_key,p_linea,p_fecha,p_turno,rv,u,req,result);
  RETURN result;
 END IF;
 RETURN jsonb_build_object('contract','LP-PROPOSAL-1','key',p_key,'line',p_linea,'date',p_fecha,'shift',p_turno,'target',target,'revision',rv,'available',available,'canWrite',enabled AND sgp_lp_operacion.puede_operar(u,'ENSAMBLE','NOTA') AND (SELECT estado='ABIERTO' FROM sgp_lp_operacion.turnos WHERE etapa='ENSAMBLE' AND linea=p_linea AND fecha=p_fecha AND turno=p_turno), 'history',coalesce((SELECT jsonb_agg(respuesta||jsonb_build_object('at',creado_en) ORDER BY revision DESC) FROM sgp_lp_propuestas.eventos WHERE key=p_key AND linea=p_linea AND fecha=p_fecha AND turno=p_turno),'[]'));
END $$;
REVOKE ALL ON FUNCTION public.sgp_lp_propuesta_v1(text,text,text,date,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;

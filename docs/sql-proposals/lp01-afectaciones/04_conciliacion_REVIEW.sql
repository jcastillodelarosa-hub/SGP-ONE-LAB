-- REVIEW ONLY. Evidence-based coordinator reconciliation, no historical rewriting.
BEGIN;
ALTER TABLE sgp_lp_afectaciones.conciliacion ADD COLUMN firma_reportes text;
CREATE TABLE sgp_lp_afectaciones.conciliaciones_audit (
 id uuid PRIMARY KEY,usuario text NOT NULL,key text NOT NULL,etapa text NOT NULL,
 solicitud jsonb NOT NULL,fuentes jsonb NOT NULL,respuesta jsonb NOT NULL,
 creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE sgp_lp_afectaciones.conciliaciones_audit ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER inmutable BEFORE UPDATE OR DELETE ON sgp_lp_afectaciones.conciliaciones_audit FOR EACH ROW EXECUTE FUNCTION sgp_lp_afectaciones.inmutable();
CREATE FUNCTION sgp_lp_afectaciones.firma_reportes(k text,et text) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT md5(coalesce(jsonb_agg(jsonb_build_array(id,causa,ventanas) ORDER BY id)::text,'[]')) FROM sgp_lp_afectaciones.reportes WHERE key=k AND etapa=et;
$$;
CREATE FUNCTION sgp_lp_afectaciones.legado(k text,et text) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 WITH latest AS (SELECT DISTINCT ON(o.parte) o.* FROM sgp_lp_operacion.ordenes o WHERE o.key=k AND o.etapa=et ORDER BY o.parte,o.fecha DESC,o.turno DESC),
 items AS (
 SELECT parte,fecha,turno,a.key causa,a.value::bigint cantidad FROM latest CROSS JOIN LATERAL jsonb_each_text(afectaciones) a WHERE a.value::numeric>0
 UNION ALL SELECT parte,fecha,turno,'__UNION__',consolidado FROM latest WHERE consolidado>0
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('id',parte::text||'|'||causa,'assignment',parte,'date',fecha,'shift',turno,'cause',causa,'quantity',cantidad) ORDER BY parte,causa),'[]') FROM items;
$$;
CREATE FUNCTION public.sgp_lp_afectaciones_legado_v1(p_token text,p_key text,p_stage text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;BEGIN
 s:=sgp_lp_afectaciones.actor(p_token,p_key,p_stage,'VALIDAR');
 IF s->>'rol' IS DISTINCT FROM 'COORDINADOR' THEN RAISE EXCEPTION 'SOLO_COORDINADOR';END IF;
 PERFORM 1 FROM public.sgp_producciones WHERE key_produccion=p_key FOR SHARE;
 RETURN jsonb_build_object('contract','LP-AFFECTATIONS-LEGACY-1','key',p_key,'stage',p_stage,'fingerprint',sgp_lp_afectaciones.firma_legado(p_key,p_stage),'revision',coalesce((SELECT revision FROM sgp_lp_afectaciones.ambitos WHERE key=p_key AND etapa=p_stage),0),'sources',sgp_lp_afectaciones.legado(p_key,p_stage));
END $$;
CREATE FUNCTION public.sgp_lp_afectaciones_conciliar_v1(p_token text,p_key text,p_stage text,p_id uuid,p_fingerprint text,p_revision bigint,p_mappings jsonb,p_observation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;u text;ln text;cfg sgp_lp_afectaciones.config%rowtype;req jsonb;prior sgp_lp_afectaciones.conciliaciones_audit%rowtype;src jsonb;m jsonb;item jsonb;lo bigint;hi numeric;n bigint;result jsonb; BEGIN
 s:=sgp_lp_afectaciones.actor(p_token,p_key,p_stage,'VALIDAR');u:=s->>'usuario';ln:=s->>'line';
 IF s->>'rol' IS DISTINCT FROM 'COORDINADOR' THEN RAISE EXCEPTION 'SOLO_COORDINADOR';END IF;
 PERFORM sgp_lp_operacion.admitir();SELECT * INTO cfg FROM sgp_lp_afectaciones.config WHERE id FOR SHARE;
 IF cfg.writes IS DISTINCT FROM true THEN RAISE EXCEPTION 'ESCRITURA_NO_HABILITADA';END IF;
 IF p_id IS NULL OR length(btrim(coalesce(p_observation,''))) NOT BETWEEN 1 AND 2000 OR jsonb_typeof(p_mappings) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'EVIDENCIA_REQUERIDA';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,383));
 req:=jsonb_build_object('key',p_key,'stage',p_stage,'fingerprint',p_fingerprint,'revision',p_revision,'mappings',p_mappings,'observation',p_observation);
 SELECT * INTO prior FROM sgp_lp_afectaciones.conciliaciones_audit WHERE id=p_id;
 IF FOUND THEN IF prior.usuario<>u OR prior.solicitud<>req THEN RAISE EXCEPTION 'IDEMPOTENCIA_REUTILIZADA';END IF;RETURN prior.respuesta||jsonb_build_object('duplicate',true);END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_stage||'|'||ln,184));
 PERFORM 1 FROM public.sgp_producciones WHERE key_produccion=p_key FOR UPDATE;
 PERFORM 1 FROM sgp_lp_operacion.ordenes WHERE key=p_key AND etapa=p_stage FOR SHARE;
 IF p_fingerprint IS DISTINCT FROM sgp_lp_afectaciones.firma_legado(p_key,p_stage) OR p_revision IS DISTINCT FROM coalesce((SELECT revision FROM sgp_lp_afectaciones.ambitos WHERE key=p_key AND etapa=p_stage),0) THEN RAISE EXCEPTION 'EVIDENCIA_DESACTUALIZADA';END IF;
 src:=sgp_lp_afectaciones.legado(p_key,p_stage);
 IF jsonb_array_length(src)<>jsonb_array_length(p_mappings) OR (SELECT count(DISTINCT v->>'sourceId') FROM jsonb_array_elements(p_mappings) v)<>jsonb_array_length(src) THEN RAISE EXCEPTION 'COBERTURA_LEGADO_INCOMPLETA';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(src) LOOP
  SELECT value INTO m FROM jsonb_array_elements(p_mappings) WHERE value->>'sourceId'=item->>'id';
  IF m IS NULL OR length(btrim(coalesce(m->>'evidence',''))) NOT BETWEEN 1 AND 2000 OR jsonb_typeof(m->'reportIds') IS DISTINCT FROM 'array' OR jsonb_array_length(m->'reportIds')=0 THEN RAISE EXCEPTION 'ASOCIACION_CON_EVIDENCIA_REQUERIDA';END IF;
  SELECT count(*),coalesce(max(r.ventanas),0),coalesce(sum(r.ventanas),0) INTO n,lo,hi FROM sgp_lp_afectaciones.reportes r WHERE r.key=p_key AND r.etapa=p_stage AND (item->>'cause'='__UNION__' OR r.causa=item->>'cause') AND r.id IN(SELECT v::uuid FROM jsonb_array_elements_text(m->'reportIds') v);
  IF n<>jsonb_array_length(m->'reportIds') OR (item->>'quantity')::bigint<lo OR (item->>'quantity')::numeric>hi THEN RAISE EXCEPTION 'REPORTES_NO_CUBREN_EVIDENCIA';END IF;
 END LOOP;
 INSERT INTO sgp_lp_afectaciones.conciliacion(key,etapa,firma_legado,evidencia,firma_reportes) VALUES(p_key,p_stage,p_fingerprint,p_observation,sgp_lp_afectaciones.firma_reportes(p_key,p_stage)) ON CONFLICT(key,etapa) DO UPDATE SET firma_legado=excluded.firma_legado,evidencia=excluded.evidencia,firma_reportes=excluded.firma_reportes;
 DELETE FROM sgp_lp_afectaciones.consolidados WHERE key=p_key AND etapa=p_stage;
 result:=jsonb_build_object('contract','LP-AFFECTATIONS-RECONCILIATION-1','id',p_id,'duplicate',false,'sourceCount',jsonb_array_length(src));
 INSERT INTO sgp_lp_afectaciones.conciliaciones_audit(id,usuario,key,etapa,solicitud,fuentes,respuesta) VALUES(p_id,u,p_key,p_stage,req,src,result);
 RETURN result;
END $$;
-- Extend the exact new local contracts, preserving all security attributes and ACL.
DO $patch$ DECLARE signature text;def text;needle text:='z.firma_legado=sgp_lp_afectaciones.firma_legado(p_key,p_stage)';BEGIN
 FOREACH signature IN ARRAY ARRAY['public.sgp_lp_afectaciones_consultar_v1(text,text,text)','public.sgp_lp_afectaciones_comando_v1(text,text,text,date,integer,jsonb)'] LOOP
  SELECT pg_get_functiondef(signature::regprocedure) INTO def;
  IF position(needle IN def)=0 THEN RAISE EXCEPTION 'CONTRATO_CONCILIACION_INCOMPATIBLE';END IF;
  EXECUTE replace(def,needle,needle||' AND z.firma_reportes=sgp_lp_afectaciones.firma_reportes(p_key,p_stage)');
 END LOOP;
END $patch$;
-- Recovered actors: leader/coordinator. Supervisors/admin do not acquire physical confirmation by default.
DO $patch$ DECLARE def text;BEGIN
 SELECT pg_get_functiondef('public.sgp_lp_afectaciones_consultar_v1(text,text,text)'::regprocedure) INTO def;
 IF position('IF cfg.physical THEN' IN def)=0 THEN RAISE EXCEPTION 'CONTRATO_FISICO_INCOMPATIBLE';END IF;
 EXECUTE replace(def,'IF cfg.physical THEN',$s$IF cfg.physical AND s->>'rol' IN('LIDER LINEA','COORDINADOR') THEN$s$);
 SELECT pg_get_functiondef('public.sgp_lp_afectaciones_comando_v1(text,text,text,date,integer,jsonb)'::regprocedure) INTO def;
 IF position($n$IF op='CONFIRM' AND cfg.physical IS DISTINCT FROM true THEN$n$ IN def)=0 THEN RAISE EXCEPTION 'ESCRITOR_FISICO_INCOMPATIBLE';END IF;
 EXECUTE replace(def,$n$IF op='CONFIRM' AND cfg.physical IS DISTINCT FROM true THEN$n$,$r$IF op='CONFIRM' AND s->>'rol' NOT IN('LIDER LINEA','COORDINADOR') THEN RAISE EXCEPTION 'CONFIRMACION_ROL_NO_ACREDITADO';END IF;
 IF op='CONFIRM' AND cfg.physical IS DISTINCT FROM true THEN$r$);
END $patch$;
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_lp_afectaciones FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_lp_afectaciones FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sgp_lp_afectaciones_legado_v1(text,text,text),public.sgp_lp_afectaciones_conciliar_v1(text,text,text,uuid,text,bigint,jsonb,text) FROM PUBLIC,anon,authenticated;
COMMIT;

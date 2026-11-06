-- REVIEW ONLY: local candidate; no grants, scheduler installation or production activation.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE sgp_lp_official.config ADD COLUMN native_close boolean NOT NULL DEFAULT false;
ALTER TABLE sgp_lp_official.config ADD COLUMN automatic_open boolean NOT NULL DEFAULT false;
-- Preserve the two existing formats and admit the existing official parser version.
ALTER TABLE sgp_lp_operacion.archivos DROP CONSTRAINT archivos_adaptador_check;
ALTER TABLE sgp_lp_operacion.archivos ADD CONSTRAINT archivos_adaptador_check CHECK(adaptador IN('CSV-QA','LP-PBI-XLSX-1','LP-PBI-XLSX-2'));
CREATE FUNCTION sgp_lp_official.native_close() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb:=NEW.result->'result';ctx jsonb:=c->'context';tr sgp_lp_operacion.turnos%rowtype;st jsonb;h jsonb;f sgp_lp_official.files%rowtype;fid uuid;rows jsonb;snapshot jsonb;
BEGIN
 IF c->>'type' IS DISTINCT FROM 'CLOSE' OR NOT (SELECT native_close FROM sgp_lp_official.config WHERE id) THEN RETURN NEW;END IF;
 IF c->>'coverage' IS DISTINCT FROM 'COMPLETE' THEN RAISE EXCEPTION 'CIERRE_NATIVO_COBERTURA_PENDIENTE';END IF;
 SELECT * INTO tr FROM sgp_lp_operacion.turnos WHERE etapa=NEW.stage AND linea=NEW.line AND fecha=(ctx->>'date')::date AND turno=(ctx->>'shift')::int FOR UPDATE;
 IF NOT FOUND OR tr.estado NOT IN('ABIERTO','EN_REVISION') THEN RAISE EXCEPTION 'TURNO_NO_CERRABLE';END IF;
 SELECT state INTO st FROM sgp_lp_official.ledger WHERE stage=NEW.stage AND line=NEW.line;
 SELECT value INTO h FROM jsonb_array_elements(st->'history') WITH ORDINALITY a(value,n) WHERE value->'context'=ctx ORDER BY n DESC LIMIT 1;
 SELECT * INTO f FROM sgp_lp_official.files WHERE id=(h->>'id')::uuid;
 IF NOT FOUND THEN RAISE EXCEPTION 'ARCHIVO_OFICIAL_REQUERIDO';END IF;
 SELECT coalesce(jsonb_agg(r||jsonb_build_object('ejecutado',r->'realized','power_bi',r->'realized','sale',r->'planned')),'[]') INTO rows FROM jsonb_array_elements(c->'rows') r;
 SELECT id INTO fid FROM sgp_lp_operacion.archivos WHERE etapa=NEW.stage AND linea=NEW.line AND fecha=tr.fecha AND turno=tr.turno AND sha256=f.sha256;
 IF fid IS NULL THEN
  fid:=gen_random_uuid();
  INSERT INTO sgp_lp_operacion.archivos(id,linea,etapa,fecha,turno,nombre,sha256,contenido,contenido_binario,adaptador,evidencia,filas,usuario)
  VALUES(fid,NEW.line,NEW.stage,tr.fecha,tr.turno,f.name,f.sha256,'',f.bytes,'LP-PBI-XLSX-2',jsonb_build_object('officialCloseId',NEW.id,'sourceHistory',st->'history'),rows,NEW.actor);
 END IF;
 snapshot:=c||jsonb_build_object('ok',true,'id',NEW.id,'stage',NEW.stage,'line',NEW.line,'date',tr.fecha,'shift',tr.turno,'version',tr.revision+1,'user',NEW.actor,'rows',rows,'file',jsonb_build_object('id',fid,'name',f.name,'sha256',f.sha256,'adapter','LP-PBI-XLSX-2'));
 INSERT INTO sgp_lp_operacion.cierres(id,linea,etapa,fecha,turno,version,archivo,snapshot,usuario) VALUES(NEW.id,NEW.line,NEW.stage,tr.fecha,tr.turno,tr.revision+1,fid,snapshot,NEW.actor);
 UPDATE sgp_lp_operacion.turnos SET estado='CERRADO',revision=revision+1 WHERE etapa=NEW.stage AND linea=NEW.line AND fecha=tr.fecha AND turno=tr.turno;
 NEW.result:=NEW.result||jsonb_build_object('nativeClosed',true);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sgp_lp_official.native_close() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER official_native_close BEFORE INSERT ON sgp_lp_official.events FOR EACH ROW EXECUTE FUNCTION sgp_lp_official.native_close();

-- Called only by an approved server runner. No token or job is provisioned here.
-- Current period is derived from configured times and the existing timezone policy.
CREATE FUNCTION public.sgp_lp_official_open_due_v1(p_token text,p_stage text,p_line text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;now_at timestamptz:=clock_timestamp();day date:=(clock_timestamp() AT TIME ZONE 'America/Bogota')::date;d date;t int;p jsonb;target jsonb;matches int:=0;prev sgp_lp_operacion.turnos%rowtype;r record;close_id uuid;
BEGIN
 s:=sgp_lp_operacion.sesion(p_token,p_stage,NULL,p_line);
 IF s->>'rol' NOT IN('COORDINADOR','ADMINISTRADOR') THEN RAISE EXCEPTION 'APERTURA_SERVIDOR_NO_AUTORIZADA';END IF;
 IF p_stage NOT IN('ENSAMBLE','EMPAQUE') OR p_line NOT IN('PANELES_2','FRAMES_2') THEN RAISE EXCEPTION 'APERTURA_AMBITO_INVALIDO';END IF;
 PERFORM sgp_lp_operacion.admitir();
 PERFORM 1 FROM sgp_lp_official.config WHERE id FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM sgp_lp_official.config WHERE id AND enabled AND automatic_open) THEN RAISE EXCEPTION 'APERTURA_AUTOMATICA_NO_HABILITADA';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_stage||'|'||p_line,184));
 now_at:=clock_timestamp();day:=(now_at AT TIME ZONE 'America/Bogota')::date;
 FOR d IN SELECT generate_series(day-1,day,interval '1 day')::date LOOP
  FOR t IN 1..2 LOOP
   p:=sgp_lp_operacion.periodo(d,t);
   IF now_at>=(p->>'start')::timestamptz AND now_at<(p->>'end')::timestamptz THEN target:=p;matches:=matches+1;END IF;
  END LOOP;
 END LOOP;
 IF matches=0 THEN RETURN jsonb_build_object('status','WAITING_SCHEDULE');END IF;
 IF matches<>1 THEN RAISE EXCEPTION 'HORARIOS_OPERATIVOS_SUPERPUESTOS';END IF;
 d:=(target->>'date')::date;t:=(target->>'shift')::int;
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.turnos WHERE etapa=p_stage AND linea=p_line AND fecha=d AND turno=t) THEN RETURN jsonb_build_object('status','EXISTS','period',target);END IF;
 SELECT * INTO prev FROM sgp_lp_operacion.turnos WHERE etapa=p_stage AND linea=p_line ORDER BY fecha DESC,turno DESC LIMIT 1;
 IF FOUND THEN
  IF (prev.fecha,prev.turno)>(d,t) OR prev.estado<>'CERRADO' THEN RAISE EXCEPTION 'TURNO_PREVIO_PENDIENTE';END IF;
  SELECT id INTO close_id FROM sgp_lp_operacion.cierres WHERE etapa=p_stage AND linea=p_line AND fecha=prev.fecha AND turno=prev.turno ORDER BY version DESC LIMIT 1;
  IF close_id IS NULL THEN RAISE EXCEPTION 'CIERRE_PREVIO_NO_ACREDITADO';END IF;
  IF sgp_lp_operacion.siguiente(prev.fecha,prev.turno)->>'date'<>d::text OR (sgp_lp_operacion.siguiente(prev.fecha,prev.turno)->>'shift')::int<>t THEN RAISE EXCEPTION 'TURNOS_INTERMEDIOS_PENDIENTES';END IF;
 END IF;
 INSERT INTO sgp_lp_operacion.turnos(etapa,linea,fecha,turno) VALUES(p_stage,p_line,d,t);
 -- Use official stage balance for carry-over, never manual executed or inferred zero.
 FOR r IN
  SELECT DISTINCT ON(a.id) a.*,p.produccion FROM public.sgp_linea_plan_asignaciones a JOIN public.sgp_producciones p USING(key_produccion)
  WHERE p.id_linea=p_line AND a.estado IS DISTINCT FROM 'CANCELADA' AND (
   (a.fecha=d AND a.turno=t) OR EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes o WHERE o.parte=a.id AND o.etapa=p_stage AND o.linea=p_line AND o.fecha=prev.fecha AND o.turno=prev.turno
    AND p.saldos_inicializados AND p.presente_ultimo_export AND CASE WHEN p_stage='ENSAMBLE' THEN p.saldo_ensamble ELSE p.saldo_empaque END>0))
  ORDER BY a.id
 LOOP
  PERFORM sgp_lp_operacion.sesion(p_token,p_stage,r.key_produccion,p_line);
  INSERT INTO sgp_lp_operacion.ordenes(linea,etapa,fecha,turno,key,parte,prioridad,origen_fecha,origen_turno)
  VALUES(p_line,p_stage,d,t,r.key_produccion,r.id,r.prioridad,CASE WHEN (r.fecha,r.turno)<>(d,t) THEN r.fecha END,CASE WHEN (r.fecha,r.turno)<>(d,t) THEN r.turno END);
 END LOOP;
 PERFORM sgp_lp_operacion.sesion(p_token,p_stage,NULL,p_line);
 INSERT INTO sgp_lp_operacion.auditoria(id,usuario,operacion,linea,etapa,fecha,turno,payload,respuesta) VALUES(gen_random_uuid(),s->>'usuario','ABRIR_AUTO_OFICIAL',p_line,p_stage,d,t,target,jsonb_build_object('previousClose',close_id,'period',target));
 RETURN jsonb_build_object('status','OPENED','period',target,'previousClose',close_id,'timezone','America/Bogota');
END $$;
REVOKE ALL ON FUNCTION public.sgp_lp_official_open_due_v1(text,text,text) FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid IN('public.sgp_lp_official_open_due_v1(text,text,text)'::regprocedure,'sgp_lp_official.native_close()'::regprocedure) AND a.grantee<>p.proowner) THEN RAISE EXCEPTION 'OFFICIAL_BRIDGE_ACL_REQUIRES_REVIEW';END IF;
END $$;
COMMIT;

-- REVIEW ONLY. Native PDT V4 + LP in one transaction; no grants or activation.
BEGIN;
ALTER TABLE sgp_lp_afectaciones.config ADD COLUMN atomic_pdt boolean NOT NULL DEFAULT false;
CREATE TABLE sgp_lp_afectaciones.pdt_recibos (
 id uuid PRIMARY KEY,usuario text NOT NULL,solicitud jsonb NOT NULL,respuesta jsonb NOT NULL,
 creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE sgp_lp_afectaciones.pdt_recibos ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER inmutable BEFORE UPDATE OR DELETE ON sgp_lp_afectaciones.pdt_recibos FOR EACH ROW EXECUTE FUNCTION sgp_lp_afectaciones.inmutable();
DO $pre$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_pdt_registrar_v4(text,text,jsonb,jsonb,uuid)'::regprocedure) IS DISTINCT FROM '8c501e21c8a6986f584ec96a3da955e6'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='sgp_pdt_multiorigen.registrar(text,text,jsonb,jsonb,uuid,uuid)'::regprocedure) IS DISTINCT FROM '2c9da616eb830fd6db20973e9bec4155'
 OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.sgp_pdt_registrar_v4(text,text,jsonb,jsonb,uuid)'::regprocedure AND prosecdef AND proconfig=ARRAY['search_path=""']::text[] AND pg_get_userbyid(proowner)=current_user)
 THEN RAISE EXCEPTION 'PDT_CONTRATO_INCOMPATIBLE';END IF;
END $pre$;
CREATE FUNCTION public.sgp_lp_afectaciones_aluminio_v1(p_token text,p_key text,p_stage text,p_date date,p_shift int,p_cmd jsonb,p_pieces jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;u text;ln text;rid uuid:=(p_cmd->>'id')::uuid;req jsonb;prior sgp_lp_afectaciones.pdt_recibos%rowtype;cfg sgp_lp_afectaciones.config%rowtype;ctx jsonb;native jsonb;result jsonb;item jsonb;pid uuid;ids jsonb; BEGIN
 IF p_cmd->>'action' IS DISTINCT FROM 'CREATE' OR p_cmd->>'cause' IS DISTINCT FROM 'NC_AL' OR rid IS NULL OR jsonb_typeof(p_cmd) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_cmd) k WHERE k NOT IN('id','action','cause','quantity','revision','observation')) THEN RAISE EXCEPTION 'COMANDO_ALUMINIO_INVALIDO';END IF;
 IF jsonb_typeof(p_pieces) IS DISTINCT FROM 'array' OR jsonb_array_length(p_pieces) NOT BETWEEN 1 AND 100 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_pieces) p WHERE p->>'key_produccion' IS DISTINCT FROM p_key) THEN RAISE EXCEPTION 'PIEZAS_AJENAS_O_INVALIDAS';END IF;
 s:=sgp_lp_afectaciones.actor(p_token,p_key,p_stage,'AFECTAR',p_date,p_shift);u:=s->>'usuario';ln:=s->>'line';
 -- Native actor is authoritative: supervisors do not inherit PDT permissions from LP.
 IF sgp_pdt_multiorigen.actor(p_token,p_stage) IS DISTINCT FROM u THEN RAISE EXCEPTION 'ACTOR_PDT_INCOMPATIBLE';END IF;
 PERFORM sgp_lp_operacion.admitir();SELECT * INTO cfg FROM sgp_lp_afectaciones.config WHERE id FOR SHARE;
 IF cfg.writes IS DISTINCT FROM true OR cfg.atomic_pdt IS DISTINCT FROM true OR cfg.pdt_links IS DISTINCT FROM true THEN RAISE EXCEPTION 'PDT_ATOMICO_NO_HABILITADO';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,382));
 PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,0)); -- same native PDT receipt lock before checking existing event
 req:=jsonb_build_object('key',p_key,'stage',p_stage,'date',p_date,'shift',p_shift,'command',p_cmd,'pieces',p_pieces);
 SELECT * INTO prior FROM sgp_lp_afectaciones.pdt_recibos WHERE id=rid;
 IF FOUND THEN
  IF prior.usuario<>u OR prior.solicitud<>req THEN RAISE EXCEPTION 'IDEMPOTENCIA_REUTILIZADA';END IF;
  RETURN prior.respuesta||jsonb_build_object('duplicate',true);
 END IF;
 IF EXISTS(SELECT 1 FROM sgp_lp_afectaciones.eventos WHERE id=rid) OR EXISTS(SELECT 1 FROM sgp_pdt_multiorigen.eventos WHERE id_evento=rid) THEN RAISE EXCEPTION 'EVENTO_PREEXISTENTE';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_stage||'|'||ln,184));
 PERFORM 1 FROM public.sgp_producciones WHERE key_produccion=p_key FOR UPDATE;
 SELECT jsonb_build_object('key_produccion',p_key,'produccion',produccion) INTO ctx FROM public.sgp_producciones WHERE key_produccion=p_key;
 -- Native writer validates fabrication/length/reserve/master, NC and piece count. No window inference.
 native:=public.sgp_pdt_registrar_v4(p_token,p_stage,ctx,p_pieces,rid);ids:=native->'ids_pendientes';
 IF native->>'ok' IS DISTINCT FROM 'true' OR native->>'contract_version' IS DISTINCT FROM '4' OR jsonb_typeof(ids) IS DISTINCT FROM 'array' OR jsonb_array_length(ids)<>jsonb_array_length(p_pieces) OR (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(ids) x)<>jsonb_array_length(ids) THEN RAISE EXCEPTION 'RESPUESTA_PDT_INVALIDA';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(ids) LOOP
  pid:=(item #>> '{}')::uuid;
  IF NOT EXISTS(SELECT 1 FROM sgp_pdt_multiorigen.detalles d JOIN public.sgp_aluminio_pendientes p USING(id_pendiente) WHERE d.id_evento=rid AND p.id_pendiente=pid AND p.key_produccion=p_key AND p.origen=p_stage AND p.contrato_pdt='V2') THEN RAISE EXCEPTION 'PDT_IDENTIDAD_NO_ACREDITADA';END IF;
  INSERT INTO sgp_lp_afectaciones.pdt_fuentes_acreditadas VALUES('V4',pid,p_key,p_stage,'Registro nativo V4: '||rid,true);
 END LOOP;
 result:=public.sgp_lp_afectaciones_comando_v1(p_token,p_key,p_stage,p_date,p_shift,p_cmd||jsonb_build_object('sourceContract','V4','sourceId',ids->>0));
 FOR item IN SELECT value FROM jsonb_array_elements(ids) WITH ORDINALITY x(value,n) WHERE n>1 LOOP
  INSERT INTO sgp_lp_afectaciones.fuentes VALUES('V4',(item #>> '{}')::uuid,rid);
 END LOOP;
 result:=result||jsonb_build_object('pdtIds',ids);
 INSERT INTO sgp_lp_afectaciones.pdt_recibos(id,usuario,solicitud,respuesta) VALUES(rid,u,req,result);
 RETURN result;
END $$;
CREATE FUNCTION public.sgp_lp_afectaciones_consultar_v2(p_token text,p_key text,p_stage text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;s jsonb;pending jsonb;allowed boolean:=false;cfg sgp_lp_afectaciones.config%rowtype;BEGIN
 result:=public.sgp_lp_afectaciones_consultar_v1(p_token,p_key,p_stage);
 s:=sgp_lp_afectaciones.actor(p_token,p_key,p_stage,'LEER');
 -- Same native metadata read roles. No role aliases or supervisor escalation.
 IF s->>'rol'=ANY(ARRAY['ADMINISTRADOR','COORDINADOR','PATINADOR','PICKING','SUPERVISOR DE PICKING','LIDER','LIDER LINEA','LIDER MECANIZADO','RECEPCION','CONSULTA']) THEN
  PERFORM public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PATINADOR','PICKING','SUPERVISOR DE PICKING','LIDER','LIDER LINEA','LIDER MECANIZADO','RECEPCION','CONSULTA']);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id_pendiente,'linked',EXISTS(SELECT 1 FROM sgp_lp_afectaciones.fuentes f WHERE f.contrato='V4' AND f.fuente_id=p.id_pendiente),'contract',p.contrato_pdt,'key',p.key_produccion,'origin',p.origen,'reference',p.perfil,'fabrication',p.fabricacion,'length',p.longitud,'reserve',p.reserva,'finish',p.acabado_pendiente,'pieceQuantity',p.cantidad,'state',p.estado,'replacementState',p.estado_repo,'validationState',p.validacion_estado,'nc',p.nc,'reportedAt',p.fecha_reporte) ORDER BY p.fecha_reporte,p.id_pendiente),'[]') INTO pending FROM public.sgp_aluminio_pendientes p WHERE p.key_produccion=p_key AND p.origen='PICKING';
 ELSE pending:=NULL;END IF;
 SELECT * INTO cfg FROM sgp_lp_afectaciones.config WHERE id;
 IF cfg.writes AND cfg.atomic_pdt AND cfg.pdt_links AND result->'capabilities' ? 'REPORT' AND s->>'rol' IN('ADMINISTRADOR','COORDINADOR','LIDER','LIDER LINEA') THEN
  allowed:=sgp_pdt_multiorigen.actor(p_token,p_stage)=s->>'usuario';
 END IF;
 RETURN result||jsonb_build_object('contract','LP-AFFECTATIONS-2','capabilities',(result->'capabilities')||CASE WHEN allowed THEN '["REPORT_ALUMINUM"]'::jsonb ELSE '[]'::jsonb END||CASE WHEN cfg.writes AND result->'capabilities' ? 'REPORT' AND s->>'rol'='COORDINADOR' AND sgp_lp_operacion.puede_operar(s->>'usuario',p_stage,'VALIDAR') THEN '["RECONCILE"]'::jsonb ELSE '[]'::jsonb END,'pickingPending',jsonb_build_object('status',CASE WHEN pending IS NULL THEN 'UNAUTHORIZED' ELSE 'AVAILABLE' END,'rows',coalesce(pending,'[]')));
END $$;
REVOKE ALL ON sgp_lp_afectaciones.pdt_recibos FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sgp_lp_afectaciones_aluminio_v1(text,text,text,date,int,jsonb,jsonb),public.sgp_lp_afectaciones_consultar_v2(text,text,text) FROM PUBLIC,anon,authenticated;
COMMIT;

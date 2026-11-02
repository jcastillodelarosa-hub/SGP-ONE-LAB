-- PROPUESTA. Ejecutar solamente tras autorización; requiere 01 revisado con columnas XLSX.
-- La credencial técnica permanece exclusivamente en el servidor. No sustituye la sesión SGP.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='sgp_lp_operacion' AND table_name='archivos' AND column_name='contenido_binario') OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN RAISE EXCEPTION 'CONTRATO_XLSX_BASE_AUSENTE'; END IF;
 IF NOT has_function_privilege('service_role','public.sgp_sesion_actual(text)','EXECUTE') THEN RAISE EXCEPTION 'LECTURA_SESION_SERVIDOR_NO_DISPONIBLE'; END IF;
END $$;
CREATE FUNCTION public.sgp_lp_operacion_importar_xlsx(p_token text,p_contexto jsonb,p_nombre text,p_base64 text,p_documento jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE et text:=p_contexto->>'stage';line_id text:=p_contexto->>'line';d date:=(p_contexto->>'date')::date;t int:=(p_contexto->>'shift')::int;rid uuid:=(p_contexto->>'id')::uuid;rev bigint:=(p_contexto->>'revision')::bigint;s jsonb;u text;tr sgp_lp_operacion.turnos%rowtype;prior sgp_lp_operacion.auditoria%rowtype;raw bytea;sha text;payload jsonb;r jsonb;k text;candidates int;groups jsonb:='[]';res jsonb;file_id uuid;qty bigint;source_rows jsonb;
BEGIN
 s:=sgp_lp_operacion.sesion(p_token,et,NULL,line_id);u:=s->>'usuario';
 IF s->>'rol'='CONSULTA' OR NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.config WHERE id AND escrituras AND formato_bi_aprobado AND adaptador_bi='LP-PBI-XLSX-1') THEN RAISE EXCEPTION 'IMPORTACION_XLSX_NO_HABILITADA'; END IF;
 IF jsonb_typeof(p_contexto) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_contexto) x WHERE x NOT IN('stage','line','date','shift','id','revision')) OR d IS NULL OR t IS NULL OR t NOT IN(1,2) OR rid IS NULL OR rev IS NULL OR rev<0 THEN RAISE EXCEPTION 'CONTEXTO_XLSX_INVALIDO'; END IF;
 IF p_nombre IS NULL OR length(p_nombre)>255 OR p_nombre !~* '\.xlsx$' OR p_base64 IS NULL OR length(p_base64)>2800000 THEN RAISE EXCEPTION 'ARCHIVO_XLSX_INVALIDO'; END IF;
 raw:=decode(p_base64,'base64');sha:=encode(sha256(raw),'hex');
 IF octet_length(raw)<22 OR octet_length(raw)>2097152 OR encode(substring(raw FROM 1 FOR 4),'hex')<>'504b0304' OR jsonb_typeof(p_documento) IS DISTINCT FROM 'object' OR p_documento->>'adapter' IS DISTINCT FROM 'LP-PBI-XLSX-1' OR p_documento->>'sha256' IS DISTINCT FROM sha OR p_documento->>'stage' IS DISTINCT FROM et OR jsonb_typeof(p_documento->'records') IS DISTINCT FROM 'array' OR jsonb_array_length(p_documento->'records')>20000 THEN RAISE EXCEPTION 'EVIDENCIA_XLSX_INCOMPATIBLE'; END IF;
 -- The shared turn history must not disclose source rows from other shifts.
 -- Full provenance stays in the protected immutable file; its digest binds retries.
 payload:=jsonb_build_object('op','IMPORTAR_XLSX','context',p_contexto,'filename',p_nombre,'sha256',sha,'document_sha256',encode(sha256(convert_to(p_documento::text,'UTF8')),'hex'));
 PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,123));
 PERFORM pg_advisory_xact_lock(hashtextextended(et||'|'||line_id,184));
 SELECT * INTO tr FROM sgp_lp_operacion.turnos WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TURNO_NO_EXISTE'; END IF;
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos p WHERE p.usuario=u AND p.etapa=et AND p.key=a.key)) THEN RAISE EXCEPTION 'TURNO_FUERA_DE_AMBITO'; END IF;
 SELECT * INTO prior FROM sgp_lp_operacion.auditoria WHERE id=rid;
 IF FOUND THEN IF prior.usuario<>u OR prior.payload<>payload THEN RAISE EXCEPTION 'IDEMPOTENCIA_REUTILIZADA'; END IF;RETURN prior.respuesta||jsonb_build_object('duplicate',true); END IF;
 IF tr.estado='CERRADO' THEN RAISE EXCEPTION 'REAPERTURA_REQUERIDA'; END IF;
 IF tr.estado='EN_REVISION' AND s->>'rol' NOT IN('ADMINISTRADOR','COORDINADOR') THEN RAISE EXCEPTION 'CORRECCION_REQUIERE_COORDINADOR'; END IF;
 IF tr.revision<>rev THEN RAISE EXCEPTION 'CONFLICTO_REVISION'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_documento->'records') WHERE value->>'line'=line_id AND value->>'date'=d::text AND value->>'shift'=t::text LOOP
  IF r->>'stage' IS DISTINCT FROM et OR nullif(btrim(r->>'production'),'') IS NULL OR coalesce(r->>'quantity','') !~ '^[0-9]+$' OR length(r->>'quantity')>15 OR coalesce(r->>'row','') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'FILA_XLSX_INVALIDA'; END IF;
  -- Exact production label + physical line; no fuzzy matching or Mecanizado part inference.
  SELECT count(*),min(p.key_produccion) INTO candidates,k FROM public.sgp_producciones p WHERE p.id_linea=line_id AND btrim(p.produccion)=btrim(r->>'production');
  IF candidates<>1 THEN RAISE EXCEPTION 'PRODUCCION_XLSX_NO_UNIVOCA: %',r->>'production'; END IF;
  IF NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND a.key=k) THEN RAISE EXCEPTION 'XLSX_SIN_ASIGNACION_EN_TURNO: %',r->>'production'; END IF;
  groups:=groups||jsonb_build_array(jsonb_build_object('key',k,'quantity',(r->>'quantity')::bigint,'source_row',(r->>'row')::int));
 END LOOP;
 IF jsonb_array_length(groups)=0 THEN RAISE EXCEPTION 'XLSX_SIN_PERIODO_SELECCIONADO'; END IF;
 SELECT jsonb_agg(to_jsonb(x) ORDER BY x.key) INTO groups FROM(SELECT v->>'key' key,sum((v->>'quantity')::bigint)::bigint quantity,jsonb_agg((v->>'source_row')::int ORDER BY (v->>'source_row')::int) source_rows FROM jsonb_array_elements(groups) v GROUP BY v->>'key')x;
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(groups) g WHERE g->>'key'=a.key)) THEN RAISE EXCEPTION 'ARCHIVO_BI_INCOMPLETO_AUSENCIA_NO_ES_CERO'; END IF;
 INSERT INTO sgp_lp_operacion.archivos(id,etapa,linea,fecha,turno,nombre,sha256,contenido,contenido_binario,adaptador,evidencia,filas,usuario)
 VALUES(rid,et,line_id,d,t,p_nombre,sha,'',raw,'LP-PBI-XLSX-1',p_documento,groups,u) ON CONFLICT(etapa,linea,fecha,turno,sha256) DO NOTHING;
 SELECT id INTO file_id FROM sgp_lp_operacion.archivos WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t AND sha256=sha;
 UPDATE sgp_lp_operacion.turnos SET revision=revision+1 WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t;
 res:=jsonb_build_object('ok',true,'fileId',file_id,'turnRevision',tr.revision+1,'adapter','LP-PBI-XLSX-1','productions',jsonb_array_length(groups),'sha256',sha);
 INSERT INTO sgp_lp_operacion.auditoria(id,usuario,operacion,etapa,linea,fecha,turno,payload,antes,respuesta) VALUES(rid,u,'IMPORTAR_XLSX',et,line_id,d,t,payload,to_jsonb(tr),res);
 RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb) TO service_role;
-- Original recovery: current turn scope; non-uploading coordinators also require complete file scope.
CREATE FUNCTION public.sgp_lp_operacion_archivo(p_token text,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f sgp_lp_operacion.archivos%rowtype;s jsonb;g jsonb;k text;n int;BEGIN
 SELECT * INTO f FROM sgp_lp_operacion.archivos WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'ARCHIVO_NO_DISPONIBLE'; END IF;
 s:=sgp_lp_operacion.sesion(p_token,f.etapa,NULL,f.linea);
 IF s->>'usuario'<>f.usuario THEN
  IF s->>'rol' NOT IN('ADMINISTRADOR','COORDINADOR') THEN RAISE EXCEPTION 'ORIGINAL_REQUIERE_CARGADOR_O_COORDINADOR'; END IF;
  FOR g IN SELECT value FROM jsonb_array_elements(f.evidencia->'records') LOOP
   SELECT count(*),min(p.key_produccion) INTO n,k FROM public.sgp_producciones p WHERE p.id_linea=g->>'line' AND btrim(p.produccion)=g->>'production';
   IF n<>1 THEN RAISE EXCEPTION 'ORIGINAL_FUENTE_NO_UNIVOCA'; END IF;
   PERFORM sgp_lp_operacion.sesion(p_token,f.etapa,k,g->>'line');
  END LOOP;
 END IF;
 FOR g IN SELECT value FROM jsonb_array_elements(f.filas) LOOP PERFORM sgp_lp_operacion.sesion(p_token,f.etapa,g->>'key',f.linea); END LOOP;
 IF f.contenido_binario IS NULL THEN RAISE EXCEPTION 'ARCHIVO_NO_ES_XLSX'; END IF;
 RETURN jsonb_build_object('filename',f.nombre,'sha256',f.sha256,'base64',replace(encode(f.contenido_binario,'base64'),E'\n',''),'adapter',f.adaptador);
END $$;
REVOKE ALL ON FUNCTION public.sgp_lp_operacion_archivo(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_lp_operacion_archivo(text,uuid) TO anon,authenticated;
COMMIT;

-- Runs only in the verified, networkless restored database. No helper is replaced.
-- Login/session checks and RPC authorization are real; all QA writes roll back.
BEGIN;
SET LOCAL timezone='UTC';
SET LOCAL statement_timeout='120s';
SET LOCAL lock_timeout='5s';
CREATE FUNCTION pg_temp.rpc(q text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb;
BEGIN
 EXECUTE 'SET LOCAL ROLE anon';
 IF current_user <> 'anon' THEN RAISE EXCEPTION 'QA_TECHNICAL_ROLE'; END IF;
 EXECUTE q INTO result;
 EXECUTE 'RESET ROLE';
 RETURN result;
END $$;
CREATE FUNCTION pg_temp.denied(q text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN
  PERFORM pg_temp.rpc(q);
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM IN ('PDT_ROL_REAL_NO_AUTORIZADO','PDT_SESION_NO_VALIDA') THEN RETURN; END IF;
  RAISE;
 END;
 RAISE EXCEPTION 'QA_ROLE_DENIAL_MISSING';
END $$;
CREATE TEMP TABLE qa_tokens(role text PRIMARY KEY, token text NOT NULL);
CREATE TEMP TABLE qa_context(context jsonb, piece jsonb, event uuid, pending uuid);
DO $auth$ DECLARE col text; r text; username text; password text; response jsonb; session jsonb;
BEGIN
 IF position('crypt' IN lower(pg_get_functiondef('public.sgp_login(text,text)'::regprocedure)))=0
 THEN RAISE EXCEPTION 'QA_LOGIN_CONTRACT_UNKNOWN'; END IF;
 SELECT attname INTO STRICT col FROM pg_attribute WHERE attrelid='public.sgp_usuarios'::regclass
 AND attname IN ('password_hash','clave_hash','contrasena_hash','hash_password') AND NOT attisdropped;
 FOREACH r IN ARRAY ARRAY['ADMINISTRADOR','COORDINADOR','LIDER LINEA','RECEPCION','PICKING',
  'SUPERVISOR DE PICKING','CONSULTA','LIDER MECANIZADO','LIDER','PATINADOR'] LOOP
  username:='991'||floor(random()*100000000000000)::bigint::text;
  password:=gen_random_uuid()::text||gen_random_uuid()::text;
  EXECUTE format('INSERT INTO public.sgp_usuarios(usuario,nombre,rol,activo,%I) VALUES($1,$2,$3,true,extensions.crypt($4,extensions.gen_salt(''bf'')))',col)
   USING username,'QA aislada reversible',r,password;
  response:=pg_temp.rpc(format('SELECT public.sgp_login(%L,%L)',username,password));
  IF nullif(response->>'token','') IS NULL THEN RAISE EXCEPTION 'QA_REAL_LOGIN_FAILED'; END IF;
  session:=pg_temp.rpc(format('SELECT public.sgp_sesion_actual(%L)',response->>'token'));
  IF session->>'valida' IS DISTINCT FROM 'true' OR session->>'rol' IS DISTINCT FROM r
  THEN RAISE EXCEPTION 'QA_REAL_SESSION_FAILED'; END IF;
  INSERT INTO qa_tokens VALUES(r,response->>'token');
  IF r IN ('ADMINISTRADOR','COORDINADOR','LIDER LINEA') THEN
   PERFORM pg_temp.rpc(format('SELECT public.sgp_pdt_manual_catalogo_v1(%L)',response->>'token'));
  ELSE
   PERFORM pg_temp.denied(format('SELECT public.sgp_pdt_manual_catalogo_v1(%L)',response->>'token'));
  END IF;
 END LOOP;
 PERFORM pg_temp.denied('SELECT public.sgp_pdt_manual_catalogo_v1(''invalid-isolated-token'')');
END $auth$;
SELECT 'PASS:real-role-authentication';

DO $manual$ DECLARE token text; p jsonb; source jsonb; details jsonb; response jsonb;
 ctx jsonb; candidate record; event uuid; nc text; origin text; key uuid; id uuid;
BEGIN
 SELECT t.token INTO STRICT token FROM qa_tokens t WHERE role='COORDINADOR';
 -- Pick an actual restored source with a matching Picking event; never fabricate
 -- relationships or replace origin/context helpers to make a case succeed.
 FOR p IN SELECT value FROM jsonb_array_elements(pg_temp.rpc(format(
  'SELECT public.sgp_pdt_manual_catalogo_v1(%L)',token))->'producciones') LOOP
  FOR source IN SELECT value FROM jsonb_array_elements(pg_temp.rpc(format(
   'SELECT public.sgp_pdt_manual_fuentes_v1(%L,%L,%L)',token,p->>'key_produccion',p->>'reserva'))->'fuentes') LOOP
   IF (source->>'cantidad_referencia')::numeric < 2 OR coalesce(source->>'fabricacion','')='' THEN CONTINUE; END IF;
   SELECT e.id_entrega INTO event FROM public.sgp_picking_entregas e
    JOIN public.sgp_mecanizado_programacion m USING(id_programacion)
    WHERE e.produccion=p->>'produccion' AND m.reserva=p->>'reserva'
    AND upper(btrim(m.sistema))=upper(btrim(p->>'sistema'))
    AND upper(btrim(m.acabado))=upper(btrim(source->>'acabado'))
    AND upper(btrim(source->>'acabado'))=upper(btrim(p->>'acabado')) LIMIT 1;
   IF event IS NOT NULL THEN EXIT; END IF;
  END LOOP;
  IF event IS NOT NULL THEN EXIT; END IF;
 END LOOP;
 IF event IS NULL THEN RAISE EXCEPTION 'QA_MATCHING_PANEL_PICKING_SOURCE_REQUIRED'; END IF;
 SELECT consecutivo INTO nc FROM public.sgp_nc_aluminio WHERE consecutivo IS NOT NULL
  AND length(consecutivo) BETWEEN 1 AND 120 LIMIT 1;
 IF nc IS NULL THEN RAISE EXCEPTION 'QA_NC_SOURCE_REQUIRED'; END IF;
 ctx:=jsonb_build_object('key_produccion',p->>'key_produccion','reserva',p->>'reserva','produccion',p->>'produccion');
 details:=jsonb_build_array(jsonb_build_object('perfil',source->>'codigo_sap','fabricacion',source->>'fabricacion',
  'marca',coalesce(source->>'marca',''),'longitud',source->'longitud','acabado',source->>'acabado','cantidad',2,'nc',nc));
 FOREACH origin IN ARRAY ARRAY['PICKING','ENSAMBLE','EMPAQUE'] LOOP
  key:=gen_random_uuid();
  response:=pg_temp.rpc(format('SELECT public.sgp_pdt_manual_registrar_v1(%L,%L,%L::jsonb,%L::jsonb,%L,%L::uuid)',
   token,origin,ctx,details,'QA aislada',key));
  id:=(response->'ids_pendientes'->>0)::uuid;
  IF response->>'ok' IS DISTINCT FROM 'true' OR id IS NULL THEN RAISE EXCEPTION 'QA_MANUAL_CREATION_FAILED'; END IF;
  IF (pg_temp.rpc(format('SELECT public.sgp_pdt_manual_registrar_v1(%L,%L,%L::jsonb,%L::jsonb,%L,%L::uuid)',
   token,origin,ctx,details,'QA aislada',key))->>'duplicado') IS DISTINCT FROM 'true'
  THEN RAISE EXCEPTION 'QA_CREATION_NOT_IDEMPOTENT'; END IF;
  IF (SELECT count(*) FROM public.sgp_aluminio_pendiente_ncs WHERE id_pendiente=id AND consecutivo=nc)<>1
  THEN RAISE EXCEPTION 'QA_NC_LINK_MISSING'; END IF;
  IF origin='PICKING' THEN INSERT INTO qa_context VALUES(ctx,details,event,id); END IF;
 END LOOP;
 PERFORM pg_temp.denied(format('SELECT public.sgp_pdt_manual_registrar_v1(%L,%L,%L::jsonb,%L::jsonb,NULL,%L::uuid)',
  (SELECT t.token FROM qa_tokens t WHERE role='CONSULTA'),'PICKING',ctx,details,gen_random_uuid()));
END $manual$;
SELECT 'PASS:manual-three-origins-nc-idempotency';

DO $cycle$ DECLARE token text; picking text; reception text; c qa_context%rowtype;
 d uuid; result jsonb; key uuid; line uuid; q text;
BEGIN
 SELECT t.token INTO token FROM qa_tokens t WHERE role='COORDINADOR';
 SELECT t.token INTO picking FROM qa_tokens t WHERE role='PICKING';
 SELECT t.token INTO reception FROM qa_tokens t WHERE role='RECEPCION';
 SELECT * INTO STRICT c FROM qa_context;
 PERFORM pg_temp.denied(format('SELECT public.sgp_aluminio_pendiente_validar_detalles_v1(%L,%L::uuid,%L::jsonb,%L,NULL)',
  (SELECT t.token FROM qa_tokens t WHERE role='LIDER MECANIZADO'),c.pending,c.piece,c.context->>'reserva'));
 PERFORM pg_temp.rpc(format('SELECT public.sgp_aluminio_pendiente_validar_detalles_v1(%L,%L::uuid,%L::jsonb,%L,NULL)',
  token,c.pending,c.piece,c.context->>'reserva'));
 SELECT id_detalle INTO STRICT d FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=c.pending;
 PERFORM pg_temp.rpc(format('SELECT public.sgp_pdt_estado_v2(%L,%L::uuid,''CORTE'')',token,c.pending));
 PERFORM pg_temp.rpc(format('SELECT public.sgp_pdt_estado_v2(%L,%L::uuid,''MECANIZADO'')',token,c.pending));
 key:=gen_random_uuid();
 q:=format('SELECT public.sgp_aluminio_pendiente_registrar_avance_v1(%L,%L::uuid,%L::uuid,1,''T1'',current_date,%L::uuid,NULL)',token,c.pending,d,key);
 result:=pg_temp.rpc(q);
 IF result->>'saldo_detalle' IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'QA_PARTIAL_BALANCE'; END IF;
 IF (pg_temp.rpc(q)->>'duplicado') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'QA_ADVANCE_RETRY'; END IF;
 PERFORM pg_temp.denied(format('SELECT public.sgp_aluminio_pendiente_registrar_avance_v1(%L,%L::uuid,%L::uuid,1,''T1'',current_date,%L::uuid,NULL)',
  reception,c.pending,d,gen_random_uuid()));
 result:=pg_temp.rpc(format('SELECT public.sgp_aluminio_pendiente_registrar_avance_v1(%L,%L::uuid,%L::uuid,1,''T1'',current_date,%L::uuid,NULL)',token,c.pending,d,gen_random_uuid()));
 IF result->>'saldo_detalle' IS DISTINCT FROM '0' THEN RAISE EXCEPTION 'QA_FINAL_BALANCE'; END IF;
 PERFORM pg_temp.rpc(format('SELECT public.sgp_pdt_estado_v2(%L,%L::uuid,''PROCESADO'')',token,c.pending));
 key:=gen_random_uuid();q:=format('SELECT public.sgp_pdt_manual_entrega_registrar_v1(%L,%L::uuid,%L::uuid,2,%L::uuid)',picking,d,c.event,key);
 result:=pg_temp.rpc(q);line:=(result->>'id_linea')::uuid;
 IF line IS NULL OR (pg_temp.rpc(q)->>'duplicado') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'QA_PICKING_RETRY'; END IF;
 -- Source state is altered only inside this rollback transaction in the clone.
 UPDATE public.sgp_picking_entregas SET estado='VALIDADA' WHERE id_entrega=c.event;
 PERFORM pg_temp.rpc(format('SELECT public.sgp_pdt_manual_entrega_validar_v1(%L,%L::uuid)',reception,line));
 key:=gen_random_uuid();q:=format('SELECT public.sgp_pdt_manual_asignar_v1(%L,%L::uuid,%L::uuid)',reception,line,key);
 PERFORM pg_temp.rpc(q);
 IF (pg_temp.rpc(q)->>'duplicado') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'QA_ASSIGNMENT_RETRY'; END IF;
 key:=gen_random_uuid();q:=format('SELECT public.sgp_pdt_manual_cerrar_v1(%L,%L::uuid,%L::uuid)',token,c.pending,key);
 PERFORM pg_temp.rpc(q);
 IF (pg_temp.rpc(q)->>'duplicado') IS DISTINCT FROM 'true'
 OR NOT EXISTS(SELECT 1 FROM public.sgp_aluminio_pendientes WHERE id_pendiente=c.pending AND estado='RESUELTO' AND estado_repo='PICKING')
 THEN RAISE EXCEPTION 'QA_CLOSURE_FAILED'; END IF;
END $cycle$;
SELECT 'PASS:validation-partial-advance-picking-close';

DO $lists$ DECLARE r text; t text; rows jsonb; n integer;
BEGIN
 FOREACH r IN ARRAY ARRAY['RECEPCION','LIDER MECANIZADO','PICKING'] LOOP
  SELECT token INTO t FROM qa_tokens WHERE role=r;
  rows:=pg_temp.rpc(format('SELECT public.sgp_pdt_manual_listar_v1(%L)',t))->'pendientes';
  SELECT count(*) INTO n FROM jsonb_array_elements(rows) x JOIN sgp_pdt_manual.detalles d
   ON d.id_pendiente::text=x->>'id_pendiente';
  IF n<>3 OR (SELECT count(DISTINCT x->>'id_pendiente') FROM jsonb_array_elements(rows) x)<>jsonb_array_length(rows)
  THEN RAISE EXCEPTION 'QA_UNIFIED_LIST_DUPLICATED_OR_MISSING'; END IF;
  -- Modern report path must remain callable with the actual role and schema.
  PERFORM pg_temp.rpc(format('SELECT public.sgp_aluminio_pendientes_listar_v2(%L,false)',t));
 END LOOP;
END $lists$;
SELECT 'PASS:reception-mecanizado-unified-list';

DO $period$ DECLARE c qa_context%rowtype; y integer; w integer; t text; changed integer; rows jsonb; payload jsonb; response jsonb;
BEGIN
 SELECT * INTO STRICT c FROM qa_context;
 SELECT anio,coalesce(semana_actual,semana_base) INTO STRICT y,w FROM public.sgp_producciones WHERE key_produccion=c.context->>'key_produccion';
 SELECT token INTO t FROM qa_tokens WHERE role='COORDINADOR';
 changed:=CASE WHEN w=52 THEN 51 ELSE w+1 END;
 SELECT jsonb_build_array(to_jsonb(p)||jsonb_build_object('semana_actual',changed)) INTO STRICT payload
 FROM public.sgp_producciones p WHERE key_produccion=c.context->>'key_produccion';
 response:=pg_temp.rpc(format('SELECT public.sgp_aplicar_export_diario(%L,''PANELES_2'',''qa-isolated.xlsx'',%L::jsonb)',t,payload));
 IF response->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'QA_SAME_YEAR_EXPORT_FAILED'; END IF;
 SET CONSTRAINTS trg_pdt_manual_auditar_programacion IMMEDIATE;
 IF (SELECT count(*) FROM sgp_pdt_manual.programacion_cambios WHERE id_pendiente=c.pending AND anio_nuevo=y AND semana_nueva=changed)<>1
 THEN RAISE EXCEPTION 'QA_WEEK_AUDIT_MISSING'; END IF;
 PERFORM pg_temp.rpc(format('SELECT public.sgp_aplicar_export_diario(%L,''PANELES_2'',''qa-isolated.xlsx'',%L::jsonb)',t,payload));
 IF (SELECT count(*) FROM sgp_pdt_manual.programacion_cambios WHERE id_pendiente=c.pending)<>1
 THEN RAISE EXCEPTION 'QA_WEEK_AUDIT_DUPLICATED'; END IF;
 BEGIN
  UPDATE public.sgp_producciones SET anio=y+1 WHERE key_produccion=c.context->>'key_produccion';
  RAISE EXCEPTION 'QA_YEAR_CHANGE_ALLOWED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'PDT_PRODUCTION_YEAR_IMMUTABLE:%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM pg_temp.rpc(format('SELECT public.sgp_aplicar_export_diario(%L,''PANELES_2'',''qa-isolated.xlsx'',%L::jsonb)',t,
   jsonb_build_array(jsonb_build_object('key_produccion',c.context->>'key_produccion','id_linea','PANELES_2','anio',y+1,'semana_actual',changed))));
  RAISE EXCEPTION 'QA_EXPORT_YEAR_CHANGE_ALLOWED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'PDT_EXPORT_YEAR_IMMUTABLE:%' THEN RAISE; END IF; END;
 rows:=pg_temp.rpc(format('SELECT public.sgp_pdt_manual_listar_v1(%L)',t))->'pendientes';
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(rows) x WHERE x->>'id_pendiente'=c.pending::text
  AND (x->>'semana')::integer=changed AND (x->>'anio')::integer=y)
 OR NOT EXISTS(SELECT 1 FROM sgp_pdt_manual.reportes r JOIN sgp_pdt_manual.detalles d USING(id_reporte)
  WHERE d.id_pendiente=c.pending AND r.anio=y AND r.semana=w)
 THEN RAISE EXCEPTION 'QA_CURRENT_OR_ORIGINAL_PERIOD'; END IF;
END $period$;
SELECT 'PASS:export-week-year-guard-audit';

DO $cut$ DECLARE t text; stamp timestamptz:='2026-10-29T23:59:59Z'; response jsonb;
BEGIN
 SELECT token INTO t FROM qa_tokens WHERE role='COORDINADOR';
 INSERT INTO sgp_pdt_manual.corte_operativo(id,desde,activado_por) VALUES(1,stamp,'QA aislada reversible');
 SET LOCAL timezone='America/Bogota';
 response:=pg_temp.rpc(format('SELECT public.sgp_pdt_corte_operativo_v1(%L)',t));
 IF (response->>'desde')::timestamptz IS DISTINCT FROM stamp
 OR NOT ('2026-10-30T00:00:00Z'::timestamptz>=stamp)
 OR ('2026-10-29T23:59:58Z'::timestamptz>=stamp)
 THEN RAISE EXCEPTION 'QA_UTC_CUTOVER'; END IF;
 -- SQL installation does not erase historical rows; Node covers frontend filtering.
 IF NOT EXISTS(SELECT 1 FROM public.sgp_aluminio_pendientes_historial)
 THEN RAISE EXCEPTION 'QA_HISTORY_REQUIRED'; END IF;
END $cut$;
SELECT 'PASS:utc-cutover-historical-preservation';

-- Compare public dispatch with its captured original on nonmanual restored rows.
-- Each probe is separately rolled back, including successful original calls.
CREATE FUNCTION pg_temp.outcome(q text, technical_anon boolean) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb;
BEGIN
 BEGIN
  IF technical_anon THEN result:=pg_temp.rpc(q); ELSE EXECUTE q INTO result; END IF;
  RAISE EXCEPTION USING ERRCODE='ZQ001';
 EXCEPTION WHEN SQLSTATE 'ZQ001' THEN NULL;
 WHEN OTHERS THEN result:=jsonb_build_object('sqlstate',SQLSTATE,'error',SQLERRM);
 END;
 RETURN result;
END $$;
DO $dispatch$ DECLARE contract text; id uuid; t text; a jsonb; b jsonb; q text;
BEGIN
 SELECT token INTO t FROM qa_tokens WHERE role='COORDINADOR';
 FOREACH contract IN ARRAY ARRAY['LEGACY','V2'] LOOP
  SELECT p.id_pendiente INTO id FROM public.sgp_aluminio_pendientes p
  WHERE p.contrato_pdt=contract AND NOT EXISTS(SELECT 1 FROM sgp_pdt_manual.detalles d WHERE d.id_pendiente=p.id_pendiente) LIMIT 1;
  IF id IS NULL THEN RAISE EXCEPTION 'QA_LEGACY_V2_COHORT_REQUIRED'; END IF;
  q:=format('(%L,%L::uuid,''[]''::jsonb,NULL,NULL)',t,id);
  a:=pg_temp.outcome('SELECT public.sgp_aluminio_pendiente_validar_detalles_v1'||q,true);
  b:=pg_temp.outcome('SELECT sgp_pdt_manual.original_validar'||q,false);
  IF a IS DISTINCT FROM b THEN RAISE EXCEPTION 'QA_VALIDATOR_DISPATCH_REGRESSION'; END IF;
  q:=format('(%L,%L::uuid,''INVALID_QA_STAGE'')',t,id);
  a:=pg_temp.outcome('SELECT public.sgp_pdt_estado_v2'||q,true);
  b:=pg_temp.outcome('SELECT sgp_pdt_manual.original_estado_v2'||q,false);
  IF a IS DISTINCT FROM b THEN RAISE EXCEPTION 'QA_STAGE_DISPATCH_REGRESSION'; END IF;
 END LOOP;
END $dispatch$;
SELECT 'PASS:legacy-v2-dispatch';
ROLLBACK;

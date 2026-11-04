-- ISOLATED DESIGN REFERENCE, NOT AN INSTALLER. Never apply in Supabase.
BEGIN;
DO $$ BEGIN
 IF current_setting('sgp.lp_a_design',true) IS DISTINCT FROM 'synthetic-only' OR to_regclass('public.qa_lp_a_synthetic_marker') IS NULL THEN RAISE EXCEPTION 'ISOLATED_DESIGN_ONLY'; END IF;
 IF EXISTS(SELECT 1 FROM public.sgp_producciones WHERE key_produccion NOT LIKE 'QA-%') THEN RAISE EXCEPTION 'NON_SYNTHETIC_DATA_REFUSED'; END IF;
END $$;
CREATE SCHEMA lp_a_review;
CREATE SCHEMA lp_a_api;
REVOKE ALL ON SCHEMA lp_a_review,lp_a_api FROM PUBLIC,anon,authenticated;
CREATE TABLE lp_a_review.principals(role_oid oid PRIMARY KEY,role_name name UNIQUE NOT NULL,allow_open boolean NOT NULL DEFAULT false,allow_read boolean NOT NULL DEFAULT false,expires_at timestamptz NOT NULL);
CREATE TABLE lp_a_review.scopes(role_oid oid REFERENCES lp_a_review.principals,stage text NOT NULL CHECK(stage IN('ENSAMBLE','EMPAQUE')),line text NOT NULL CHECK(line IN('PANELES_2','FRAMES_2')),key text REFERENCES public.sgp_producciones,active boolean NOT NULL DEFAULT false,PRIMARY KEY(role_oid,stage,key));
CREATE TABLE lp_a_review.intents(id uuid PRIMARY KEY,role_oid oid NOT NULL,scope jsonb NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE lp_a_review.events(attempt uuid PRIMARY KEY,request uuid NOT NULL REFERENCES lp_a_review.intents,role_oid oid NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),role_name name NOT NULL DEFAULT session_user);
CREATE TRIGGER fixed BEFORE UPDATE OR DELETE ON lp_a_review.intents FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.inmutable();
CREATE TRIGGER fixed BEFORE UPDATE OR DELETE ON lp_a_review.events FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.inmutable();
DO $$ DECLARE r record;BEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='lp_a_review' LOOP EXECUTE format('ALTER TABLE lp_a_review.%I ENABLE ROW LEVEL SECURITY',r.tablename);END LOOP;END $$;
CREATE FUNCTION lp_a_review.perimeter_ok(who oid) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT NOT has_database_privilege(who,current_database(),'TEMP,CREATE')
 AND NOT EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname NOT IN('pg_catalog','information_schema') AND has_schema_privilege(who,n.oid,'CREATE'))
 AND NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT IN('pg_catalog','information_schema') AND p.prosecdef AND p.oid NOT IN(coalesce(to_regprocedure('lp_a_api.plan(text,text)'),0::oid),coalesce(to_regprocedure('lp_a_api.open(jsonb,uuid)'),0::oid),coalesce(to_regprocedure('lp_a_api.receipt(uuid)'),0::oid)) AND p.prorettype NOT IN('trigger'::regtype,'event_trigger'::regtype) AND has_schema_privilege(who,n.oid,'USAGE') AND has_function_privilege(who,p.oid,'EXECUTE'))
 AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN('pg_catalog','information_schema') AND c.relkind IN('r','v','m','f') AND has_schema_privilege(who,n.oid,'USAGE') AND has_table_privilege(who,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'));
$$;
CREATE FUNCTION lp_a_review.tech_actor(stage text,line text,writing boolean) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r record;p lp_a_review.principals%rowtype;BEGIN
 SELECT * INTO r FROM pg_roles WHERE rolname=session_user;
 SELECT * INTO p FROM lp_a_review.principals WHERE role_oid=r.oid AND role_name=session_user FOR SHARE;
 IF NOT FOUND OR r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolinherit OR NOT r.rolcanlogin OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid) THEN RAISE EXCEPTION 'TECHNICAL_SESSION_DENIED'; END IF;
 IF p.expires_at<=clock_timestamp() OR NOT p.allow_read OR(writing AND NOT p.allow_open) THEN RAISE EXCEPTION 'TECHNICAL_ADMISSION_DISABLED'; END IF;
 IF NOT lp_a_review.perimeter_ok(r.oid) THEN RAISE EXCEPTION 'PUBLIC_PRIVILEGE_PERIMETER_UNSAFE'; END IF;
 PERFORM 1 FROM lp_a_review.scopes s WHERE s.role_oid=r.oid AND s.active FOR SHARE;
 IF stage NOT IN('ENSAMBLE','EMPAQUE') OR line NOT IN('PANELES_2','FRAMES_2') OR NOT EXISTS(SELECT 1 FROM lp_a_review.scopes s JOIN public.sgp_producciones x ON x.key_produccion=s.key AND x.id_linea=s.line WHERE s.role_oid=r.oid AND s.stage=tech_actor.stage AND s.line=tech_actor.line AND s.active) THEN RAISE EXCEPTION 'TECHNICAL_SCOPE_DENIED'; END IF;
 RETURN jsonb_build_object('kind','TECHNICAL','role_oid',r.oid,'usuario','TECH_DB:'||r.oid,'rol','LP_ABRIDOR');
END $$;
CREATE FUNCTION lp_a_review.authorize(spec jsonb,stage text,line text) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE s jsonb;BEGIN
 IF spec->>'kind'='TECHNICAL' THEN RETURN lp_a_review.tech_actor(stage,line,true); END IF;
 IF spec->>'kind' IS DISTINCT FROM 'HUMAN' THEN RAISE EXCEPTION 'ACTOR_KIND_DENIED'; END IF;
 IF EXISTS(SELECT 1 FROM lp_a_review.principals p JOIN pg_roles r ON r.oid=p.role_oid WHERE r.rolname=session_user) THEN RAISE EXCEPTION 'HUMAN_FACADE_DENIES_TECHNICAL_SESSION'; END IF;
 s:=sgp_lp_operacion.sesion(spec->>'token',stage,NULL,line);
 IF s->>'rol' NOT IN('COORDINADOR','ADMINISTRADOR') THEN RAISE EXCEPTION 'REQUIERE_COORDINADOR'; END IF;
 RETURN s||jsonb_build_object('kind','HUMAN');
END $$;
CREATE FUNCTION lp_a_review.scope_ok(actor jsonb,stage text,k text,line text) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT CASE WHEN actor->>'kind'='HUMAN' THEN EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos p JOIN public.sgp_producciones x ON x.key_produccion=p.key WHERE p.usuario=actor->>'usuario' AND p.etapa=stage AND p.key=k AND x.id_linea=line)
 ELSE EXISTS(SELECT 1 FROM lp_a_review.scopes p JOIN public.sgp_producciones x ON x.key_produccion=p.key AND x.id_linea=p.line WHERE p.role_oid=(actor->>'role_oid')::oid AND p.stage=scope_ok.stage AND p.line=scope_ok.line AND p.key=k AND p.active) END;
$$;
CREATE FUNCTION lp_a_review.core_open(spec jsonb,p_cmd jsonb,expected jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE et text:=p_cmd->>'stage';line_id text:=p_cmd->>'line';d date:=(p_cmd->>'date')::date;t int:=(p_cmd->>'shift')::int;rid uuid:=(p_cmd->>'id')::uuid;rv bigint:=(p_cmd->>'revision')::bigint;actor jsonb;u text;tr sgp_lp_operacion.turnos%rowtype;prior sgp_lp_operacion.auditoria%rowtype;previous_turn sgp_lp_operacion.turnos%rowtype;next_period jsonb;closed jsonb;initialized jsonb;cap bigint;res jsonb;
BEGIN
 IF p_cmd->>'op' IS DISTINCT FROM 'ABRIR' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_cmd) k WHERE k NOT IN('id','op','stage','line','date','shift','revision','capacity')) THEN RAISE EXCEPTION 'ONLY_ABRIR_ALLOWED'; END IF;
 IF rid IS NULL OR rv IS NULL OR rv<0 OR d IS NULL OR t IS NULL OR t NOT IN(1,2) THEN RAISE EXCEPTION 'INVALID_OPEN_IDENTITY'; END IF;
 actor:=lp_a_review.authorize(spec,et,line_id);u:=actor->>'usuario';
 IF actor->>'kind'='TECHNICAL' AND p_cmd ? 'capacity' THEN RAISE EXCEPTION 'TECHNICAL_CAPACITY_OVERRIDE_DENIED'; END IF;
 PERFORM sgp_lp_operacion.admitir();
 PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,123));
 SELECT * INTO prior FROM sgp_lp_operacion.auditoria WHERE id=rid;
 IF FOUND THEN
  IF prior.usuario<>u OR prior.payload<>p_cmd THEN RAISE EXCEPTION 'IDEMPOTENCIA_REUTILIZADA'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(prior.respuesta->'incorporadas') x WHERE NOT lp_a_review.scope_ok(actor,et,x->>'key',line_id)) THEN RAISE EXCEPTION 'TECHNICAL_SCOPE_DENIED'; END IF;
  RETURN prior.respuesta||jsonb_build_object('duplicate',true);
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(et||'|'||line_id,184));
 actor:=lp_a_review.authorize(spec,et,line_id);
 PERFORM sgp_lp_operacion.periodo(d,t);
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.turnos x WHERE x.etapa=et AND x.linea=line_id AND(x.fecha,x.turno)>(d,t)) THEN RAISE EXCEPTION 'TURNO_CON_SUCESOR_NO_REINCORPORAR'; END IF;
 SELECT * INTO previous_turn FROM sgp_lp_operacion.turnos x WHERE x.etapa=et AND x.linea=line_id AND(x.fecha,x.turno)<(d,t) ORDER BY fecha DESC,turno DESC LIMIT 1;
 IF FOUND THEN
  next_period:=sgp_lp_operacion.siguiente(previous_turn.fecha,previous_turn.turno);
  IF next_period->>'date'<>d::text OR(next_period->>'shift')::int<>t THEN RAISE EXCEPTION 'DESTINO_NO_ES_SIGUIENTE_TURNO_OPERATIVO'; END IF;
  IF previous_turn.estado<>'CERRADO' THEN RAISE EXCEPTION 'TURNO_ORIGEN_REQUIERE_CIERRE'; END IF;
  closed:=sgp_lp_operacion.cierre_valido(et,line_id,previous_turn.fecha,previous_turn.turno);
  IF closed IS NULL THEN RAISE EXCEPTION 'CIERRE_ORIGEN_NO_ACREDITADO'; END IF;
 ELSIF actor->>'kind'='TECHNICAL' THEN RAISE EXCEPTION 'MANUAL_BOOTSTRAP_REQUIRED'; END IF;
 IF actor->>'kind'='TECHNICAL' THEN
  IF closed->>'id' IS DISTINCT FROM expected->>'previousClose' OR closed->>'version' IS DISTINCT FROM expected->>'previousVersion' OR(next_period->>'start')::timestamptz IS DISTINCT FROM(expected->>'start')::timestamptz OR(next_period->>'end')::timestamptz IS DISTINCT FROM(expected->>'end')::timestamptz THEN RAISE EXCEPTION 'STALE_OPENING_INTENT'; END IF;
  IF clock_timestamp()<(next_period->>'start')::timestamptz THEN RAISE EXCEPTION 'OPENING_NOT_DUE'; END IF;
 END IF;
 SELECT * INTO tr FROM sgp_lp_operacion.turnos WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t FOR UPDATE;
 IF FOUND AND EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes x WHERE x.etapa=et AND x.linea=line_id AND x.fecha=d AND x.turno=t AND NOT lp_a_review.scope_ok(actor,et,x.key,line_id)) THEN RAISE EXCEPTION 'TURNO_FUERA_DE_AMBITO'; END IF;
 IF FOUND AND actor->>'kind'='TECHNICAL' THEN RETURN jsonb_build_object('ok',true,'status','EXISTING_REQUIRES_RECONCILIATION','turnRevision',tr.revision,'actorKind','TECHNICAL');END IF;
 INSERT INTO sgp_lp_operacion.turnos(etapa,linea,fecha,turno) VALUES(et,line_id,d,t) ON CONFLICT DO NOTHING;
 SELECT * INTO tr FROM sgp_lp_operacion.turnos WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t FOR UPDATE;
 IF tr.estado='CERRADO' THEN RAISE EXCEPTION 'REAPERTURA_REQUERIDA'; END IF;
 IF tr.revision<>rv THEN RAISE EXCEPTION 'CONFLICTO_REVISION'; END IF;
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes x WHERE x.etapa=et AND x.linea=line_id AND x.fecha=d AND x.turno=t AND NOT lp_a_review.scope_ok(actor,et,x.key,line_id)) THEN RAISE EXCEPTION 'TURNO_FUERA_DE_AMBITO'; END IF;
-- BEGIN EXISTING ABRIR BRANCH (only permission predicates projected to actor-aware checks)
   -- Whole-turn incorporation cannot silently omit productions outside the actor's scope.
   IF EXISTS(SELECT 1 FROM public.sgp_linea_plan_asignaciones a JOIN public.sgp_producciones p USING(key_produccion) WHERE a.fecha=d AND a.turno=t AND a.estado<>'CANCELADA' AND p.id_linea=line_id AND NOT lp_a_review.scope_ok(actor,et,a.key_produccion,line_id)) OR EXISTS(SELECT 1 FROM (SELECT DISTINCT ON(key,parte) x.* FROM sgp_lp_operacion.ordenes x WHERE x.etapa=et AND x.linea=line_id AND(x.fecha,x.turno)<(d,t) ORDER BY key,parte,fecha DESC,turno DESC) a JOIN public.sgp_producciones p ON p.key_produccion=a.key WHERE (SELECT coalesce(sum(used_order.ejecutado),0) FROM sgp_lp_operacion.ordenes used_order WHERE used_order.key=a.key AND used_order.parte=a.parte AND used_order.etapa=et)<(SELECT z.cantidad FROM public.sgp_linea_plan_asignaciones z WHERE z.id=a.parte) AND(coalesce((to_jsonb(p)->>CASE WHEN et='ENSAMBLE' THEN 'saldo_ensamble' ELSE 'saldo_empaque' END)::numeric,1)>0 OR to_jsonb(p)->>'saldos_inicializados' IS DISTINCT FROM 'true') AND NOT lp_a_review.scope_ok(actor,et,a.key,line_id)) THEN RAISE EXCEPTION 'INCORPORACION_FUERA_DE_AMBITO'; END IF;
   IF p_cmd ? 'capacity' THEN
    IF et<>'EMPAQUE' OR coalesce(p_cmd->>'capacity','') !~ '^[0-9]+$' OR length(p_cmd->>'capacity')>15 THEN RAISE EXCEPTION 'CAPACIDAD_INVALIDA'; END IF;
    cap:=(p_cmd->>'capacity')::bigint;
    IF cap<coalesce((SELECT sum(sale) FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t),0) THEN RAISE EXCEPTION 'CAPACIDAD_INFERIOR_A_SALE_EXISTENTE'; END IF;
    UPDATE sgp_lp_operacion.turnos SET capacidad=cap WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t;
   END IF;
   -- One persisted root per turn. Prior execution is context, never destination execution.
   INSERT INTO sgp_lp_operacion.ordenes(etapa,linea,fecha,turno,key,parte,sale,prioridad,origen_fecha,origen_turno,afectaciones,consolidado,validado,observacion,antiguedad_fecha,antiguedad_turno,contexto_origen,apertura_id,sale_fuente,sale_estado)
   SELECT et,line_id,d,t,x.key,x.parte,CASE WHEN et='ENSAMBLE' OR (x.sale=0 AND x.sale_fuente IN('COORDINADOR','COORDINADOR_CONTINUIDAD')) THEN 0 ELSE NULL END,x.prioridad,x.fecha,x.turno,x.afectaciones,x.consolidado,false,x.observacion,coalesce(x.antiguedad_fecha,x.origen_fecha,x.fecha),coalesce(x.antiguedad_turno,x.origen_turno,x.turno),jsonb_build_object('fecha',x.fecha,'turno',x.turno,'revision',x.revision,'sale',x.sale,'ejecutado',x.ejecutado,'pendiente',greatest(coalesce(x.sale,0)-x.ejecutado,0),'sale_fuente',x.sale_fuente,'validado',x.validado),rid,CASE WHEN x.sale=0 AND x.sale_fuente IN('COORDINADOR','COORDINADOR_CONTINUIDAD') THEN 'COORDINADOR_CONTINUIDAD' ELSE 'PENDIENTE' END,'CONTINUIDAD_REVALIDAR' FROM
    (SELECT DISTINCT ON(key,parte) a.* FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND (a.fecha,a.turno)<(d,t) ORDER BY key,parte,fecha DESC,turno DESC) x
    JOIN public.sgp_producciones p ON p.key_produccion=x.key
    WHERE (SELECT coalesce(sum(q.ejecutado),0) FROM sgp_lp_operacion.ordenes q WHERE q.key=x.key AND q.parte=x.parte AND q.etapa=et)<(SELECT cantidad FROM public.sgp_linea_plan_asignaciones a WHERE a.id=x.parte)
    AND(coalesce((to_jsonb(p)->>CASE WHEN et='ENSAMBLE' THEN 'saldo_ensamble' ELSE 'saldo_empaque' END)::numeric,1)>0 OR to_jsonb(p)->>'saldos_inicializados' IS DISTINCT FROM 'true') ON CONFLICT DO NOTHING;
   INSERT INTO sgp_lp_operacion.ordenes(etapa,linea,fecha,turno,key,parte,sale,prioridad,antiguedad_fecha,antiguedad_turno,apertura_id)
   SELECT et,line_id,d,t,a.key_produccion,sgp_lp_operacion.raiz(a.id,a.key_produccion),NULL,a.prioridad,coalesce((SELECT z.fecha FROM public.sgp_linea_plan_asignaciones z WHERE z.id=sgp_lp_operacion.raiz(a.id,a.key_produccion)),d),coalesce((SELECT z.turno FROM public.sgp_linea_plan_asignaciones z WHERE z.id=sgp_lp_operacion.raiz(a.id,a.key_produccion)),t),rid FROM public.sgp_linea_plan_asignaciones a WHERE a.fecha=d AND a.turno=t AND a.estado<>'CANCELADA' AND (SELECT coalesce(sum(q.ejecutado),0) FROM sgp_lp_operacion.ordenes q WHERE q.key=a.key_produccion AND q.etapa=et AND q.parte=sgp_lp_operacion.raiz(a.id,a.key_produccion))<(SELECT cantidad FROM public.sgp_linea_plan_asignaciones z WHERE z.id=sgp_lp_operacion.raiz(a.id,a.key_produccion)) AND EXISTS(SELECT 1 FROM public.sgp_producciones z WHERE z.key_produccion=a.key_produccion AND z.id_linea=line_id) ON CONFLICT DO NOTHING;
   IF et='EMPAQUE' THEN initialized:=sgp_lp_operacion.iniciar_empaque(line_id,d,t,u); END IF;
   res:=jsonb_build_object('ok',true,'turnRevision',tr.revision+1,'incorporadas',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY key,parte) FROM sgp_lp_operacion.ordenes a WHERE a.apertura_id=rid),'[]'),'saleInitialization',initialized);
-- END EXISTING ABRIR BRANCH
 UPDATE sgp_lp_operacion.turnos SET revision=revision+1 WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t;
 res:=res||jsonb_build_object('actorKind',actor->>'kind','principalOid',actor->'role_oid','status','OPENED');
 INSERT INTO sgp_lp_operacion.auditoria(id,usuario,operacion,etapa,linea,fecha,turno,payload,antes,respuesta) VALUES(rid,u,'ABRIR',et,line_id,d,t,p_cmd,to_jsonb(tr),res);
 RETURN res;
END $$;
CREATE FUNCTION lp_a_api.human_open(p_token text,p_command jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RETURN lp_a_review.core_open(jsonb_build_object('kind','HUMAN','token',p_token),p_command,NULL);END $$;
CREATE FUNCTION lp_a_api.plan(line text,stage text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM lp_a_review.tech_actor(stage,line,false);RETURN sgp_lp_operacion.apertura_preparada(stage,line);END $$;
CREATE FUNCTION lp_a_api.open(p_request jsonb,p_attempt uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor jsonb;who oid;req uuid;prior lp_a_review.intents%rowtype;e lp_a_review.events%rowtype;response jsonb;result jsonb;code text;state text;BEGIN
 actor:=lp_a_review.tech_actor(p_request->>'stage',p_request->>'line',true);who:=(actor->>'role_oid')::oid;
 PERFORM sgp_lp_operacion.admitir();
 IF jsonb_typeof(p_request) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_request) k WHERE k NOT IN('id','op','line','stage','date','shift','revision','expected')) OR p_request->>'op' IS DISTINCT FROM 'ABRIR' OR p_attempt IS NULL THEN RAISE EXCEPTION 'ONLY_ABRIR_REQUEST_ALLOWED'; END IF;
 req:=(p_request->>'id')::uuid;IF req IS NULL THEN RAISE EXCEPTION 'REQUEST_ID_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(req::text,123));
 SELECT * INTO prior FROM lp_a_review.intents WHERE id=req;
 IF FOUND AND(prior.role_oid<>who OR prior.payload<>p_request) THEN RAISE EXCEPTION 'IDEMPOTENCIA_REUTILIZADA'; END IF;
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.auditoria au CROSS JOIN LATERAL jsonb_array_elements(au.respuesta->'incorporadas') x WHERE au.id=req AND NOT lp_a_review.scope_ok(actor,p_request->>'stage',x->>'key',p_request->>'line')) THEN RAISE EXCEPTION 'TECHNICAL_SCOPE_DENIED'; END IF;
 IF NOT FOUND THEN INSERT INTO lp_a_review.intents VALUES(req,who,jsonb_build_object('line',p_request->>'line','stage',p_request->>'stage'),p_request,clock_timestamp());END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_attempt::text,188));
 SELECT * INTO e FROM lp_a_review.events WHERE attempt=p_attempt;
 IF FOUND THEN IF e.request<>req OR e.role_oid<>who THEN RAISE EXCEPTION 'ATTEMPT_REUSED';END IF;RETURN e.result||jsonb_build_object('duplicateAttempt',true);END IF;
 BEGIN
  result:=lp_a_review.core_open('{"kind":"TECHNICAL"}'::jsonb,p_request-'expected',p_request->'expected');
  response:=jsonb_build_object('ok',true,'status',result->>'status','request',req,'actorKind','TECHNICAL','principalOid',who,'turnRevision',result->'turnRevision','duplicate',coalesce((result->>'duplicate')::boolean,false));
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS code=MESSAGE_TEXT,state=RETURNED_SQLSTATE;
  response:=jsonb_build_object('ok',false,'status','BLOCKED','request',req,'code',CASE WHEN code~'^[A-Z0-9_]+$' THEN code ELSE 'UNEXPECTED_ENGINE_ERROR' END,'sqlstate',state);
 END;
 INSERT INTO lp_a_review.events(attempt,request,role_oid,result,created_at) VALUES(p_attempt,req,who,response,clock_timestamp());RETURN response;
END $$;
CREATE FUNCTION lp_a_api.receipt(p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i lp_a_review.intents%rowtype;a jsonb;result jsonb;BEGIN
 SELECT * INTO i FROM lp_a_review.intents WHERE id=p_request;
 IF NOT FOUND THEN RAISE EXCEPTION 'RECEIPT_NOT_AVAILABLE';END IF;
 a:=lp_a_review.tech_actor(i.scope->>'stage',i.scope->>'line',false);
 IF i.role_oid<>(a->>'role_oid')::oid THEN RAISE EXCEPTION 'RECEIPT_NOT_OWNED'; END IF;
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.auditoria au CROSS JOIN LATERAL jsonb_array_elements(au.respuesta->'incorporadas') x WHERE au.id=p_request AND NOT lp_a_review.scope_ok(a,i.scope->>'stage',x->>'key',i.scope->>'line')) THEN RAISE EXCEPTION 'TECHNICAL_SCOPE_DENIED'; END IF;
 SELECT e.result INTO result FROM lp_a_review.events e WHERE e.request=p_request ORDER BY e.created_at DESC,e.attempt DESC LIMIT 1;
 RETURN jsonb_build_object('found',true,'response',result);
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA lp_a_review FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA lp_a_review,lp_a_api FROM PUBLIC,anon,authenticated;
COMMIT;

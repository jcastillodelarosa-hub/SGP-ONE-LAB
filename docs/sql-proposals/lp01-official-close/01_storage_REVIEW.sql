-- REVIEW ONLY. Private persistence for server-computed official close transitions.
-- Not a migration/activation. No grants, roles, scheduler or native turn mutations.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'OFFICIAL_OWNER_REVIEW_REQUIRED'; END IF;
 IF to_regprocedure('sgp_lp_operacion.sesion(text,text,text,text)') IS NULL
 OR to_regprocedure('sgp_lp_operacion.admitir()') IS NULL
 OR to_regprocedure('sgp_lp_operacion.periodo(date,integer)') IS NULL
 OR to_regclass('public.sgp_linea_plan_asignaciones') IS NULL
 THEN RAISE EXCEPTION 'OFFICIAL_BASE_MISSING'; END IF;
 IF to_regnamespace('sgp_lp_official') IS NOT NULL THEN RAISE EXCEPTION 'OFFICIAL_ALREADY_EXISTS'; END IF;
END $$;
CREATE SCHEMA sgp_lp_official;
REVOKE ALL ON SCHEMA sgp_lp_official FROM PUBLIC,anon,authenticated;
CREATE TABLE sgp_lp_official.config(id boolean PRIMARY KEY CHECK(id),enabled boolean NOT NULL DEFAULT false);
INSERT INTO sgp_lp_official.config VALUES(true,false);
CREATE TABLE sgp_lp_official.ledger(stage text NOT NULL CHECK(stage IN('ENSAMBLE','EMPAQUE')),line text NOT NULL CHECK(line IN('PANELES_2','FRAMES_2')),revision bigint NOT NULL CHECK(revision>=0),state jsonb NOT NULL,PRIMARY KEY(stage,line));
CREATE TABLE sgp_lp_official.events(id uuid PRIMARY KEY,stage text NOT NULL,line text NOT NULL,actor text NOT NULL,request_hash text NOT NULL,source_fingerprint text NOT NULL,revision bigint NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE sgp_lp_official.files(id uuid PRIMARY KEY REFERENCES sgp_lp_official.events,name text NOT NULL,sha256 text NOT NULL,bytes bytea NOT NULL);
ALTER TABLE sgp_lp_official.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_official.ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_official.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_official.files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_lp_official FROM PUBLIC,anon,authenticated;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON sgp_lp_official.events FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.inmutable();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON sgp_lp_official.files FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.inmutable();

CREATE FUNCTION public.sgp_lp_official_context_v1(p_token text,p_context jsonb,p_id uuid,p_request_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE et text:=p_context->>'stage';lin text:=p_context->>'line';d date:=(p_context->>'date')::date;t int:=(p_context->>'shift')::int;
 s jsonb;st jsonb;catalog jsonb;plan_rows jsonb;plan jsonb;period jsonb;native_turn jsonb;fingerprint text;event sgp_lp_official.events%rowtype;r jsonb;enabled boolean;
BEGIN
 s:=sgp_lp_operacion.sesion(p_token,et,NULL,lin);
 IF s->>'rol'='CONSULTA' THEN RAISE EXCEPTION 'OFFICIAL_WRITE_ROLE_REQUIRED'; END IF;
 IF p_id IS NULL OR p_request_hash !~ '^[a-f0-9]{64}$' OR p_request_hash IS NULL OR et NOT IN('ENSAMBLE','EMPAQUE') OR lin NOT IN('PANELES_2','FRAMES_2') OR d IS NULL OR t IS NULL OR t NOT IN(1,2) OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_context) k WHERE k NOT IN('stage','line','date','shift')) THEN RAISE EXCEPTION 'OFFICIAL_CONTEXT_INVALID'; END IF;
 SELECT state INTO st FROM sgp_lp_official.ledger WHERE stage=et AND line=lin;
 st:=coalesce(st,'{"contract":"LP-OFFICIAL-CLOSE-1","revision":0,"entries":[],"pending":[],"history":[],"closures":[],"receipts":[]}'::jsonb);
 -- No partial-scope reader may receive another order's stored history.
 FOR r IN SELECT value FROM jsonb_array_elements(st->'entries') LOOP
  PERFORM sgp_lp_operacion.sesion(p_token,et,r->>'key',lin);
 END LOOP;
 SELECT * INTO event FROM sgp_lp_official.events WHERE id=p_id;
 IF FOUND THEN
  IF event.actor<>s->>'usuario' OR event.stage<>et OR event.line<>lin OR event.request_hash<>p_request_hash THEN RAISE EXCEPTION 'IDEMPOTENCIA_REUTILIZADA'; END IF;
  RETURN jsonb_build_object('contract','LP-OFFICIAL-CONTEXT-1','receipt',event.result);
 END IF;
 PERFORM sgp_lp_operacion.admitir();
 SELECT c.enabled INTO enabled FROM sgp_lp_official.config c WHERE id FOR SHARE;
 IF enabled IS DISTINCT FROM true THEN RAISE EXCEPTION 'OFFICIAL_NOT_ENABLED'; END IF;
 SELECT to_jsonb(x) INTO native_turn FROM sgp_lp_operacion.turnos x WHERE x.etapa=et AND x.linea=lin AND x.fecha=d AND x.turno=t FOR SHARE;
 IF native_turn IS NULL THEN RAISE EXCEPTION 'TURNO_NO_EXISTE'; END IF;
 IF native_turn->>'estado'='EN_REVISION' AND s->>'rol' NOT IN('COORDINADOR','ADMINISTRADOR') THEN RAISE EXCEPTION 'CORRECCION_REQUIERE_COORDINADOR'; END IF;
 IF native_turn->>'estado'='CERRADO' THEN RAISE EXCEPTION 'REAPERTURA_REQUERIDA'; END IF;
 period:=sgp_lp_operacion.periodo(d,t)||jsonb_build_object('timezone','America/Bogota');
 -- Canonical source rows, not identity or authorization evidence supplied by a client.
 SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.key_produccion),'[]') INTO catalog
 FROM public.sgp_producciones p WHERE p.id_linea=lin AND EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos a WHERE a.usuario=s->>'usuario' AND a.etapa=et AND a.key=p.key_produccion);
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.key),'[]') INTO plan_rows FROM (
  SELECT a.key_produccion key,sum(a.cantidad)::bigint quantity,jsonb_agg(to_jsonb(a) ORDER BY a.id) assignments
  FROM public.sgp_linea_plan_asignaciones a JOIN public.sgp_producciones p USING(key_produccion)
  WHERE p.id_linea=lin AND a.fecha=d AND a.turno=t AND a.estado IS DISTINCT FROM 'CANCELADA'
  GROUP BY a.key_produccion)x;
 FOR r IN SELECT value FROM jsonb_array_elements(plan_rows) LOOP PERFORM sgp_lp_operacion.sesion(p_token,et,r->>'key',lin);END LOOP;
 plan:=p_context||jsonb_build_object('revision',md5(plan_rows::text),'rows',plan_rows);
 fingerprint:=md5(jsonb_build_object('catalog',catalog,'plan',plan,'schedule',period,'turn',native_turn)::text);
 RETURN jsonb_build_object('contract','LP-OFFICIAL-CONTEXT-1','actor',s->>'usuario','observedAt',clock_timestamp(),'state',st,'catalog',catalog,'plan',plan,'schedule',period,'fingerprint',fingerprint);
END $$;
REVOKE ALL ON FUNCTION public.sgp_lp_official_context_v1(text,jsonb,uuid,text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.sgp_lp_official_commit_v1(p_token text,p_context jsonb,p_id uuid,p_request_hash text,p_source_fingerprint text,p_expected_revision bigint,p_state jsonb,p_result jsonb,p_file jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE et text:=p_context->>'stage';lin text:=p_context->>'line';ctx jsonb;old jsonb;r jsonb;rev bigint;raw bytea;result jsonb;s jsonb;
BEGIN
 s:=sgp_lp_operacion.sesion(p_token,et,NULL,lin);
 PERFORM pg_advisory_xact_lock(hashtextextended(et||'/'||lin,61106));
 -- Brief source lock only for commit: a changed plan/catalog/schedule rejects the CAS.
 -- Same order for every writer; source writers cannot slip between fingerprint and COMMIT.
 LOCK TABLE public.sgp_configuracion_general,public.sgp_producciones,public.sgp_linea_plan_asignaciones IN SHARE MODE;
 ctx:=public.sgp_lp_official_context_v1(p_token,p_context,p_id,p_request_hash);
 IF ctx ? 'receipt' THEN RETURN ctx->'receipt'; END IF;
 old:=ctx->'state';rev:=(old->>'revision')::bigint;
 IF p_expected_revision IS NULL OR rev<>p_expected_revision THEN RAISE EXCEPTION 'CONFLICTO_REVISION'; END IF;
 IF ctx->>'fingerprint' IS DISTINCT FROM p_source_fingerprint THEN RAISE EXCEPTION 'OFFICIAL_SOURCE_CHANGED'; END IF;
 IF p_state->>'contract' IS DISTINCT FROM 'LP-OFFICIAL-CLOSE-1' OR (p_state->>'revision')::bigint IS DISTINCT FROM rev+1 OR jsonb_typeof(p_state->'entries') IS DISTINCT FROM 'array' OR jsonb_typeof(p_state->'history') IS DISTINCT FROM 'array' OR jsonb_typeof(p_state->'closures') IS DISTINCT FROM 'array' OR jsonb_typeof(p_state->'receipts') IS DISTINCT FROM 'array' OR jsonb_typeof(p_state->'pending') IS DISTINCT FROM 'array' OR p_result->>'id' IS DISTINCT FROM p_id::text OR p_result->'context' IS DISTINCT FROM p_context THEN RAISE EXCEPTION 'OFFICIAL_TRANSITION_INVALID'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(old->'history') WITH ORDINALITY h(v,n) WHERE p_state->'history'->(h.n::int-1) IS DISTINCT FROM h.v)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(old->'closures') WITH ORDINALITY h(v,n) WHERE p_state->'closures'->(h.n::int-1) IS DISTINCT FROM h.v)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(old->'receipts') WITH ORDINALITY h(v,n) WHERE p_state->'receipts'->(h.n::int-1) IS DISTINCT FROM h.v) THEN RAISE EXCEPTION 'HISTORIAL_INMUTABLE'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_state->'entries') LOOP
  IF r->>'stage' IS DISTINCT FROM et OR r->>'line' IS DISTINCT FROM lin OR coalesce(r->>'quantity','') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'OFFICIAL_ENTRY_INVALID'; END IF;
  PERFORM sgp_lp_operacion.sesion(p_token,et,r->>'key',lin);
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_state->'entries') e GROUP BY e->>'key',e->>'date',e->>'shift' HAVING count(*)>1) THEN RAISE EXCEPTION 'OFFICIAL_ENTRY_DUPLICATE'; END IF;
 -- Parser output is accepted only from the future reviewed server credential.
 -- No EXECUTE is granted by this definition to any API role.
 IF p_file IS NOT NULL THEN
  raw:=decode(p_file->>'base64','base64');
  IF octet_length(raw)<22 OR octet_length(raw)>2097152 OR p_file->>'sha256' IS DISTINCT FROM encode(sha256(raw),'hex') OR p_result->>'sha256' IS DISTINCT FROM p_file->>'sha256' OR p_file->>'name' !~* '\.xlsx$' THEN RAISE EXCEPTION 'OFFICIAL_FILE_INVALID'; END IF;
 END IF;
 result:=jsonb_build_object('contract','LP-OFFICIAL-COMMITTED-1','id',p_id,'revision',rev+1,'result',p_result);
 INSERT INTO sgp_lp_official.ledger VALUES(et,lin,rev+1,p_state) ON CONFLICT(stage,line) DO UPDATE SET revision=excluded.revision,state=excluded.state;
 INSERT INTO sgp_lp_official.events(id,stage,line,actor,request_hash,source_fingerprint,revision,result) VALUES(p_id,et,lin,ctx->>'actor',p_request_hash,p_source_fingerprint,rev+1,result);
 IF p_file IS NOT NULL THEN INSERT INTO sgp_lp_official.files VALUES(p_id,p_file->>'name',p_file->>'sha256',raw);END IF;
 -- End-of-transaction authorization is rechecked after potentially blocking locks.
 PERFORM sgp_lp_operacion.sesion(p_token,et,NULL,lin);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.sgp_lp_official_commit_v1(text,jsonb,uuid,text,text,bigint,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
-- Fail closed if deployment-specific default ACL would expose newly defined objects.
-- Do not change global/default ACL or create a technical principal to pass this guard.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
   WHERE p.oid IN('public.sgp_lp_official_context_v1(text,jsonb,uuid,text)'::regprocedure,'public.sgp_lp_official_commit_v1(text,jsonb,uuid,text,text,bigint,jsonb,jsonb,jsonb)'::regprocedure) AND a.grantee<>p.proowner)
 OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname='sgp_lp_official' AND c.relkind='r' AND a.grantee<>c.relowner)
 THEN RAISE EXCEPTION 'OFFICIAL_NEW_OBJECT_ACL_REQUIRES_REVIEW'; END IF;
END $$;
COMMIT;

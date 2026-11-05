-- ISOLATED REVIEW. Records an order definition; never applies it to any turn.
-- No grants, production installation, turn consumption, reset or migration.
BEGIN;
SET LOCAL search_path='';SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
DO $guard$ BEGIN
 IF current_user<>'postgres' OR to_regnamespace('sgp_lp_sale_orden') IS NOT NULL
 OR to_regprocedure('public.sgp_lp_sale_orden_consultar_v1(text,text,text)') IS NOT NULL
 OR to_regprocedure('public.sgp_lp_sale_orden_definir_v1(text,text,text,jsonb)') IS NOT NULL
 THEN RAISE EXCEPTION 'SALE_ORDER_INSTALL_CONFLICT';END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('sgp_lp_afectaciones.actor(text,text,text,text,date,integer)')) IS DISTINCT FROM 'ad60fdc6dd01904c366010467f96e6ca'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.sgp_lp_afectaciones_consultar_v2(text,text,text)')) IS DISTINCT FROM 'a74f14fefe3a3d91201423fdc3111d7a'
 THEN RAISE EXCEPTION 'SALE_ORDER_DEPENDENCY_DRIFT';END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid IN(to_regprocedure('sgp_lp_afectaciones.actor(text,text,text,text,date,integer)'),to_regprocedure('public.sgp_lp_afectaciones_consultar_v2(text,text,text)'))
  AND(p.proowner IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='postgres') OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
   OR p.prosecdef IS DISTINCT FROM (p.proname='sgp_lp_afectaciones_consultar_v2')
   OR (SELECT count(*) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))))<>CASE WHEN p.proname='sgp_lp_afectaciones_consultar_v2' THEN 2 ELSE 1 END
   OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.privilege_type<>'EXECUTE' OR a.is_grantable OR(a.grantee<>p.proowner AND NOT(p.proname='sgp_lp_afectaciones_consultar_v2' AND a.grantee=(SELECT oid FROM pg_roles WHERE rolname='anon'))))))
 THEN RAISE EXCEPTION 'SALE_ORDER_DEPENDENCY_SECURITY';END IF;
END $guard$;
CREATE SCHEMA sgp_lp_sale_orden;
REVOKE ALL ON SCHEMA sgp_lp_sale_orden FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE sgp_lp_sale_orden.config(id boolean PRIMARY KEY DEFAULT true CHECK(id),definitions_enabled boolean NOT NULL DEFAULT false);
INSERT INTO sgp_lp_sale_orden.config VALUES(true,false);
CREATE TABLE sgp_lp_sale_orden.definiciones(
 key text NOT NULL REFERENCES public.sgp_producciones(key_produccion),etapa text NOT NULL CHECK(etapa IN('ENSAMBLE','EMPAQUE')),
 revision bigint NOT NULL CHECK(revision>0),cantidad bigint NOT NULL CHECK(cantidad>=0),usuario text NOT NULL,registrado_en timestamptz NOT NULL,
 PRIMARY KEY(key,etapa)
);
CREATE TABLE sgp_lp_sale_orden.eventos(
 id uuid PRIMARY KEY,key text NOT NULL,etapa text NOT NULL,revision bigint NOT NULL CHECK(revision>0),
 cantidad bigint NOT NULL CHECK(cantidad>=0),antes jsonb,fuentes jsonb NOT NULL,
 observacion text NOT NULL CHECK(length(btrim(observacion)) BETWEEN 1 AND 2000),usuario text NOT NULL,registrado_en timestamptz NOT NULL,
 solicitud jsonb NOT NULL,respuesta jsonb NOT NULL,
 UNIQUE(key,etapa,revision),FOREIGN KEY(key,etapa) REFERENCES sgp_lp_sale_orden.definiciones(key,etapa)
);
CREATE FUNCTION sgp_lp_sale_orden.inmutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'SALE_ORDER_HISTORY_IMMUTABLE';END $$;
CREATE TRIGGER eventos_inmutables BEFORE UPDATE OR DELETE ON sgp_lp_sale_orden.eventos FOR EACH ROW EXECUTE FUNCTION sgp_lp_sale_orden.inmutable();
-- Re-check wall-clock expiry after waits; sgp_sesion_actual uses transaction-start now().
CREATE FUNCTION sgp_lp_sale_orden.sesion_viva(token text,usuario text) RETURNS boolean LANGUAGE sql SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.sgp_sesiones_app a JOIN public.sgp_usuarios u ON u.id_usuario=a.id_usuario
 WHERE a.token_hash=encode(extensions.digest(coalesce(token,''),'sha256'),'hex')
 AND a.revocado_en IS NULL AND a.expira_en>clock_timestamp() AND u.activo AND u.usuario=usuario)
$$;
-- Same accredited union and source coverage as Seguimiento, no sum of causes/pieces.
CREATE FUNCTION sgp_lp_sale_orden.fuentes(token text,k text,et text) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE e jsonb;p jsonb;bal bigint;available bigint;result jsonb;BEGIN
 e:=public.sgp_lp_afectaciones_consultar_v2(token,k,et);
 SELECT to_jsonb(x) INTO p FROM public.sgp_producciones x WHERE key_produccion=k;
 BEGIN bal:=sgp_lp_operacion.saldo(k,et);EXCEPTION WHEN OTHERS THEN bal:=NULL;END;
 IF e->'aluminumPending'->>'status'='AVAILABLE' AND bal IS NOT NULL
 AND (e->'consolidated'->>'revision')::bigint=(e->>'revision')::bigint
 AND (e->'consolidated'->>'balance')::bigint=bal
 AND (e->'consolidated'->>'quantity')::bigint BETWEEN 0 AND bal
 AND (e->>'available')::bigint=bal-(e->'consolidated'->>'quantity')::bigint
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(e->'aluminumPending'->'rows') a WHERE a->>'state'='PENDIENTE' AND NOT EXISTS(
  SELECT 1 FROM jsonb_array_elements(e->'reports') r CROSS JOIN LATERAL jsonb_array_elements(r->'sources') f WHERE f->>'id'=a->>'id'))
 THEN available:=(e->>'available')::bigint;END IF;
 result:=jsonb_build_object('exportBalance',bal,'available',available,'affectationRevision',e->'revision','consolidated',e->'consolidated',
  'exportLoad',p->'ultima_carga_diaria','exportAt',p->'ultima_vez_export','aluminum',e->'aluminumPending');
 RETURN jsonb_build_object('exportBalance',bal,'available',available,'fingerprint',md5(result::text),'evidence',result);
END $$;
CREATE FUNCTION public.sgp_lp_sale_orden_consultar_v1(p_token text,p_key text,p_stage text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;d jsonb;source jsonb;hist jsonb;enabled boolean;BEGIN
 s:=sgp_lp_afectaciones.actor(p_token,p_key,p_stage,'LEER');
 PERFORM 1 FROM public.sgp_producciones WHERE key_produccion=p_key FOR SHARE;
 s:=sgp_lp_afectaciones.actor(p_token,p_key,p_stage,'LEER');
 SELECT to_jsonb(x) INTO d FROM sgp_lp_sale_orden.definiciones x WHERE key=p_key AND etapa=p_stage;
 source:=sgp_lp_sale_orden.fuentes(p_token,p_key,p_stage);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'revision',e.revision,'quantity',e.cantidad,'before',e.antes,'observation',e.observacion,'user',e.usuario,'at',e.registrado_en) ORDER BY e.revision),'[]') INTO hist FROM sgp_lp_sale_orden.eventos e WHERE e.key=p_key AND e.etapa=p_stage;
 SELECT definitions_enabled INTO enabled FROM sgp_lp_sale_orden.config WHERE id;
 IF NOT sgp_lp_sale_orden.sesion_viva(p_token,s->>'usuario') THEN RAISE EXCEPTION 'SALE_ORDER_SESSION_EXPIRED';END IF;
 RETURN jsonb_build_object('contract','LP-ORDER-SALE-1','key',p_key,'stage',p_stage,'role',s->>'rol',
  'quantity',d->'cantidad','revision',coalesce((d->>'revision')::bigint,0),'source',source-'evidence','history',hist,
  'capabilities',CASE WHEN enabled AND s->>'rol' IN('COORDINADOR','ADMINISTRADOR') AND sgp_lp_operacion.puede_operar(s->>'usuario',p_stage,'SALE') THEN '["READ","DEFINE"]'::jsonb ELSE '["READ"]'::jsonb END,
  'temporalPolicy','UNRESOLVED','operational',false);
END $$;
CREATE FUNCTION public.sgp_lp_sale_orden_definir_v1(p_token text,p_key text,p_stage text,p_cmd jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;rid uuid;q bigint;rv bigint;prior sgp_lp_sale_orden.eventos%rowtype;d sgp_lp_sale_orden.definiciones%rowtype;
 source jsonb;request jsonb;response jsonb;stamp timestamptz;enabled boolean;BEGIN
 IF jsonb_typeof(p_cmd) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_cmd) k WHERE k NOT IN('id','quantity','revision','sourceFingerprint','observation'))
 OR coalesce(p_cmd->>'quantity','')!~'^[0-9]{1,9}$' OR coalesce(p_cmd->>'revision','')!~'^[0-9]{1,16}$'
 OR length(btrim(coalesce(p_cmd->>'observation',''))) NOT BETWEEN 1 AND 2000 OR nullif(p_cmd->>'sourceFingerprint','') IS NULL
 THEN RAISE EXCEPTION 'SALE_ORDER_COMMAND_INVALID';END IF;
 rid:=(p_cmd->>'id')::uuid;q:=(p_cmd->>'quantity')::bigint;rv:=(p_cmd->>'revision')::bigint;
 IF rid IS NULL THEN RAISE EXCEPTION 'SALE_ORDER_ID_REQUIRED';END IF;
 s:=sgp_lp_afectaciones.actor(p_token,p_key,p_stage,'SALE');
 IF s->>'rol' NOT IN('COORDINADOR','ADMINISTRADOR') THEN RAISE EXCEPTION 'SALE_ORDER_COORDINATOR_ADMIN_ONLY';END IF;
 SELECT definitions_enabled INTO enabled FROM sgp_lp_sale_orden.config WHERE id FOR SHARE;
 IF enabled IS DISTINCT FROM true THEN RAISE EXCEPTION 'SALE_ORDER_DEFINITIONS_DISABLED';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,387));
 s:=sgp_lp_afectaciones.actor(p_token,p_key,p_stage,'SALE');
 IF s->>'rol' NOT IN('COORDINADOR','ADMINISTRADOR') OR NOT sgp_lp_operacion.puede_operar(s->>'usuario',p_stage,'SALE') THEN RAISE EXCEPTION 'SALE_ORDER_COORDINATOR_ADMIN_ONLY';END IF;
 request:=jsonb_build_object('key',p_key,'stage',p_stage,'command',p_cmd);
 SELECT * INTO prior FROM sgp_lp_sale_orden.eventos WHERE id=rid;
 IF FOUND THEN
  IF NOT sgp_lp_sale_orden.sesion_viva(p_token,s->>'usuario') THEN RAISE EXCEPTION 'SALE_ORDER_SESSION_EXPIRED';END IF;
  IF prior.usuario<>s->>'usuario' OR prior.solicitud<>request THEN RAISE EXCEPTION 'SALE_ORDER_IDEMPOTENCY_REUSED';END IF;
  RETURN prior.respuesta||jsonb_build_object('duplicate',true);
 END IF;
 PERFORM 1 FROM public.sgp_producciones WHERE key_produccion=p_key FOR UPDATE;
 s:=sgp_lp_afectaciones.actor(p_token,p_key,p_stage,'SALE');
 IF s->>'rol' NOT IN('COORDINADOR','ADMINISTRADOR') THEN RAISE EXCEPTION 'SALE_ORDER_COORDINATOR_ADMIN_ONLY';END IF;
 SELECT * INTO d FROM sgp_lp_sale_orden.definiciones WHERE key=p_key AND etapa=p_stage;
 IF coalesce(d.revision,0)<>rv THEN RAISE EXCEPTION 'SALE_ORDER_REVISION_STALE';END IF;
 source:=sgp_lp_sale_orden.fuentes(p_token,p_key,p_stage);
 IF source->>'available' IS NULL THEN RAISE EXCEPTION 'SALE_ORDER_AVAILABILITY_PENDING';END IF;
 IF source->>'fingerprint'<>p_cmd->>'sourceFingerprint' THEN RAISE EXCEPTION 'SALE_ORDER_SOURCE_STALE';END IF;
 IF q>(source->>'available')::bigint THEN RAISE EXCEPTION 'SALE_ORDER_EXCEEDS_AVAILABLE';END IF;
 IF NOT sgp_lp_sale_orden.sesion_viva(p_token,s->>'usuario') THEN RAISE EXCEPTION 'SALE_ORDER_SESSION_EXPIRED';END IF;
 stamp:=clock_timestamp();
 INSERT INTO sgp_lp_sale_orden.definiciones VALUES(p_key,p_stage,rv+1,q,s->>'usuario',stamp)
 ON CONFLICT(key,etapa) DO UPDATE SET revision=EXCLUDED.revision,cantidad=EXCLUDED.cantidad,usuario=EXCLUDED.usuario,registrado_en=EXCLUDED.registrado_en;
 response:=jsonb_build_object('contract','LP-ORDER-SALE-SAVED-1','id',rid,'key',p_key,'stage',p_stage,'quantity',q,'revision',rv+1,'duplicate',false,'operational',false,'temporalPolicy','UNRESOLVED');
 INSERT INTO sgp_lp_sale_orden.eventos VALUES(rid,p_key,p_stage,rv+1,q,to_jsonb(d),source->'evidence',btrim(p_cmd->>'observation'),s->>'usuario',stamp,request,response);
 RETURN response;
END $$;
ALTER TABLE sgp_lp_sale_orden.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_sale_orden.definiciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_sale_orden.eventos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_lp_sale_orden FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_lp_sale_orden FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.sgp_lp_sale_orden_consultar_v1(text,text,text),public.sgp_lp_sale_orden_definir_v1(text,text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;

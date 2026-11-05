-- REVIEW ONLY. No production installation or grants. No legacy note migration.
BEGIN;
SET LOCAL search_path=''; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regnamespace('sgp_lp_order_details') IS NOT NULL THEN RAISE EXCEPTION 'ORDER_DETAILS_INSTALL_CONFLICT'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('sgp_lp_afectaciones.actor(text,text,text,text,date,integer)')) IS DISTINCT FROM 'ad60fdc6dd01904c366010467f96e6ca'
 THEN RAISE EXCEPTION 'ORDER_DETAILS_DEPENDENCY_DRIFT'; END IF;
END $$;
CREATE SCHEMA sgp_lp_order_details;
REVOKE ALL ON SCHEMA sgp_lp_order_details FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE sgp_lp_order_details.config(id boolean PRIMARY KEY DEFAULT true CHECK(id),writes boolean NOT NULL DEFAULT false);
INSERT INTO sgp_lp_order_details.config VALUES(true,false);
-- key_produccion is canonical production|line; stage is authorization context only.
CREATE TABLE sgp_lp_order_details.notes(
 key text PRIMARY KEY REFERENCES public.sgp_producciones(key_produccion),
 revision bigint NOT NULL CHECK(revision>0),observation text NOT NULL CHECK(length(observation)<=2000),
 actor text NOT NULL,at timestamptz NOT NULL
);
CREATE TABLE sgp_lp_order_details.events(
 id uuid PRIMARY KEY,key text NOT NULL REFERENCES sgp_lp_order_details.notes(key),revision bigint NOT NULL CHECK(revision>0),
 stage text NOT NULL CHECK(stage IN('ENSAMBLE','EMPAQUE')),actor text NOT NULL,at timestamptz NOT NULL,
 before_state jsonb,observation text NOT NULL CHECK(length(observation)<=2000),request jsonb NOT NULL,response jsonb NOT NULL,
 UNIQUE(key,revision)
);
CREATE FUNCTION sgp_lp_order_details.immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'ORDER_NOTE_HISTORY_IMMUTABLE';END $$;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON sgp_lp_order_details.events FOR EACH ROW EXECUTE FUNCTION sgp_lp_order_details.immutable();
CREATE FUNCTION sgp_lp_order_details.authorize(token text,k text,stage text,op text) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE s jsonb; BEGIN
 -- Reuse current scope and access-catalog locks. Never grant a new role or scope.
 s:=sgp_lp_afectaciones.actor(token,k,stage,'LEER');
 IF op='NOTA' AND NOT sgp_lp_operacion.puede_operar(s->>'usuario',stage,'NOTA') THEN RAISE EXCEPTION 'ORDER_NOTE_PERMISSION_DENIED';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sgp_sesiones_app a JOIN public.sgp_usuarios u ON u.id_usuario=a.id_usuario
 WHERE a.token_hash=encode(extensions.digest(coalesce(token,''),'sha256'),'hex') AND a.revocado_en IS NULL AND a.expira_en>clock_timestamp() AND u.activo AND u.usuario=s->>'usuario')
 THEN RAISE EXCEPTION 'ORDER_NOTE_SESSION_EXPIRED';END IF;
 RETURN s;
END $$;
CREATE FUNCTION public.sgp_lp_order_details_read_v1(p_token text,p_key text,p_stage text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;n jsonb;p jsonb;h jsonb;enabled boolean; BEGIN
 s:=sgp_lp_order_details.authorize(p_token,p_key,p_stage,'LEER');
 PERFORM 1 FROM public.sgp_producciones WHERE key_produccion=p_key FOR SHARE;
 s:=sgp_lp_order_details.authorize(p_token,p_key,p_stage,'LEER');
 SELECT to_jsonb(x) INTO p FROM public.sgp_producciones x WHERE key_produccion=p_key;
 SELECT to_jsonb(x) INTO n FROM sgp_lp_order_details.notes x WHERE key=p_key;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'revision',revision,'stage',stage,'actor',actor,'at',at,'observation',observation) ORDER BY revision),'[]') INTO h FROM sgp_lp_order_details.events WHERE key=p_key;
 SELECT writes AND (SELECT escrituras FROM sgp_lp_operacion.config WHERE id) INTO enabled FROM sgp_lp_order_details.config WHERE id;
 RETURN jsonb_build_object('contract','LP-ORDER-DETAILS-1','key',p_key,'line',p->>'id_linea','stage',p_stage,
 'note',jsonb_build_object('observation',coalesce(n->>'observation',''),'revision',coalesce((n->>'revision')::bigint,0),'actor',n->'actor','at',n->'at'),
 'history',h,'capabilities',CASE WHEN enabled AND sgp_lp_operacion.puede_operar(s->>'usuario',p_stage,'NOTA') THEN '["READ","NOTE"]'::jsonb ELSE '["READ"]'::jsonb END,
 -- Strings preserve decimal precision; null/absent inputs are never coerced to 0.
 'export',jsonb_build_object('quantity',p->>'cantidad','percentage',p->>'porc_vidrio','present',p->'presente_ultimo_export','at',p->'ultima_vez_export','load',p->'ultima_carga_diaria'));
END $$;
CREATE FUNCTION public.sgp_lp_order_note_save_v1(p_token text,p_key text,p_stage text,p_cmd jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;rid uuid;rv bigint;n sgp_lp_order_details.notes%rowtype;e sgp_lp_order_details.events%rowtype;req jsonb;res jsonb;stamp timestamptz;enabled boolean; BEGIN
 IF jsonb_typeof(p_cmd) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_cmd) k WHERE k NOT IN('id','revision','observation'))
 OR jsonb_typeof(p_cmd->'observation') IS DISTINCT FROM 'string' OR length(p_cmd->>'observation')>2000
 OR coalesce(p_cmd->>'revision','')!~'^[0-9]{1,15}$' THEN RAISE EXCEPTION 'ORDER_NOTE_COMMAND_INVALID';END IF;
 rid:=(p_cmd->>'id')::uuid;rv:=(p_cmd->>'revision')::bigint;
 IF rid IS NULL THEN RAISE EXCEPTION 'ORDER_NOTE_ID_REQUIRED';END IF;
 s:=sgp_lp_order_details.authorize(p_token,p_key,p_stage,'NOTA');
 PERFORM sgp_lp_operacion.admitir();
 SELECT writes INTO enabled FROM sgp_lp_order_details.config WHERE id FOR SHARE;
 IF enabled IS DISTINCT FROM true THEN RAISE EXCEPTION 'ORDER_NOTE_DISABLED';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,392));
 PERFORM 1 FROM public.sgp_producciones WHERE key_produccion=p_key FOR UPDATE;
 s:=sgp_lp_order_details.authorize(p_token,p_key,p_stage,'NOTA');
 req:=jsonb_build_object('key',p_key,'stage',p_stage,'command',p_cmd);
 SELECT * INTO e FROM sgp_lp_order_details.events WHERE id=rid;
 IF FOUND THEN
  IF e.actor<>s->>'usuario' OR e.request<>req THEN RAISE EXCEPTION 'ORDER_NOTE_IDEMPOTENCY_REUSED';END IF;
  RETURN e.response||jsonb_build_object('duplicate',true);
 END IF;
 SELECT * INTO n FROM sgp_lp_order_details.notes WHERE key=p_key;
 IF coalesce(n.revision,0)<>rv THEN RAISE EXCEPTION 'ORDER_NOTE_REVISION_STALE';END IF;
 stamp:=clock_timestamp();
 INSERT INTO sgp_lp_order_details.notes VALUES(p_key,rv+1,p_cmd->>'observation',s->>'usuario',stamp)
 ON CONFLICT(key) DO UPDATE SET revision=EXCLUDED.revision,observation=EXCLUDED.observation,actor=EXCLUDED.actor,at=EXCLUDED.at;
 res:=jsonb_build_object('contract','LP-ORDER-NOTE-SAVED-1','id',rid,'key',p_key,'revision',rv+1,'observation',p_cmd->>'observation','duplicate',false);
 INSERT INTO sgp_lp_order_details.events VALUES(rid,p_key,rv+1,p_stage,s->>'usuario',stamp,to_jsonb(n),p_cmd->>'observation',req,res);
 RETURN res;
END $$;
ALTER TABLE sgp_lp_order_details.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_order_details.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_order_details.events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_lp_order_details FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_lp_order_details FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.sgp_lp_order_details_read_v1(text,text,text),public.sgp_lp_order_note_save_v1(text,text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;

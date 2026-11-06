-- REVIEW: shared production/line affectations, independent of shifts. No grants/activation.
BEGIN;
SET LOCAL search_path='';SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regnamespace('sgp_lp_shared_order') IS NOT NULL THEN RAISE EXCEPTION 'SHARED_INSTALL_CONFLICT';END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('sgp_lp_order_details.authorize(text,text,text,text)')) IS DISTINCT FROM '834eb09f5d18b0a00d9509f880794b0b'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('sgp_lp_operacion.admitir()')) IS DISTINCT FROM 'dba0559912a5d2351aa7028cbad9379e'
 THEN RAISE EXCEPTION 'SHARED_DEPENDENCY_DRIFT';END IF;
END $$;
CREATE SCHEMA sgp_lp_shared_order;
REVOKE ALL ON SCHEMA sgp_lp_shared_order FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE sgp_lp_shared_order.config(id boolean PRIMARY KEY DEFAULT true CHECK(id),writes boolean NOT NULL DEFAULT false);
INSERT INTO sgp_lp_shared_order.config VALUES(true,false);
CREATE TABLE sgp_lp_shared_order.versions(key text PRIMARY KEY REFERENCES public.sgp_producciones(key_produccion),revision bigint NOT NULL CHECK(revision>=0));
CREATE TABLE sgp_lp_shared_order.reports(
 id uuid PRIMARY KEY,key text NOT NULL REFERENCES public.sgp_producciones(key_produccion),
 cause text NOT NULL CHECK(cause IN('NC_AL','NC_V','NOVEDAD','ACCESORIOS')),
 quantity bigint NOT NULL CHECK(quantity>=0),solved bigint NOT NULL DEFAULT 0 CHECK(solved>=0),confirmed bigint NOT NULL DEFAULT 0 CHECK(confirmed>=0),
 observation text NOT NULL,source_ref text,source_snapshot jsonb,nc_reference text,nc_link jsonb,
 origin_stage text NOT NULL CHECK(origin_stage IN('ENSAMBLE','EMPAQUE')),actor text NOT NULL,at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(confirmed<=solved AND solved<=quantity),UNIQUE(id,key)
);
CREATE TABLE sgp_lp_shared_order.events(
 id uuid PRIMARY KEY,key text NOT NULL REFERENCES public.sgp_producciones(key_produccion),revision bigint NOT NULL,
 report_id uuid NOT NULL,stage text NOT NULL,actor text NOT NULL,at timestamptz NOT NULL DEFAULT clock_timestamp(),
 action text NOT NULL,observation text NOT NULL,before_state jsonb,after_state jsonb NOT NULL,request jsonb NOT NULL,response jsonb NOT NULL,
 UNIQUE(key,revision),FOREIGN KEY(report_id,key) REFERENCES sgp_lp_shared_order.reports(id,key)
);
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON sgp_lp_shared_order.events FOR EACH ROW EXECUTE FUNCTION sgp_lp_order_details.immutable();
ALTER TABLE sgp_lp_shared_order.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_shared_order.versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_shared_order.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_lp_shared_order.events ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION sgp_lp_shared_order.authorize(token text,k text,stage text,write_access boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE s jsonb;enabled boolean;BEGIN
 s:=sgp_lp_order_details.authorize(token,k,stage,'LEER');
 IF write_access THEN
  IF NOT sgp_lp_operacion.puede_operar(s->>'usuario',stage,'AFECTAR') THEN RAISE EXCEPTION 'NO_AUTORIZADO';END IF;
  PERFORM sgp_lp_operacion.admitir();
  SELECT writes INTO enabled FROM sgp_lp_shared_order.config WHERE id FOR SHARE;
  IF enabled IS DISTINCT FROM true THEN RAISE EXCEPTION 'SHARED_ORDER_DISABLED';END IF;
  SELECT writes INTO enabled FROM sgp_lp_afectaciones.config WHERE id FOR SHARE;
  IF enabled IS DISTINCT FROM true THEN RAISE EXCEPTION 'SHARED_ORDER_DISABLED';END IF;
 END IF;
 RETURN s;
END $$;
CREATE FUNCTION sgp_lp_shared_order.nc_source(ref text) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('reference',consecutivo,'state',estado_nc,'active',activo,'updatedAt',fecha_actualizacion,'order',orden,'affectedLine',linea_afectada)
 FROM public.sgp_nc_vidrio WHERE consecutivo=ref
$$;
CREATE FUNCTION public.sgp_lp_shared_nc_lookup_v1(p_token text,p_key text,p_stage text,p_reference text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;n jsonb;BEGIN
 s:=sgp_lp_shared_order.authorize(p_token,p_key,p_stage);
 IF p_reference IS NULL OR length(btrim(p_reference)) NOT BETWEEN 1 AND 80 OR p_reference~'[[:cntrl:]]' THEN RAISE EXCEPTION 'NC_REFERENCE_REQUIRED';END IF;
 n:=sgp_lp_shared_order.nc_source(btrim(p_reference));
 RETURN jsonb_build_object('contract','LP-SHARED-NC-1','key',p_key,'line',s->>'line','stage',p_stage,'reference',btrim(p_reference),'source',n,'fingerprint',CASE WHEN n IS NOT NULL THEN md5(n::text) END);
END $$;
CREATE FUNCTION public.sgp_lp_shared_order_read_v1(p_token text,p_key text,p_stage text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;rep jsonb;hist jsonb;old jsonb;acc jsonb;BEGIN
 s:=sgp_lp_shared_order.authorize(p_token,p_key,p_stage);
 PERFORM 1 FROM public.sgp_producciones WHERE key_produccion=p_key FOR SHARE;
 SELECT coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('sourceNow',CASE WHEN r.nc_link IS NOT NULL THEN sgp_lp_shared_order.nc_source(r.nc_reference) END) ORDER BY r.at,r.id),'[]') INTO rep FROM sgp_lp_shared_order.reports r WHERE r.key=p_key;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'revision',revision,'reportId',report_id,'action',action,'stage',stage,'actor',actor,'at',at,'observation',observation,'before',before_state,'after',after_state) ORDER BY revision),'[]') INTO hist FROM sgp_lp_shared_order.events WHERE key=p_key;
 -- Prior reports stay in their recorded process/turn, visible separately, never cloned or summed.
 SELECT coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('ncReference',n.reference) ORDER BY r.creado_en,r.id),'[]') INTO old FROM sgp_lp_afectaciones.reportes r LEFT JOIN sgp_lp_order_details.glass_nc n ON n.report_id=r.id WHERE r.key=p_key;
 -- Only a canonical key is admissible. Ambiguous/missing keys are intentionally excluded.
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id_accesorio,'reference',a.codigo_sap,'description',a.descripcion,'pieces',a.cantidad::text,'unit',a.unidad) ORDER BY a.id_accesorio),'[]') INTO acc FROM public.sgp_accesorios a WHERE a.key_produccion=p_key;
 RETURN jsonb_build_object('contract','LP-SHARED-ORDER-1','key',p_key,'line',s->>'line','stage',p_stage,'revision',coalesce((SELECT revision FROM sgp_lp_shared_order.versions WHERE key=p_key),0),'reports',rep,'history',hist,'legacyReports',old,'accessories',acc,'canReport',
 (SELECT writes FROM sgp_lp_shared_order.config WHERE id) AND (SELECT writes FROM sgp_lp_afectaciones.config WHERE id) AND (SELECT escrituras FROM sgp_lp_operacion.config WHERE id) AND sgp_lp_operacion.puede_operar(s->>'usuario',p_stage,'AFECTAR'));
END $$;
CREATE FUNCTION public.sgp_lp_shared_order_command_v1(p_token text,p_key text,p_stage text,p_cmd jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;cmdid uuid;rid uuid;rv bigint;current_rev bigint;op text;qty bigint;r sgp_lp_shared_order.reports%rowtype;e sgp_lp_shared_order.events%rowtype;before_data jsonb;after_data jsonb;req jsonb;res jsonb;source_data jsonb;ref text;enabled boolean;BEGIN
 IF jsonb_typeof(p_cmd) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_cmd) k WHERE k NOT IN('id','revision','action','reportId','cause','quantity','observation','sourceRef','ncReference','fingerprint'))
 OR coalesce(p_cmd->>'revision','')!~'^[0-9]{1,15}$' OR jsonb_typeof(p_cmd->'observation') IS DISTINCT FROM 'string' OR length(btrim(p_cmd->>'observation')) NOT BETWEEN 1 AND 2000
 OR coalesce(p_cmd->>'action','') NOT IN('CREATE','CORRECT','SOLVE','CONFIRM','LINK_NC') THEN RAISE EXCEPTION 'SHARED_COMMAND_INVALID';END IF;
 cmdid:=(p_cmd->>'id')::uuid;rv:=(p_cmd->>'revision')::bigint;op:=p_cmd->>'action';
 IF cmdid IS NULL THEN RAISE EXCEPTION 'SHARED_ID_REQUIRED';END IF;
 IF op<>'LINK_NC' THEN
  IF coalesce(p_cmd->>'quantity','')!~'^[0-9]{1,15}$' THEN RAISE EXCEPTION 'SHARED_QUANTITY_INVALID';END IF;
  qty:=(p_cmd->>'quantity')::bigint;
 END IF;
 s:=sgp_lp_shared_order.authorize(p_token,p_key,p_stage,true);
 PERFORM pg_advisory_xact_lock(hashtextextended(cmdid::text,396));
 PERFORM 1 FROM public.sgp_producciones WHERE key_produccion=p_key FOR UPDATE;
 s:=sgp_lp_shared_order.authorize(p_token,p_key,p_stage,true);
 req:=jsonb_build_object('key',p_key,'stage',p_stage,'cmd',p_cmd);
 SELECT * INTO e FROM sgp_lp_shared_order.events WHERE id=cmdid;
 IF FOUND THEN
  IF e.request<>req OR e.actor<>s->>'usuario' THEN RAISE EXCEPTION 'SHARED_IDEMPOTENCY_REUSED';END IF;
  RETURN e.response||jsonb_build_object('duplicate',true);
 END IF;
 INSERT INTO sgp_lp_shared_order.versions VALUES(p_key,0) ON CONFLICT DO NOTHING;
 SELECT revision INTO current_rev FROM sgp_lp_shared_order.versions WHERE key=p_key FOR UPDATE;
 IF rv<>current_rev THEN RAISE EXCEPTION 'SHARED_REVISION_STALE';END IF;
 IF op='CREATE' THEN
  IF coalesce(p_cmd->>'cause','') NOT IN('NC_AL','NC_V','NOVEDAD','ACCESORIOS') THEN RAISE EXCEPTION 'SHARED_CAUSE_INVALID';END IF;
  ref:=nullif(btrim(p_cmd->>'sourceRef'),'');source_data:=NULL;
  IF ref IS NOT NULL THEN
   IF p_cmd->>'cause'='ACCESORIOS' THEN
    SELECT jsonb_build_object('id',id_accesorio,'reference',codigo_sap,'description',descripcion,'pieces',cantidad::text,'unit',unidad) INTO source_data FROM public.sgp_accesorios WHERE id_accesorio=ref AND key_produccion=p_key FOR SHARE;
   ELSIF p_cmd->>'cause'='NC_AL' THEN
    SELECT jsonb_build_object('id',id_pendiente,'reference',perfil,'origin',origen,'pieces',cantidad::text) INTO source_data FROM public.sgp_aluminio_pendientes WHERE id_pendiente::text=ref AND key_produccion=p_key FOR SHARE;
   END IF;
   IF source_data IS NULL THEN RAISE EXCEPTION 'SHARED_SOURCE_MISMATCH';END IF;
   IF EXISTS(SELECT 1 FROM sgp_lp_shared_order.reports WHERE key=p_key AND cause=p_cmd->>'cause' AND source_ref=ref) THEN RAISE EXCEPTION 'SHARED_SOURCE_ALREADY_REPORTED';END IF;
  END IF;
  IF p_cmd->>'cause'='NC_V' AND (jsonb_typeof(p_cmd->'ncReference') IS DISTINCT FROM 'string' OR length(btrim(p_cmd->>'ncReference')) NOT BETWEEN 1 AND 80 OR p_cmd->>'ncReference'~'[[:cntrl:]]') THEN RAISE EXCEPTION 'NC_REFERENCE_REQUIRED';END IF;
  rid:=cmdid;
  INSERT INTO sgp_lp_shared_order.reports(id,key,cause,quantity,observation,source_ref,source_snapshot,nc_reference,origin_stage,actor) VALUES(rid,p_key,p_cmd->>'cause',qty,p_cmd->>'observation',ref,source_data,CASE WHEN p_cmd->>'cause'='NC_V' THEN btrim(p_cmd->>'ncReference') END,p_stage,s->>'usuario');
 ELSE
  rid:=(p_cmd->>'reportId')::uuid;SELECT * INTO r FROM sgp_lp_shared_order.reports WHERE id=rid AND key=p_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SHARED_REPORT_MISMATCH';END IF;
  before_data:=to_jsonb(r);
  IF op='CORRECT' THEN
   IF qty<r.solved THEN RAISE EXCEPTION 'SHARED_BELOW_SOLVED';END IF;
   UPDATE sgp_lp_shared_order.reports SET quantity=qty,observation=p_cmd->>'observation' WHERE id=rid;
  ELSIF op='SOLVE' THEN
   IF qty<=0 OR r.solved+qty>r.quantity THEN RAISE EXCEPTION 'SHARED_SOLVE_RANGE';END IF;
   UPDATE sgp_lp_shared_order.reports SET solved=solved+qty WHERE id=rid;
  ELSIF op='CONFIRM' THEN
   SELECT physical INTO enabled FROM sgp_lp_afectaciones.config WHERE id FOR SHARE;
   IF enabled IS DISTINCT FROM true OR s->>'rol' NOT IN('COORDINADOR','LIDER LINEA') THEN RAISE EXCEPTION 'NO_AUTORIZADO';END IF;
   IF qty<=0 OR r.confirmed+qty>r.solved THEN RAISE EXCEPTION 'SHARED_CONFIRM_RANGE';END IF;
   UPDATE sgp_lp_shared_order.reports SET confirmed=confirmed+qty WHERE id=rid;
  ELSIF op='LINK_NC' THEN
   IF r.cause<>'NC_V' OR r.nc_link IS NOT NULL THEN RAISE EXCEPTION 'SHARED_NC_LINK_CONFLICT';END IF;
   PERFORM 1 FROM public.sgp_nc_vidrio WHERE consecutivo=r.nc_reference FOR SHARE;
   source_data:=sgp_lp_shared_order.nc_source(r.nc_reference);
   IF source_data IS NULL OR source_data->>'active' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'NC_SOURCE_UNAVAILABLE';END IF;
   IF coalesce(p_cmd->>'fingerprint','')<>md5(source_data::text) THEN RAISE EXCEPTION 'NC_SOURCE_CHANGED';END IF;
   UPDATE sgp_lp_shared_order.reports SET nc_link=jsonb_build_object('source',source_data,'actor',s->>'usuario','at',clock_timestamp(),'evidence',p_cmd->>'observation') WHERE id=rid;
  END IF;
 END IF;
 UPDATE sgp_lp_shared_order.versions SET revision=revision+1 WHERE key=p_key;
 SELECT to_jsonb(x) INTO after_data FROM sgp_lp_shared_order.reports x WHERE id=rid;
 res:=jsonb_build_object('contract','LP-SHARED-COMMAND-1','id',cmdid,'key',p_key,'reportId',rid,'revision',rv+1,'duplicate',false);
 INSERT INTO sgp_lp_shared_order.events(id,key,revision,report_id,stage,actor,action,observation,before_state,after_state,request,response) VALUES(cmdid,p_key,rv+1,rid,p_stage,s->>'usuario',op,p_cmd->>'observation',before_data,after_data,req,res);
 RETURN res;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_lp_shared_order FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_lp_shared_order FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.sgp_lp_shared_order_read_v1(text,text,text),public.sgp_lp_shared_order_command_v1(text,text,text,jsonb),public.sgp_lp_shared_nc_lookup_v1(text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;

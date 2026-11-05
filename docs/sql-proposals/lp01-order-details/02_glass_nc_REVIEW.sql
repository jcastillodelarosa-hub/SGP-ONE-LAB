-- REVIEW ONLY. Optional new entry point; does not modify the existing RPC or reports.
-- Manual NC references are unverified text, never proof of NC closure/physical receipt.
BEGIN;
SET LOCAL search_path=''; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE TABLE sgp_lp_order_details.glass_nc(
 report_id uuid PRIMARY KEY REFERENCES sgp_lp_afectaciones.reportes(id),
 reference text NOT NULL CHECK(length(btrim(reference)) BETWEEN 1 AND 80 AND reference!~'[[:cntrl:]]')
);
ALTER TABLE sgp_lp_order_details.glass_nc ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON sgp_lp_order_details.glass_nc FOR EACH ROW EXECUTE FUNCTION sgp_lp_order_details.immutable();
CREATE FUNCTION public.sgp_lp_glass_nc_report_v1(p_token text,p_key text,p_stage text,p_date date,p_shift integer,p_cmd jsonb,p_nc text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;prior text;enabled boolean; BEGIN
 IF p_cmd->>'action' IS DISTINCT FROM 'CREATE' OR p_cmd->>'cause' IS DISTINCT FROM 'NC_V'
 OR p_nc IS NULL OR length(btrim(p_nc)) NOT BETWEEN 1 AND 80 OR p_nc~'[[:cntrl:]]' THEN RAISE EXCEPTION 'GLASS_NC_REFERENCE_REQUIRED';END IF;
 PERFORM sgp_lp_order_details.authorize(p_token,p_key,p_stage,'LEER');
 SELECT writes INTO enabled FROM sgp_lp_order_details.config WHERE id FOR SHARE;
 IF enabled IS DISTINCT FROM true THEN RAISE EXCEPTION 'ORDER_NOTE_DISABLED';END IF;
 -- Existing writer enforces current permissions, actual open turn, CAS, idempotency,
 -- quantity and audit in this same transaction. Reference errors roll it all back.
 result:=public.sgp_lp_afectaciones_comando_v1(p_token,p_key,p_stage,p_date,p_shift,p_cmd);
 SELECT reference INTO prior FROM sgp_lp_order_details.glass_nc WHERE report_id=(result->>'reportId')::uuid;
 IF result->>'duplicate'='true' THEN
  IF prior IS DISTINCT FROM btrim(p_nc) THEN RAISE EXCEPTION 'GLASS_NC_IDEMPOTENCY_REUSED';END IF;
 ELSE INSERT INTO sgp_lp_order_details.glass_nc VALUES((result->>'reportId')::uuid,btrim(p_nc));END IF;
 RETURN result||jsonb_build_object('ncReference',btrim(p_nc),'ncVerified',false);
END $$;
CREATE FUNCTION public.sgp_lp_glass_nc_read_v1(p_token text,p_key text,p_stage text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; BEGIN
 PERFORM sgp_lp_order_details.authorize(p_token,p_key,p_stage,'LEER');
 SELECT coalesce(jsonb_agg(jsonb_build_object('reportId',r.id,'reference',n.reference,'verified',false) ORDER BY r.id),'[]') INTO result
 FROM sgp_lp_order_details.glass_nc n JOIN sgp_lp_afectaciones.reportes r ON r.id=n.report_id WHERE r.key=p_key AND r.etapa=p_stage;
 RETURN jsonb_build_object('contract','LP-GLASS-NC-1','key',p_key,'stage',p_stage,'references',result);
END $$;
REVOKE ALL ON sgp_lp_order_details.glass_nc FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.sgp_lp_glass_nc_report_v1(text,text,text,date,integer,jsonb,text),public.sgp_lp_glass_nc_read_v1(text,text,text) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;

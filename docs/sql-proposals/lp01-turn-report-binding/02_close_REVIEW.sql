BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
DO $patch$
DECLARE target oid:=to_regprocedure('public.sgp_lp_operacion_comando(text,jsonb)');body text;definition text;candidate text;owner0 oid;acl0 aclitem[];config0 text[];definer0 boolean;
BEGIN
 SELECT prosrc,pg_get_functiondef(oid),proowner,proacl,proconfig,prosecdef INTO body,definition,owner0,acl0,config0,definer0 FROM pg_proc WHERE oid=target;
 IF md5(body) IS DISTINCT FROM '48ad61deb0200a0fbe4a4a817b645ffd' THEN RAISE EXCEPTION 'REPORT_CLOSE_SOURCE_CHANGED';END IF;
 candidate:=replace(body,$old$    IF NOT sgp_lp_operacion.export_v4_plan_visible(res,u,et,line_id,d,t) THEN$old$,$new$    res:=res||jsonb_build_object('reportEvidence',sgp_lp_operacion.report_evidence(et,line_id,d,t,rid,rows));
    IF NOT sgp_lp_operacion.export_v4_plan_visible(res,u,et,line_id,d,t) THEN$new$);
 IF candidate=body THEN RAISE EXCEPTION 'REPORT_CLOSE_ANCHOR_MISSING';END IF;
 EXECUTE replace(definition,body,candidate);
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=target AND proowner=owner0 AND proacl IS NOT DISTINCT FROM acl0 AND proconfig IS NOT DISTINCT FROM config0 AND prosecdef=definer0 AND md5(prosrc)='79fcc3d1023b689befbb3d18ea81e54b') THEN RAISE EXCEPTION 'REPORT_CLOSE_METADATA_CHANGED';END IF;
END $patch$;
COMMIT;

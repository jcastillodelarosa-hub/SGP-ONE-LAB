-- REVIEW ONLY. Explicit shared PDT contract change: optional NC for Ensamble/Empaque.
-- No records, grants, origins, identity checks or validation states are changed.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
DO $change$ DECLARE f oid:=to_regprocedure('sgp_pdt_multiorigen.registrar(text,text,jsonb,jsonb,uuid,uuid)');d text;b text;prior_acl aclitem[];
 needle text:=$needle$ IF p_origen IN ('ENSAMBLE','EMPAQUE') AND nc IS NULL THEN RAISE EXCEPTION 'PDT_NC_OBLIGATORIA'; END IF;
$needle$;
BEGIN
 PERFORM 1 FROM sgp_lp_afectaciones.config WHERE id FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM sgp_lp_afectaciones.config WHERE id AND NOT writes AND NOT physical AND NOT pdt_links AND NOT atomic_pdt) THEN RAISE EXCEPTION 'CONTENER_AFECTACIONES_ANTES_DE_CAMBIAR_NC';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=f AND md5(prosrc)='2c9da616eb830fd6db20973e9bec4155' AND prosecdef AND proconfig=ARRAY['search_path=""']::text[] AND pg_get_userbyid(proowner)=current_user AND NOT has_function_privilege('anon',oid,'EXECUTE') AND NOT has_function_privilege('authenticated',oid,'EXECUTE')) THEN RAISE EXCEPTION 'PDT_NC_CONTRATO_PREVIO_INCOMPATIBLE';END IF;
 SELECT pg_get_functiondef(oid),prosrc,proacl INTO d,b,prior_acl FROM pg_proc WHERE oid=f;
 IF (length(b)-length(replace(b,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'PDT_NC_GUARD_NO_UNICO';END IF;
 EXECUTE replace(d,b,replace(b,needle,''));
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=f AND md5(prosrc)='d1195cca8c35315007969da936979546' AND proacl IS NOT DISTINCT FROM prior_acl AND prosecdef AND proconfig=ARRAY['search_path=""']::text[] AND pg_get_userbyid(proowner)=current_user) THEN RAISE EXCEPTION 'PDT_NC_POSTCHECK_FALLO';END IF;
END $change$;
COMMIT;

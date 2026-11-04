-- Solo emergencia autorizada: restaura ACL observadas, reintroduciendo riesgo conocido.
-- Preferir corrección hacia adelante mediante RPC. No ejecutar como rollback automático.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$ BEGIN
 IF current_setting('sgp_lp183.restore_original_acl',true) IS DISTINCT FROM 'AUTORIZADO_RIESGO_CATALOGO' THEN RAISE EXCEPTION 'RECUPERACION_DEGRADA_SEGURIDAD_REQUIERE_AUTORIZACION'; END IF;
END $guard$;
LOCK TABLE public.sgp_rol_accesos,public.sgp_usuario_accesos IN ACCESS EXCLUSIVE MODE;
DO $pre$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_class c WHERE c.oid IN('public.sgp_rol_accesos'::regclass,'public.sgp_usuario_accesos'::regclass) AND
 (pg_get_userbyid(c.relowner)<>'postgres' OR c.relrowsecurity OR
 (SELECT jsonb_agg(to_jsonb(a) ORDER BY grantee,grantor,privilege_type,is_grantable) FROM aclexplode(c.relacl) a) IS DISTINCT FROM
 (SELECT jsonb_agg(to_jsonb(a) ORDER BY grantee,grantor,privilege_type,is_grantable) FROM aclexplode('{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'::aclitem[]) a))) THEN RAISE EXCEPTION 'ACL_POSTERIOR_DERIVO_NO_SOBRESCRIBIR'; END IF;
END $pre$;
GRANT ALL ON TABLE public.sgp_rol_accesos,public.sgp_usuario_accesos TO anon,authenticated;
COMMIT;

-- LP183: corrección acotada de acceso directo. Requiere respaldo ACL previo verificado.
-- Sin DML de datos, sin cambiar RLS, propietarios, funciones o privilegios de otros objetos.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
LOCK TABLE public.sgp_rol_accesos,public.sgp_usuario_accesos IN ACCESS EXCLUSIVE MODE;
DO $pre$ DECLARE r record; BEGIN
 FOR r IN SELECT c.relname,c.relacl::text acl,c.relrowsecurity,c.relowner,c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('sgp_rol_accesos','sgp_usuario_accesos') LOOP
  IF pg_get_userbyid(r.relowner)<>'postgres' OR r.relrowsecurity OR (SELECT jsonb_agg(to_jsonb(a) ORDER BY grantee,grantor,privilege_type,is_grantable) FROM aclexplode(r.acl::aclitem[]) a) IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(a) ORDER BY grantee,grantor,privilege_type,is_grantable) FROM aclexplode('{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'::aclitem[]) a) OR EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=r.oid AND a.attnum>0 AND a.attacl IS NOT NULL) THEN RAISE EXCEPTION 'CATALOGO_DERIVO_REVISAR_RESPALDO: %',r.relname; END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND pg_get_userbyid(p.proowner)='postgres' AND(p.proname,md5(p.prosrc)) IN(
 ('sgp_admin_usuarios_listar','543908bbd6c0de99540d8b6bf3299d15'),('sgp_mis_accesos','4f879ddd1659ef97f05e2f4aaa7c5d33'),('sgp_admin_rol_accesos_guardar','96c5531abff3988b31a91211b4a440f4'),('sgp_admin_rol_accesos_listar','32a3077fbfc057aca30f6e622796f12e'),('sgp_admin_usuario_guardar','ed07b071fe83cf63709ed976d38fb116')))<>5 THEN RAISE EXCEPTION 'CONSUMIDOR_ADMINISTRATIVO_CAMBIO'; END IF;
END $pre$;
REVOKE ALL ON TABLE public.sgp_rol_accesos,public.sgp_usuario_accesos FROM PUBLIC,anon,authenticated;
DO $post$ DECLARE obj regclass;actor text; BEGIN
 FOREACH obj IN ARRAY ARRAY['public.sgp_rol_accesos'::regclass,'public.sgp_usuario_accesos'::regclass] LOOP
  FOREACH actor IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF has_table_privilege(actor,obj,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(actor,obj,'SELECT,INSERT,UPDATE,REFERENCES') THEN RAISE EXCEPTION 'ACCESO_DIRECTO_PERSISTE'; END IF;
  END LOOP;
 END LOOP;
END $post$;
COMMIT;

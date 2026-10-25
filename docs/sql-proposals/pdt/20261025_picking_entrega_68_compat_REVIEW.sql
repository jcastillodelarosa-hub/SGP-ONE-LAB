-- REVIEW ONLY, no automatic production application. Non-destructive 6/8 fix.
-- Move the original 8-argument function (same OID/body/defaults/ACL) to a private
-- schema; expose an 7-required-argument public forwarder (optional turno) with equivalent EXECUTE.
BEGIN;
DO $compat$
DECLARE six regprocedure:=to_regprocedure('public.sgp_picking_entrega_orden(text,uuid,text,boolean,text,jsonb)');
 eight regprocedure:=to_regprocedure('public.sgp_picking_entrega_orden(text,uuid,text,boolean,text,jsonb,date,text)');
 original record; entry record; a record; role_name text; old_definition text; effective_acl jsonb; actual_acl jsonb; private_id oid;
BEGIN
 IF six IS NULL OR eight IS NULL THEN
  -- Only the explicitly synthetic 4/5-overload fixture can skip this proposal.
  IF current_database() LIKE 'sgp_pdt_qa_91_%' AND six IS NULL AND eight IS NULL
   AND to_regprocedure('public.sgp_picking_entrega_orden(text,uuid,text,boolean)') IS NOT NULL
   AND to_regprocedure('public.sgp_picking_entrega_orden(text,uuid,text,boolean,jsonb)') IS NOT NULL THEN RETURN; END IF;
  RAISE EXCEPTION 'PDT68: required real signatures absent';
 END IF;
 IF to_regnamespace('sgp_pdt_compat_91') IS NOT NULL THEN
  IF to_regclass('sgp_pdt_compat_91.entrega_backup') IS NULL THEN RAISE EXCEPTION 'PDT68: unrecognized existing namespace'; END IF;
  SELECT * INTO entry FROM sgp_pdt_compat_91.entrega_backup WHERE signature='delivery8';
  IF FOUND AND entry.reverted_at IS NULL THEN
   private_id:=to_regprocedure('sgp_pdt_compat_91.sgp_picking_entrega_orden(text,uuid,text,boolean,text,jsonb,date,text)');
   IF private_id IS NULL OR (SELECT md5(pg_get_functiondef(oid)) FROM pg_proc WHERE oid=eight)<>entry.wrapper_md5
    OR (SELECT md5(replace(pg_get_functiondef(oid),'FUNCTION sgp_pdt_compat_91.sgp_picking_entrega_orden(', 'FUNCTION public.sgp_picking_entrega_orden(')) FROM pg_proc WHERE oid=private_id)<>md5(entry.definition)
    OR (SELECT pg_get_userbyid(proowner)<>entry.owner_name FROM pg_proc WHERE oid=private_id)
    OR (SELECT pg_get_userbyid(proowner)<>entry.owner_name FROM pg_proc WHERE oid=eight)
    THEN RAISE EXCEPTION 'PDT68: installed compatibility objects changed'; END IF;
   SELECT jsonb_object_agg(grants.role_name,grants.grantable) INTO actual_acl FROM (
    SELECT CASE WHEN grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END role_name,bool_or(is_grantable) grantable
    FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
    WHERE p.oid=eight AND privilege_type='EXECUTE' GROUP BY grantee
   ) grants;
   IF actual_acl IS DISTINCT FROM entry.execute_acl OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=private_id)<>entry.body_md5 THEN
    RAISE EXCEPTION 'PDT68: body or effective privileges changed'; END IF;
   SELECT jsonb_object_agg(grants.role_name,grants.grantable) INTO actual_acl FROM (
    SELECT CASE WHEN grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END role_name,bool_or(is_grantable) grantable
    FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
    WHERE p.oid=private_id AND privilege_type='EXECUTE' GROUP BY grantee
   ) grants;
   IF actual_acl IS DISTINCT FROM entry.execute_acl THEN RAISE EXCEPTION 'PDT68: original effective privileges changed'; END IF;
   -- OIDs are not portable across logical restore. Rebind only after complete
   -- definition/owner/privilege verification; signatures, not stale OIDs, identify objects.
   UPDATE sgp_pdt_compat_91.entrega_backup SET original_oid=private_id,wrapper_oid=eight WHERE signature='delivery8';
   RETURN;
  END IF;
 END IF;
 SELECT * INTO original FROM pg_proc WHERE oid=eight;
 old_definition:=pg_get_functiondef(eight);
 IF md5(old_definition)<>'b7a4b58eb8a8f9db4439d1cd354b92c8' OR original.pronargdefaults<>4 THEN
  RAISE EXCEPTION 'PDT68: unknown original eight-argument definition';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_depend WHERE classid='pg_proc'::regclass AND objid=eight AND deptype='e') THEN
  RAISE EXCEPTION 'PDT68: extension-managed function requires separate review';
 END IF;
 IF NOT original.prosecdef OR original.proretset OR original.prorettype<>'jsonb'::regtype THEN
  RAISE EXCEPTION 'PDT68: unexpected security/return contract';
 END IF;
 SELECT jsonb_object_agg(grants.role_name,grants.grantable) INTO effective_acl FROM (
  SELECT CASE WHEN grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END role_name,bool_or(is_grantable) grantable
  FROM aclexplode(coalesce(original.proacl,acldefault('f',original.proowner))) WHERE privilege_type='EXECUTE' GROUP BY grantee
 ) grants;
 CREATE SCHEMA IF NOT EXISTS sgp_pdt_compat_91;
 -- Never inherit unintended default USAGE grants on this private namespace.
 FOR a IN SELECT DISTINCT grantee FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) x
  WHERE n.nspname='sgp_pdt_compat_91' AND grantee<>n.nspowner
 LOOP
  role_name:=CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END;
  EXECUTE 'REVOKE ALL ON SCHEMA sgp_pdt_compat_91 FROM '||role_name;
 END LOOP;
 CREATE TABLE IF NOT EXISTS sgp_pdt_compat_91.entrega_backup(
  signature text PRIMARY KEY,original_oid oid NOT NULL,definition text NOT NULL,owner_name name NOT NULL,
  execute_acl jsonb NOT NULL,body_md5 text NOT NULL,original_comment text,
  wrapper_oid oid,wrapper_md5 text,created_at timestamptz NOT NULL DEFAULT now(),reverted_at timestamptz
 );
 ALTER TABLE sgp_pdt_compat_91.entrega_backup ENABLE ROW LEVEL SECURITY;
 REVOKE ALL ON sgp_pdt_compat_91.entrega_backup FROM PUBLIC,anon,authenticated;
 INSERT INTO sgp_pdt_compat_91.entrega_backup(signature,original_oid,definition,owner_name,execute_acl,body_md5,original_comment)
 VALUES('delivery8',eight,old_definition,pg_get_userbyid(original.proowner),effective_acl,md5(original.prosrc),obj_description(eight,'pg_proc'))
 ON CONFLICT(signature) DO UPDATE SET original_oid=excluded.original_oid,definition=excluded.definition,
 owner_name=excluded.owner_name,execute_acl=excluded.execute_acl,body_md5=excluded.body_md5,
 original_comment=excluded.original_comment,reverted_at=NULL;
 EXECUTE 'ALTER FUNCTION public.sgp_picking_entrega_orden(text,uuid,text,boolean,text,jsonb,date,text) SET SCHEMA sgp_pdt_compat_91';
 EXECUTE format('GRANT USAGE ON SCHEMA sgp_pdt_compat_91 TO %I',pg_get_userbyid(original.proowner));
 EXECUTE $wrapper$
 CREATE FUNCTION public.sgp_picking_entrega_orden(p_token text,p_id_programacion uuid,p_produccion text,p_completa boolean,
  p_observacion text,p_faltantes jsonb,p_fecha_entrega date,p_turno text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path TO '' AS $body$
  SELECT sgp_pdt_compat_91.sgp_picking_entrega_orden(p_token,p_id_programacion,p_produccion,p_completa,p_observacion,p_faltantes,p_fecha_entrega,p_turno);
 $body$
 $wrapper$;
 eight:=to_regprocedure('public.sgp_picking_entrega_orden(text,uuid,text,boolean,text,jsonb,date,text)');
 EXECUTE format('ALTER FUNCTION public.sgp_picking_entrega_orden(text,uuid,text,boolean,text,jsonb,date,text) OWNER TO %I',pg_get_userbyid(original.proowner));
 -- Clear defaults inherited from installer privileges, then reproduce old EXECUTE.
 FOR a IN SELECT DISTINCT grantee FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x WHERE p.oid=eight
 LOOP
  role_name:=CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END;
  EXECUTE 'REVOKE ALL ON FUNCTION public.sgp_picking_entrega_orden(text,uuid,text,boolean,text,jsonb,date,text) FROM '||role_name;
 END LOOP;
 FOR a IN SELECT key,value FROM jsonb_each(effective_acl) LOOP
  role_name:=CASE WHEN a.key='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(a.key) END;
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.sgp_picking_entrega_orden(text,uuid,text,boolean,text,jsonb,date,text) TO '||role_name||CASE WHEN a.value::text::boolean THEN ' WITH GRANT OPTION' ELSE '' END;
 END LOOP;
 EXECUTE format('COMMENT ON FUNCTION public.sgp_picking_entrega_orden(text,uuid,text,boolean,text,jsonb,date,text) IS %L',obj_description(original.oid,'pg_proc'));
 IF (SELECT md5(prosrc)<>md5(original.prosrc) OR proowner<>original.proowner OR proacl IS DISTINCT FROM original.proacl FROM pg_proc WHERE oid=original.oid)
  OR (SELECT pronargdefaults<>1 FROM pg_proc WHERE oid=eight) THEN RAISE EXCEPTION 'PDT68: original body/owner/ACL or public arity changed unexpectedly'; END IF;
 SELECT jsonb_object_agg(grants.role_name,grants.grantable) INTO actual_acl FROM (
    SELECT CASE WHEN grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END role_name,bool_or(is_grantable) grantable
    FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
    WHERE p.oid=eight AND privilege_type='EXECUTE' GROUP BY grantee
   ) grants;
 IF actual_acl IS DISTINCT FROM effective_acl THEN RAISE EXCEPTION 'PDT68: effective EXECUTE privileges differ'; END IF;
 UPDATE sgp_pdt_compat_91.entrega_backup SET wrapper_oid=eight,wrapper_md5=md5(pg_get_functiondef(eight)) WHERE signature='delivery8';
END $compat$;
COMMIT;

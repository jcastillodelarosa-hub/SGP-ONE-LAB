-- REVIEW ONLY. Revert interface forwarding without dropping original functions.
-- Existing V2 data/guards are NOT removed. No business rows are changed.
BEGIN;
DO $restore$
DECLARE entry record; retired name; a record; role_name text; acl_now jsonb; target_oid oid;
BEGIN
 SELECT * INTO STRICT entry FROM sgp_pdt_compat_91.entrega_backup WHERE signature='delivery8';
 IF entry.reverted_at IS NOT NULL THEN RETURN; END IF;
 entry.wrapper_oid:=to_regprocedure('public.sgp_picking_entrega_orden(text,uuid,text,boolean,text,jsonb,date,text)');
 entry.original_oid:=to_regprocedure('sgp_pdt_compat_91.sgp_picking_entrega_orden(text,uuid,text,boolean,text,jsonb,date,text)');
 IF entry.wrapper_oid IS NULL OR entry.original_oid IS NULL
 OR (SELECT md5(pg_get_functiondef(oid)) FROM pg_proc WHERE oid=entry.wrapper_oid)<>entry.wrapper_md5
 OR (SELECT md5(replace(pg_get_functiondef(oid),'FUNCTION sgp_pdt_compat_91.sgp_picking_entrega_orden(', 'FUNCTION public.sgp_picking_entrega_orden(')) FROM pg_proc WHERE oid=entry.original_oid)<>md5(entry.definition)
 THEN RAISE EXCEPTION 'PDT68 rollback: objects changed; review required'; END IF;
 FOREACH target_oid IN ARRAY ARRAY[entry.original_oid,entry.wrapper_oid] LOOP
  IF (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid=target_oid)<>entry.owner_name THEN RAISE EXCEPTION 'PDT68 rollback: owner changed'; END IF;
  SELECT jsonb_object_agg(grants.role_name,grants.grantable) INTO acl_now FROM (
   SELECT CASE WHEN grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END role_name,bool_or(is_grantable) grantable
   FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
   WHERE p.oid=target_oid AND privilege_type='EXECUTE' GROUP BY grantee
  ) grants;
  IF acl_now IS DISTINCT FROM entry.execute_acl THEN RAISE EXCEPTION 'PDT68 rollback: effective privileges changed'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_depend WHERE refclassid='pg_proc'::regclass AND refobjid=entry.wrapper_oid AND deptype='n') THEN
  RAISE EXCEPTION 'PDT68 rollback: new wrapper has dependents; preserve them and review first';
 END IF;
 retired:=('entrega_retired_'||entry.wrapper_oid)::name;
 EXECUTE format('ALTER FUNCTION public.sgp_picking_entrega_orden(text,uuid,text,boolean,text,jsonb,date,text) RENAME TO %I',retired);
 EXECUTE format('ALTER FUNCTION public.%I(text,uuid,text,boolean,text,jsonb,date,text) SET SCHEMA sgp_pdt_compat_91',retired);
 FOR a IN SELECT DISTINCT grantee FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x WHERE p.oid=entry.wrapper_oid AND grantee<>p.proowner
 LOOP
  role_name:=CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END;
  EXECUTE format('REVOKE ALL ON FUNCTION sgp_pdt_compat_91.%I(text,uuid,text,boolean,text,jsonb,date,text) FROM ',retired)||role_name;
 END LOOP;
 ALTER FUNCTION sgp_pdt_compat_91.sgp_picking_entrega_orden(text,uuid,text,boolean,text,jsonb,date,text) SET SCHEMA public;
 IF md5(pg_get_functiondef(entry.original_oid))<>md5(entry.definition) THEN RAISE EXCEPTION 'PDT68 rollback: original definition differs'; END IF;
 UPDATE sgp_pdt_compat_91.entrega_backup SET reverted_at=now(),original_oid=entry.original_oid,wrapper_oid=entry.wrapper_oid WHERE signature='delivery8';
END $restore$;
COMMIT;

-- Narrow role extension only; no operational rows, ACL, owners, or reception roles change.
BEGIN;
DO $patch$
DECLARE r record; def text; updated text; acl aclitem[]; owner oid;
BEGIN
 FOR r IN SELECT * FROM (VALUES
('public.sgp_pdt_picking_aviso_leer_v1(text,uuid)','c491ce57c95d840158fcd288e446ff56',1),
('public.sgp_pdt_picking_avisos_v1(text,uuid,integer)','3c13b7ea3b17069c613fad09956d70fe',2),
('public.sgp_pdt_picking_cola_v1(text,text,text,text,text,uuid,integer)','eaf52be4002c704672370338e8cdca30',3),
('public.sgp_pdt_picking_movimiento_v1(text,uuid,text,integer,uuid,text)','5618822490de2f6db2a83a44ea6228fc',1),
('public.sgp_pdt_picking_simple_v1(text,uuid,integer,uuid,text)','2569ed689bf2bd0bcba129a533da405d',1)
 ) AS expected(signature,hash,changes) LOOP
  SELECT pg_get_functiondef(oid),proacl,proowner INTO STRICT def,acl,owner FROM pg_proc WHERE oid=r.signature::regprocedure;
  IF md5(def)<>r.hash THEN RAISE EXCEPTION 'PDT_LEADER_ROLLBACK_CHANGED: %',r.signature; END IF;
  updated:=replace(def,',''LIDER MECANIZADO''','');
  EXECUTE updated;
  IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=r.signature::regprocedure AND proacl IS NOT DISTINCT FROM acl AND proowner=owner) THEN RAISE EXCEPTION 'PDT_LEADER_ACL_CHANGED'; END IF;
 END LOOP;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;

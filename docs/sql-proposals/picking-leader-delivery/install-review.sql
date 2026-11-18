-- Narrow role extension only; no operational rows, ACL, owners, or reception roles change.
BEGIN;
DO $patch$
DECLARE r record; def text; updated text; acl aclitem[]; owner oid;
BEGIN
 FOR r IN SELECT * FROM (VALUES
('public.sgp_pdt_picking_aviso_leer_v1(text,uuid)','556dabfa49166c931e55134c0f240483',1),
('public.sgp_pdt_picking_avisos_v1(text,uuid,integer)','835d28b32cb41d6c00fb8be33a50696e',2),
('public.sgp_pdt_picking_cola_v1(text,text,text,text,text,uuid,integer)','06fae1ce52462b37925315aa92cb669e',3),
('public.sgp_pdt_picking_movimiento_v1(text,uuid,text,integer,uuid,text)','3a5e8810fd171f4f9b448c9a53695a24',1),
('public.sgp_pdt_picking_simple_v1(text,uuid,integer,uuid,text)','f22b356e07e5e9e2604e578164294321',1)
 ) AS expected(signature,hash,changes) LOOP
  SELECT pg_get_functiondef(oid),proacl,proowner INTO STRICT def,acl,owner FROM pg_proc WHERE oid=r.signature::regprocedure;
  IF md5(def)<>r.hash THEN RAISE EXCEPTION 'PDT_LEADER_BASELINE_CHANGED: %',r.signature; END IF;
  updated:=replace(replace(def,'ARRAY[''ADMINISTRADOR'',''COORDINADOR'',''PICKING'',''SUPERVISOR DE PICKING'']','ARRAY[''ADMINISTRADOR'',''COORDINADOR'',''PICKING'',''SUPERVISOR DE PICKING'',''LIDER MECANIZADO'']'),'ARRAY[''ADMINISTRADOR'',''COORDINADOR'',''PICKING'',''SUPERVISOR DE PICKING'',''RECEPCION'',''LIDER LINEA'',''LIDER'',''PATINADOR'',''CONSULTA'']','ARRAY[''ADMINISTRADOR'',''COORDINADOR'',''PICKING'',''SUPERVISOR DE PICKING'',''RECEPCION'',''LIDER LINEA'',''LIDER'',''PATINADOR'',''CONSULTA'',''LIDER MECANIZADO'']');
  IF (length(updated)-length(def))/length(',''LIDER MECANIZADO''')<>r.changes THEN RAISE EXCEPTION 'PDT_LEADER_REPLACEMENT_COUNT: %',r.signature; END IF;
  EXECUTE updated;
  IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=r.signature::regprocedure AND proacl IS NOT DISTINCT FROM acl AND proowner=owner) THEN RAISE EXCEPTION 'PDT_LEADER_ACL_CHANGED'; END IF;
 END LOOP;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;

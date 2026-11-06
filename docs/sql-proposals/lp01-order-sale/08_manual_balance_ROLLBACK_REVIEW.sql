-- Manual per-order Disponible bounded by real stage balance. No grants or data changes.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $patch$ DECLARE p pg_proc%ROWTYPE; ddl text; body text; BEGIN
 SELECT * INTO p FROM pg_proc WHERE oid='public.sgp_lp_sale_orden_definir_v1(text,text,text,jsonb)'::regprocedure;
 IF md5(p.prosrc)<>'27342a35c3c7e6a0e0910f5d327323af' OR pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef
 OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
 OR p.proacl::text IS DISTINCT FROM '{postgres=X/postgres,anon=X/postgres}'
 THEN RAISE EXCEPTION 'SALE_MANUAL_CONTRACT_DRIFT'; END IF;
 ddl:=pg_get_functiondef(p.oid);body:=p.prosrc;
 body:=replace(body,$old$IF source->>'exportBalance' IS NULL THEN RAISE EXCEPTION 'SALE_ORDER_BALANCE_PENDING';END IF;$old$,$new$IF source->>'available' IS NULL THEN RAISE EXCEPTION 'SALE_ORDER_AVAILABILITY_PENDING';END IF;$new$);
 body:=replace(body,$old$IF q>(source->>'exportBalance')::bigint THEN RAISE EXCEPTION 'SALE_ORDER_EXCEEDS_BALANCE';END IF;$old$,$new$IF q>(source->>'available')::bigint THEN RAISE EXCEPTION 'SALE_ORDER_EXCEEDS_AVAILABLE';END IF;$new$);
 IF md5(body)<>'d7aa1edaea6a22004226e4a73a6fb61f' THEN RAISE EXCEPTION 'SALE_MANUAL_PATCH_FAILED'; END IF;
 EXECUTE replace(ddl,p.prosrc,body);
END $patch$;
DO $check$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_lp_sale_orden_definir_v1(text,text,text,jsonb)'::regprocedure)<>'d7aa1edaea6a22004226e4a73a6fb61f'
 THEN RAISE EXCEPTION 'SALE_MANUAL_POSTCHECK_FAILED'; END IF;
END $check$;
COMMIT;

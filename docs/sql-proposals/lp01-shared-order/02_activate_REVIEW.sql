-- REVIEW ONLY: requires specific installation/permission approval.
BEGIN;
SET LOCAL search_path='';SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'OWNER_REQUIRED';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('sgp_lp_shared_order.authorize(text,text,text,boolean)') AND md5(pg_get_functiondef(oid))='d658365a02ae350693966bf0875f6f66' AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=""'] AND proacl::text='{postgres=X/postgres}') THEN RAISE EXCEPTION 'SHARED_ACTIVATION_DRIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('sgp_lp_shared_order.nc_source(text)') AND md5(pg_get_functiondef(oid))='72866b3a67ca1c26b471a74acf7608e1' AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=""'] AND proacl::text='{postgres=X/postgres}') THEN RAISE EXCEPTION 'SHARED_ACTIVATION_DRIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.sgp_lp_shared_nc_lookup_v1(text,text,text,text)') AND md5(pg_get_functiondef(oid))='04d110092bb986cc0a0fe8eca730c27a' AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=""'] AND proacl::text='{postgres=X/postgres}') THEN RAISE EXCEPTION 'SHARED_ACTIVATION_DRIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.sgp_lp_shared_order_command_v1(text,text,text,jsonb)') AND md5(pg_get_functiondef(oid))='90b9f7a1e2c7711d2f9caeea4a01869d' AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=""'] AND proacl::text='{postgres=X/postgres}') THEN RAISE EXCEPTION 'SHARED_ACTIVATION_DRIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.sgp_lp_shared_order_read_v1(text,text,text)') AND md5(pg_get_functiondef(oid))='be7b206c5ecd28726594fd1f48331328' AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=""'] AND proacl::text='{postgres=X/postgres}') THEN RAISE EXCEPTION 'SHARED_ACTIVATION_DRIFT';END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.sgp_lp_shared_nc_lookup_v1(text,text,text,text),public.sgp_lp_shared_order_command_v1(text,text,text,jsonb),public.sgp_lp_shared_order_read_v1(text,text,text) TO anon;
UPDATE sgp_lp_shared_order.config SET writes=true WHERE id;
COMMIT;

SELECT md5(pg_get_functiondef('public.sgp_lp_shared_order_command_v1(text,text,text,jsonb)'::regprocedure)), proacl,proconfig FROM pg_proc WHERE oid='public.sgp_lp_shared_order_command_v1(text,text,text,jsonb)'::regprocedure;
SELECT column_name FROM information_schema.columns WHERE table_schema='sgp_lp_shared_order' AND table_name='reports';

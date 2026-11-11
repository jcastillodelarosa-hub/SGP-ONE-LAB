BEGIN READ ONLY;
SELECT md5(pg_get_functiondef('public.sgp_cargar_paquete_semanal(text,integer,integer,jsonb,jsonb,jsonb,jsonb)'::regprocedure)) AS writer_hash,
 md5(pg_get_functiondef('public.sgp_validar_paquete_semanal(integer,integer,jsonb,jsonb,jsonb,jsonb)'::regprocedure)) AS validator_hash;
-- Expected writer 53654295f422c940ac94b31e308f5164; validator 52a26bd58649b5407b5e777ef6f56b8d.
SELECT oid::regprocedure,prosecdef,proconfig,proacl FROM pg_proc WHERE oid='public.sgp_cargar_paquete_semanal(text,integer,integer,jsonb,jsonb,jsonb,jsonb)'::regprocedure;
COMMIT;

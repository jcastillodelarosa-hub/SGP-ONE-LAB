-- Run after fixture and REVIEW migration, on disposable PostgreSQL only.
BEGIN;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.sgp_linea_plan_saldos_grupo_v1('coord','["A|L","B|L","C|L","DECIMAL|L"]'::jsonb);
 IF (r->0->>'pendiente')::numeric<>5 OR (r->1->>'pendiente')::numeric<>3
    OR (r->2->>'pendiente')::numeric<>2 OR (r->3->>'pendiente')::numeric<>2 THEN
   RAISE EXCEPTION 'Global preview failed: %',r;
 END IF;
END $$;
DO $$ DECLARE r jsonb; id uuid := '00000000-0000-0000-0000-000000000001'; BEGIN
 r:=public.sgp_linea_plan_programar_grupo_v1('coord',id,'2026-10-31',1,'[{"key_produccion":"A|L","cantidad":3,"prioridad":1},{"key_produccion":"B|L","cantidad":4,"prioridad":1}]');
 IF (r->>'parcial')::boolean IS DISTINCT FROM true OR (r->>'ventanas_programadas')::integer<>3 OR (r->>'ventanas_pendientes')::integer<>4 THEN RAISE EXCEPTION 'Partial result failed: %',r; END IF;
 IF (SELECT count(*) FROM public.sgp_linea_plan_asignaciones)<>1 THEN RAISE EXCEPTION 'Partial integrity failed'; END IF;
 IF public.sgp_linea_plan_programar_grupo_v1('coord',id,'2026-10-31',1,'[{"key_produccion":"A|L","cantidad":3,"prioridad":1},{"key_produccion":"B|L","cantidad":4,"prioridad":1}]')<>r THEN RAISE EXCEPTION 'Retry differs'; END IF;
 IF (SELECT count(*) FROM public.sgp_linea_plan_asignaciones)<>1 THEN RAISE EXCEPTION 'Retry duplicated'; END IF;
 BEGIN PERFORM public.sgp_linea_plan_programar_grupo_v1('coord',id,'2026-10-31',1,'[{"key_produccion":"A|L","cantidad":2,"prioridad":1}]'); RAISE EXCEPTION 'Changed request accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Changed request accepted' THEN RAISE; END IF; END;
 BEGIN PERFORM public.sgp_linea_plan_programar_grupo_v1('bad',gen_random_uuid(),'2026-10-31',1,'[{"key_produccion":"C|L","cantidad":1,"prioridad":1}]'); RAISE EXCEPTION 'Unauthorized accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Unauthorized accepted' THEN RAISE; END IF; END;
 BEGIN PERFORM public.sgp_linea_plan_programar_grupo_v1('coord',gen_random_uuid(),'2026-10-31',1,'[{"key_produccion":"C|L","cantidad":1,"prioridad":1},{"key_produccion":"C|L","cantidad":1,"prioridad":1}]'); RAISE EXCEPTION 'Duplicate accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Duplicate accepted' THEN RAISE; END IF; END;
 r:=public.sgp_linea_plan_programar_grupo_v1('coord',gen_random_uuid(),'2026-10-31',1,'[{"key_produccion":"INACTIVA|L","cantidad":1,"prioridad":1}]');
 IF (r->>'procesadas')::integer<>1 OR jsonb_array_length(r->'rechazadas')<>1 THEN RAISE EXCEPTION 'Total rejection failed'; END IF;
END $$;
ROLLBACK;
DO $$ BEGIN IF (SELECT count(*) FROM public.sgp_linea_plan_asignaciones)<>0 THEN RAISE EXCEPTION 'Rollback did not restore assignments'; END IF; END $$;
-- Privilege boundary: no new anonymous/authenticated EXECUTE grant.
DO $$ BEGIN IF has_function_privilege('anon','public.sgp_linea_plan_programar_grupo_v1(text,uuid,date,integer,jsonb)','EXECUTE') OR has_function_privilege('authenticated','public.sgp_linea_plan_programar_grupo_v1(text,uuid,date,integer,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Unexpected EXECUTE grant'; END IF; END $$;

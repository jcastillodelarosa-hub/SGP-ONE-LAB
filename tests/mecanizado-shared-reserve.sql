-- Synthetic-only integration fixture. Run on an isolated PostgreSQL 17 database.
BEGIN;
INSERT INTO public.sgp_producciones(key_produccion,id,id_linea,anio,semana_base,semana_actual,produccion,cantidad,sistema,acabado,reserva_al)
VALUES
 ('1121855|PANELES_2','1121855','PANELES_2',2026,44,44,'1121855',12,'QA','DIFERENTE','8725215,8725225'),
 ('QA-OWN-A|PANELES_2','QA-OWN-A','PANELES_2',2026,44,44,'QA-OWN-A',16,'QA','NORMAL','8725215'),
 ('QA-OWN-B|PANELES_2','QA-OWN-B','PANELES_2',2026,44,44,'QA-OWN-B',12,'QA','NORMAL','8725225'),
 ('QA-OWN-C|PANELES_2','QA-OWN-C','PANELES_2',2026,44,44,'QA-OWN-C',15,'QA','NORMAL','8725225');
INSERT INTO public.sgp_prioridades(anio,semana,id_linea,reserva,key_produccion,prioridad,usuario)
VALUES
 (2026,44,'PANELES_2','8725215','1121855|PANELES_2','11','qa-coordinador'),
 (2026,44,'PANELES_2','8725215','QA-OWN-A|PANELES_2','11','qa-coordinador'),
 (2026,44,'PANELES_2','8725225','QA-OWN-B|PANELES_2','9.1','qa-coordinador'),
 (2026,44,'PANELES_2','8725225','QA-OWN-C|PANELES_2','9.2','qa-coordinador');
DO $test$ DECLARE a jsonb; b jsonb; id uuid; result jsonb; key uuid:=gen_random_uuid(); BEGIN
 SELECT to_jsonb(x) INTO a FROM public.sgp_mecanizado_disponibles('qa-coordinador',44) x WHERE reserva='8725215';
 SELECT to_jsonb(x) INTO b FROM public.sgp_mecanizado_disponibles('qa-coordinador',44) x WHERE reserva='8725225';
 IF (a->>'cantidad')::int<>28 OR (b->>'cantidad')::int<>27 THEN RAISE EXCEPTION 'reader expected 28/27; got %/%',a->>'cantidad',b->>'cantidad'; END IF;
 IF jsonb_array_length(a->'ordenes')<>2 OR jsonb_array_length(b->'ordenes')<>2 THEN RAISE EXCEPTION 'duplicate or missing production'; END IF;
 BEGIN
  PERFORM public.sgp_mecanizado_programar('qa-coordinador','8725225','1121855',12,'2026-10-28','TURNO 1',1,NULL,NULL,'9.1');
  RAISE EXCEPTION 'secondary accepted shared production';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='secondary accepted shared production' THEN RAISE; END IF;
 END;
 id:=public.sgp_mecanizado_programar('qa-coordinador','8725215',NULL,28,'2026-10-28','TURNO 1',1,NULL,NULL,'11');
 IF (SELECT count(*) FROM public.sgp_mecanizado_programacion_detalle WHERE id_programacion=id)<>2 THEN RAISE EXCEPTION 'missing canonical detail'; END IF;
 IF (SELECT sum(cantidad_snapshot) FROM public.sgp_mecanizado_programacion_detalle WHERE id_programacion=id)<>28 THEN RAISE EXCEPTION 'bad saved total'; END IF;
 IF (SELECT count(*) FROM public.sgp_mecanizado_programacion_detalle WHERE key_produccion='1121855|PANELES_2' AND id_programacion=id)<>1 THEN RAISE EXCEPTION 'shared key duplicated'; END IF;
 BEGIN
   PERFORM public.sgp_mecanizado_programar('qa-picking','8725225',NULL,12,'2026-10-28','TURNO 1',1,NULL,NULL,'9.1');
   RAISE EXCEPTION 'unauthorized role accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='unauthorized role accepted' THEN RAISE; END IF;
 END;
 UPDATE public.sgp_mecanizado_programacion SET fecha_programacion='2026-10-30' WHERE id_programacion=id;
 IF (SELECT count(*) FROM public.sgp_mecanizado_programacion_detalle WHERE id_programacion=id)<>2 THEN RAISE EXCEPTION 'reprogram lost details'; END IF;
 UPDATE public.sgp_mecanizado_programacion SET estado='CANCELADA' WHERE id_programacion=id;
 IF (SELECT count(*) FROM public.sgp_mecanizado_programacion_detalle d JOIN public.sgp_mecanizado_programacion mp USING(id_programacion)
     WHERE mp.estado<>'CANCELADA' AND d.key_produccion='1121855|PANELES_2')<>0 THEN RAISE EXCEPTION 'cancel did not release shared key'; END IF;
 id:=public.sgp_mecanizado_programar('qa-coordinador','8725215',NULL,28,'2026-10-31','TURNO 2',1,NULL,NULL,'11');
 IF (SELECT sum(cantidad_snapshot) FROM public.sgp_mecanizado_programacion_detalle WHERE id_programacion=id)<>28 THEN RAISE EXCEPTION 'cancel and retry failed'; END IF;
 IF to_regprocedure('public.sgp_mecanizado_partes_programar(text,text,text,jsonb,uuid)') IS NOT NULL THEN
   BEGIN
     PERFORM public.sgp_mecanizado_partes_programar('qa-coordinador','1121855|PANELES_2','8725225','[{"cantidad":1,"fecha":"2026-10-29","turno":"TURNO 1","prioridad":1}]',gen_random_uuid());
     RAISE EXCEPTION 'partial route accepted secondary reservation';
   EXCEPTION WHEN raise_exception THEN
     IF SQLERRM='partial route accepted secondary reservation' THEN RAISE; END IF;
   END;
   result:=public.sgp_mecanizado_partes_programar('qa-coordinador','QA-OWN-B|PANELES_2','8725225',
     '[{"cantidad":5,"fecha":"2026-10-29","turno":"TURNO 1","prioridad":1}]',key);
   IF result->>'disponible'<>'7' THEN RAISE EXCEPTION 'partial saldo wrong: %',result; END IF;
   IF public.sgp_mecanizado_partes_programar('qa-coordinador','QA-OWN-B|PANELES_2','8725225',
     '[{"cantidad":5,"fecha":"2026-10-29","turno":"TURNO 1","prioridad":1}]',key)<>result THEN RAISE EXCEPTION 'retry not idempotent'; END IF;
 END IF;
END $test$;
ROLLBACK;

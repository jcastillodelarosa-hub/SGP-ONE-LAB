-- Synthetic PostgreSQL 17 fixture. Never execute in Supabase.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE TABLE public.sgp_producciones (
 key_produccion text PRIMARY KEY, produccion text, id_linea text, anio integer,
 semana_base integer, reserva_al text, cantidad numeric
);
CREATE TABLE public.sgp_mecanizado_programacion_detalle (
 id_programacion uuid, key_produccion text REFERENCES public.sgp_producciones(key_produccion)
);
CREATE TABLE public.sgp_picking_entregas (
 id_entrega uuid PRIMARY KEY, id_programacion uuid, produccion text,
 estado text, completa boolean, fecha_operativa date
);
CREATE TABLE public.sgp_recepcion_reservas (
 id_recepcion uuid PRIMARY KEY, reserva text UNIQUE, completa boolean, legalizada boolean
);
WITH x AS (
 SELECT g,CASE WHEN g<=10 THEN 'FRAMES_2' ELSE 'PANELES_2' END line
 FROM generate_series(1,798) g
)
INSERT INTO public.sgp_producciones
SELECT 'K'||lpad(g::text,4,'0')||'|'||line,
 'P'||lpad((((g-1)%406)+1)::text,4,'0'),line,2026,41+((g-1)%4),
 'R'||lpad((((g-1)%94)+1)::text,3,'0'),CASE WHEN g<=159 THEN 8 ELSE 7 END
FROM x;
INSERT INTO public.sgp_producciones VALUES('OUTSIDE|PANELES_2','OUTSIDE','PANELES_2',2026,45,'R999',99);
INSERT INTO public.sgp_mecanizado_programacion_detalle
SELECT gen_random_uuid(),key_produccion FROM public.sgp_producciones
WHERE key_produccion LIKE 'K%' ORDER BY key_produccion LIMIT 254;
INSERT INTO public.sgp_mecanizado_programacion_detalle
SELECT gen_random_uuid(),key_produccion FROM public.sgp_producciones
WHERE key_produccion LIKE 'K%' ORDER BY key_produccion LIMIT 3;
INSERT INTO public.sgp_picking_entregas
SELECT gen_random_uuid(),d.id_programacion,s.produccion,
 CASE WHEN row_number() OVER (ORDER BY s.key_produccion)<=5 THEN 'AUDITADA_DIFERENCIA' ELSE 'VALIDADA' END,
 true,DATE '2026-10-26'
FROM public.sgp_mecanizado_programacion_detalle d
JOIN public.sgp_producciones s USING(key_produccion)
ORDER BY s.key_produccion LIMIT 50;
INSERT INTO public.sgp_recepcion_reservas
SELECT gen_random_uuid(),'R'||lpad(g::text,3,'0'),g>63,g>63
FROM generate_series(1,93) g;

-- Optional product read-only check for ChatGPT; returns aggregates and a digest only.
-- No operational rows, tokens, names or reservations are returned.
BEGIN TRANSACTION READ ONLY;
SELECT count(*) AS total_pdt,
       count(*) FILTER (WHERE estado='PENDIENTE') AS pendientes,
       count(*) FILTER (WHERE es_reserva_compartida) AS compartidas_true,
       count(*) FILTER (WHERE NOT es_reserva_compartida) AS compartidas_false,
       md5(string_agg(id_pendiente::text||':'||es_reserva_compartida::text,',' ORDER BY id_pendiente)) AS digest_id_y_compartida
FROM public.sgp_aluminio_pendientes;
ROLLBACK;

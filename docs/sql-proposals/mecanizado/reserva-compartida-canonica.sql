-- REVIEW ONLY. Do not apply without QA and explicit production approval.
-- Changes both read and write RPCs; preserves signatures, ACL and RLS.
BEGIN;
DO $migration$
DECLARE
 reader text;
 writer text;
 old_reader text;
 old_writer text;
 old_scope text := 'where pr.reserva=p_reserva and pr.id_linea=''PANELES_2'' and sp.id_linea=''PANELES_2''';
 new_scope text := 'where pr.reserva=p_reserva and pr.id_linea=''PANELES_2'' and sp.id_linea=''PANELES_2'' and nullif(trim(split_part(coalesce(sp.reserva_al,''''),'','',1)),'''')=p_reserva';
 old_principal text := 'coalesce(pr.reserva,nullif(trim(split_part(coalesce(sp.reserva_al,''''),'','',1)),''''))';
 new_principal text := 'nullif(trim(split_part(coalesce(sp.reserva_al,''''),'','',1)),'''')';
 old_filter text := 'join principal x on x.reserva_principal=p.reserva_principal and x.sistema=p.sistema and x.acabado=p.acabado';
 new_filter text := 'join principal x on x.reserva_principal=p.reserva_principal';
BEGIN
 SELECT pg_get_functiondef('public.sgp_mecanizado_disponibles(text,integer)'::regprocedure) INTO reader;
 SELECT pg_get_functiondef('public.sgp_mecanizado_programar(text,text,text,integer,date,text,integer,text,text,text)'::regprocedure) INTO writer;
 old_reader := reader; old_writer := writer;
 IF length(reader)-length(replace(reader,old_principal,''))<>length(old_principal)
 OR length(reader)-length(replace(reader,old_filter,''))<>length(old_filter)
 THEN RAISE EXCEPTION 'Reader contract changed; review manually'; END IF;
 reader := replace(replace(reader,old_principal,new_principal),old_filter,new_filter);
 IF (length(writer)-length(replace(writer,old_scope,'')))/length(old_scope)<>4
 THEN RAISE EXCEPTION 'Writer contract changed; expected four scope filters'; END IF;
 writer := replace(writer,old_scope,new_scope);
 IF reader=old_reader OR writer=old_writer THEN RAISE EXCEPTION 'No-op migration'; END IF;
 EXECUTE reader;
 EXECUTE writer;
END
$migration$;
COMMIT;

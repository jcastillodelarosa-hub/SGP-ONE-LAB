-- PROPUESTA N4: NO ejecutar en producción sin revisión y autorización.
-- Unifica la pertenencia canónica con la PRIMERA reserva de reserva_al.
-- No reparte cantidades: una producción pertenece al 100 % a su reserva principal.
-- Requiere pruebas en base aislada y snapshot de definiciones para reversión.
BEGIN;
DO $migration$
DECLARE
  reader text;
  writer text;
  reader_before text;
  writer_before text;
  first_expr text := 'nullif(trim(split_part(coalesce(sp.reserva_al,'''') ,'','',1)),'''')';
  predicate text := ' and nullif(trim(split_part(coalesce(sp.reserva_al,'''') ,'','',1)),'''')=p_reserva';
BEGIN
  SELECT pg_get_functiondef('public.sgp_mecanizado_disponibles(text,integer)'::regprocedure) INTO reader;
  SELECT pg_get_functiondef('public.sgp_mecanizado_programar(text,text,text,integer,date,text,integer,text,text,text)'::regprocedure) INTO writer;
  reader_before := reader;
  writer_before := writer;
  -- La prioridad no puede redefinir la reserva principal: manda el primer valor de reserva_al.
  reader := replace(reader,
    'coalesce(pr.reserva,nullif(trim(split_part(coalesce(sp.reserva_al,'''') ,'','',1)),''''))',
    first_expr);
  -- La lectura debe incluir TODOS los acabados de la reserva principal;
  -- la elección de acabado predominante no puede ocultar producciones.
  reader := replace(reader,
    'join principal x on x.reserva_principal=p.reserva_principal and x.sistema=p.sistema and x.acabado=p.acabado',
    'join principal x on x.reserva_principal=p.reserva_principal');
  IF reader=reader_before THEN RAISE EXCEPTION 'Contrato de lectura distinto: abortar'; END IF;
  -- Restringir también las escrituras: no permitir programar una producción desde reserva secundaria.
  writer := replace(writer,
    'where pr.reserva=p_reserva and pr.id_linea=''PANELES_2'' and sp.id_linea=''PANELES_2''',
    'where pr.reserva=p_reserva and pr.id_linea=''PANELES_2'' and sp.id_linea=''PANELES_2''' || predicate);
  IF writer=writer_before THEN RAISE EXCEPTION 'Contrato de escritura distinto: abortar'; END IF;
  EXECUTE reader;
  EXECUTE writer;
END
$migration$;
COMMIT;

-- SGP_ONE: solo la auditoría moderna con fecha y turno admite LIDER MECANIZADO y RECEPCION.
-- La firma antigua de seis parámetros mantiene sus permisos anteriores.
DO $migration$
DECLARE
  fn text;
  signature regprocedure := 'public.sgp_recepcion_guardar(text,text,boolean,boolean,text,jsonb,date,text)'::regprocedure;
  previous_roles text := 'array[''ADMINISTRADOR'',''COORDINADOR'',''LIDER'']';
  permitted_roles text := 'array[''ADMINISTRADOR'',''COORDINADOR'',''LIDER'',''LIDER MECANIZADO'',''RECEPCION'']';
BEGIN
  fn := pg_get_functiondef(signature);
  IF position(permitted_roles IN fn) > 0 THEN RETURN; END IF;
  IF position(previous_roles IN fn) = 0 THEN
    RAISE EXCEPTION 'Unexpected authorization definition in %', signature;
  END IF;
  IF position('FECHA_REQUERIDA' IN fn) = 0 OR position('TURNO_REQUERIDO' IN fn) = 0
     OR position('usuario_recepcion' IN fn) = 0 OR position('sgp_recepcion_historial' IN fn) = 0 THEN
    RAISE EXCEPTION 'Required audit safeguards absent in %', signature;
  END IF;
  EXECUTE replace(fn, previous_roles, permitted_roles);
END $migration$;

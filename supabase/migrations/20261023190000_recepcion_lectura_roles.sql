-- SGP_ONE: habilita lectura a LIDER MECANIZADO y RECEPCION sin ampliar escrituras.
-- Aplicada en Supabase: recepcion_lectura_roles_20261023.
DO $migration$
DECLARE fn text; target regprocedure;
  old_guard text := 'array[''ADMINISTRADOR'',''COORDINADOR'',''LIDER'',''CONSULTA'']';
  new_guard text := 'array[''ADMINISTRADOR'',''COORDINADOR'',''LIDER'',''CONSULTA'',''LIDER MECANIZADO'',''RECEPCION'']';
BEGIN
 FOR target IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('sgp_recepcion_listar','sgp_consultar_seguimiento_aluminio') LOOP
  fn := pg_get_functiondef(target);
  IF position(new_guard in fn)>0 THEN CONTINUE; END IF;
  IF position(old_guard in fn)=0 THEN RAISE EXCEPTION 'Unexpected role guard in %',target; END IF;
  fn := replace(fn,old_guard,new_guard);
  IF target::text LIKE '%sgp_recepcion_listar%' THEN
    IF position('insert into sgp_recepcion_reservas(reserva,anio,semana_prog)' in fn)=0
       OR position('on conflict(reserva) do update set anio=excluded.anio,semana_prog=excluded.semana_prog;' in fn)=0
    THEN RAISE EXCEPTION 'Unexpected sync block'; END IF;
    fn := replace(fn,'insert into sgp_recepcion_reservas(reserva,anio,semana_prog)',
      'if not exists (select 1 from sgp_usuarios where usuario=u and rol in (''LIDER MECANIZADO'',''RECEPCION'')) then insert into sgp_recepcion_reservas(reserva,anio,semana_prog)');
    fn := replace(fn,'on conflict(reserva) do update set anio=excluded.anio,semana_prog=excluded.semana_prog;',
      'on conflict(reserva) do update set anio=excluded.anio,semana_prog=excluded.semana_prog; end if;');
  END IF;
  EXECUTE fn;
 END LOOP;
END $migration$;

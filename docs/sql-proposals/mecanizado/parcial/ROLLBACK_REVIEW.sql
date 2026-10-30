-- REVIEW ONLY. Rehearsal/pre-activation rollback, with drift/data guards.
-- Once parts have been used, preserve their data and deploy a forward correction instead.
begin;
set local lock_timeout='5s';
do $$
declare r record;
begin
 if exists(select 1 from sgp_mecanizado_parcial.partes) then
  raise exception 'ROLLBACK_BLOQUEADO: conservar partes/historial; preparar corrección forward';
 end if;
 for r in select * from sgp_mecanizado_parcial.respaldo_funciones loop
  if md5(pg_get_functiondef(r.firma::regprocedure)) is distinct from r.instalada then
   raise exception 'ROLLBACK_BLOQUEADO: función modificada después de instalación: %',r.firma;
  end if;
 end loop;
 for r in select * from sgp_mecanizado_parcial.respaldo_funciones loop
  execute r.definicion;
 end loop;
end $$;
drop schema sgp_mecanizado_parcial cascade;
drop function public.sgp_mecanizado_partes_consultar(text,text);
drop function public.sgp_mecanizado_partes_programar(text,text,text,jsonb,uuid);
drop function public.sgp_mecanizado_parte_mover(text,uuid,date,text,integer,text,boolean);
drop function public.sgp_mecanizado_parte_historial(text,uuid);
drop function public.sgp_mecanizado_partes_resumen(text,date,date);
drop function public.sgp_mecanizado_es_parte(uuid);
notify pgrst,'reload schema';
commit;

-- LAB v288: bloquear una misma orden en más de una programación activa.
create or replace function public.sgp_mecanizado_prevenir_detalle_duplicado()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_reserva text;
begin
 select p.reserva into v_reserva from public.sgp_mecanizado_programacion p where p.id_programacion=new.id_programacion;
 if v_reserva is null then raise exception 'Programación inexistente'; end if;
 if new.reserva_snapshot is distinct from v_reserva then raise exception 'Reserva de detalle no coincide con programación'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_reserva||'|'||new.key_produccion,0));
 if exists (
  select 1 from public.sgp_mecanizado_programacion_detalle d
  join public.sgp_mecanizado_programacion p on p.id_programacion=d.id_programacion
  where p.reserva=v_reserva and d.key_produccion=new.key_produccion
    and p.estado<>'CANCELADA'
 ) then
  raise exception 'La orden % ya está vinculada a una programación activa de la reserva %',new.key_produccion,v_reserva;
 end if;
 return new;
end $$;
create trigger sgp_mecanizado_prevenir_detalle_duplicado
before insert on public.sgp_mecanizado_programacion_detalle
for each row execute function public.sgp_mecanizado_prevenir_detalle_duplicado();

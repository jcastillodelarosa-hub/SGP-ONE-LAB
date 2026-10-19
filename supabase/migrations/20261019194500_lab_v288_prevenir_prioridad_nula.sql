-- LAB v288: prevenir nuevas programaciones sin prioridad válida.
create or replace function public.sgp_mecanizado_validar_prioridad_nueva()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.prioridad_semanal is null then raise exception 'Prioridad semanal requerida'; end if;
 if not exists(
  select 1 from public.sgp_prioridades pr
  where pr.reserva=new.reserva and pr.prioridad=new.prioridad_semanal and pr.id_linea='PANELES_2'
 ) then raise exception 'Prioridad no corresponde a la reserva'; end if;
 return new;
end $$;
create trigger sgp_mecanizado_validar_prioridad_nueva
before insert on public.sgp_mecanizado_programacion
for each row execute function public.sgp_mecanizado_validar_prioridad_nueva();

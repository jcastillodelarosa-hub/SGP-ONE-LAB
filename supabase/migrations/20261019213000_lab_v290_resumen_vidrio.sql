-- LAB v290: resumen único de vidrio por key_produccion (ID + línea).
create table if not exists public.sgp_vidrio_resumen_produccion (
 key_produccion text primary key,
 vidrio_preparado numeric not null default 0,
 vidrio_novedad numeric not null default 0,
 vidrio_traslado numeric not null default 0,
 actualizado_en timestamptz not null default now()
);
alter table public.sgp_vidrio_resumen_produccion enable row level security;
revoke all on public.sgp_vidrio_resumen_produccion from anon,authenticated;
create or replace function public.sgp_refrescar_vidrio_resumen()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
  delete from public.sgp_vidrio_resumen_produccion where key_produccion=old.key_produccion;
  insert into public.sgp_vidrio_resumen_produccion(key_produccion,vidrio_preparado,vidrio_novedad,vidrio_traslado)
  select key_produccion,
   coalesce(sum(disponible) filter(where lower(coalesce(estado_orden,'')) like 'preparado%' and upper(coalesce(posicion,'')) not like 'T%' and upper(coalesce(posicion,'')) not like 'L%'),0),
   coalesce(sum(disponible) filter(where lower(coalesce(estado_orden,'')) like 'novedad%' and upper(coalesce(posicion,'')) not like 'T%' and upper(coalesce(posicion,'')) not like 'L%'),0),
   coalesce(sum(disponible) filter(where upper(coalesce(posicion,'')) like 'T%' or upper(coalesce(posicion,'')) like 'L%'),0)
  from public.sgp_ubicacion_vidrio_actual where activo=true and key_produccion=old.key_produccion group by key_produccion;
  return old;
 end if;
 if tg_op='UPDATE' and old.key_produccion is distinct from new.key_produccion then
  delete from public.sgp_vidrio_resumen_produccion where key_produccion=old.key_produccion;
  insert into public.sgp_vidrio_resumen_produccion(key_produccion,vidrio_preparado,vidrio_novedad,vidrio_traslado)
  select key_produccion,
   coalesce(sum(disponible) filter(where lower(coalesce(estado_orden,'')) like 'preparado%' and upper(coalesce(posicion,'')) not like 'T%' and upper(coalesce(posicion,'')) not like 'L%'),0),
   coalesce(sum(disponible) filter(where lower(coalesce(estado_orden,'')) like 'novedad%' and upper(coalesce(posicion,'')) not like 'T%' and upper(coalesce(posicion,'')) not like 'L%'),0),
   coalesce(sum(disponible) filter(where upper(coalesce(posicion,'')) like 'T%' or upper(coalesce(posicion,'')) like 'L%'),0)
  from public.sgp_ubicacion_vidrio_actual where activo=true and key_produccion=old.key_produccion group by key_produccion;
 end if;
 delete from public.sgp_vidrio_resumen_produccion where key_produccion=new.key_produccion;
 insert into public.sgp_vidrio_resumen_produccion(key_produccion,vidrio_preparado,vidrio_novedad,vidrio_traslado)
 select key_produccion,
  coalesce(sum(disponible) filter(where lower(coalesce(estado_orden,'')) like 'preparado%' and upper(coalesce(posicion,'')) not like 'T%' and upper(coalesce(posicion,'')) not like 'L%'),0),
  coalesce(sum(disponible) filter(where lower(coalesce(estado_orden,'')) like 'novedad%' and upper(coalesce(posicion,'')) not like 'T%' and upper(coalesce(posicion,'')) not like 'L%'),0),
  coalesce(sum(disponible) filter(where upper(coalesce(posicion,'')) like 'T%' or upper(coalesce(posicion,'')) like 'L%'),0)
 from public.sgp_ubicacion_vidrio_actual where activo=true and key_produccion=new.key_produccion group by key_produccion;
 return new;
end $$;
create trigger sgp_vidrio_resumen_sync after insert or update or delete on public.sgp_ubicacion_vidrio_actual
for each row execute function public.sgp_refrescar_vidrio_resumen();
insert into public.sgp_vidrio_resumen_produccion(key_produccion,vidrio_preparado,vidrio_novedad,vidrio_traslado)
select key_produccion,
 coalesce(sum(disponible) filter(where lower(coalesce(estado_orden,'')) like 'preparado%' and upper(coalesce(posicion,'')) not like 'T%' and upper(coalesce(posicion,'')) not like 'L%'),0),
 coalesce(sum(disponible) filter(where lower(coalesce(estado_orden,'')) like 'novedad%' and upper(coalesce(posicion,'')) not like 'T%' and upper(coalesce(posicion,'')) not like 'L%'),0),
 coalesce(sum(disponible) filter(where upper(coalesce(posicion,'')) like 'T%' or upper(coalesce(posicion,'')) like 'L%'),0)
from public.sgp_ubicacion_vidrio_actual where activo=true group by key_produccion
on conflict(key_produccion) do update set vidrio_preparado=excluded.vidrio_preparado,vidrio_novedad=excluded.vidrio_novedad,vidrio_traslado=excluded.vidrio_traslado,actualizado_en=now();

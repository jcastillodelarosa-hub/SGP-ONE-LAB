-- SGP_ONE: guard against duplicate complete Picking deliveries.
-- PROPOSED ONLY. Requires explicit authorization and controlled deployment to Supabase.
-- Existing historical rows are deliberately preserved.
-- Locks by programming/production to prevent simultaneous duplicate inserts.
create or replace function public.sgp_picking_rechazar_entrega_completa_duplicada()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.completa is distinct from true then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.id_programacion::text || '|' || new.produccion, 0));
  if exists (
    select 1 from public.sgp_picking_entregas e
    where e.id_programacion = new.id_programacion
      and e.produccion = new.produccion
      and e.completa is true
      and e.estado in ('PENDIENTE_VALIDACION','VALIDADA','AUDITADA_DIFERENCIA')
  ) then
    raise exception 'ENTREGA_COMPLETA_YA_REGISTRADA: la producción ya tiene una entrega completa activa'
      using errcode = '23505';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_sgp_picking_no_duplicar_completa on public.sgp_picking_entregas;
create trigger trg_sgp_picking_no_duplicar_completa
before insert on public.sgp_picking_entregas
for each row execute function public.sgp_picking_rechazar_entrega_completa_duplicada();
-- Rollback: drop trigger if exists trg_sgp_picking_no_duplicar_completa on public.sgp_picking_entregas;
-- drop function if exists public.sgp_picking_rechazar_entrega_completa_duplicada();

-- LAB v287: evidencias operativas de conciliación, sin alterar programación ni ejecución.
-- Esta migración NO incorpora todavía las confirmaciones: deben insertarse mediante proceso autorizado y auditable.
create table if not exists public.sgp_mecanizado_conciliaciones_operativas (
 id uuid primary key default gen_random_uuid(),
 reserva text not null,
 cantidad_canonica integer not null check (cantidad_canonica > 0),
 cantidad_confirmada integer not null check (cantidad_confirmada > 0 and cantidad_confirmada <= cantidad_canonica),
 estado text not null default 'CONFIRMADA_OPERACION' check (estado in ('CONFIRMADA_OPERACION','REVOCADA')),
 motivo text not null check (length(trim(motivo)) > 5),
 usuario_confirmacion text not null,
 fecha_confirmacion timestamptz not null default now(),
 evidencia jsonb not null default '{}'::jsonb,
 unique (reserva,estado)
);
alter table public.sgp_mecanizado_conciliaciones_operativas enable row level security;
revoke all on public.sgp_mecanizado_conciliaciones_operativas from anon,authenticated;
comment on table public.sgp_mecanizado_conciliaciones_operativas is 'Evidencia administrativa de reserva completa; NO representa órdenes, producción ni entregas.';

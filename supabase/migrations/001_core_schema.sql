-- SGP ONE
-- Initial PostgreSQL/Supabase schema derived from the validated Apps Script model.
-- Do not run in production until reviewed in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.sgp_lineas (
  id_linea text primary key,
  nombre text not null,
  activa text not null default 'SI' check (activa in ('SI','NO'))
);

create table if not exists public.sgp_sublineas (
  id_sublinea text primary key,
  id_linea text not null references public.sgp_lineas(id_linea),
  nivel integer not null,
  activa text not null default 'SI' check (activa in ('SI','NO'))
);

create table if not exists public.sgp_procesos (
  id_proceso text not null,
  id_linea text not null references public.sgp_lineas(id_linea),
  orden integer not null,
  activo text not null default 'SI' check (activo in ('SI','NO')),
  primary key (id_linea, id_proceso)
);

create table if not exists public.sgp_relaciones_lineas (
  id_linea_a text not null references public.sgp_lineas(id_linea),
  id_linea_b text not null references public.sgp_lineas(id_linea),
  tipo_relacion text not null default 'HERMANA',
  activa text not null default 'SI' check (activa in ('SI','NO')),
  primary key (id_linea_a, id_linea_b)
);

create table if not exists public.sgp_maestro_piezas (
  codigo_sap text primary key,
  tipo_pieza text not null check (tipo_pieza in ('PANEL','FRAME','COVER','REFUERZO','MUNTIN')),
  destino_productivo text not null check (destino_productivo in ('PANEL','FRAME')),
  observacion text,
  activo text not null default 'SI' check (activo in ('SI','NO')),
  fecha_actualizacion timestamptz not null default now()
);

create table if not exists public.sgp_producciones (
  key_produccion text primary key,
  id text not null,
  id_linea text not null references public.sgp_lineas(id_linea),
  prioridad_programacion text,
  anio integer,
  semana_base integer,
  semana_actual integer,
  tipo text,
  mercado text,
  proyecto text,
  produccion text,
  sistema text,
  cantidad numeric,
  cliente text,
  mercado_detalle text,
  ensamblado numeric,
  empacado numeric,
  cantidad_pt numeric,
  cargue numeric,
  despacho numeric,
  saldo_ensamble numeric,
  saldo_empaque numeric,
  saldo_cargue numeric,
  saldo_despacho numeric,
  estado_produccion text check (
    estado_produccion is null or
    estado_produccion in ('CERRADA','ABIERTA','ENSAMBLADA','FINALIZADA')
  ),
  codigo_programacion_abierto text,
  estado_destino_fussion text,
  acabado text,
  reserva_al text,
  porc_aluminio numeric,
  estado_reserva_al text,
  orden_oves text,
  porc_vidrio numeric,
  grupo_vidrio text,
  reservas_accesorios text,
  obs_accesorios text,
  muntin text,
  cantidad_muntin numeric,
  flush_frame text,
  cantidad_flush_frame numeric,
  sistema_curvo text,
  screen_requiere_frame text,
  es_smi text,
  es_lmi text,
  es_two_tone text,
  id_op_fussion text,
  id_sistema_fk text,
  fecha_recibido text,
  pedido_sap text,
  orden_co text,
  es_service text,
  solo_panel_lleva_cover text,
  sistema_pvc text,
  tipo_sellado text,
  mecanizado text,
  es_sistema_modificado text,
  lotes text,
  activa text not null default 'SI' check (activa in ('SI','NO')),
  fecha_actualizacion timestamptz not null default now(),
  fuente text,
  id_carga text,
  constraint produccion_identity check (key_produccion = id || '|' || id_linea)
);

create index if not exists ix_sgp_producciones_id
  on public.sgp_producciones(id);

create index if not exists ix_sgp_producciones_linea_semana
  on public.sgp_producciones(id_linea, anio, semana_actual);

create table if not exists public.sgp_base_semana (
  key_produccion text primary key references public.sgp_producciones(key_produccion),
  anio integer not null,
  semana_base integer not null,
  id_carga text,
  fecha_carga timestamptz not null default now()
);

create table if not exists public.sgp_aluminio (
  id_pieza text primary key,
  id_carga text not null,
  fila_origen integer not null,
  id text,
  key_produccion text,
  id_linea_origen text,
  id_linea_destino text,
  estado_relacion_produccion text,
  descripcion text,
  acabado text,
  longitud numeric,
  marca text,
  fabricacion text,
  semana integer,
  anio integer,
  order_co text,
  produccion text,
  id_orden_produccion text,
  proyecto text,
  cantidad numeric,
  codigo_sap text,
  sistema text,
  id_sistema text,
  unidades numeric,
  uso text,
  tipo_pieza text,
  destino_productivo text,
  estado_clasificacion text,
  fecha_carga timestamptz not null default now(),
  activo text not null default 'SI' check (activo in ('SI','NO'))
);

create index if not exists ix_sgp_aluminio_id
  on public.sgp_aluminio(id);

create index if not exists ix_sgp_aluminio_key_produccion
  on public.sgp_aluminio(key_produccion);

create table if not exists public.sgp_seguimiento_aluminio (
  key_seguimiento_aluminio text primary key,
  id text not null,
  reserva text not null,
  anio integer,
  semana integer,
  proyecto text,
  produccion text,
  sistema text,
  estado_reserva text not null check (
    estado_reserva in (
      'PENDIENTE_ABASTECIMIENTO',
      'PENDIENTE_BODEGA',
      'ALUMINIO_ENTREGADO'
    )
  ),
  estado_reserva_fuente text,
  peso_reserva numeric,
  cant_vent numeric,
  porcentaje_vidrio numeric,
  vent_cant_vidrio numeric,
  id_carga text,
  fecha_actualizacion timestamptz not null default now(),
  activo text not null default 'SI' check (activo in ('SI','NO')),
  constraint seguimiento_identity check (
    key_seguimiento_aluminio = id || '|' || reserva
  )
);

create index if not exists ix_sgp_seguimiento_aluminio_id
  on public.sgp_seguimiento_aluminio(id);

create index if not exists ix_sgp_seguimiento_aluminio_reserva
  on public.sgp_seguimiento_aluminio(reserva);

create table if not exists public.sgp_lotes_carga (
  id_lote_carga text primary key,
  fecha_hora timestamptz not null default now(),
  usuario text,
  tipo_carga text,
  id_unidad_carga text,
  anio integer,
  semana_base integer,
  estado text,
  archivos_esperados integer default 0,
  archivos_recibidos integer default 0,
  archivos_validos integer default 0,
  registros_recibidos integer default 0,
  insertados integer default 0,
  actualizados integer default 0,
  inconsistencias integer default 0,
  fecha_aplicacion timestamptz,
  detalle text
);

create table if not exists public.sgp_sesiones_actualizacion (
  id_sesion text primary key,
  fecha_hora timestamptz not null default now(),
  usuario text,
  tipo text,
  estado text,
  fuentes_seleccionadas text,
  fuentes_recibidas text,
  fuentes_validas text,
  archivos_recibidos integer default 0,
  archivos_validos integer default 0,
  registros_recibidos integer default 0,
  insertados integer default 0,
  actualizados integer default 0,
  sin_cambios integer default 0,
  desaparecidas integer default 0,
  inconsistencias integer default 0,
  fecha_aplicacion timestamptz,
  detalle text
);

create table if not exists public.sgp_cargas (
  id_carga text primary key,
  id_lote_carga text references public.sgp_lotes_carga(id_lote_carga),
  id_sesion text references public.sgp_sesiones_actualizacion(id_sesion),
  fecha_hora timestamptz not null default now(),
  usuario text,
  tipo_carga text,
  fuente text,
  archivo text,
  anio integer,
  semana_base integer,
  semanas_archivo text,
  registros_recibidos integer default 0,
  insertados integer default 0,
  actualizados integer default 0,
  inconsistencias integer default 0,
  resultado text,
  detalle text,
  constraint carga_scope check (
    not (id_lote_carga is not null and id_sesion is not null)
  )
);

-- The operational browser must never receive service-role credentials.
-- RLS is enabled now; policies will be added when authentication/roles are defined.
alter table public.sgp_lineas enable row level security;
alter table public.sgp_sublineas enable row level security;
alter table public.sgp_procesos enable row level security;
alter table public.sgp_relaciones_lineas enable row level security;
alter table public.sgp_maestro_piezas enable row level security;
alter table public.sgp_producciones enable row level security;
alter table public.sgp_base_semana enable row level security;
alter table public.sgp_aluminio enable row level security;
alter table public.sgp_seguimiento_aluminio enable row level security;
alter table public.sgp_lotes_carga enable row level security;
alter table public.sgp_sesiones_actualizacion enable row level security;
alter table public.sgp_cargas enable row level security;

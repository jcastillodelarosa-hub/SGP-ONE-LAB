-- SGP ONE - 27 sublíneas físicas autoritativas
-- Fuente: maestro confirmado por el usuario.
-- Normalización: ACTIVA fuente = ACTIVO se materializa como SI, estándar booleano SGP ONE.

alter table public.sgp_sublineas
  add column if not exists codigo text,
  add column if not exists nombre text,
  add column if not exists orden integer,
  add column if not exists observacion text;

insert into public.sgp_sublineas
(id_sublinea,id_linea,nivel,activa,codigo,nombre,orden,observacion) values
('CASEMENT_L1','CASEMENT',1,'SI','L1','LINEA 1',10,null),
('CASEMENT_2_L1','CASEMENT_2',1,'SI','L1','LINEA 1',10,null),
('CASEMENT_3_L1','CASEMENT_3',1,'SI','L1','LINEA 1',10,null),
('CUERPOS_FIJOS_L1','CUERPOS_FIJOS',1,'SI','L1','LINEA 1',10,null),
('CUERPOS_FIJOS_L2','CUERPOS_FIJOS',2,'SI','L2','LINEA 2',20,null),
('CUERPOS_FIJOS_2_L1','CUERPOS_FIJOS_2',1,'SI','L1','LINEA 1',10,null),
('DIRECTO_A_DESPACHO_L1','DIRECTO_A_DESPACHO',1,'SI','L1','LINEA 1',10,null),
('ECOMAX_L1','ECOMAX',1,'SI','L1','LINEA 1',10,null),
('FACHADAS_Y_ESTRUCTURAS_L1','FACHADAS_Y_ESTRUCTURAS',1,'SI','L1','LINEA 1',10,null),
('FRAMES_L1','FRAMES',1,'SI','L1','LINEA 1',10,null),
('FRAMES_2_L1','FRAMES_2',1,'SI','L1','LINEA 1',10,null),
('GARAGE_L1','GARAGE',1,'SI','L1','LINEA 1',10,null),
('GUILLOTINA_L1','GUILLOTINA',1,'SI','L1','LINEA 1',10,null),
('GUILLOTINA_L2','GUILLOTINA',2,'SI','L2','LINEA 2',20,null),
('GUILLOTINA_2_L1','GUILLOTINA_2',1,'SI','L1','LINEA 1',10,null),
('GUILLOTINA_3_L1','GUILLOTINA_3',1,'SI','L1','LINEA 1',10,null),
('LEGACY_L1','LEGACY',1,'SI','L1','LINEA 1',10,null),
('PANELES_L1','PANELES',1,'SI','L1','LINEA 1',10,null),
('PANELES_L2','PANELES',2,'SI','L2','LINEA 2',20,null),
('PANELES_2_L1','PANELES_2',1,'SI','L1','LINEA 1',10,null),
('PIVOT_L1','PIVOT',1,'SI','L1','LINEA 1',10,null),
('PUERTAS_L1','PUERTAS',1,'SI','L1','LINEA 1',10,null),
('PUERTAS_2_L1','PUERTAS_2',1,'SI','L1','LINEA 1',10,null),
('PUERTAS_3_L1','PUERTAS_3',1,'SI','L1','LINEA 1',10,null),
('RAILINGS_L1','RAILINGS',1,'SI','L1','LINEA 1',10,null),
('SCREENS_L1','SCREENS',1,'SI','L1','LINEA 1',10,null),
('STARTERS_Y_RECEPTORS_L1','STARTERS_Y_RECEPTORS',1,'SI','L1','LINEA 1',10,null)
on conflict (id_sublinea) do update set
  id_linea=excluded.id_linea,
  nivel=excluded.nivel,
  activa=excluded.activa,
  codigo=excluded.codigo,
  nombre=excluded.nombre,
  orden=excluded.orden,
  observacion=excluded.observacion;

create unique index if not exists ux_sgp_sublineas_linea_codigo
  on public.sgp_sublineas(id_linea,codigo);

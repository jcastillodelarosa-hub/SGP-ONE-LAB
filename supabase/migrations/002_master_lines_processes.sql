-- SGP ONE master seed: validated production lines and known Paneles/Frames processes.

insert into public.sgp_lineas (id_linea, nombre, activa) values
('CASEMENT','CASEMENT','SI'),
('CASEMENT_2','CASEMENT_2','SI'),
('CASEMENT_3','CASEMENT_3','SI'),
('CUERPOS_FIJOS','CUERPOS_FIJOS','SI'),
('CUERPOS_FIJOS_2','CUERPOS_FIJOS_2','SI'),
('DIRECTO_A_DESPACHO','DIRECTO_A_DESPACHO','SI'),
('ECOMAX','ECOMAX','SI'),
('FACHADAS_Y_ESTRUCTURAS','FACHADAS_Y_ESTRUCTURAS','SI'),
('FRAMES','FRAMES','SI'),
('FRAMES_2','FRAMES_2','SI'),
('GARAGE','GARAGE','SI'),
('GUILLOTINA','GUILLOTINA','SI'),
('GUILLOTINA_2','GUILLOTINA_2','SI'),
('GUILLOTINA_3','GUILLOTINA_3','SI'),
('LEGACY','LEGACY','SI'),
('PANELES','PANELES','SI'),
('PANELES_2','PANELES_2','SI'),
('PIVOT','PIVOT','SI'),
('PUERTAS','PUERTAS','SI'),
('PUERTAS_2','PUERTAS_2','SI'),
('PUERTAS_3','PUERTAS_3','SI'),
('RAILINGS','RAILINGS','SI'),
('SCREENS','SCREENS','SI'),
('STARTERS_Y_RECEPTORS','STARTERS_Y_RECEPTORS','SI')
on conflict (id_linea) do update
set nombre = excluded.nombre,
    activa = excluded.activa;

insert into public.sgp_relaciones_lineas
(id_linea_a,id_linea_b,tipo_relacion,activa) values
('PANELES','FRAMES','HERMANA','SI'),
('PANELES_2','FRAMES_2','HERMANA','SI')
on conflict (id_linea_a,id_linea_b) do update
set tipo_relacion = excluded.tipo_relacion,
    activa = excluded.activa;

insert into public.sgp_procesos (id_proceso,id_linea,orden,activo) values
('CORTE','PANELES',10,'SI'),
('MECANIZADO','PANELES',20,'SI'),
('PROCESADO','PANELES',30,'SI'),
('PICKING','PANELES',40,'SI'),
('ENSAMBLE','PANELES',50,'SI'),
('EMPAQUE','PANELES',60,'SI'),

('CORTE','PANELES_2',10,'SI'),
('MECANIZADO','PANELES_2',20,'SI'),
('PROCESADO','PANELES_2',30,'SI'),
('PICKING','PANELES_2',40,'SI'),
('ENSAMBLE','PANELES_2',50,'SI'),
('EMPAQUE','PANELES_2',60,'SI'),

('CORTE','FRAMES',10,'SI'),
('MECANIZADO','FRAMES',20,'SI'),
('PROCESADO','FRAMES',30,'SI'),
('PICKING','FRAMES',40,'SI'),
('ENSAMBLE','FRAMES',50,'SI'),
('EMPAQUE','FRAMES',60,'SI'),
('COVER','FRAMES',70,'SI'),
('TRACKS','FRAMES',80,'SI'),

('CORTE','FRAMES_2',10,'SI'),
('MECANIZADO','FRAMES_2',20,'SI'),
('PROCESADO','FRAMES_2',30,'SI'),
('PICKING','FRAMES_2',40,'SI'),
('ENSAMBLE','FRAMES_2',50,'SI'),
('EMPAQUE','FRAMES_2',60,'SI'),
('COVER','FRAMES_2',70,'SI'),
('TRACKS','FRAMES_2',80,'SI')
on conflict (id_linea,id_proceso) do update
set orden = excluded.orden,
    activo = excluded.activo;

-- Sublíneas físicas:
-- El sistema actual tiene 27 y deben migrarse con sus IDs exactos.
-- No se insertan aquí hasta extraer la tabla maestra autoritativa.

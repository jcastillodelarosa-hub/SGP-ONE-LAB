-- v123: trazabilidad de recepción de faltantes
alter table public.sgp_recepcion_faltantes add column if not exists fecha_recibido_operativa date;
alter table public.sgp_recepcion_faltantes add column if not exists turno_recibido text;
-- La función sgp_recepcion_faltante_estado se despliega en Supabase con fecha/turno y usuario de cierre.

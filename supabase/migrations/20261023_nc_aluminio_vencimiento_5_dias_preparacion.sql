-- SGP_ONE | PREPARACION NO EJECUTAR EN PRODUCCION
-- Regla: NC 'Sin Auditar' > 5 dias calendario => ELIMINADA operativamente.
-- Esta migracion es ADITIVA. No modifica RPC existentes hasta revisar el contrato completo.
ALTER TABLE public.sgp_nc_aluminio
  ADD COLUMN IF NOT EXISTS estado_operativo text,
  ADD COLUMN IF NOT EXISTS fecha_eliminacion timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_eliminacion text;

COMMENT ON COLUMN public.sgp_nc_aluminio.estado_operativo IS 'Estado derivado SGP; estado conserva el valor del Excel.';
COMMENT ON COLUMN public.sgp_nc_aluminio.fecha_eliminacion IS 'Fecha de transicion administrativa, no eliminacion fisica.';
COMMENT ON COLUMN public.sgp_nc_aluminio.motivo_eliminacion IS 'Motivo auditable de eliminacion administrativa.';

-- La evaluacion propuesta usa fecha de creacion de NC, no fecha de importacion:
-- lower(btrim(estado)) = 'sin auditar'
-- AND (current_date - (creacion AT TIME ZONE 'America/Bogota')::date) > 5
-- No crear triggers ni jobs hasta aprobar semantica de reactivacion y timezone.
-- No marcar activo=false: los reportes historicos dependen de activo=true.

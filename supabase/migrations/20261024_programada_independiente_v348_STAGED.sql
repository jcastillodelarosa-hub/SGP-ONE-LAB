-- SGP_ONE / LAB v348 — migración propuesta, NO APLICAR SIN REVISIÓN DE RPC
-- Cambios de estado SOLO en tablas de ejecución; el historial permanece intacto.
-- La condición programada se almacena en programación, pero los elementos sin fila
-- se consideran NO mediante las RPC de disponibilidad/cobertura existentes.
-- PRECONDICIÓN: respaldos, definición de RPC y validación de reglas de cancelación.

BEGIN;
ALTER TABLE public.sgp_mecanizado_programacion
  ADD COLUMN IF NOT EXISTS programada boolean NOT NULL DEFAULT false;
UPDATE public.sgp_mecanizado_programacion
SET programada = (estado IS DISTINCT FROM 'CANCELADA')
WHERE programada IS DISTINCT FROM (estado IS DISTINCT FROM 'CANCELADA');

ALTER TABLE public.sgp_mecanizado_ejecucion_orden
  ALTER COLUMN estado SET DEFAULT 'SIN INICIAR';
UPDATE public.sgp_mecanizado_ejecucion_orden
SET estado = 'SIN INICIAR'
WHERE estado = 'PROGRAMADA';

ALTER TABLE public.sgp_mecanizado_programacion
  ALTER COLUMN estado SET DEFAULT 'SIN INICIAR';
UPDATE public.sgp_mecanizado_programacion
SET estado = 'SIN INICIAR'
WHERE estado = 'PROGRAMADA';

-- NO modificar REPROGRAMADO, PICKING, CORTE, MECANIZADO, PROCESADO,
-- sgp_mecanizado_historial_orden ni las asignaciones/identificadores.
-- ATENCIÓN: RPC existentes que escriben PROGRAMADA pueden reintroducirlo.
-- No ejecutar hasta versionar/validar esas RPC en la misma entrega.
COMMIT;

-- SGP_ONE / PDT multifabricacion y avances parciales — BORRADOR NO APLICADO
-- Esta migracion NO modifica filas existentes, RPC ni permisos de ejecucion.
-- No aplicar hasta completar revision de contratos, grants, concurrencia y pruebas.
BEGIN;
CREATE TABLE IF NOT EXISTS public.sgp_aluminio_pendiente_detalles (
  id_detalle uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pendiente uuid NOT NULL REFERENCES public.sgp_aluminio_pendientes(id_pendiente),
  id_pieza text,
  fabricacion text NOT NULL CHECK (length(btrim(fabricacion)) > 0),
  longitud numeric NOT NULL CHECK (longitud > 0),
  acabado text NOT NULL CHECK (length(btrim(acabado)) > 0),
  cantidad_validada integer NOT NULL CHECK (cantidad_validada > 0),
  creado_por text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id_pendiente, fabricacion, longitud, acabado, id_pieza)
);
CREATE INDEX IF NOT EXISTS sgp_pdt_detalle_pendiente_idx
  ON public.sgp_aluminio_pendiente_detalles (id_pendiente);

CREATE TABLE IF NOT EXISTS public.sgp_aluminio_pendiente_movimientos (
  id_movimiento uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pendiente uuid NOT NULL REFERENCES public.sgp_aluminio_pendientes(id_pendiente),
  id_detalle uuid NOT NULL REFERENCES public.sgp_aluminio_pendiente_detalles(id_detalle),
  tipo text NOT NULL CHECK (tipo IN ('AVANCE', 'REVERSO')),
  cantidad integer NOT NULL CHECK (cantidad > 0),
  id_movimiento_revertido uuid REFERENCES public.sgp_aluminio_pendiente_movimientos(id_movimiento),
  idempotency_key uuid NOT NULL UNIQUE,
  usuario text NOT NULL,
  turno text NOT NULL CHECK (turno IN ('T1', 'T2')),
  fecha_operativa date NOT NULL,
  registrado_en timestamptz NOT NULL DEFAULT now(),
  observacion text,
  CHECK ((tipo = 'AVANCE' AND id_movimiento_revertido IS NULL)
     OR (tipo = 'REVERSO' AND id_movimiento_revertido IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS sgp_pdt_mov_reverso_unico_idx
  ON public.sgp_aluminio_pendiente_movimientos (id_movimiento_revertido)
  WHERE id_movimiento_revertido IS NOT NULL;
CREATE INDEX IF NOT EXISTS sgp_pdt_mov_detalle_idx
  ON public.sgp_aluminio_pendiente_movimientos (id_detalle, registrado_en);

CREATE TABLE IF NOT EXISTS public.sgp_aluminio_pendiente_ncs (
  id_pendiente uuid NOT NULL REFERENCES public.sgp_aluminio_pendientes(id_pendiente),
  consecutivo text NOT NULL CHECK (length(btrim(consecutivo)) > 0),
  enlazado_por text,
  enlazado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id_pendiente, consecutivo)
);
CREATE INDEX IF NOT EXISTS sgp_pdt_nc_consecutivo_idx
  ON public.sgp_aluminio_pendiente_ncs (consecutivo);

-- REVISAR ANTES DE APLICAR: politica RLS y EXECUTE de RPC SECURITY DEFINER;
-- NO conceder acceso directo al navegador a estas tablas.
-- Los saldos se calcularan en RPC transaccional con bloqueo de cabecera/detalles.
-- No migrar cantidades de pendientes ya validados sin conciliacion manual.
COMMIT;

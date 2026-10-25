-- SGP_ONE / PDT multifabricacion y avances parciales — BORRADOR NO APLICADO
-- Esta migracion NO modifica filas existentes, RPC ni permisos de ejecucion.
-- No aplicar hasta completar revision de contratos, grants, concurrencia y pruebas.
BEGIN;
ALTER TABLE public.sgp_aluminio_pendientes ADD COLUMN IF NOT EXISTS contrato_pdt text NOT NULL DEFAULT 'LEGACY'
 CHECK (contrato_pdt IN ('LEGACY','V2'));

CREATE TABLE IF NOT EXISTS public.sgp_aluminio_pendiente_detalles (
  id_detalle uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pendiente uuid NOT NULL REFERENCES public.sgp_aluminio_pendientes(id_pendiente),
  id_pieza text NOT NULL DEFAULT '',
  fabricacion text NOT NULL CHECK (length(btrim(fabricacion)) > 0),
  longitud numeric NOT NULL CHECK (longitud > 0),
  acabado text NOT NULL CHECK (length(btrim(acabado)) > 0),
  cantidad_validada integer NOT NULL CHECK (cantidad_validada > 0),
  creado_por text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id_pendiente, fabricacion, longitud, acabado, id_pieza)
);
CREATE TABLE IF NOT EXISTS public.sgp_pdt_fuentes (
 id_detalle uuid PRIMARY KEY REFERENCES public.sgp_aluminio_pendiente_detalles(id_detalle),
 id_pieza text NOT NULL, id_carga text NOT NULL, fila_origen integer NOT NULL,
 snapshot jsonb NOT NULL, registrado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sgp_pdt_fuentes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sgp_pdt_fuentes FROM PUBLIC,anon,authenticated;
CREATE INDEX IF NOT EXISTS sgp_pdt_detalle_pendiente_idx
  ON public.sgp_aluminio_pendiente_detalles (id_pendiente);

-- Enforce that every movement references a detail of the SAME pending.
DO $ddl$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.sgp_aluminio_pendiente_detalles'::regclass AND conname='sgp_pdt_detalle_parent_unique') THEN
 ALTER TABLE public.sgp_aluminio_pendiente_detalles ADD CONSTRAINT sgp_pdt_detalle_parent_unique UNIQUE (id_pendiente,id_detalle);
 END IF;
END $ddl$;

CREATE TABLE IF NOT EXISTS public.sgp_aluminio_pendiente_movimientos (
  id_movimiento uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pendiente uuid NOT NULL REFERENCES public.sgp_aluminio_pendientes(id_pendiente),
  id_detalle uuid NOT NULL,
  CONSTRAINT sgp_pdt_mov_detalle_mismo_pendiente FOREIGN KEY (id_pendiente,id_detalle)
    REFERENCES public.sgp_aluminio_pendiente_detalles(id_pendiente,id_detalle),
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
-- The referenced movement must also belong to the same pending and detail.
DO $ddl$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.sgp_aluminio_pendiente_movimientos'::regclass AND conname='sgp_pdt_mov_reversal_parent_unique') THEN
 ALTER TABLE public.sgp_aluminio_pendiente_movimientos ADD CONSTRAINT sgp_pdt_mov_reversal_parent_unique UNIQUE (id_pendiente,id_detalle,id_movimiento);
 END IF;
END $ddl$;
DO $ddl$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.sgp_aluminio_pendiente_movimientos'::regclass AND conname='sgp_pdt_mov_reversal_same_detail') THEN
 ALTER TABLE public.sgp_aluminio_pendiente_movimientos ADD CONSTRAINT sgp_pdt_mov_reversal_same_detail FOREIGN KEY (id_pendiente,id_detalle,id_movimiento_revertido)
  REFERENCES public.sgp_aluminio_pendiente_movimientos(id_pendiente,id_detalle,id_movimiento);
 END IF;
END $ddl$;
CREATE INDEX IF NOT EXISTS sgp_pdt_mov_detalle_idx
  ON public.sgp_aluminio_pendiente_movimientos (id_detalle, registrado_en);

CREATE TABLE IF NOT EXISTS public.sgp_aluminio_pendiente_ncs (
  id_pendiente uuid NOT NULL REFERENCES public.sgp_aluminio_pendientes(id_pendiente),
  consecutivo text NOT NULL CHECK (length(btrim(consecutivo)) > 0),
  snapshot jsonb,
  enlazado_por text,
  enlazado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id_pendiente, consecutivo)
);
ALTER TABLE public.sgp_aluminio_pendiente_ncs ADD COLUMN IF NOT EXISTS snapshot jsonb;
CREATE INDEX IF NOT EXISTS sgp_pdt_nc_consecutivo_idx
  ON public.sgp_aluminio_pendiente_ncs (consecutivo);

-- PRECONDITION: new RPC must enforce matching id_pendiente on detail and movement,
-- unique reversals, exact reversal quantity, row locking, and server-side role validation.
-- REVISAR ANTES DE APLICAR: politica RLS y EXECUTE de RPC SECURITY DEFINER;
-- NO conceder acceso directo al navegador a estas tablas.
-- Los saldos se calcularan en RPC transaccional con bloqueo de cabecera/detalles.
-- No migrar cantidades de pendientes ya validados sin conciliacion manual.
ALTER TABLE public.sgp_aluminio_pendiente_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sgp_aluminio_pendiente_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sgp_aluminio_pendiente_ncs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sgp_aluminio_pendiente_detalles,
 public.sgp_aluminio_pendiente_movimientos,public.sgp_aluminio_pendiente_ncs
 FROM PUBLIC,anon,authenticated;
COMMIT;

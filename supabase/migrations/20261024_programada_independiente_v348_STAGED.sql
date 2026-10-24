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

-- El guardado general de mecanizado también escribe SIN INICIAR y su CHECK
-- vigente solo admite PICKING/CORTE/MECANIZADO/PROCESADO/REPROGRAMADO.
ALTER TABLE public.sgp_mecanizado_ejecucion
 DROP CONSTRAINT IF EXISTS sgp_mecanizado_ejecucion_estado_check;
ALTER TABLE public.sgp_mecanizado_ejecucion
 ADD CONSTRAINT sgp_mecanizado_ejecucion_estado_check
 CHECK (estado IN ('SIN INICIAR','PICKING','CORTE','MECANIZADO','PROCESADO','REPROGRAMADO'));
ALTER TABLE public.sgp_mecanizado_ejecucion
 ALTER COLUMN estado SET DEFAULT 'SIN INICIAR';

-- La restricción actual no acepta SIN INICIAR; reemplazarla en la misma transacción.
ALTER TABLE public.sgp_mecanizado_ejecucion_orden
 DROP CONSTRAINT IF EXISTS sgp_mecanizado_ejecucion_orden_estado_check;
ALTER TABLE public.sgp_mecanizado_ejecucion_orden
 ADD CONSTRAINT sgp_mecanizado_ejecucion_orden_estado_check
 CHECK (estado IN ('SIN INICIAR','PROGRAMADA','PICKING','CORTE','MECANIZADO','PROCESADO','REPROGRAMADO'));

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

-- Nueva programación: el indicador debe ser SÍ desde el INSERT, incluso
-- antes de adaptar todas las sobrecargas de sgp_mecanizado_programar.
-- Trigger limitado a INSERT: no reescribe cancelaciones ni programación histórica.
CREATE OR REPLACE FUNCTION public.sgp_mecanizado_programada_al_insertar()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
 NEW.programada := (NEW.estado IS DISTINCT FROM 'CANCELADA');
 RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS trg_sgp_mecanizado_programada_insert ON public.sgp_mecanizado_programacion;
CREATE TRIGGER trg_sgp_mecanizado_programada_insert
BEFORE INSERT ON public.sgp_mecanizado_programacion
FOR EACH ROW EXECUTE FUNCTION public.sgp_mecanizado_programada_al_insertar();

-- Mantener sincronizada la bandera ante cancelación o reactivación.
CREATE OR REPLACE FUNCTION public.sgp_mecanizado_programada_al_actualizar()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
 NEW.programada := (NEW.estado IS DISTINCT FROM 'CANCELADA');
 RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS trg_sgp_mecanizado_programada_update ON public.sgp_mecanizado_programacion;
CREATE TRIGGER trg_sgp_mecanizado_programada_update
BEFORE UPDATE OF estado ON public.sgp_mecanizado_programacion
FOR EACH ROW EXECUTE FUNCTION public.sgp_mecanizado_programada_al_actualizar();

-- Normalización de escritura: preserva autorización, observaciones e historial.
-- El estado de programación queda separado de los estados de ejecución.
CREATE OR REPLACE FUNCTION public.sgp_mecanizado_guardar_estado_orden(
 p_token text, p_id_programacion uuid, p_produccion text,
 p_estado text, p_observacion text DEFAULT NULL::text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE u text; old_state text; new_state text;
BEGIN
 u:=sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA']);
 new_state:=upper(trim(coalesce(p_estado,'')));
 IF new_state NOT IN ('SIN INICIAR','CORTE','MECANIZADO','PROCESADO','REPROGRAMADO') THEN
  RAISE EXCEPTION 'Estado de mecanizado no permitido: %',p_estado;
 END IF;
 IF new_state='REPROGRAMADO' AND NOT EXISTS (
  SELECT 1 FROM sgp_mecanizado_reprogramaciones
  WHERE id_origen=p_id_programacion AND produccion=p_produccion
 ) THEN
  RAISE EXCEPTION 'REPROGRAMADO requiere vínculo de reprogramación';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM sgp_mecanizado_programacion
                WHERE id_programacion=p_id_programacion AND estado<>'CANCELADA') THEN
  IF new_state <> 'REPROGRAMADO' OR NOT EXISTS (SELECT 1 FROM sgp_mecanizado_reprogramaciones WHERE id_origen=p_id_programacion AND produccion=p_produccion) THEN
   RAISE EXCEPTION 'Programación inexistente o cancelada';
  END IF;
 END IF;
 SELECT estado INTO old_state FROM sgp_mecanizado_ejecucion_orden
 WHERE id_programacion=p_id_programacion AND produccion=p_produccion;
 INSERT INTO sgp_mecanizado_ejecucion_orden(id_programacion,produccion,estado,observacion,usuario,actualizado_en)
 VALUES(p_id_programacion,p_produccion,new_state,p_observacion,u,now())
 ON CONFLICT(id_programacion,produccion) DO UPDATE SET
 estado=excluded.estado,
 observacion=coalesce(excluded.observacion,sgp_mecanizado_ejecucion_orden.observacion),
 usuario=excluded.usuario,actualizado_en=now();
 IF old_state IS DISTINCT FROM new_state OR p_observacion IS NOT NULL THEN
  INSERT INTO sgp_mecanizado_historial_orden(id_programacion,produccion,estado_anterior,estado_nuevo,observacion,usuario)
  VALUES(p_id_programacion,p_produccion,old_state,new_state,p_observacion,u);
 END IF;
 RETURN true;
END $function$;

-- Arrastre: reemplazar solo el valor de respaldo cuando no existe ejecución,
-- preservando fechas, turnos, trazabilidad y la lógica de pendientes vigente.
DO $migration$
DECLARE v_def text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO v_def
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='sgp_mecanizado_pendientes_turno';
 IF v_def IS NULL OR position('coalesce(eo.estado,me.estado,''PROGRAMADA'')' in v_def)=0 THEN
  RAISE EXCEPTION 'La RPC de arrastre cambió: revisar contrato antes de migrar';
 END IF;
 v_def:=replace(v_def,'coalesce(eo.estado,me.estado,''PROGRAMADA'')',
                        'coalesce(eo.estado,me.estado,''SIN INICIAR'')');
 EXECUTE v_def;
END $migration$;

-- REPROGRAMADO es evento interno usado por la RPC de reprogramación; nunca debe mostrarse como etapa seleccionable.
-- El guardado de arrastre reutiliza sgp_mecanizado_guardar_estado_orden;
-- no se modifica la función de arrastre ni sus reglas de identificación.

-- NO modificar REPROGRAMADO, PICKING, CORTE, MECANIZADO, PROCESADO,
-- sgp_mecanizado_historial_orden ni las asignaciones/identificadores.
-- ATENCIÓN: la reprogramación escribe REPROGRAMADO como evento histórico,
-- y las RPC de cobertura siguen interpretando PROGRAMADA como cobertura.
-- Se requiere revisar todas las lecturas antes de aplicar este cambio.
-- No ejecutar hasta validar cancelación total, reprogramación y cobertura en la misma entrega.
COMMIT;

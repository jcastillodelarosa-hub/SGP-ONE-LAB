-- Issue #123: enforce operational shift at the final Picking INSERT boundary.
-- Apply only after staging tests, backup and approval. Does not rewrite historical rows.
-- Bogotá schedules: Mon-Sat 07:00-19:00 / 19:00-07:00; Sunday 07:00-18:00 / 18:00-05:00.
CREATE OR REPLACE FUNCTION public.sgp_picking_validar_jornada_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_now timestamptz := statement_timestamp();
  v_local timestamp := v_now AT TIME ZONE 'America/Bogota';
  v_date date := v_local::date;
  v_hour time := v_local::time;
  v_prev date := v_date - 1;
  v_prev_sunday boolean := extract(isodow from v_prev) = 7;
  v_expected_date date;
  v_expected_turn text;
  v_start timestamptz;
  v_start_hour integer;
BEGIN
  IF v_hour >= time '07:00' THEN
    v_expected_date := v_date;
    IF extract(isodow from v_date) = 7 THEN
      v_expected_turn := CASE WHEN v_hour < time '18:00' THEN 'TURNO 1' ELSE 'TURNO 2' END;
    ELSE
      v_expected_turn := CASE WHEN v_hour < time '19:00' THEN 'TURNO 1' ELSE 'TURNO 2' END;
    END IF;
  ELSIF v_prev_sunday AND v_hour >= time '05:00' THEN
    v_expected_date := NULL; -- No active shift Monday 05:00-07:00.
  ELSE
    v_expected_date := v_prev;
    v_expected_turn := 'TURNO 2';
  END IF;

  -- Legacy 6-argument RPC omits both fields. Fill both from the actual active shift.
  IF NEW.fecha_operativa IS NULL AND NEW.turno_entrega IS NULL THEN
    IF v_expected_date IS NULL THEN
      RAISE EXCEPTION 'PICKING_SIN_TURNO_ACTIVO';
    END IF;
    NEW.fecha_operativa := v_expected_date;
    NEW.turno_entrega := v_expected_turn;
  ELSIF NEW.fecha_operativa IS NULL OR NEW.turno_entrega IS NULL THEN
    RAISE EXCEPTION 'PICKING_FECHA_TURNO_REQUERIDOS';
  END IF;

  NEW.turno_entrega := upper(btrim(NEW.turno_entrega));
  IF NEW.turno_entrega NOT IN ('TURNO 1','TURNO 2') THEN
    RAISE EXCEPTION 'PICKING_TURNO_INVALIDO';
  END IF;
  v_start_hour := CASE
    WHEN NEW.turno_entrega = 'TURNO 1' THEN 7
    WHEN extract(isodow from NEW.fecha_operativa) = 7 THEN 18
    ELSE 19
  END;
  v_start := (NEW.fecha_operativa::timestamp + make_interval(hours => v_start_hour))
    AT TIME ZONE 'America/Bogota';
  IF v_start > v_now THEN
    RAISE EXCEPTION 'PICKING_TURNO_FUTURO';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sgp_picking_validar_jornada_insert ON public.sgp_picking_entregas;
CREATE TRIGGER trg_sgp_picking_validar_jornada_insert
BEFORE INSERT ON public.sgp_picking_entregas
FOR EACH ROW EXECUTE FUNCTION public.sgp_picking_validar_jornada_insert();

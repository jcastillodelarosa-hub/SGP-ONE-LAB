-- Containment only. Preserve turns, audit, orders and all later work.
BEGIN;
SET LOCAL lock_timeout='5s';
UPDATE sgp_lp_operacion.config SET turno_horario_ensamble=false WHERE id;
COMMIT;

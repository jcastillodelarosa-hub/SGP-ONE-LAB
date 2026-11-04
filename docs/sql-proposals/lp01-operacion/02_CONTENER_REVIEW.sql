-- PROPUESTA: contención reversible, requiere autorización productiva independiente.
BEGIN;
SET LOCAL lock_timeout='5s';
-- Exclusive config-row lock drains all admitted commands/imports before returning.
-- The config trigger increments turn revisions, invalidating commands captured earlier.
-- A timeout rolls back; it does NOT establish containment.
UPDATE sgp_lp_operacion.config SET escrituras=false WHERE id=true;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM sgp_lp_operacion.config WHERE escrituras) THEN RAISE EXCEPTION 'CONTENCION_NO_CONFIRMADA'; END IF; END $$;
COMMIT;

-- REVIEW ONLY. Execute only in the authorized publication window, after
-- confirming the effective instant in Colombia and a restored backup.
-- Replace both placeholders from an approved publication record. Never use
-- a guessed timestamp or the current server clock implicitly.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$ BEGIN
 IF position('REPLACE_' IN 'REPLACE_WITH_PUBLICATION_UTC')>0
 OR position('REPLACE_' IN 'REPLACE_WITH_ADMIN_USER')>0
 THEN RAISE EXCEPTION 'PDT_CUTOVER_PUBLICATION_INSTANT_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM sgp_pdt_manual.corte_operativo WHERE id=1)
 THEN RAISE EXCEPTION 'PDT_CUTOVER_ALREADY_ACTIVE'; END IF;
END $guard$;
INSERT INTO sgp_pdt_manual.corte_operativo(id,desde,activado_por)
VALUES(1,'REPLACE_WITH_PUBLICATION_UTC'::timestamptz,'REPLACE_WITH_ADMIN_USER');
COMMIT;

-- REVIEW ONLY: contain frontend first; refuse to erase configured rules.
BEGIN;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM sgp_accessory_alerts.rules) THEN
 RAISE EXCEPTION 'RULES_EXIST: preserve configuration; disable feature instead'; END IF; END $$;
DROP FUNCTION public.sgp_alertas_accesorio_consultar(text,text,jsonb);
DROP FUNCTION public.sgp_alertas_accesorio_catalogo(text);
DROP FUNCTION public.sgp_alertas_accesorio_guardar(text,text,text,boolean,integer);
DROP FUNCTION sgp_accessory_alerts.decorate(jsonb,jsonb);
DROP TABLE sgp_accessory_alerts.rules;
DROP SCHEMA sgp_accessory_alerts;
COMMIT;

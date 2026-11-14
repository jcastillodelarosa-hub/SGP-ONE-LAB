-- Disable routing to Retail v3 before removal. No document or cut deletion.
BEGIN;
DROP FUNCTION public.sgp_opt_importar_retail_validado_v3(text,bytea,jsonb,jsonb,jsonb);
DROP FUNCTION public.sgp_opt_import_contexto_retail_v3(text,jsonb,text,jsonb,text[]);
COMMIT;

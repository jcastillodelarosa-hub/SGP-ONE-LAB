-- Local review only. Remove the new entrypoints without touching v1 or data.
BEGIN;
DROP FUNCTION public.sgp_opt_importar_proyecto_validado_v2(text,bytea,jsonb,jsonb,jsonb);
DROP FUNCTION public.sgp_opt_import_contexto_proyecto_v2(text,jsonb,text,jsonb,text[]);
COMMIT;

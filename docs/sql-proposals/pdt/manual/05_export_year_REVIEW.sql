-- REVIEW ONLY. Do not apply until the installed Export writer body/hash is captured
-- and compared in a restored production backup. Replace the guard only after review.
-- BLOCKED: a JSON error response from the delegated writer can still reach the
-- year UPDATE when the prior week matches. Resolve the real response contract
-- before replacing the deliberately unset guard; see integration/EXPORT_BODY_CONTRAST.md.
-- The XLSX contains explicit "Año prog." -> p_datos[*].anio and "Sem prog." -> semana_actual.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $preflight$ DECLARE fn oid; BEGIN
 fn:=to_regprocedure('public.sgp_aplicar_export_diario(text,text,text,jsonb)');
 IF fn IS NULL OR to_regclass('sgp_pdt_manual.funcion_previa') IS NULL
 OR to_regprocedure('sgp_pdt_manual.auditar_programacion()') IS NULL
 THEN RAISE EXCEPTION 'PDT_EXPORT_YEAR_DEPENDENCY_MISSING'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=fn AND p.prorettype='jsonb'::regtype
  AND p.prosecdef AND pg_get_userbyid(p.proowner)='postgres')
 THEN RAISE EXCEPTION 'PDT_EXPORT_YEAR_WRITER_CONTRACT_DIFFERENT'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=fn) IS DISTINCT FROM 'REPLACE_WITH_VERIFIED_EXPORT_PROSRC_MD5'
 THEN RAISE EXCEPTION 'PDT_EXPORT_YEAR_WRITER_BODY_NOT_CERTIFIED'; END IF;
 IF EXISTS(SELECT 1 FROM sgp_pdt_manual.funcion_previa
  WHERE firma='public.sgp_aplicar_export_diario(text,text,text,jsonb)')
 THEN RAISE EXCEPTION 'PDT_EXPORT_YEAR_ALREADY_INSTALLED'; END IF;
END $preflight$;
INSERT INTO sgp_pdt_manual.funcion_previa(firma,definicion)
VALUES('public.sgp_aplicar_export_diario(text,text,text,jsonb)',
 pg_get_functiondef('public.sgp_aplicar_export_diario(text,text,text,jsonb)'::regprocedure));
DO $clone$ DECLARE original text; BEGIN
 SELECT definicion INTO STRICT original FROM sgp_pdt_manual.funcion_previa
 WHERE firma='public.sgp_aplicar_export_diario(text,text,text,jsonb)';
 EXECUTE replace(original,'FUNCTION public.sgp_aplicar_export_diario(',
  'FUNCTION sgp_pdt_manual.original_aplicar_export_diario(');
END $clone$;
REVOKE ALL ON FUNCTION sgp_pdt_manual.original_aplicar_export_diario(text,text,text,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.sgp_aplicar_export_diario(
 p_token text,p_linea text,p_nombre_archivo text,p_datos jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE item jsonb; expected_year integer; expected_week integer; key text;
 seen text[]:=ARRAY[]::text[]; existing public.sgp_producciones%rowtype; response jsonb;
BEGIN
 IF jsonb_typeof(p_datos) IS DISTINCT FROM 'array' OR jsonb_array_length(p_datos)=0
 THEN RAISE EXCEPTION 'PDT_EXPORT_YEAR_DATA_INVALID'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_datos) LOOP
  key:=nullif(btrim(item->>'key_produccion'),'');
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR key IS NULL
   OR coalesce(item->>'anio','') !~ '^[0-9]{4}$'
   OR coalesce(item->>'semana_actual','') !~ '^[0-9]{1,2}$'
   OR nullif(btrim(item->>'id_linea'),'') IS DISTINCT FROM p_linea
  THEN RAISE EXCEPTION 'PDT_EXPORT_YEAR_EXPLICIT_PERIOD_REQUIRED'; END IF;
  expected_year:=(item->>'anio')::integer;expected_week:=(item->>'semana_actual')::integer;
  IF expected_year NOT BETWEEN 2020 AND 2100 OR expected_week NOT BETWEEN 1 AND 53
   OR key=ANY(seen) THEN RAISE EXCEPTION 'PDT_EXPORT_YEAR_PERIOD_AMBIGUOUS'; END IF;
  seen:=array_append(seen,key);
 END LOOP;
 -- Preserve installed Export authorization, reconciliation, history and response.
 response:=sgp_pdt_manual.original_aplicar_export_diario(p_token,p_linea,p_nombre_archivo,p_datos);
 -- Update only an existing matching production whose week the original writer set.
 -- Missing rows remain the original writer's responsibility (e.g. FUERA_BASE).
 FOR item IN SELECT value FROM jsonb_array_elements(p_datos) LOOP
  key:=btrim(item->>'key_produccion');expected_year:=(item->>'anio')::integer;
  expected_week:=(item->>'semana_actual')::integer;
  SELECT * INTO existing FROM public.sgp_producciones WHERE key_produccion=key FOR UPDATE;
  IF FOUND THEN
   IF existing.id_linea IS DISTINCT FROM p_linea
    OR coalesce(existing.semana_actual,existing.semana_base) IS DISTINCT FROM expected_week
   THEN RAISE EXCEPTION 'PDT_EXPORT_YEAR_RESULT_MISMATCH: %',key; END IF;
   IF existing.anio IS DISTINCT FROM expected_year THEN
    UPDATE public.sgp_producciones SET anio=expected_year WHERE key_produccion=key;
   END IF;
  END IF;
 END LOOP;
 RETURN response;
END $fn$;
NOTIFY pgrst,'reload schema';
COMMIT;

-- REVIEW ONLY. Install after grouped-source + manual 01-05; no historical update.
-- Activation is separate and requires the effective publication timestamp.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$ BEGIN
 IF to_regnamespace('sgp_pdt_manual') IS NULL
 OR to_regprocedure('public.sgp_pdt_validar_rol_real(text,text[])') IS NULL
 OR to_regclass('sgp_pdt_manual.detalles') IS NULL
 OR to_regclass('public.sgp_aluminio_pendientes') IS NULL
 THEN RAISE EXCEPTION 'PDT_CUTOVER_DEPENDENCY_MISSING'; END IF;
 IF to_regclass('sgp_pdt_manual.corte_operativo') IS NOT NULL
 OR to_regprocedure('public.sgp_pdt_corte_operativo_v1(text)') IS NOT NULL
 THEN RAISE EXCEPTION 'PDT_CUTOVER_ALREADY_INSTALLED'; END IF;
END $guard$;
CREATE TABLE sgp_pdt_manual.corte_operativo(
 id integer PRIMARY KEY CHECK(id=1),
 desde timestamptz NOT NULL,
 activado_por text NOT NULL,
 activado_en timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON sgp_pdt_manual.corte_operativo FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.sgp_pdt_corte_operativo_v1(p_token text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE cutoff timestamptz;
BEGIN
 PERFORM public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','RECEPCION',
  'PICKING','PATINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','SUPERVISOR DE PICKING','CONSULTA']);
 SELECT desde INTO cutoff FROM sgp_pdt_manual.corte_operativo WHERE id=1;
 RETURN jsonb_build_object('ok',true,'contract_version',1,'desde',cutoff);
END $fn$;
REVOKE ALL ON FUNCTION public.sgp_pdt_corte_operativo_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_pdt_corte_operativo_v1(text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

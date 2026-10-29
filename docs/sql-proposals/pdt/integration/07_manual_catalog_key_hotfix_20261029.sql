-- Applied in Supabase production 2026-10-29; fixes missing key_produccion in manual catalog.
-- No table changes. Preserves existing role authorization.
CREATE OR REPLACE FUNCTION public.sgp_pdt_manual_catalogo_v1(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE data jsonb;
BEGIN
 PERFORM public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','LIDER LINEA']);
 SELECT coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object('key_produccion',p.key_produccion) ORDER BY p.anio DESC,p.semana DESC,p.produccion,p.reserva),'[]'::jsonb) INTO data
 FROM (
  SELECT DISTINCT p.anio::integer AS anio,coalesce(p.semana_actual,p.semana_base)::integer AS semana,
   p.id_linea AS linea,p.produccion,r.reserva,p.sistema,coalesce(r.acabado_reserva,'') AS acabado,
   r.key_produccion
  FROM public.sgp_produccion_reservas_v r JOIN public.sgp_producciones p USING(key_produccion)
  WHERE p.id_linea='PANELES_2' AND p.anio IS NOT NULL
   AND coalesce(p.semana_actual,p.semana_base) BETWEEN 1 AND 53
   AND coalesce(r.acabado_reserva,'')<>''
  LIMIT 3000
 ) p;
 RETURN jsonb_build_object('ok',true,'producciones',data);
END $function$;
NOTIFY pgrst, 'reload schema';

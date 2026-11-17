-- REVIEW ONLY. No seeds or business-data writes.
BEGIN;
CREATE OR REPLACE FUNCTION public.sgp_alertas_accesorio_catalogo(p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR']);
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.codigo_sap),'[]'::jsonb) FROM (
 SELECT codes.codigo_sap, coalesce((SELECT string_agg(DISTINCT a.descripcion,' · ' ORDER BY a.descripcion)
 FROM public.sgp_accesorios a WHERE a.codigo_sap=codes.codigo_sap),'Sin descripción') descripcion,
 r.mensaje,coalesce(r.activa,false) activa,coalesce(r.revision,0) revision,
 EXISTS(SELECT 1 FROM public.sgp_accesorios a WHERE a.codigo_sap=codes.codigo_sap) existe
 FROM (SELECT codigo_sap FROM public.sgp_accesorios WHERE codigo_sap IS NOT NULL AND codigo_sap<>''
 UNION SELECT codigo_sap FROM sgp_accessory_alerts.rules) codes
 LEFT JOIN sgp_accessory_alerts.rules r USING(codigo_sap)) c);
END $$;
CREATE OR REPLACE FUNCTION public.sgp_alertas_accesorio_guardar(p_token text,p_codigo text,p_mensaje text,p_activa boolean,p_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text; result sgp_accessory_alerts.rules;
BEGIN
 actor:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR']);
 IF p_codigo IS NULL OR p_mensaje IS NULL OR length(btrim(p_mensaje)) NOT BETWEEN 1 AND 500 OR p_activa IS NULL OR p_revision IS NULL OR p_revision<0 THEN RAISE EXCEPTION 'DATOS_INVALIDOS'; END IF;
 IF p_revision=0 THEN
  IF NOT EXISTS(SELECT 1 FROM public.sgp_accesorios WHERE codigo_sap=p_codigo) THEN RAISE EXCEPTION 'ACCESORIO_INEXISTENTE'; END IF;
  INSERT INTO sgp_accessory_alerts.rules(codigo_sap,mensaje,activa,actualizado_por)
  VALUES(p_codigo,btrim(p_mensaje),p_activa,actor) ON CONFLICT DO NOTHING RETURNING * INTO result;
 ELSE
  UPDATE sgp_accessory_alerts.rules SET mensaje=btrim(p_mensaje),activa=p_activa,revision=revision+1,actualizado_por=actor,actualizado_en=now()
  WHERE codigo_sap=p_codigo AND revision=p_revision RETURNING * INTO result;
 END IF;
 IF result.codigo_sap IS NULL THEN RAISE EXCEPTION 'REGLA_MODIFICADA_RECARGAR'; END IF;
 RETURN to_jsonb(result);
END $$;

CREATE FUNCTION public.sgp_alertas_accesorio_guardar_lote(p_token text,p_codigos jsonb,p_mensaje text,p_activa boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item jsonb; result jsonb:='[]'::jsonb;
BEGIN
 PERFORM public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR']);
 IF p_codigos IS NULL OR jsonb_typeof(p_codigos)<>'array' THEN RAISE EXCEPTION 'DATOS_INVALIDOS'; END IF;
 IF jsonb_array_length(p_codigos) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'DATOS_INVALIDOS'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_codigos) x WHERE jsonb_typeof(x)<>'object' OR jsonb_typeof(x->'codigo_sap') IS DISTINCT FROM 'string' OR jsonb_typeof(x->'revision') IS DISTINCT FROM 'number' OR (x->>'revision') !~ '^[0-9]+$') THEN RAISE EXCEPTION 'DATOS_INVALIDOS'; END IF;
 IF (SELECT count(DISTINCT x->>'codigo_sap') FROM jsonb_array_elements(p_codigos) x)<>jsonb_array_length(p_codigos) THEN RAISE EXCEPTION 'CODIGOS_DUPLICADOS'; END IF;
 -- Stable lock order; one invalid code/revision aborts the complete batch.
 FOR item IN SELECT value FROM jsonb_array_elements(p_codigos) ORDER BY value->>'codigo_sap' LOOP
  result:=result||jsonb_build_array(public.sgp_alertas_accesorio_guardar(p_token,item->>'codigo_sap',p_mensaje,p_activa,(item->>'revision')::integer));
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.sgp_alertas_accesorio_guardar_lote(text,jsonb,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_alertas_accesorio_guardar_lote(text,jsonb,text,boolean) TO anon,authenticated;
COMMIT;

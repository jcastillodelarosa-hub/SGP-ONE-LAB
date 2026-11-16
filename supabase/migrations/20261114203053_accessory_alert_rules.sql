-- REVIEW ONLY. No seed rules. Apply only after explicit production approval.
BEGIN;
CREATE SCHEMA IF NOT EXISTS sgp_accessory_alerts;
REVOKE ALL ON SCHEMA sgp_accessory_alerts FROM PUBLIC, anon, authenticated;
CREATE TABLE sgp_accessory_alerts.rules (
 codigo_sap text PRIMARY KEY CHECK (length(codigo_sap)>0),
 mensaje text NOT NULL CHECK (length(btrim(mensaje)) BETWEEN 1 AND 500),
 activa boolean NOT NULL DEFAULT true,
 revision integer NOT NULL DEFAULT 1,
 actualizado_por text NOT NULL,
 actualizado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sgp_accessory_alerts.rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sgp_accessory_alerts.rules FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.sgp_alertas_accesorio_catalogo(p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR']);
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.codigo_sap),'[]'::jsonb) FROM (
 SELECT codes.codigo_sap, coalesce((SELECT string_agg(DISTINCT a.descripcion,' · ' ORDER BY a.descripcion)
 FROM public.sgp_accesorios a WHERE a.codigo_sap=codes.codigo_sap),'Sin descripción') descripcion,
 r.mensaje,coalesce(r.activa,false) activa,coalesce(r.revision,0) revision,
 EXISTS(SELECT 1 FROM public.sgp_accesorios a WHERE a.codigo_sap=codes.codigo_sap) existe
 FROM (SELECT codigo_sap FROM public.sgp_accesorios WHERE codigo_sap IS NOT NULL AND codigo_sap<>''
 UNION SELECT codigo_sap FROM sgp_accessory_alerts.rules) codes
 LEFT JOIN sgp_accessory_alerts.rules r USING(codigo_sap)) c);
END $$;
CREATE FUNCTION public.sgp_alertas_accesorio_guardar(p_token text,p_codigo text,p_mensaje text,p_activa boolean,p_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text; result sgp_accessory_alerts.rules;
BEGIN
 actor:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR']);
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

-- Pure traversal: only keys already returned by the authorized source are enriched.
CREATE FUNCTION sgp_accessory_alerts.decorate(node jsonb, alerts jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE result jsonb; k text;
BEGIN
 IF jsonb_typeof(node)='array' THEN
  SELECT coalesce(jsonb_agg(sgp_accessory_alerts.decorate(value,alerts) ORDER BY ord),'[]'::jsonb) INTO result FROM jsonb_array_elements(node) WITH ORDINALITY t(value,ord);
 ELSIF jsonb_typeof(node)='object' THEN
  SELECT coalesce(jsonb_object_agg(key,sgp_accessory_alerts.decorate(value,alerts)),'{}'::jsonb) INTO result FROM jsonb_each(node);
  k:=node->>'key_produccion';
  IF k IS NOT NULL THEN result:=result||jsonb_build_object('accessory_alerts',coalesce(alerts->k,'[]'::jsonb)); END IF;
 ELSE result:=node; END IF;
 RETURN result;
END $$;

CREATE FUNCTION public.sgp_alertas_accesorio_consultar(p_token text,p_fuente text,p_parametros jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE payload jsonb; alerts jsonb;
BEGIN
 -- Fixed dispatch only; every original reader still executes its own session/role/order/period ACL.
 CASE p_fuente
 WHEN 'sgp_consultar_ensamble' THEN payload:=public.sgp_consultar_ensamble(p_token,(p_parametros->>'p_semana')::integer,p_parametros->>'p_linea');
 WHEN 'sgp_lp_seguimiento_consultar' THEN payload:=public.sgp_lp_seguimiento_consultar(p_token,p_parametros->>'p_etapa',p_parametros->>'p_linea');
 WHEN 'sgp_lp_operacion_consultar' THEN payload:=public.sgp_lp_operacion_consultar(p_token,p_parametros->>'p_etapa',p_parametros->>'p_linea',(p_parametros->>'p_fecha')::date,(p_parametros->>'p_turno')::integer);
 WHEN 'sgp_linea_plan_consultar' THEN payload:=public.sgp_linea_plan_consultar(p_token,(p_parametros->>'p_desde')::date,(p_parametros->>'p_hasta')::date,p_parametros->>'p_linea');
 WHEN 'sgp_mecanizado_disponibles' THEN SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO payload FROM public.sgp_mecanizado_disponibles(p_token,(p_parametros->>'p_semana')::integer) x;
 ELSE RAISE EXCEPTION 'FUENTE_INVALIDA'; END CASE;
 WITH visible AS (SELECT DISTINCT value #>> '{}' AS key FROM jsonb_path_query(payload,'$.**.key_produccion') value),
 matched AS (SELECT DISTINCT p.key_produccion,r.codigo_sap,r.mensaje
 FROM visible v JOIN public.sgp_producciones p ON p.key_produccion=v.key
 JOIN public.sgp_accesorios a ON a.id=p.id AND a.estado_relacion_produccion='RELACIONADO' AND a.activo='SI'
 AND (a.key_produccion IS NULL OR a.key_produccion=p.key_produccion)
 JOIN sgp_accessory_alerts.rules r ON r.codigo_sap=a.codigo_sap AND r.activa),
 grouped AS (SELECT key_produccion,jsonb_agg(jsonb_build_object('codigo',codigo_sap,'mensaje',mensaje) ORDER BY codigo_sap) items FROM matched GROUP BY key_produccion)
 SELECT coalesce(jsonb_object_agg(key_produccion,items),'{}'::jsonb) INTO alerts FROM grouped;
 RETURN sgp_accessory_alerts.decorate(payload,alerts);
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_accessory_alerts FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sgp_alertas_accesorio_catalogo(text),public.sgp_alertas_accesorio_guardar(text,text,text,boolean,integer),public.sgp_alertas_accesorio_consultar(text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_alertas_accesorio_catalogo(text),public.sgp_alertas_accesorio_guardar(text,text,text,boolean,integer),public.sgp_alertas_accesorio_consultar(text,text,jsonb) TO anon,authenticated;
COMMIT;

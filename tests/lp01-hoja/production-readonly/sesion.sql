CREATE OR REPLACE FUNCTION sgp_lp_operacion.sesion(token text, et text, k text DEFAULT NULL::text, line_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s jsonb; roles_enabled boolean; BEGIN
 PERFORM sgp_lp_operacion.contener_ambitos();
 s:=public.sgp_sesion_actual(token);
 IF s->>'valida' IS DISTINCT FROM 'true' OR nullif(s->>'usuario','') IS NULL
 OR (coalesce(s->>'rol','') NOT IN('LIDER','LIDER LINEA','COORDINADOR','ADMINISTRADOR','CONSULTA')
 AND NOT((SELECT habilitado FROM sgp_lp_operacion.perfil_roles WHERE id)
 AND s->>'rol' IN('SUPERVISOR ENSAMBLE','SUPERVISOR EMPAQUE')))
 THEN RAISE EXCEPTION 'SESION_NO_AUTORIZADA'; END IF;
 IF et IS NULL OR et NOT IN('ENSAMBLE','EMPAQUE') OR line_id IS NULL
 THEN RAISE EXCEPTION 'AMBITO_DENEGADO'; END IF;
 SELECT habilitado INTO roles_enabled FROM sgp_lp_operacion.perfil_roles WHERE id;
 IF roles_enabled IS TRUE THEN
  -- Exactamente el mismo ámbito que produciría permisos_en_periodo para este
  -- usuario, etapa y clave; evita el producto cartesiano de toda la línea.
  IF line_id<>'PANELES_2'
  OR NOT sgp_lp_operacion.acceso_rol(s->>'usuario',et)
  OR NOT EXISTS(SELECT 1 FROM public.sgp_producciones x
    WHERE x.id_linea=line_id AND (k IS NULL OR x.key_produccion=k))
  THEN RAISE EXCEPTION 'AMBITO_DENEGADO'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo() p
    WHERE p.usuario=s->>'usuario' AND p.etapa=et AND (k IS NULL OR p.key=k)
    AND EXISTS(SELECT 1 FROM public.sgp_producciones x
      WHERE x.key_produccion=p.key AND x.id_linea=line_id))
  THEN RAISE EXCEPTION 'AMBITO_DENEGADO'; END IF;
 END IF;
 RETURN s;
END $function$


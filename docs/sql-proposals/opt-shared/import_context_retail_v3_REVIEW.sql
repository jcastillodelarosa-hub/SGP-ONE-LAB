-- LOCAL REVIEW ONLY. No activation, data load or grant to browser roles.
-- RETAIL v3: exact complete index label + reservation/system; internal ID remains distinct.
-- p_selectores is reconstructed from the original workbook by the private server.
BEGIN;
CREATE FUNCTION public.sgp_opt_import_contexto_retail_v3(
 p_token text,p_scope jsonb,p_opt text,p_selectores jsonb,p_referencias text[]
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE bindings jsonb; selectors jsonb; profiles jsonb; refs text[];
BEGIN
 PERFORM sgp_opt_shared.actor(p_token,true);
 PERFORM sgp_opt_shared.validate_scope(p_scope);
 IF p_opt IS NULL OR p_opt!~'^OPT[0-9]{4}-[0-9]{1,2}-[0-9]+-[A-Z0-9]+-[0-9]+$'
 OR length(p_opt)>128 THEN RAISE EXCEPTION 'OPT_CONSECUTIVO_INVALIDO'; END IF;
 IF p_selectores IS NULL OR jsonb_typeof(p_selectores)<>'array'
 THEN RAISE EXCEPTION 'OPT_SELECTORES_INVALIDOS'; END IF;
 IF jsonb_array_length(p_selectores) NOT BETWEEN 1 AND 1000
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_selectores) x WHERE
   jsonb_typeof(x)<>'object' OR NOT(x ?& ARRAY['reserva','sistema','produccion','documentProduction'])
   OR x-ARRAY['reserva','sistema','produccion','documentProduction']<>'{}'::jsonb
   OR jsonb_typeof(x->'reserva') IS DISTINCT FROM 'string'
   OR jsonb_typeof(x->'sistema') IS DISTINCT FROM 'string'
   OR jsonb_typeof(x->'produccion') IS DISTINCT FROM 'string'
   OR length(x->>'produccion') NOT BETWEEN 1 AND 255 OR x->>'produccion'<>btrim(x->>'produccion') OR x->>'produccion' ~ '[[:cntrl:]]'
   OR jsonb_typeof(x->'documentProduction') IS DISTINCT FROM 'string'
   OR x->>'documentProduction'!~'^[0-9]{1,30}$'
   OR substring(x->>'produccion' from '^([0-9]+)\s*-\s*\S') IS DISTINCT FROM x->>'documentProduction'
   OR x->>'reserva'!~'^[0-9]{1,30}$'
   OR length(x->>'sistema') NOT BETWEEN 1 AND 255
   OR x->>'sistema'<>btrim(x->>'sistema')
   OR x->>'sistema' ~ '[[:cntrl:]]')
 THEN RAISE EXCEPTION 'OPT_SELECTORES_INVALIDOS'; END IF;
 SELECT jsonb_agg(jsonb_build_object('reserva',reserva,'sistema',sistema,'produccion',produccion,'documentProduction',document_id)
   ORDER BY reserva,sistema,produccion,document_id) INTO selectors
 FROM (SELECT DISTINCT x->>'reserva' reserva,x->>'sistema' sistema,x->>'produccion' produccion,x->>'documentProduction' document_id
   FROM jsonb_array_elements(p_selectores) x) s;
 IF p_referencias IS NULL OR cardinality(p_referencias) NOT BETWEEN 1 AND 1000
 OR array_ndims(p_referencias)<>1 OR EXISTS(SELECT 1 FROM unnest(p_referencias) r
  WHERE r IS NULL OR length(r) NOT BETWEEN 1 AND 255 OR r<>btrim(r) OR r ~ '[[:cntrl:]]')
 THEN RAISE EXCEPTION 'OPT_REFERENCIAS_INVALIDAS'; END IF;
 SELECT array_agg(r ORDER BY r) INTO refs FROM (SELECT DISTINCT unnest(p_referencias) r) s;
 -- Exact physical profile classifications. No inferred destination, no use of
 -- lineas_aplicables and no active prefilter that would hide a broken master.
 SELECT coalesce(jsonb_agg(jsonb_build_object('referencia',m.codigo_sap,
  'destino_productivo',m.destino_productivo,'tipo_pieza',m.tipo_pieza,'activa',m.activo)
  ORDER BY m.codigo_sap),'[]'::jsonb) INTO profiles
 FROM public.sgp_maestro_piezas m WHERE m.codigo_sap=ANY(refs);
 -- Exhaustive matches, including other weeks/lines and inactive identities.
 -- Never select one production/program by row order or hide an ambiguity.
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'documentProduction',substring(p.produccion from '^([0-9]+)\s*-\s*\S'),'documentLabel',p.produccion,'sgpProductionId',p.id,'reserva',r.reserva,'sistema',p.sistema,
  'key_produccion',p.key_produccion,'id_programacion',m.id_programacion,
  'id_linea',p.id_linea,'anio',p.anio,'semana_base',p.semana_base,
  'activa',p.activa,'excluida_export',p.excluida_export,
  'reserva_principal',r.reserva_principal,'programacion_reserva',m.reserva,
  'reserva_snapshot',m.reserva_snapshot,'estado_programacion',m.estado,
  'cantidad_snapshot',m.cantidad_snapshot
 ) ORDER BY p.id,p.key_produccion,r.reserva,m.id_programacion),'[]'::jsonb)
 INTO bindings
 FROM public.sgp_producciones p
 LEFT JOIN public.sgp_produccion_reservas_v r ON r.key_produccion=p.key_produccion
 LEFT JOIN LATERAL (
  SELECT mp.id_programacion,mp.reserva,mp.estado,d.reserva_snapshot,d.cantidad_snapshot
  FROM public.sgp_mecanizado_programacion_detalle d
  JOIN public.sgp_mecanizado_programacion mp USING(id_programacion)
  WHERE d.key_produccion=p.key_produccion AND mp.estado<>'CANCELADA' AND d.cantidad_snapshot>0
  AND mp.reserva=nullif(trim(split_part(coalesce(p.reserva_al,''),',',1)),'')
  AND d.reserva_snapshot=mp.reserva
 ) m ON true
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(selectors) s
  WHERE s->>'reserva'=r.reserva AND s->>'sistema'=p.sistema AND s->>'produccion'=p.produccion);
 -- Missing selectors remain in the returned selector set even with no binding.
 -- The validator must account for every selector before importing the document.
 RETURN jsonb_build_object('contract','OPT-IMPORT-CONTEXT-RETAIL-3',
  'scope',p_scope,'opt',p_opt,'selectores',selectors,'referencias',to_jsonb(refs),
  'profileDestinations',profiles,
  'revision',md5(jsonb_build_object('opt',p_opt,'selectores',selectors,'bindings',bindings,
   'referencias',to_jsonb(refs),'profileDestinations',profiles)::text),
  'bindings',bindings);
END $$;
REVOKE ALL ON FUNCTION public.sgp_opt_import_contexto_retail_v3(text,jsonb,text,jsonb,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sgp_opt_import_contexto_retail_v3(text,jsonb,text,jsonb,text[]) TO service_role;
COMMIT;

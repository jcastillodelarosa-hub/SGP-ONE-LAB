-- Server-only proposal for deterministic documentary binding; no enable or data load.
BEGIN;
CREATE FUNCTION public.sgp_opt_import_contexto_v1(p_token text,p_scope jsonb,p_producciones text[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE bindings jsonb;
BEGIN
 PERFORM sgp_opt_shared.actor(p_token,true);
 PERFORM sgp_opt_shared.validate_scope(p_scope);
 IF p_producciones IS NULL OR cardinality(p_producciones) NOT BETWEEN 1 AND 1000
 OR array_ndims(p_producciones)<>1 OR EXISTS(SELECT 1 FROM unnest(p_producciones) x WHERE x IS NULL OR x!~'^[0-9]{1,30}$')
 THEN RAISE EXCEPTION 'OPT_PRODUCCIONES_INVALIDAS'; END IF;
 -- Exact production ID, never a heuristic prefix, length or row order.
 -- Do not prefilter by line/week: the validator must detect real ambiguity and
 -- account for the full PDF before retaining only the requested assignment scope.
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'documentProduction',p.id,'reserva',r.reserva,'sistema',p.sistema,
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
 WHERE p.id=ANY(p_producciones);
 -- A missing active eligible program remains a null row and is rejected by the
 -- validator. Multiple eligible programs remain visible; none is chosen by order.
 RETURN jsonb_build_object('contract','OPT-IMPORT-CONTEXT-1','scope',p_scope,
  'revision',md5(bindings::text),'bindings',bindings);
END $$;
REVOKE ALL ON FUNCTION public.sgp_opt_import_contexto_v1(text,jsonb,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sgp_opt_import_contexto_v1(text,jsonb,text[]) TO service_role;
COMMIT;

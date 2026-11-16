-- Additive read-only endpoint scoped through the existing order/stage authorizer.
BEGIN;
CREATE FUNCTION public.sgp_lp_shared_nc_states_v1(p_token text,p_key text,p_stage text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;BEGIN
 s:=sgp_lp_shared_order.authorize(p_token,p_key,p_stage);
 RETURN jsonb_build_object('contract','NCV-ORDER-STATE-1','key',p_key,'line',s->>'line','stage',p_stage,'rows',(
  WITH refs AS (
   SELECT btrim(r.nc_reference) ref FROM sgp_lp_shared_order.reports r
   WHERE r.key=p_key AND r.cause='NC_V' AND (p_stage<>'EMPAQUE' OR r.origin_stage='EMPAQUE')
   UNION
   SELECT btrim(g.reference) FROM sgp_lp_order_details.glass_nc g
   JOIN sgp_lp_afectaciones.reportes r ON r.id=g.report_id
   WHERE r.key=p_key AND r.causa='NC_V' AND (p_stage<>'EMPAQUE' OR r.etapa='EMPAQUE')
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('reference',n.consecutivo,
   'state',n.estado_nc,'active',n.activo,'updatedAt',n.fecha_actualizacion)
   ORDER BY n.consecutivo),'[]'::jsonb)
  FROM public.sgp_nc_vidrio n
  JOIN refs ON refs.ref=n.consecutivo
  JOIN public.sgp_producciones p ON p.key_produccion=p_key
  WHERE n.activo AND nullif(btrim(n.orden),'') IS NOT NULL AND nullif(btrim(n.sistema),'') IS NOT NULL
   AND upper(regexp_replace(btrim(n.orden),'\s+',' ','g'))=upper(regexp_replace(btrim(p.produccion),'\s+',' ','g'))
   AND upper(regexp_replace(btrim(n.sistema),'\s+',' ','g'))=upper(regexp_replace(btrim(p.sistema),'\s+',' ','g'))
 ));
END $$;
REVOKE ALL ON FUNCTION public.sgp_lp_shared_nc_states_v1(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sgp_lp_shared_nc_states_v1(text,text,text) TO anon,authenticated;
COMMIT;

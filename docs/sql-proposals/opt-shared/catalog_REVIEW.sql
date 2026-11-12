-- PROPOSAL ONLY: optional read-only catalog, after the reviewed v2 schema.
-- No production execution, import, activation, write authority or client grants.
-- The existing state/register RPCs independently revalidate current roles and bindings.
BEGIN;
CREATE FUNCTION public.sgp_opt_catalogo_v2(p_token text,p_scope jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE groups jsonb; documents integer; pieces integer;
BEGIN
 PERFORM sgp_opt_shared.actor(p_token,false);
 PERFORM sgp_opt_shared.validate_scope(p_scope);
 WITH refs AS (
  SELECT a.reserva,a.sistema,d.id_documento,d.sha256,p.referencia,
   (SELECT jsonb_agg(jsonb_build_object('origen',s.origen,'source_key',s.source_key,
     'consecutivo',s.consecutivo,'modo_carga',s.modo_carga) ORDER BY s.origen,s.source_key)
    FROM sgp_opt_shared.sources s WHERE s.id_documento=d.id_documento) fuentes,
   jsonb_agg(jsonb_build_object('id_pieza',p.id_pieza,'pagina',p.pagina,'patron',p.patron,
    'barra',p.barra,'corte',p.corte,'longitud_mm',p.longitud_mm)
    ORDER BY p.pagina,p.patron,p.barra,p.corte) piezas
  FROM sgp_opt_shared.documents d
  JOIN sgp_opt_shared.pieces p USING(id_documento)
  JOIN sgp_opt_shared.assignments a USING(id_pieza)
  WHERE sgp_opt_shared.in_scope(a.key_produccion,p_scope)
  GROUP BY a.reserva,a.sistema,d.id_documento,d.sha256,p.referencia
 ), catalog AS (
  SELECT reserva,sistema,jsonb_agg(jsonb_build_object('id_documento',id_documento,
   'sha256',sha256,'referencia',referencia,'sistema',sistema,'fuentes',fuentes,'piezas',piezas)
   ORDER BY id_documento,referencia) referencias
  FROM refs GROUP BY reserva,sistema
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('reserva',reserva,'sistema',sistema,
  'referencias',referencias) ORDER BY reserva,sistema),'[]'::jsonb) INTO groups FROM catalog;
 SELECT count(DISTINCT ref->>'id_documento'),coalesce(sum(jsonb_array_length(ref->'piezas')),0)
 INTO documents,pieces FROM jsonb_array_elements(groups) g
 CROSS JOIN LATERAL jsonb_array_elements(g->'referencias') ref;
 RETURN jsonb_build_object('contract_version',2,'scope',p_scope,'grupos',groups,
  'totales',jsonb_build_object('grupos',jsonb_array_length(groups),'documentos',documents,'piezas',pieces));
END $$;
-- Creation otherwise inherits the PostgreSQL default PUBLIC execute privilege.
REVOKE ALL ON FUNCTION public.sgp_opt_catalogo_v2(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
-- Reviewed rollback when separately authorized: DROP FUNCTION public.sgp_opt_catalogo_v2(text,jsonb);

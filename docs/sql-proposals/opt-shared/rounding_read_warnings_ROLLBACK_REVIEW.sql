-- Local review only: exact read-only definitions captured before change.
BEGIN;
CREATE OR REPLACE FUNCTION public.sgp_opt_catalogo_v2(p_token text, p_scope jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION public.sgp_opt_cortes_estado_v2(p_token text, p_reserva text, p_scope jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor text; can_write boolean:=false; refs jsonb; total integer; done integer;
BEGIN
 actor:=sgp_opt_shared.actor(p_token,false);
 IF p_reserva IS NULL OR btrim(p_reserva)='' THEN RAISE EXCEPTION 'OPT_RESERVA_REQUERIDA'; END IF;
 PERFORM sgp_opt_shared.validate_scope(p_scope);
 BEGIN PERFORM sgp_opt_shared.actor(p_token,true); can_write:=true; EXCEPTION WHEN OTHERS THEN can_write:=false; END;
 refs:=coalesce((
 SELECT jsonb_agg(jsonb_build_object('id_documento',q.id_documento,'referencia',q.referencia,'sha256',q.sha256,'sistema',q.sistema,
 'fuentes',(SELECT jsonb_agg(jsonb_build_object('origen',s.origen,'source_key',s.source_key,'consecutivo',s.consecutivo,'modo_carga',s.modo_carga) ORDER BY s.origen,s.source_key) FROM sgp_opt_shared.sources s WHERE s.id_documento=q.id_documento),'piezas',q.piezas) ORDER BY q.id_documento,q.sistema,q.referencia)
 FROM (SELECT d.id_documento,d.sha256,a.sistema,p.referencia,jsonb_agg(jsonb_build_object(
 'id_pieza',p.id_pieza,'registrable',sgp_opt_shared.bound(p.id_pieza),'pagina',p.pagina,'patron',p.patron,'barra',p.barra,'corte',p.corte,'longitud_mm',p.longitud_mm,
 'estado',CASE WHEN c.id_pieza IS NULL THEN 'PENDIENTE' ELSE 'CORTADO' END,'usuario',e.usuario,'registrado_en',e.registrado_en,'id_registro',e.clave,'periodo',e.periodo
 ) ORDER BY p.pagina,p.patron,p.barra,p.corte) piezas
 FROM sgp_opt_shared.documents d JOIN sgp_opt_shared.pieces p USING(id_documento) JOIN sgp_opt_shared.assignments a USING(id_pieza)
 LEFT JOIN sgp_opt_shared.cuts c USING(id_pieza) LEFT JOIN sgp_opt_shared.events e USING(clave)
 WHERE a.reserva=p_reserva AND sgp_opt_shared.in_scope(a.key_produccion,p_scope)
 GROUP BY d.id_documento,a.sistema,p.referencia) q),'[]'::jsonb);
 SELECT count(*),count(*) FILTER(WHERE piece->>'estado'='CORTADO') INTO total,done FROM jsonb_array_elements(refs) ref CROSS JOIN LATERAL jsonb_array_elements(ref->'piezas') piece;
 RETURN jsonb_build_object('contract_version',2,'habilitado',true,'reserva',p_reserva,'scope',p_scope,'manifiesto_validado',total>0,
 'puede_registrar',can_write AND total>0 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(refs) r CROSS JOIN LATERAL jsonb_array_elements(r->'piezas') p WHERE p->>'estado'='PENDIENTE' AND p->'registrable'<>'true'::jsonb),
 'referencias',refs,'totales',jsonb_build_object('piezas',total,'cortadas',done,'pendientes',total-done));
END $function$
;
DROP FUNCTION sgp_opt_shared.document_validation_warnings(uuid);
COMMIT;

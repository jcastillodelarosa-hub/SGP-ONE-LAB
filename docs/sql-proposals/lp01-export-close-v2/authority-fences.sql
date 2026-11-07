 -- Technical authority boundary, not a business rule about an unclosed prior turn.
 -- Legacy ABRIR cannot turn unallocated Export totals into zero manual execution.
 IF et='ENSAMBLE' AND line_id='PANELES_2' AND (
  (op='ABRIR' AND EXISTS(SELECT 1 FROM sgp_lp_operacion.cierres c WHERE c.etapa=et AND c.linea=line_id
   AND (c.fecha,c.turno)<=(d,t) AND c.snapshot->>'authority'='EXPORT_PRODUCTION_V2'))
  OR (op IN('SALE','EJECUTAR','LIBERAR') AND EXISTS(SELECT 1 FROM sgp_lp_operacion.cierres c,
   jsonb_array_elements(c.snapshot->'rows') x WHERE c.etapa=et AND c.linea=line_id AND c.snapshot->>'authority'='EXPORT_PRODUCTION_V2' AND x->>'key'=k)))
 THEN RAISE EXCEPTION 'EXPORT_V2_RECONCILIATION_REQUIRED'; END IF;

BEGIN READ ONLY; SET LOCAL statement_timeout='15s';
WITH p AS (SELECT * FROM public.sgp_aluminio_pendientes WHERE origen='PICKING')
SELECT coalesce(p.contrato_pdt,'UNSPECIFIED') AS contract,count(*) AS pending_count,
count(*) FILTER(WHERE p.key_produccion IS NULL OR btrim(p.key_produccion)='') AS missing_key,
count(*) FILTER(WHERE p.key_produccion IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.sgp_producciones x WHERE x.key_produccion=p.key_produccion)) AS orphan_key,
count(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM sgp_pdt_multiorigen.detalles d WHERE d.id_pendiente=p.id_pendiente)) AS without_native_detail,
count(*) FILTER(WHERE EXISTS(SELECT 1 FROM sgp_pdt_multiorigen.detalles d JOIN sgp_pdt_multiorigen.eventos e USING(id_evento) JOIN public.sgp_picking_entregas t USING(id_entrega) WHERE d.id_pendiente=p.id_pendiente AND e.solicitud->>'origen'='PICKING')) AS native_lineage_eligible,
count(*) FILTER(WHERE EXISTS(SELECT 1 FROM sgp_pdt_multiorigen.detalles d JOIN sgp_pdt_multiorigen.eventos e USING(id_evento) WHERE d.id_pendiente=p.id_pendiente AND e.solicitud->>'origen' IS DISTINCT FROM 'PICKING')) AS origin_mismatch,
count(*) FILTER(WHERE p.fabricacion IS NULL OR btrim(p.fabricacion)='') AS missing_fabrication,
count(*) FILTER(WHERE p.longitud IS NULL OR p.longitud<=0) AS missing_or_invalid_length,
count(*) FILTER(WHERE p.cantidad IS NULL OR p.cantidad<=0) AS missing_or_invalid_piece_quantity,
count(*) FILTER(WHERE EXISTS(SELECT 1 FROM sgp_pdt_manual.detalles d WHERE d.id_pendiente=p.id_pendiente)) AS manual_detail
FROM p GROUP BY p.contrato_pdt ORDER BY contract;
ROLLBACK;

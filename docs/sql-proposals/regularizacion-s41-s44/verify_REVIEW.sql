-- READ ONLY. This ledger records historical test regularization, not physical delivery.
WITH scope AS (
 SELECT key_produccion,id_linea,cantidad,trim(split_part(coalesce(reserva_al,''),',',1)) reserva
 FROM public.sgp_producciones WHERE anio=2026 AND semana_base BETWEEN 41 AND 44
), links AS (
 SELECT s.key_produccion,count(DISTINCT d.id_programacion) n
 FROM scope s LEFT JOIN public.sgp_mecanizado_programacion_detalle d USING(key_produccion)
 GROUP BY s.key_produccion
)
SELECT (SELECT count(*) FROM scope) scope_keys,
 (SELECT coalesce(sum(cantidad),0) FROM scope) scope_windows,
 (SELECT count(*) FROM links WHERE n=0) without_program,
 (SELECT count(*) FROM links WHERE n>1) multiple_programs,
 (SELECT count(*) FROM scope WHERE id_linea<>'PANELES_2') non_panel,
 (SELECT count(*) FROM sgp_regularizacion_187.producciones WHERE lote_id='SGP-187-2026-S41-S44') ledger_keys,
 (SELECT count(*) FROM sgp_regularizacion_187.producciones WHERE lote_id='SGP-187-2026-S41-S44' AND entrega_historica_pruebas) panel_test_deliveries,
 (SELECT count(*) FROM sgp_regularizacion_187.producciones WHERE lote_id='SGP-187-2026-S41-S44' AND auditoria_historica_pruebas) panel_test_audits,
 (SELECT count(*) FROM sgp_regularizacion_187.reservas WHERE lote_id='SGP-187-2026-S41-S44') ledger_reserves,
 (SELECT count(*) FROM sgp_regularizacion_187.producciones WHERE lote_id='SGP-187-2026-S41-S44' AND entrega_previa<>'[]'::jsonb) keys_with_prior_delivery,
 (SELECT count(*) FROM sgp_regularizacion_187.reservas WHERE lote_id='SGP-187-2026-S41-S44' AND recepcion_previa IS NULL) reserves_without_prior_reception,
 (SELECT count(*) FROM sgp_regularizacion_187.producciones h WHERE NOT EXISTS
   (SELECT 1 FROM scope s WHERE s.key_produccion=h.key_produccion)) out_of_scope;

SELECT fuente->>'id_linea' id_linea,count(*) productions,sum((fuente->>'cantidad')::numeric) windows
FROM sgp_regularizacion_187.producciones
WHERE lote_id='SGP-187-2026-S41-S44'
GROUP BY fuente->>'id_linea';

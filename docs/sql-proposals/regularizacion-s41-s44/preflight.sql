-- SGP-ONE-LAB / Issue #187
-- PREFLIGHT READ-ONLY: regularizacion historica de pruebas, 2026 semanas 41-44.
-- No ejecutar UPDATE/INSERT en produccion sin SQL transaccional y rollback validados.
WITH scope AS (
 SELECT key_produccion, produccion, cantidad, id_linea, semana_base,
        NULLIF(trim(split_part(coalesce(reserva_al,''),',',1)),'') AS reserva_principal
 FROM public.sgp_producciones
 WHERE anio=2026 AND semana_base BETWEEN 41 AND 44
),
detalle AS (
 SELECT s.key_produccion, count(DISTINCT d.id_programacion) AS programaciones
 FROM scope s LEFT JOIN public.sgp_mecanizado_programacion_detalle d
 ON d.key_produccion=s.key_produccion
 GROUP BY s.key_produccion
),
reservas AS (
 SELECT DISTINCT reserva_principal AS reserva FROM scope
 WHERE reserva_principal IS NOT NULL
)
SELECT
 (SELECT count(*) FROM scope) AS producciones,
 (SELECT sum(cantidad) FROM scope) AS ventanas,
 (SELECT count(DISTINCT produccion) FROM scope) AS codigos_produccion,
 (SELECT count(*) FROM reservas) AS reservas_principales,
 (SELECT count(*) FROM detalle WHERE programaciones=0) AS producciones_sin_programacion,
 (SELECT count(*) FROM detalle WHERE programaciones>1) AS producciones_con_varias_programaciones,
 (SELECT count(*) FROM reservas r LEFT JOIN public.sgp_recepcion_reservas x ON x.reserva=r.reserva WHERE x.id_recepcion IS NULL) AS reservas_sin_recepcion,
 (SELECT count(*) FROM reservas r JOIN public.sgp_recepcion_reservas x ON x.reserva=r.reserva WHERE x.completa IS DISTINCT FROM true OR x.legalizada IS DISTINCT FROM true) AS reservas_recepcion_incompleta,
 (SELECT count(*) FROM scope s WHERE NOT EXISTS (SELECT 1 FROM public.sgp_mecanizado_programacion_detalle d WHERE d.key_produccion=s.key_produccion)) AS filas_sin_detalle;
-- Validar por separado las entregas existentes por id_programacion y produccion:
-- NO asumir que un mismo codigo de produccion representa una sola fila/parte.
-- NO actualizar estados AUDITADA_DIFERENCIA sin preservar evidencia y faltantes.

-- Pendiente de contraste productivo: distribución por línea y eventos vinculados
-- exactamente por key_produccion + id_programacion + código. Solo agregados.
WITH scope AS (
 SELECT key_produccion,produccion,id_linea,cantidad
 FROM public.sgp_producciones
 WHERE anio=2026 AND semana_base BETWEEN 41 AND 44
), evidence AS (
 SELECT s.*,
  EXISTS(SELECT 1 FROM public.sgp_mecanizado_programacion_detalle d
         WHERE d.key_produccion=s.key_produccion) has_plan,
  EXISTS(SELECT 1 FROM public.sgp_mecanizado_programacion_detalle d
         JOIN public.sgp_picking_entregas e ON e.id_programacion=d.id_programacion
          AND e.produccion=s.produccion
         WHERE d.key_produccion=s.key_produccion AND e.estado='VALIDADA' AND e.completa=true) validated_complete,
  EXISTS(SELECT 1 FROM public.sgp_mecanizado_programacion_detalle d
         JOIN public.sgp_picking_entregas e ON e.id_programacion=d.id_programacion
          AND e.produccion=s.produccion
         WHERE d.key_produccion=s.key_produccion AND e.estado='AUDITADA_DIFERENCIA') audited_difference
 FROM scope s
)
SELECT id_linea,count(*) productions,sum(cantidad) windows,
 count(*) FILTER (WHERE NOT has_plan) without_plan,
 count(*) FILTER (WHERE validated_complete) validated_complete,
 count(*) FILTER (WHERE audited_difference) audited_difference
FROM evidence GROUP BY id_linea ORDER BY id_linea;

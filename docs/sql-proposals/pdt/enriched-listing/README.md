# PDT enriquecido — propuesta REVIEW, no aplicada

Fuente productiva reportada: `SGP_PDT_RPC_y_columnas_productivas_COMPLETO.md`, huella de `pg_get_functiondef` `e7546c68fec006a0f02cc60b5f4643b6`, 101 PDT (91 PENDIENTE). La definición transcrita coincide con la versionada en main salvo punto y coma final. Se conserva firma, rol, filtros, claves JSON, orden, fechas, historial y estados. Los campos `key_produccion`, `reserva_principal`, `acabado_pendiente` y `es_reserva_compartida` ya existen; `semana_pdt` es nuevo. NC sigue consultándose en vivo: asignar/cambiar/desvincular `p.nc` y cambiar `n.estado` no requieren sincronización duplicada ni guardan un estado obsoleto.

## Instalación controlada

1. Obtener backup consistente y restaurarlo en PostgreSQL 17 aislado. Verificar recuento y contrato; no tratar un SQL parcial como backup. Tomar `pg_get_functiondef` original y hash. Medir baseline con `EXPLAIN (ANALYZE, BUFFERS)` sobre `SELECT sgp_aluminio_pendientes_listar(<token QA>,false)` en QA; en producción solo mediante una sesión autorizada de lectura y sin imprimir token.
2. Aplicar `01_enriched_listing_REVIEW.sql` **primero en la copia aislada**. Guard de hash y recuento aborta si cambia la base. La actualización usa exactamente las búsquedas legacy como fuente histórica; `coalesce` conserva todo valor válido. El trigger enriquece solo INSERT nuevos; la NC permanece viva. Un guard PDT puede rechazar el backfill de registros validados: es un bloqueo, no se debe desactivar el guard.
3. Instalar `tests/pdt-enriched/baseline.sql` solo en QA antes del cambio; ejecutar `tests/pdt-enriched/equality-isolated.sql` con token QA. Comparar 101 IDs, valores JSON completos y abiertos. Probar NC asignada, reasignada, desvinculada y cambio de estado; verificar igualdad antes/después de cada operación en QA, con ROLLBACK. Medir nuevo tiempo en mismo plan/dataset. No declarar timeout corregido sin ambos tiempos.
4. Antes de producción: confirmar restauración y ventana; revisar que nuevos triggers no alteren registro/identidad; repetir igualdad/tiempos en transacción controlada antes de commit y suspender ante diferencia, error de guard o aparición de nuevas filas. No ejecutar por este PR.

## Reversión

Guardar definición original real. En transacción controlada: restaurar `sgp_aluminio_pendientes_listar`, eliminar `trg_sgp_pdt_enrich_insert_20261028`, función de enriquecimiento y `semana_pdt` solo tras confirmar que ningún consumidor nuevo depende de ella. No revertir cantidades, estados, historial ni NC. Si aparecen escrituras posteriores, restaurar backup completo perdería operaciones: preferir reversión de DDL y reconciliación de nuevos PDT. El archivo SQL REVIEW no se ejecuta automáticamente.

## Riesgos pendientes

No se pudo medir el tiempo productivo en esta sesión ni ejecutar la migración en restauración compatible. El guard de validados puede impedir el backfill, y la instalación debe abortar si ocurre. La prueba de igualdad sobre los 101 registros y el estado de NC es una condición, no un resultado certificado. PR #119 modifica el listado frontend y debe contrastarse antes de fusionar. No aplicar sin completar estas verificaciones.

## Corrección de revisión PR #138

`es_reserva_compartida` no aparece en el SET histórico ni en el trigger: se conserva cada valor almacenado. El listado usa el mismo `coalesce(p.es_reserva_compartida,false)` de la definición productiva. La comprobación de los 101 valores reales requiere ejecutar solamente `SHARED_RESERVATION_READONLY.sql` antes y después en una ventana de instalación autorizada; el digest de ID+boolean detecta alteraciones sin revelar registros. En esta sesión no existe acceso SQL productivo y no se declara verificado ese digest.

La expresión literal `regexp_split_to_array(...,'\\s*,\\s*')` se copió exactamente de la RPC productiva versionada para backfill y trigger; una prueba compara las apariciones. El trigger se ejecuta también al cambiar `reserva`, `produccion` o `key_produccion`, recalculando reserva principal, acabado y semana de la identidad nueva. Cambios que no alteran identidad retornan sin tocar datos enriquecidos. `es_reserva_compartida` y cantidades/estados/historial permanecen intactos. Revisar el orden con otros triggers instalados antes de aplicación.

`equality-isolated.sql` compara los arreglos JSONB completos para ambos filtros; esto incluye campos, cantidad y orden exacto. Con dos PDT empatados en prioridad y fecha, el orden original puede ser no determinista: si la comparación falla solo por empate, no ocultarlo ni reordenar la prueba; documentar IDs y decidir un desempate compatible antes de instalar.

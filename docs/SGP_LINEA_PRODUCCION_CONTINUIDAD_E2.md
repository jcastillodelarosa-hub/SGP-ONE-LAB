# Línea de Producción · continuidad E2 (LP-01 y LP-02)

Estado: **IMPLEMENTADO EN RAMA; NO APLICADO NI PUBLICADO**. Base `main` `7258c8c0c2e64cc38e60dee5e849ca73cfb55e8a`.

## Referencia aprobada

- LP-01: PDF B05 (semana, día y resumen por sistema), B06 (tabla), B07 (Kanban). La vista semanal conserva siete días, aun sin asignaciones.
- LP-02: PDF B08–B11. B11 requiere «Ensamble completo» solo cuando el último Export es válido y el saldo de Ensamble es cero. No existe imagen corregida de B11; se siguió la nota de aprobación.
- Las imágenes son bocetos con cifras ilustrativas; ninguna cifra se usa como dato operativo.

## Arquitectura y fuentes

- `production-line-tabs.js`: navegación LP-01 / LP-02 Ensamble / LP-02 Empaque, conservando la pestaña y el panel existentes de Reporte de ubicaciones.
- `planner-readonly-v326.js`: explorador y contexto de producción/reserva existentes. No se duplicó su fuente.
- `planner-operations-v326.js`: calendario, tabla, Kanban, por programar y ejecución. Las vistas comparten `sgp_linea_plan_consultar` con sesión SGP; programar y mover/dividir siguen usando las RPC instaladas `sgp_linea_plan_programar` y `sgp_linea_plan_mover`. La carga programada se calcula solo desde asignaciones. El saldo Export se presenta por separado y no equivale a cantidad sin programar.
- `app.js`: Ensamble y Empaque mantienen la consulta autorizada `sgp_consultar_ensamble`; Empaque distingue saldo válido, pendiente y ausencia del último Export. No registra ejecución ni comentarios de Empaque.

## Operatividad y límites

Las asignaciones, filtros de hoja, orden visual multinivel, navegación y movimiento individual usan componentes y contratos vigentes. No se habilitó programación masiva de una parte: el contrato transaccional de esa operación aún no está aprobado. No se agregaron escrituras de Sale, ejecución o cierre de turno. En Empaque, las prioridades propias y los comentarios siguen pendientes de contrato servidor. Las afectaciones NC/vidrio y el indicador Tecno de B09/B10 requieren fuentes y validaciones específicas; no se presentan cifras inventadas.

## Pruebas y evidencia

- `node --test tests/planner-integration.test.mjs tests/production-line-tabs.test.mjs tests/linea-produccion-v328.test.mjs`: 24/24.
- `python tests/linea-produccion-e2-browser.py`: PC 1440 × 900 y móvil 390 × 844; tabla, Kanban, navegación y Empaque. Capturas en `docs/evidence/linea-produccion-e2/`, rotuladas **DATOS SINTÉTICOS**; no demuestran consulta ni permisos productivos.
- `npm run build:vendor` y `npm run verify:release`: correctos para LAB v368. Vendor se generó localmente por el procedimiento existente y está excluido de Git.

## Siguiente paso

Revisión del PR Draft y verificación funcional con sesión autorizada en entorno seguro antes de integrar. Para completar B08–B10 se necesita certificar las fuentes de afectaciones y contratos de ejecución/cierre; no conectarlas al runtime hasta entonces.

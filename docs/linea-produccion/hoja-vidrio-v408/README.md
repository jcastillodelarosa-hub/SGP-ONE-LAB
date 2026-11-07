# Diseño aprobado: hoja y detalle vidrio — candidato v408

Base: v407 publicada, main `e0e5f0e01b28c9841c336da031057ece78ca97af`, árbol `73b5fc851a50fa8a813ea2bc00a31041c197175e`. Hosting `ef813e4accd8011b`.

## Cambios
- Semana a izquierda de Producción. Reserva y Prioridad en columnas propias.
- Dentro de cada grupo abiertas/programadas/otras, orden por reserva y parte de reserva, con comparación natural (1.2 antes de 1.10). La prioridad del planificador permanece separada.
- Encabezado de vidrio OVES y Tipo V real de carga semanal.
- Burro como acordeón nativo: detalle debajo, sin modal adicional, cantidad/dimensiones/Marca. Marca corresponde a Composición del export ubicaciones.
- Conserva notas compartidas, Disponible, afectaciones, navegación y clasificación por saldo Export.

## Fuentes y SQL
- Prioridad: sgp_prioridades.prioridad, join por key_produccion/anio/semana actual o base/id_linea; proyección oficial.prioridad_reserva.
- Tipo: sgp_vidrio.datos_origen->>'Tipo V'. Sin enum artificial: admite laminado, termolaminado y demás valores reales.
- OVES: fuente semanal Orden Oves; alternativas existentes p.orden_oves y ubicación.
- Detalle: sgp_ubicacion_vidrio_actual.disponible/dimensiones/composicion.
- Scripts sql/* son candidatos con guard de hash sobre definición live. No aplicados. Rebasar prioridad-install si v407 cambia la misma RPC. No quitar el guard.

## Evidencia focal
- Node: 43/43 tests (glass-location-detail + lp01-assembly-sheet).
- node --check app.js y git diff --check PASS.
- Worker SQL: PGlite vidrio y prioridad PASS; archivos en /workspace/shared/glass-details-sql-nov7/.
- Browser local intentado: sin binario Chromium instalado; no se afirma revisión visual de ejecución.

## Publicación pendiente
Candidato v408 no publicado, no SQL remoto, no datos modificados. Mantener controles Firebase existentes y baseline/rollback v407. SQL requiere revisión de autorización y coherencia antes de aplicación.

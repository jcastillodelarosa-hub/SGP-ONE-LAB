# Origen en detalle de actualización NC Vidrio

Estado: IMPLEMENTADO EN RAMA; publicación autorizada, pendiente de CI/Hosting, sin SQL aplicado. Base main
ad8e6d3 (LAB v442), preservando la corrección del calendario. Candidata v443.

Solicitud de Johan, 12/11/2026: indicar proveedor/planta en el modal de nuevas
NC Vidrio. Referencia visual: captura del modal «NC Vidrio nuevas · 6».

## Fuente y decisión
Lectura de Supabase SGP-ONE-LAB el 12/11/2026 confirmó que
`sgp_resumen_eventos_actualizacion` devuelve el snapshot `datos` completo,
con `motivo` y `linea_afectada`; no hace falta consulta nueva ni migración.
En las seis NC de la captura, cinco tienen proveedor explícito en motivo
 o línea afectada; la sexta tiene BODEGA/BODEGA DE VIDRIO.

Columna ORIGEN NC en NUEVA, FINALIZADA y ABIERTA:
- PROVEEDOR explícito → Proveedor.
- PROCESO explícito → Planta (proceso); PLANTA explícita → Planta.
- BODEGA explícita → Bodega, sin reinterpretarla como Planta.
- Señales contradictorias → Por validar; sin evidencia → Sin clasificar.
El título de cada celda conserva ambos valores de origen. La clasificación
es solo visual, no modifica fuente, cantidades, permisos o métricas existentes.

## Verificación
`node --test tests/nc-glass-origin.test.mjs tests/nc-glass-production-column.test.mjs tests/nc-glass-source-session.test.mjs`: 12 PASS.
Cobertura: motivos, ausencia/conflicto, tres grupos de eventos, apertura/reapertura,
fuente escapada, no mutación y regresión de sesión/columna Producción.
`npm run build:vendor && npm run verify:release`: PASS.
Navegador PC/móvil y aceptación real: pendientes (restricción de Chromium ya
comprobada en el entorno; no se reintentó). Fixture/DOM no equivalen a prueba visual.

Publicación autorizada por Johan. Verificar CI/Hosting del SHA exacto. OPT queda fuera del cambio.

`npm test`: 1008 PASS, 10 omitidas, 0 fallos. Sintaxis y diff: PASS.

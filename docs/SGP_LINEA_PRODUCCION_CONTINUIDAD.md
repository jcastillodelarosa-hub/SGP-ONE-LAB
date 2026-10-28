# Línea de Producción — Fase E2

Base: main `55a309729bb3166cce98e24eb7e840169f4b7890`, LAB v365. Rama `feat/linea-produccion-base-e2`. Estado: IMPLEMENTADO EN RAMA, NO APLICADO, NO PUBLICADO, SIN VERIFICACIÓN PRODUCTIVA.

## Arquitectura y rutas

La ventana existente Línea de Producción (`data-view-panel=ensamble`) integra cuatro pestañas: Programación, Ensamble, Empaque y Cierre de Turno. `index.html` define la navegación y `app.js` reutiliza la sesión SGP y `sgp_consultar_ensamble` para consulta de órdenes. Programación ofrece filtros de semana/línea y búsqueda/orden; Cierre resume exclusivamente las filas consultadas y declara que no es cierre oficial. Ensamble conserva hoja, PDT y Reporte de ubicaciones; Empaque conserva su hoja y acceso PDT.

No se crea almacenamiento paralelo. Producción, reserva, sistema, acabado, cantidad, estado y observación provienen de la RPC autenticada existente. La consulta puede fallar y muestra error, sin presentar cero como dato real. El resumen depende de la última consulta de Programación y no es trazabilidad de turno ni balance certificado.

## Operativo y pendiente

Operativo en código: navegación entre cuatro pestañas; consulta filtrada de órdenes; búsqueda y orden en Programación; detalle/Reporte de ubicaciones, filtros y registro PDT existente de Ensamble; consulta y PDT existente de Empaque. PDT v2, Picking y Reporte de ubicaciones no se modifican.

Visual/pendiente: movimientos, cambios de prioridad, observaciones editables, cierre definitivo, alertas y otras novedades. NC aluminio/vidrio, vidrio y seguimiento mantienen sus accesos existentes en el menú; no se simula escritura exitosa. No se conecta el motor aislado de PR #117→#132 ni se asume integrado.

## Archivos y pruebas

Modificados: `index.html`, `app.js`. Nuevo: este documento. Comprobaciones: `node --check app.js`, `git diff --check`, `npm test` (resultado en PR). La prueba PC/móvil visual y de roles reales requiere entorno con sesión autorizada; no se declara verificada por la suite. No hay migraciones ni cambios de backend.

## Riesgos y siguiente paso

La RPC `sgp_consultar_ensamble` alimenta Programación y Empaque en lectura; su saldo no acredita por sí mismo disponibilidad de Empaque. Cierre resume un conjunto filtrado, no un turno ni una liquidación. Antes de habilitar operaciones, revisar contratos de permisos, ejecución, fuentes Export/PDT y concurrencia de la cadena de PR. Los originales E1 DOCX maestro v1.9 y PDF B01–B27 no están disponibles aquí; validar diseño y B12 cuando se reciban.

Siguiente paso concreto para ChatGPT: revisar PR de esta rama, ejecutar recorrido autenticado PC/móvil y contrastar el diseño con los originales E1. Mantener las operaciones sin contrato como pendientes.

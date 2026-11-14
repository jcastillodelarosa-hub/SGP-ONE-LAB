# OPT: cuatro bocetos implementados localmente

Estado: IMPLEMENTADO EN RAMA `feat/opt-week-linked-list`, sobre `df0e42b` (base publicada de la rama `2ad7054`). Sin push, PR, fusión, SQL alojado ni publicación. v458 continúa provisional: coordinar main y PR270 antes de integrar, conservando alertas ajenas.

La coordinación autorizó sustituir las transferencias incompletas por su especificación visual fiel de los cuatro bocetos. No se atribuye inspección local a las imágenes truncadas.

## Resultado

- Reservas programadas y enlaces documentales exactos: contadores, búsqueda reserva/sistema/OPT, filtro de enlace, tabla PC y tarjetas móviles. Conserva el cruce exacto reserva/sistema del listado previo; compartir key_produccion no propaga enlaces.
- Avance por piezas del manifiesto autorizado: Sin iniciar, En proceso o Cortada; x/y y porcentaje. Frames sin asignación muestra Revisar vínculo, sin porcentaje ni selección de piezas. Estado no comprobado tampoco muestra 0%. No cambia asignaciones, medidas o permisos.
- Avance semanal se completa al consultar el estado autorizado de cada reserva; antes muestra Consultar avance. No se introduce una lectura masiva ni se infiere avance desde cantidades documentales.
- Origen/índice y nombres/rutas relativas del navegador permanecen visibles tras vaciar el input nativo, durante la vista actual. Selección, procesamiento local, envío, recibo confirmado, fallo y resultado incierto son estados separados. Esto no promete archivo PDF persistido en servidor ni selección conservada después de cerrar la vista.
- Comprobación manual de pendientes sin enviar PDF. Solo COMMITTED_MATCH exacto confirma el diario histórico; ausencia, discrepancia, error y cambio de contexto conservan el pendiente. No hay reintento automático ni limpieza global. Los descartes por índice/programación se separan de fallos y rechazos del intento actual.

## Evidencia local

9 pruebas Node de progreso, selección y observación pasan. DOM afectado: approved-ui, import-upload, shared-catalog, shared-reference-navigation, document-read, shared-workflow, native-session, server-registration, shared-scheme-workflow y workflow pasan. verify:release pasa, sin acreditar publicación.

Chromium local: week-linked-browser y approved-ui-browser pasan en PC 1440×1000 y móvil 390×844. Tráfico limitado a localhost y escritores sintéticos prohibidos. Se inspeccionaron capturas del listado, referencias, Frames sin asignar, origen/errores locales y tarjetas de piezas con desplazamiento. Verifica búsqueda, filtro, 18 reservas sintéticas/9 sin enlace, scroll vertical, falta de overflow móvil, controles de corte existentes y cambio de semana. Cifras exclusivamente del harness, no de producción.

Capturas locales: /tmp/opt-week-list-evidence/{desktop,mobile,desktop-bottom,mobile-bottom}.png y /tmp/opt-approved-ui-evidence/{references-desktop,references-mobile,reference-search-mobile,unassigned-mobile,files-desktop,files-mobile,piece-mobile}.png.

Reproducción: servidor estático local en 127.0.0.1:8765; ejecutar tests/opt-digital/week-linked-browser.cjs y approved-ui-browser.cjs con PLAYWRIGHT_MODULE y CHROMIUM_PATH disponibles. Para DOM usar JSDOM_MODULE. Node: node --test tests/opt-piece-progress.test.mjs tests/opt-file-selection-state.test.mjs tests/opt-import-observation.test.mjs.

## Pendientes exactos

La RPC de observación propuesta en docs/sql-proposals/opt-shared/import_observation_REVIEW.sql sigue sin aplicar; la interfaz conserva pendientes si no está disponible. Requiere revisión y autorización de integración/SQL/publicación en otro paso. No se repitieron pruebas SQL ya válidas ni se confirmó ningún pendiente real.

Frames requiere decisión del propietario sobre línea/programación antes de nuevos vínculos. Los PDFs no se reimportaron; no hubo registros de cortes, asignaciones, avances ni escrituras productivas. La QA es sintética local, no una sesión productiva.

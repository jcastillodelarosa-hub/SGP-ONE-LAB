# Seguimiento: actualización silenciosa y columnas

Base `fe82ffab` (main #191). Rama local `fix/seguimiento-silent-filters`.
No push, PR, SQL, datos productivos, fusión ni despliegue. Vidrio #192 intacto.

## Referencias y decisiones

- Objetivo visual principal: SGP_ONE_DESIGN_SYSTEM.md y la tabla/tarjetas existentes.
  Se conservan azul SGP, tipografía, estados, panel de detalle y controles existentes.
- Refero `references/craft-details.md`: controles nativos con etiquetas, foco visible,
  objetivos táctiles de 44 px y scroll interno. Consulta Refero styles devolvió
  `NO_SUBSCRIPTION`; no se atribuyen referencias externas que no pudieron leerse.
- Petición del usuario: Semana inmediatamente antes de Producción; en móvil, al
  inicio de su identidad. Año/semana original del Export, nunca fecha del turno.
- Filtros por valores combinables y orden explícito desde cabecera PC o selector de
  columna accesible en móvil. Los ausentes permanecen al final en ambas direcciones.
- Orden inicial: abiertas primero y antigüedad; ordenar una columna sustituye ese
  orden visual, sin mutar prioridades. SALE/avance/afectaciones globales siguen como
  «Ver por turno» sin filtros numéricos inventados.
- No retirar todavía bloques superiores: aclaración pendiente del responsable.

## Pruebas y límites

`python tests/lp01-tracking-ui/browser.py` ejecuta el controlador y renderizador
reales con transporte sintético exclusivamente local, Chromium 1440/390 px.
El reloj de Playwright avanza tres intervalos de 20 s; MutationObserver prueba que
la tabla no se reconstruye sin cambios. Verifica filtros, foco ante cambios reales,
panel, semanas, ausentes, concurrencia, cambio de etapa/sesión/rol y error de lectura.
No acredita permisos de backend, sesión humana, SQL, Firebase ni planta.

`npm test`: 462 PASS. `npm run verify:release`: PASS. Ver evidencia local en
`evidence/browser.json` y capturas `tracking-1440.png` / `tracking-390.png`.
Los dos enlaces locales a dependencias/vendor no forman parte de la entrega.

Siguiente acción: revisar este cambio aislado y resolver qué encabezado retirar;
la integración y publicación permanecen fuera de este encargo.

## Integración local con vidrio publicado

Main `9e4a8ecb90664d7296d1e77e241c4a9204d7ff50` incorporado a la rama local.
No implementación duplicada en main; solo conflictos de continuidad resueltos
conservando ambos historiales. `app.js` y controles de publicación idénticos a main.
Validación combinada: **469 tests PASS**, release PASS, navegador PC/móvil PASS,
política offline PASS y 7 postchecks PASS. La simulación pura de gate devuelve
HOLD / LP_ASSETS_NOT_APPROVED porque cambió `src/modules/lp01-operation.js`.
No se renuevan pins ni se publica. La versión Firebase de vidrio comunicada por
el hilo principal no se verificó independientemente desde este entorno.

## Aclaración resuelta: ambos bloques superiores

Confirmación «Los 2». Se retiran de Seguimiento el bloque «Seguimiento de órdenes»
(Línea, Buscar, Actualizar) y los accesos «Operación del turno»/«Cierres del turno».
Los controles compartidos y accesos siguen disponibles en Ensamble/Empaque;
la línea de Seguimiento es la del contexto seleccionado allí. No se eliminan
funciones, datos ni se afectan roles. El buscador oculto deja de filtrar Seguimiento.

Prueba ampliada con `production-line-tabs.js` real: ambos grupos invisibles en
Seguimiento, visibles en Ensamble/Empaque, acceso a reportes y regreso conservados;
PC y móvil PASS. Se mantienen ciclos de refresco, filtros, foco y permisos previos.
469 JS PASS y release PASS. Simulación de publicación HOLD por dos archivos:
`production-line-tabs.js` y `src/modules/lp01-operation.js`.

Para aprobar el paquete: revisar capturas y cambios locales; después autorizar
preparación del PR/CI sin despliegue. Antes de publicar, revisar artefacto exacto,
huellas, versión viva/recuperación vigentes y controles existentes. No usar los
pins anteriores de vidrio para este nuevo contenido. Ninguno se modificó aquí.

## Versión de esta entrega

Main LAB v380 → candidato LAB v381. Badge y cache-bust de app/CSS alineados con
releaseLabel; el sello conserva SHA/fecha. Verificación local real PC/móvil en
`evidence/version.json`. Tras publicación comprobar LAB v381 visible y
`#releaseVersion[data-release-commit]` igual al SHA fuente del artefacto final.
La comprobación productiva sigue pendiente; no se confunde con la local.

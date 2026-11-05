# Preparación frontend SALE tras Recepción

Base local: main e182f5379b74a5b77a325838bda5208f3a53fc7f (LAB v388).
Backend SALE instalado/habilitado por coordinador; no volver a ejecutar SQL.
Este delta local agrega solo frontend SALE y conserva todos los archivos de
Recepción. Sin PR, push, versión final ni CI final.

B10 PR199 (head 5a17276e32841e9bd965dcb61fa991340944af51) toca
`src/modules/lp01-operation.js` y `src/modules/lp01-tracking.js` además de
su CSS de Línea. La integración posterior debe partir del main que incluya B10:

- En `lp01-operation.js`, conservar `onAffectations({...,cause})` y el despacho
  del chip de causa. Agregar solo import `orderSaleTransport`, el proveedor
  asociado a sesión/línea/etapa y su opción en `renderTracking`.
- En `lp01-tracking.js`, conservar rótulo Afectaciones, chips por causa,
  `open(part,...,cause)`, panel inferior de ancho completo y su gestión de foco;
  Picking queda como origen de aluminio. Añadir solo `retainOrderSaleRows`,
  placeholder de la celda SALE global y preservar el proveedor en rerenders.
- Mantener intactos `lp01-affectation-summary.js`, `lp01-affectations-panel.js`,
  `lp01-tracking-affectations.js` y `lp01-followup.css` de B10. Las reglas de
  afectación no dependen de la definición persistente de SALE.
- `styles.css` conserva las reglas de Recepción y suma dos reglas `.lp-sale-*`.
  Renumerar `index.html` y `build-release-info.mjs` solo cuando main B10 esté
  publicado y se conozca la siguiente versión libre.

La aplicación normal en esta rama llama al lector/escritor SALE desde la fila.
La celda retiene su nodo durante filtros y refrescos; al cambiar ámbito/sesión
se destruye. El backend sigue devolviendo `operational:false` y
`temporalPolicy:UNRESOLVED`; no se modifica el SALE por turno.

Pruebas ya válidas, sin repetición en esta preparación: PostgreSQL nativo,
506 Node, PC1440/móvil390 con refresh/filtro/foco/panel, orden sin asignación,
reintento exacto y revocación. Tras rebase B10 ejecutar regresiones focalizadas
para panel inferior/chips/filtros/SALE y CI exacta del SHA final.

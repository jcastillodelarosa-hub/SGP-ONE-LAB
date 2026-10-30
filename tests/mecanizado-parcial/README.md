# Evidencia de programación parcial

Resultado local del 30/10/2026: **42/42 escenarios PostgreSQL aprobados** en 17.11,
contenedor `--network none`, con datos sintéticos. Detalle en
`integration-results.json`; no son pruebas productivas.

`evidence/browser-results.json` registra Chromium 1366×1000 y 390×844. Se ejecutan
el opener real extraído de `app.js`, el módulo real del formulario y las RPC reales
en PostgreSQL mediante una fachada HTTP local. Solo los datos del pool y su
refresco externo son fixtures; la asignación y el saldo se guardan en la base
aislada. Se prueban 90/288 y saldo 198, división, campos editables, fechas/turnos,
saldo cero, P1–P4, historial, Escape, filtros conservados y ancho móvil.

Capturas: `manual-1366.png`, `proposal-1366.png`, `proposal-390.png`,
`complete-1366.png` y `complete-390.png`.

`js-results.json`: 65 archivos JS de regresión aprobados ejecutados directamente,
además de `npm test`; 26 casos dirigidos de Picking/partes/arrastre se revalidaron
tras los últimos cambios. Sintaxis, `verify:release` y `git diff --check` aprobados.
La versión visual base LAB v371 se conserva; no se publicó una nueva versión.

La fixture usa el validador real capturado de sesiones/roles y tokens QA sintéticos,
sin `service_role`. Funciones compartidas de metadatos y validación de piezas PDT
tienen stubs explícitos: estas pruebas **no certifican** el ciclo completo PDT,
reservas compartidas, restauración productiva ni operación con usuarios de planta.

Instalación local/reproducción, contratos, riesgos y reversión:
[README de implementación](../../docs/sql-proposals/mecanizado/parcial/README.md).

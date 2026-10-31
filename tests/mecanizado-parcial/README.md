# Evidencia de programación parcial

Resultado local del 30/10/2026: **63/63 escenarios PostgreSQL aprobados** en 17.11,
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
además de `npm test`. Los casos dirigidos de Picking/partes/arrastre/avance base se revalidaron
tras los últimos cambios. Sintaxis, `verify:release` y `git diff --check` aprobados.
La versión visual base LAB v371 se conserva; no se publicó una nueva versión.

La base de pruebas se crea vacía con definiciones de catálogo consultadas en READ
ONLY; contiene datos y sesiones QA sintéticos. No se crean copias, respaldos ni
restauraciones de bases reales. No se usa `service_role`.

Se han eliminado los stubs de fuentes/actor/registro y la vista artificial de
reservas. `setup.py` carga funciones reales, vista, restricciones, índices,
triggers, ACL y RLS de las tablas implicadas. Las políticas externas de Auth no
se simulan ni se certifican: el acceso real de negocio se ensaya mediante RPC y
validador SGP capturado; no es una prueba del transporte PostgREST gestionado.
`real-function-evidence.json` prueba igualdad de huellas para 19 funciones núcleo
y la vista. Los contratos modificados se prueban como SQL REVIEW del PR.

`pdt-shared-cases.py` prueba con funciones reales: PANEL, fabricación, material
asociado de otro acabado, NC código/consecutivo, entrega incompleta, fuentes
agrupadas, auditoría y aislamiento por evento, validación, avances, saldo, recepción,
asignación y cierre; también una cabecera histórica y carreras de avances/entregas
PDT. El payload se produce con `registrationPieces` real a partir de fuentes SQL.
No se aprueba evidencia de otra parte ni del propio evento incompleto.

`physical-report-evidence.json` verifica el informe JS con contratos SQL y claves
homónimas: 90/288 procesadas y saldo 198. Las recepciones físicas de ese modelo son
DTO QA declarados; no acreditan material de planta. El cierre del PDT de P1 no
cierra P2–P4 ni la producción original, y las reposiciones suman 0 ventanas nuevas.

No se certifican uso con cuentas de planta, datos operativos, PostgREST/Auth
administrado, red corporativa ni dispositivos físicos: exigirían un entorno y
operaciones autorizados aparte. No se hicieron operaciones productivas.

Reproducción, contratos, riesgos y reversión:
[README de implementación](../../docs/sql-proposals/mecanizado/parcial/README.md).

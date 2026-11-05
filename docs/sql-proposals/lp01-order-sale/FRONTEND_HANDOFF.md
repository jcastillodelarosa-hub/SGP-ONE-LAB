# SALE v390 · integración sobre B10 publicado

Base main 13f50e95e97fe23707ec1a18deec9398c2883e87, Recepción v388 y
B10 v389 incluidos. Backend SALE instalado/habilitado por coordinación;
no repetir SQL. Frontend de la fila guarda definición por orden/etapa e
historial, con `operational:false` y `temporalPolicy:UNRESOLVED`; no cambia
SALE de turnos. El panel B10 conserva ancho inferior completo, chips por causa,
rótulo Afectaciones y Picking como origen de aluminio.

Version visible LAB v390. Baseline/rollback Hosting v389:
`sites/sgp-one-lab/versions/93bde8b172480952`. Publicación v389 verificada
por coordinación, run 42073197726 SUCCESS, 106 archivos.

Pruebas del SHA final: Node, verify:release, PostgreSQL sintético y navegador
PC/móvil para SALE/B10; CI debe corresponder al commit final de política.

# LP-01 E4 — Arrastrar y programar (implementación simplificada)

PR #170, rama `feat/lp01-e4-programacion-grupos`. No fusionado ni publicado.

## Alcance
- Calendario semanal de dos turnos; arrastre individual, por parte y por reserva, con selección táctil y confirmación.
- Programación individual y de grupos mediante la RPC **existente** `sgp_linea_plan_programar`. Para grupos se envía una llamada secuencial por producción, con cantidad y prioridad editables.
- Movimiento individual o parcial mediante `sgp_linea_plan_mover`; consulta de asignaciones mediante `sgp_linea_plan_consultar`.
- El servidor valida saldo global, sesión y permisos en cada operación. La vista previa de grupo **no** afirma conocer el saldo global a partir de la semana visible.
- Guardado parcial: se presentan aceptadas y rechazadas. No hay transacción atómica grupal. Ante resultado incierto se bloquea el reenvío y se pide revisar calendario antes de reintentar solo pendientes.

## Simplificación aprobada
Se descartaron las nuevas RPC grupales, el ledger de idempotencia, el puente servidor y las propuestas de migración SQL. No se necesitan cambios de permisos ni Gateway. Los archivos de SQL y pruebas sintéticas exclusivas de esa solución se retiraron del PR.

## Evidencia y pendientes
- Checks GitHub `SGP ONE Tests` y `JavaScript syntax check` aprobados en commit `98adc75d` (antes de la limpieza documental).
- Capturas PC/móvil y prueba de arrastre sintética disponibles en `docs/evidence/lp01-e4/` y `tests/lp01-e4-browser.py`; no constituyen validación productiva.
- Pendiente comprobar los checks del HEAD final y probar desde PC y móvil con datos de prueba: arrastre individual, varias órdenes, saldo insuficiente, movimiento parcial, guardado parcial y refresco de calendario.
- PR permanece Draft; fusión y despliegue requieren autorización expresa.

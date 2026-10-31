# LP-01 E4 — checkpoint de implementación

Base: `main` `5bd131bec310fb096f47c13854b1c5ead16d32f4` (LAB v372). Rama: `feat/lp01-e4-programacion-grupos`.

## Implementado en rama

- El diálogo de producción llama directamente a `sgp_linea_plan_programar` tras la confirmación explícita. El botón se bloquea durante la petición, muestra rechazo del servidor y actualiza el calendario tras éxito. Se conserva «Preparar formulario».
- Encabezados de parte y reserva arrastrables. El diálogo de grupo muestra producciones distintas por `key_produccion`, saldo Export y asignaciones **visibles en la semana consultada**, sin inferir que la diferencia sea el saldo programable. El guardado de grupos está deshabilitado.
- Las tarjetas de asignación son arrastrables al calendario para mover la asignación identificada mediante `sgp_linea_plan_mover`; no crean otra programación. Se permite solo mover la cantidad completa hasta certificar la división en el contrato instalado.
- Vidrios Prep./Nov./Trasl. agregados en partes y reservas a partir de los mismos detalles del explorador. Se evita duplicar una producción por clave; cualquier dato ausente muestra «—». La producción conserva sus indicadores.

## Evidencia

- 21 pruebas Node dirigidas del planificador: aprobadas.
- `tests/lp01-e4-browser.py` con Chromium, RPC sintéticas, 1440×900 y 390×844: arrastre, cancelación sin escritura, confirmación directa, grupos sin escritura, movimiento, navegación semanal, Tabla/Kanban: aprobado.
- Capturas sintéticas en `docs/evidence/lp01-e4/`. No prueban datos ni permisos productivos.
- `npm run verify:release`: aprobado; LAB v372.

## Bloqueo preciso para completar E4-I

El repositorio no contiene los cuerpos instalados de `sgp_linea_plan_programar`, `sgp_linea_plan_mover` ni la definición exacta de persistencia de asignaciones. No hay acceso Supabase autenticado en esta sesión. Los datos de `sgp_linea_plan_consultar` abarcan solo la semana consultada, y `saldo_ensamble` es un saldo oficial Export, no el saldo sin programar. Por ello no se puede certificar una RPC agrupada parcial que controle todos los saldos, reintentos y concurrencia, ni presentar la vista previa como «pendiente exacto». El contrato instalado de división parcial de `sgp_linea_plan_mover` también queda sin certificar. No se preparó una migración especulativa ni se hicieron escrituras productivas.

## Próximo paso exacto

Obtener en lectura `pg_get_functiondef` de `sgp_linea_plan_programar`, `sgp_linea_plan_mover`, `sgp_linea_plan_consultar`, y DDL de sus tablas, restricciones, triggers y permisos. Con ese contrato, preparar la RPC agrupada REVIEW con bloqueo por producción, clave de idempotencia y resultado individual; probar en PostgreSQL 17 aislado, incluyendo parcial, rechazo, concurrencia, reversión y roles. Mantener el botón grupal deshabilitado hasta instalación autorizada.

## Reversión

Los cambios de esta rama son frontend y pruebas. Revertir el commit retira las interacciones E4 sin alterar asignaciones ni saldos. No existe migración que revertir.

Estado: **IMPLEMENTADO PARCIALMENTE EN RAMA; VERIFICADO LOCALMENTE CON DATOS SINTÉTICOS; NO APLICADO; NO PUBLICADO**.

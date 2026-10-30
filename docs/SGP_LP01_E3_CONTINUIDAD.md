# LP-01 Programación E3 · checkpoint

Estado: **IMPLEMENTADO EN RAMA**, **VERIFICADO LOCALMENTE CON DATOS SINTÉTICOS**, no fusionado, no publicado, sin cambios en Supabase.

Base: `main` LAB v369, `e64fa4f48726010662b93b5c4b525c653407fa9b`. Rama: `feat/lp01-programacion-e3`.

## Interfaz y contratos reutilizados

- `planner-readonly-v326.js` conserva el explorador autenticado y su jerarquía reserva → parte → producción. La vista E3 muestra REC. SÍ/NO/—, TPO disponible, sistema, acabado, ventanas, vidrio Prep./Nov./Trasl. y estado de mecanizado por producción. Reserva y parte muestran MIXTO si sus producciones difieren, con conteo de avance. El estado almacenado no cambia. Las observaciones de Mecanizado se muestran si la fuente consultada las entrega; usuario/fecha solo si esos campos existen.
- `planner-operations-v326.js` conserva `sgp_linea_plan_consultar`, `sgp_linea_plan_programar` y `sgp_linea_plan_mover`. Cada asignación mantiene su propia prioridad. Se añade confirmación explícita con advertencias no bloqueantes de recepción, mecanizado, capacidad y asignaciones ya consultadas. El servidor sigue siendo quien valida permisos, cantidades y concurrencia.
- `src/modules/lp01-workspace-e3.js` coloca el explorador junto al calendario en PC; el separador se ajusta con puntero o teclado y en móvil se apilan. Sincroniza la línea con el control existente. El arrastre de una producción prepara fecha/turno en el formulario solo tras confirmación; no escribe. La capacidad 90 es orientativa y editable solo en esta vista.
- Seleccionar reserva o parte completa prepara la selección existente. Su guardado agrupado permanece **bloqueado**: el proyecto no dispone de RPC transaccional autorizada para escritura atómica por lote. La programación individual y el movimiento/división individual mantienen sus contratos vigentes.
- LP-02 y Reporte de ubicaciones no fueron modificados.

## Referencia visual

B05–B07 se revisaron directamente en los PDF aportados. El PDF maestro que incluye B04 supera el límite de transferencia de esta sesión; no pudo contrastarse su imagen. Se siguió la disposición izquierda/derecha que el propietario describió para E3. Antes de aprobación visual final, comparar este PR con B04 si el archivo queda accesible.

## Evidencia y límites

- `python tests/lp01-e3-browser.py`: PC 1440×900 y móvil 390×844. Capturas en `docs/evidence/lp01-e3/`, rotuladas como datos sintéticos. Incluye explorador MIXTO/REC., siete días, capacidad y sobrecupo, tabla, Kanban, cancelación de guardado y de arrastre sin RPC de escritura, sin errores JS.
- Pruebas dirigidas de planificador, línea y navegación: 32/32.
- `npm run build:vendor` y `npm run verify:release`: correctos, LAB v369. `git diff --check`: correcto.
- Pendiente: sesión autorizada para comprobar lecturas reales, representación de observaciones con usuario/fecha si la RPC las entrega y la comparación visual exacta con B04. Las capturas sintéticas no prueban disponibilidad productiva ni permisos reales.

## Siguiente paso

Revisar el PR Draft. Para habilitar escritura agrupada, diseñar y probar una RPC atómica con control de asignaciones existentes, reserva compartida, idempotencia y concurrencia; requiere autorización separada para SQL productivo. No usar una secuencia de llamadas individuales como sustituto.

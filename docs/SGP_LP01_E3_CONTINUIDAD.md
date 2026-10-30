# LP-01 Programación E3 · checkpoint

## Corrección de arrastre por tarjeta y táctil · LAB v371

Estado: **IMPLEMENTADO EN RAMA, VERIFICADO LOCALMENTE CON DATOS SINTÉTICOS**. Rama `fix/lp01-production-card-drag-v371`, base `main` `3389d98db9eec003b6bbf662bb81bc8eb3f964a5`. No fusionado, no publicado y sin cambios en Supabase.

- `src/modules/lp01-workspace-e3.js`: la tarjeta completa de producción inicia HTML Drag and Drop en PC; sus celdas muestran destino disponible y resaltan el destino bajo el ratón. En móvil, una pulsación prolongada inicia un movimiento táctil real, muestra la producción seleccionada y permite desplazar página y calendario horizontalmente antes de soltar. Tocar una tarjeta y después cualquier celda ofrece una alternativa sin arrastre. Teclado: la tarjeta acepta Enter/Espacio y después puede seleccionarse la celda.
- Los tres caminos comparten **un solo diálogo**. Cantidad y prioridad son editables; cancelar no altera el formulario; «Preparar formulario» precarga los campos existentes y **no escribe**. Solo el botón Programar, seguido de su confirmación, puede invocar `sgp_linea_plan_programar`. El guardado agrupado continúa deshabilitado.
- `python tests/lp01-e3-browser.py`: ratón PC 1440×900 desde la tarjeta completa; flujo táctil Chromium por `Input.dispatchTouchEvent` en 390×844, con pulsación prolongada, autodesplazamiento y soltado en jueves/T2; alternativa toque/tarjeta; cancelación sin cambios de prioridad ni RPC de escritura; regresión de 14 celdas, semanas, Tabla y Kanban. Capturas sintéticas rotuladas en `docs/evidence/lp01-week-grid/`.
- Regresión dirigida: 32/32. `npm run build:vendor`, `npm run verify:release` (LAB v371), sintaxis JS y `git diff --check`: correctos.
- Límite: la prueba usa datos y respuestas RPC sintéticos. Falta verificación con sesión autorizada y dispositivos físicos de la planta; no implica despliegue ni validación productiva.

## Corrección de cuadrícula y arrastre · LAB v370

Estado: **IMPLEMENTADO EN RAMA Y VERIFICADO LOCALMENTE CON DATOS SINTÉTICOS**; no fusionado ni publicado. Rama `fix/lp01-week-grid-drag-e3`, base `main` `44d7e44412438829b92cfbb0594496373c819997`.

- `planner-operations-v326.js` consulta siempre el intervalo lunes–domingo seleccionado. Flechas, Hoy y selector ISO de semana generan una nueva llamada a `sgp_linea_plan_consultar`; las respuestas anteriores no reemplazan una navegación más reciente. La vista Calendario presenta siete columnas y dos filas de turnos, con asignaciones, prioridad, desglose por sistema y capacidad en cada celda. Tabla y Kanban conservan la misma fuente.
- `src/modules/lp01-workspace-e3.js` oculta el bloque vertical redundante de pendientes dentro de LP-01. El explorador permanece disponible para seleccionar y programar. Soltar una producción en cualquier celda abre un diálogo con fecha y turno precargados, cantidad y prioridad editables. Cancelar no cambia nada; «Preparar formulario» solo llena el formulario individual existente. La escritura requiere pulsar Programar y confirmar nuevamente. La escritura agrupada continúa bloqueada.
- Prueba dirigida `python tests/lp01-e3-browser.py`: 14 celdas, consultas al navegar entre semanas, capacidad/sobrecupo, arrastre a lunes/T1 y jueves/T2, cancelar/preparar sin RPC de escritura, Tabla/Kanban; PC 1440×900 y móvil 390×844. Capturas rotuladas **DATOS SINTÉTICOS** en `docs/evidence/lp01-week-grid/`. En móvil se conserva selección por toque y desplazamiento horizontal del calendario.
- Regresión dirigida: 32/32; sintaxis JS y `git diff --check` correctos. `npm run build:vendor` y `npm run verify:release` correctos para LAB v370.
- Pendiente para aceptación productiva: lectura con sesión autorizada y revisión visual de B04 cuando el PDF maestro sea accesible. Las capturas no prueban permisos ni datos productivos. No se modificaron Supabase, LP-02, Picking ni Reporte de ubicaciones.

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

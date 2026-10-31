# LP-01 E4 — checkpoint de revisión

Base: `main` `5bd131bec310fb096f47c13854b1c5ead16d32f4` (LAB v372). Rama y PR: `feat/lp01-e4-programacion-grupos`, #170 Draft.

## Contratos confirmados por lectura de Supabase proporcionada por el propietario

`sgp_linea_plan_programar(text,text,date,integer,integer,integer)` devuelve UUID, valida ADMINISTRADOR/COORDINADOR, bloquea `sgp_producciones`, suma asignaciones no CANCELADA de todas las fechas y rechaza sobrepasar `saldo_ensamble`. `sgp_linea_plan_mover(text,uuid,date,integer,integer,integer)` devuelve UUID y admite división parcial si no hay ejecución. `sgp_linea_plan_consultar` solo cubre el intervalo pedido. Las tres RPC existentes permiten EXECUTE a anon/authenticated/service_role/postgres. `sgp_producciones.key_produccion` es PK y `saldo_ensamble` es numeric; asignaciones y ejecuciones tienen los campos, índices y RLS enumerados en el encargo del 31/10/2026. Los cuerpos literales no están versionados aquí; la RPC grupal delega la escritura a la función instalada sin sustituirla.

## Implementado en rama

- Confirmación directa individual; una llamada RPC por confirmación, sin segundo diálogo, con bloqueo de doble envío y resultado servidor. Se mantiene el formulario previo.
- Parte y reserva arrastrables; agrupaciones deduplicadas por `key_produccion`. La vista previa inicial solo muestra cifras Export y asignaciones de la semana. Cuando la nueva RPC está habilitada, consulta `sgp_linea_plan_saldos_grupo_v1` para mostrar saldo global y cantidades elegibles; el servidor revalida al confirmar.
- `01_programacion_grupal_parcial_REVIEW.sql`: preflight de firmas/columnas, ledger de idempotencia, RPC de saldos globales y RPC grupal. Cada producción delega en `sgp_linea_plan_programar` dentro de una subtransacción; devuelve aceptadas, rechazadas, ventanas programadas y pendientes. El UUID de solicitud impide duplicar reintentos y las escrituras concurrentes se serializan por los bloqueos de la RPC individual.
- Movimiento de asignación concreta, incluida cantidad parcial, mediante `sgp_linea_plan_mover`. El diálogo muestra origen y destino. Se mantienen indicadores de vidrio agregados en reserva, parte y producción.
- El guardado de grupos requiere `window.SGPLP01_GROUP_RPC_ENABLED === true`. **La rama no lo activa**.

## Pruebas y límites

- PostgreSQL 17 aislado con un sustituto sintético de la RPC individual que reproduce roles, lock y saldo global: instalación transaccional; lote parcial y totalmente rechazado; reintento; solicitud modificada; duplicado interno; rol inválido; consulta de saldos; rollback. Dos sesiones PostgreSQL compiten por la misma producción: una acepta y otra rechaza; dos sesiones con el mismo UUID persisten una sola asignación. No es una restauración de producción ni certifica el cuerpo literal de las RPC instaladas.
- 21 pruebas Node dirigidas aprobadas. Chromium PC 1440×900 y móvil 390×844: confirmación individual, arrastres de parte/reserva, grupo habilitado solo con bandera sintética, movimiento parcial, calendario y Tabla/Kanban. Capturas sintéticas en `docs/evidence/lp01-e4/`.
- `npm run verify:release` y `git diff --check`: aprobados.

## Seguridad y bloqueo restante para aplicación

La migración REVOCA EXECUTE a PUBLIC, anon y authenticated en las dos RPC nuevas y no concede nuevos privilegios. La aplicación existente usa sesión SGP con cliente Supabase cuya función efectiva puede ser `anon`; no se ha demostrado un camino autenticado alternativo para llamar las nuevas RPC sin ampliar privilegios. La funcionalidad grupal permanece deshabilitada hasta definir y aprobar ese camino, instalar la migración y validar las RPC contra la base real. No se modifican permisos de tablas ni RLS. No se ha aplicado SQL ni publicado Firebase.

## Instalación y reversión propuestos

1. Revisar cuerpos instalados y permisos efectivos de las nuevas RPC con el responsable de Supabase; decidir un camino de ejecución autorizado sin introducir acceso anónimo nuevo.
2. Instalar el SQL REVIEW en una ventana autorizada, primero en una restauración compatible y luego, con aprobación separada, en producción. Probar roles, saldos, lotes parciales, reintentos y concurrencia.
3. Habilitar la bandera de frontend únicamente después de validar la instalación y el acceso del cliente autorizado; publicar por el flujo controlado.
4. Para revertir, deshabilitar la bandera, detener solicitudes nuevas y ejecutar `01_programacion_grupal_parcial_ROLLBACK.sql` tras verificar operaciones en curso. Conservar asignaciones y ledger de idempotencia; no deshacer programaciones aceptadas automáticamente.

Estado: **IMPLEMENTADO EN RAMA; VERIFICADO EN AISLAMIENTO CON CONTRATOS SINTÉTICOS; NO APLICADO; NO PUBLICADO; PENDIENTE DE VALIDACIÓN CONTRA INSTALACIÓN REAL**.

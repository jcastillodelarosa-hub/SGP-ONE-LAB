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

- PostgreSQL 17 aislado con un sustituto sintético de la RPC individual que reproduce roles, lock y saldo global: instalación transaccional; lote parcial y totalmente rechazado; reintento; solicitud modificada; duplicado interno; rol inválido; consulta de saldos (incluidos producción CERRADA activa y saldo numérico 2,5); invocación denegada desde `anon`/`authenticated`; rollback. Dos sesiones PostgreSQL compiten por la misma producción: una acepta y otra rechaza; dos sesiones con el mismo UUID persisten una sola asignación. No es una restauración de producción ni certifica el cuerpo literal de las RPC instaladas.
- 21 pruebas Node dirigidas aprobadas. Chromium PC 1440×900 y móvil 390×844: confirmación individual, arrastres de parte/reserva, grupo habilitado solo con bandera sintética, movimiento parcial, calendario y Tabla/Kanban. Capturas sintéticas en `docs/evidence/lp01-e4/`.
- `npm run verify:release` y `git diff --check`: aprobados.

## Seguridad y bloqueo restante para aplicación

El cliente de `src/services/supabase-client.js` usa la clave publicable y `auth.persistSession=false`, sin inicio de sesión Supabase Auth. `app.js` entrega al planificador un token SGP separado (`p_token`). Por tanto, el rol SQL esperado del navegador es `anon` mientras no se demuestre otra identidad. Las RPC instaladas individuales conceden EXECUTE a `anon`, pero la migración nueva REVOCA EXECUTE a PUBLIC, `anon` y `authenticated`. En PostgreSQL aislado, una llamada como `anon` o `authenticated` fue denegada antes de validar `p_token`. La ruta actual del navegador **no puede ejecutar** las nuevas RPC. No hay un camino de privilegio mínimo implementado dentro del alcance sin autorizar un nuevo EXECUTE para `anon` o introducir un servicio de confianza distinto. No se concede `service_role` al navegador. Esta decisión de acceso requiere revisión de seguridad y autorización independiente; la bandera grupal permanece apagada. No se modifican permisos de tablas ni RLS. Las RPC y ledger siguen ausentes de producción según la lectura aportada por ChatGPT.

La función de saldo ahora replica la elegibilidad descrita de `sgp_linea_plan_programar`: `activa='SI'`, saldo inicializado y suma global de asignaciones no CANCELADA. No descarta `CERRADA` ni `FINALIZADA` por una regla adicional. Para la cantidad entera programable, toma el piso del saldo numérico positivo. El servidor individual sigue siendo la autoridad en la escritura; la vista previa puede quedar obsoleta entre consulta y confirmación.

Revisión de puente servidor: `docs/SGP_LP01_E4_PUENTE_SERVIDOR_REVIEW.md`. `functions/sgpGateway` es un proxy con clave publicable que reenvía las peticiones; no autentica el token SGP ni aporta otro rol SQL. El workflow de Hosting no despliega Functions. No existe un puente autenticado reutilizable en la arquitectura actual. Un endpoint específico con rol SQL técnico restringido y secreto administrado sería viable como propuesta, pero requiere recursos, configuración y aprobación de seguridad nuevos. No se ha implementado ni probado un cliente real con esos permisos. La bandera grupal continúa apagada.

## Instalación y reversión propuestos

1. Revisar con seguridad el rol SQL efectivo del navegador y elegir explícitamente entre un puente servidor autenticado con permisos limitados o una autorización excepcional y justificada de EXECUTE a `anon` para estas RPC, conservando la validación del token SGP. El SQL REVIEW actual no concede ese permiso; sin decisión, no activar la bandera.
2. Instalar el SQL REVIEW en una ventana autorizada, primero en una restauración compatible y luego, con aprobación separada, en producción. Probar roles, saldos, lotes parciales, reintentos y concurrencia.
3. Habilitar la bandera de frontend únicamente después de validar la instalación y el acceso del cliente autorizado; publicar por el flujo controlado.
4. Para revertir, deshabilitar la bandera, detener solicitudes nuevas y ejecutar `01_programacion_grupal_parcial_ROLLBACK.sql` tras verificar operaciones en curso. Conservar asignaciones y ledger de idempotencia; no deshacer programaciones aceptadas automáticamente.

Estado: **IMPLEMENTADO EN RAMA; VERIFICADO EN AISLAMIENTO CON CONTRATOS SINTÉTICOS; NO APLICADO; NO PUBLICADO; BLOQUEADO PARA USO DEL CLIENTE ACTUAL HASTA DECISIÓN DE ACCESO Y VALIDACIÓN REAL**.

## Revisión complementaria de preimplementación — 2026-10-31

Inspección de solo lectura contra Supabase real (sin ejecutar RPC de escritura):

- `sgp_linea_plan_consultar`, `sgp_linea_plan_mover` y `sgp_linea_plan_programar`: propietario `postgres`, `SECURITY DEFINER`, EXECUTE efectivo para `anon` y `authenticated`.
- `sgp_validar_sesion_rol`: propietario `postgres`, `SECURITY DEFINER`, sin EXECUTE directo para `anon` ni `authenticated`.
- Las RPC E4 `sgp_linea_plan_programar_grupo_v1` y `sgp_linea_plan_saldos_grupo_v1` todavía no están instaladas en la base consultada.
- La validación instalada usa hash SHA-256 de token, sesión no revocada y no vencida, usuario activo y rol autorizado; no se leyeron tokens ni datos de sesiones.
- Checks GitHub del commit `d8c3a1af4e7bfb2cb275f3f707550252ffc89b7e`: JavaScript syntax check y SGP ONE Tests, ambos `success`.

**Pendientes de seguridad antes de autorización productiva:**

1. Ejecutar pruebas de invocación efectiva `anon` contra las RPC E4 en una restauración aislada con la concesión condicional, con token ausente/inválido/revocado/vencido, usuario inactivo, roles sin permiso y token válido autorizado; confirmar denegaciones sin cambios.
2. Ensayar límites de tasa y tamaño de solicitudes frente a abuso, y revisar que `SQLERRM` devuelto en rechazos no filtre detalles internos.
3. Repetir integración de lote parcial, concurrencia, idempotencia y rollback usando los cuerpos literales de RPC instaladas en una restauración compatible, no únicamente sustitutos sintéticos.
4. Comprobar permisos efectivos de `PUBLIC`, `anon`, `authenticated` y `service_role` tras instalación aislada, así como propietario, `search_path`, RLS y ausencia de privilegios directos sobre el ledger.
5. Ensayar desde navegador con sesión SGP autorizada y un dispositivo real antes de declarar verificación productiva.

Esta inspección **no sustituye** las pruebas aisladas de permisos ni autoriza `GRANT EXECUTE` productivo. El guardado agrupado sigue apagado.

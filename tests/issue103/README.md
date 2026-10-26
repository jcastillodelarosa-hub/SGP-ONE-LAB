# Issue #103 — Avance físico por sistema / LAB v359

Estado: IMPLEMENTADO EN RAMA — VERIFICADO LOCALMENTE — LISTO PARA REVISIÓN FINAL.
PR104 sigue Draft, sin fusionar ni publicar.
Base inicial: `7be93c644ee402f051a237fbd2fb7564faf7bbaa` (PR102/LABv358).
Base vigente incorporada: main `cc3ef6f11fb5bb4142b494a32483b6cdf4c1fbf5` (PR107 fusionado).
Rama: `feat/issue-103-weekly-system-progress`. Contrato: Issue103 de GitHub.


## Sincronización de PR107 (26/10/2026, Colombia)

Se incorporan completos los hotfixes de main: contención real de `.daily-tabs`,
app-shell, topbar y tablas; cache-bust CSS359.1 e indicador **solo LAB v359**.
El SHA de build sigue en data-release-commit y title. El test del generador exige
texto visible exacto y conserva trazabilidad; el verificador visual opcional se
adapta al formato simple sin realizar consultas a producción.

Puente app.js y agregado de dominio idénticos al SHA anterior f7ccf42. Índice, CSS
y generador iguales a main/PR107. Hashes en evidence/pr107-sync.json. Se conservan
cálculos, filtros, barras, indicadores y prevención de duplicación/ceros ficticios.

Se repiten 287/287JS, verify:release y browser PC1366/móvil390. Ahora la prueba de
Issue103 usa la estructura real completa de index.html, scripts operativos retirados
y RPC sintéticas; comprueba badge exacto, anchura de topbar, scroll interno de las
cinco daily-tabs, tabla/avance y filtros. No hace login ni operaciones productivas.
Regresiones PDT y calendario también repetidas. Las capturas completas y resultados
se renuevan conservando evidencia histórica de Issue99. No se repiten las lecturas
productivas iniciales ni se modifica Supabase. CI del nuevo SHA se registra en PR104.

## Uso

Mecanizado → Programación semanal → Resumen → **Avance de mecanizado por sistema**.
Indicadores Programadas/Procesadas/Pendientes/Avance y tabla ordenable por sistema,
cantidad o porcentaje. En móvil, filas como tarjetas sin desbordamiento. Reutiliza
el filtro de una o varias semanas de origen y el selector de sistema existentes.
No se crea una pestaña, módulo funcional independiente ni un nuevo flujo operativo.

La carga operativa inferior conserva sus métricas/calendario por día y turno. El
avance acumula unidades únicas de las semanas de origen seleccionadas, aunque una
asignación se haya trasladado fuera de las fechas visibles. Se explica esa diferencia
en pantalla; no se filtra silenciosamente el denominador por la fecha calendario.
No hay gráfico diario de avance: los estados por orden no incluyen cantidad parcial
por turno y no permiten atribuir correctamente esa cantidad a una jornada.

## Fuentes y contrato de cantidades

| Información | Fuente exacta | Uso |
|---|---|---|
| Programación canónica | `progSchedule`, resultado existente `sgp_mecanizado_programacion_listar(p_token)`; `id_programacion`, reserva, producción, sistema, acabado, cantidad_programada, fecha/turno, prioridad_semanal y estado | Una asignación por UUID; no filas de carga/arrastre. Canceladas/REPROGRAMADO excluidas como asignaciones activas, conservadas como orígenes de la cadena si están disponibles. |
| Ejecución agregada | SELECT autorizado `sgp_mecanizado_ejecucion(id_programacion,estado,cantidad_procesada)` | PROCESADO acredita cantidad canónica, misma regla `shiftReportExecuted`. Otros estados usan cantidad_procesada no negativa y acotada al programado. Estado del encabezado de programación solo no acredita nada. |
| Ejecución por orden | SELECT `sgp_mecanizado_ejecucion_orden(id_programacion,produccion,estado)` | PROCESADO acredita su asignación concreta, no todo el encabezado. La tabla no ofrece cantidad parcial por orden: no se inventa. |
| Cantidad/identidad de órdenes de una parte | RPC existente `sgp_mecanizado_cobertura_ordenes(p_token,p_semana:null)`, cantidad, producción, prioridad_semanal, reserva y estado_orden | Se usa PROGRAMADA y se exige una identidad PANEL unívoca en el maestro y suma exacta contra el encabezado. No multiplica una reserva compartida ni atribuye arbitrariamente una orden. |
| Semana y maestro PANEL | SELECT `sgp_produccion_reservas_v(key_produccion,id_linea,reserva,produccion,semana_produccion,acabado_reserva)` | Semana explícita del origen cuando existe; en su defecto correspondencia unívoca con maestro, filtrada por PANELES_2/reserva/producción/acabado. No se infiere de la fecha calendario ni solo de las semanas seleccionadas. |
| Traslados | `progMoves`, RPC segura existente `sgp_mecanizado_reprogramaciones_listar(p_token)` | Cadena id_origen→id_destino para conservar semana original. Mismo sistema/reserva. Sin SELECT directo de la tabla ni nuevo permiso. |

Detalles de deduplicación:

- Repetir id_programacion/ejecución iguales no suma de nuevo; copias contradictorias
  producen error. Las filas ARRASTRE se descartan antes de agregar.
- Traslado completo: solo la asignación destino activa cuenta, con la semana del
  origen raíz; cadenas no suman cada eslabón. No se agrupa por nombre de producción
  entre sistemas o reservas distintos.
- Traslado parcial: saldo fuente derivado de órdenes canónicas restantes. Se acepta
  encabezado original o ya reducido únicamente si las sumas coinciden exactamente;
  no se resta dos veces. Se suma el destino una sola vez. Un origen faltante, ciclo,
  identidad contradictoria o detalle no verificable queda excluido con advertencia.
- Un agregado parcial en un origen parcialmente trasladado no permite saber qué
  unidades quedaron allí; se excluye con advertencia, no se distribuye por suposición.
- No se suman contadores agregados y por orden: cuando ambos indican cantidades
  parciales distintas que no pueden conciliarse, se excluye esa asignación. Si el
  agregado es cero, las órdenes PROCESADO verificadas sí aportan avance parcial.
- Pendientes = programadas − procesadas. Porcentaje ponderado = total procesadas /
  total programadas, no promedio de porcentajes. Cero programadas muestra «—».
- Registros sin semana/identidad inequívoca se excluyen y se muestra **totales solo
  de programaciones conciliadas / cobertura incompleta**. Si no queda ninguna,
  se muestra ausencia de cantidades conciliadas, no un cero presentado como total.
  No se investigan ni modifican los53 registros históricos sin semana.

## Lecturas, filtros y seguridad

Puente en `app.js`: `window.SGPWeeklyPhysicalProgress`; agregado puro añadido al
archivo de dominio existente `mecanizado-operational-load.js`. UI integrada en
`weeklyDashboard()` de `programacion-subtabs-v350.js`, no una pantalla separada.

Cliente `getMecanizadoReadClient`, sesión SGP obligatoria y cobertura por RPC con su
autorización existente. No service_role, contraseñas, nuevas RPC ni SQL. RLS/ACL intactos.
Tres lecturas REST agrupadas por150 identificadores, páginas500 ordenadas, más una
RPC de cobertura global. No se consulta una RPC por orden/reserva. Error en cualquier
lectura/página invalida toda la consulta; no se entrega un prefijo como total.

Snapshot30s/sesión, una petición simultánea compartida. Sistema/orden de tabla son
locales; cambiar semanas reutiliza el snapshot dentro del TTL. Cambiar Programación
o refrescar invalida la captura. Las respuestas de filtros anteriores se descartan;
sesión cambiada invalida datos. Refresco manual conserva filtros y vuelve a consultar.
Un fallo muestra error y reintento, sin ceros ni totales anteriores.

## Evidencia real de lectura (sin escrituras)

`evidence/read-access.json`: GET con la clave publishable ya usada por la aplicación,
sin impersonar una sesión ni usar permisos elevados. Se comprobaron columnas y
lectura completa del resultado: 76 encabezados, 55 ejecuciones y163 ejecuciones por
orden; cantidades/estados agregados sin exportar identidades, usuarios o notas.
La tabla privada de detalles devolvió401: **no se utiliza ni se modifica su acceso**.
Ejemplo real de encabezado/ejecución PROCESADO: programadas43, cantidad registrada43,
regla operacional43. Es comprobación de ese contrato, no un total semanal conciliado.

No había sesión SGP disponible en este entorno para ejecutar las RPC protegidas de
cobertura/traslados con un rol real. Sus firmas y campos se reutilizan del código
vigente. La consulta real completa de la nueva interfaz por cada rol sigue pendiente;
no se presenta el ejemplo real como prueba end-to-end. No se solicitaron secretos.

## Pruebas ejecutadas

- `npm test`: **287/287** aprobadas, incluidas16 nuevas: agregación, parciales,
  PROCESADO, cero/sin datos, semanas múltiples, sistemas, duplicados, arrastres,
  traslado completo/cadena/parcial y fuente ya reducida, ambigüedad, errores,
  paginación501filas y sesión ausente. Conserva las pruebas de PR101/102.
- `npm run verify:release`: LABv359 autocontenido. Sintaxis app.js, resumen y dominio,
  Python y YAML; `git diff --check` aprobados.
- `python tests/issue103/browser.py`: Chromium PC1366×1000 y móvil390×844,
  resumen/puente/cálculo reales y cliente con fixtures. HTTPS externo bloqueado.
  Semana44: programadas75/procesadas62/pendientes13 frente a carga132 (arrastre
  repetido). Semanas44+45:95/82/13; sistemaMX:28/23/5; destino con semana45 conserva
  origen44. Ordenación, respuestas tardías, lectura fallida sin ceros, reintento,
  sesión cambiada y ausencia de overflow durante los resultados aprobados.
  Cuatro consultas iniciales del nuevo puente; cero adicionales por filtros dentro
  del TTL. Estos números son sintéticos, **no datos productivos ni del boceto**.
- `python tests/issue99/browser-pdt.py`: PC/móvil aprobados sin reabrir PDT,
  contexto, etapas, Picking y prevención de duplicados intactos. Resultado y capturas
  copiados a `evidence/pdt-regression*`; evidencia histórica de Issue99 preservada.
- `SGP_QA_OUT=/tmp/issue103-calendar python tests/issue97/browser.py`: PC/móvil,
  caso26/10/2026T1 **8+57=65**, ambos calendarios, cierre/scroll y sin escrituras.
  Resultado conservado en `evidence/calendar-regression.json`.
- No se repiten pruebas SQL aisladas: no se modificó SQL ni contratos PDT. Métricas
  históricas de rendimiento358 se conservan; no se declaran nuevas latencias reales.

Capturas del resumen completo y sección: `evidence/progress-{1366,390}.png`,
`evidence/progress-detail-{1366,390}.png`; fallo: `evidence/error-{1366,390}.png`.
CI remoto final y SHA se registran en el PR Draft.

## Límites y siguiente paso

- Validar con sesión SGP real de roles autorizados/rechazados el payload de cobertura
  y el resumen completo; no probado desde planta ni móvil físico.
- La semana del maestro es la fuente verificable disponible, no una nueva historia
  inmutable. Si cambió sin conservar su origen y no existe semana explícita, no se
  reconstruye esa historia. Las correspondencias ambiguas quedan advertidas.
- Varias lecturas REST no son una transacción serializable; cambios concurrentes
  pueden requerir refresco y conciliación. No se inventan saldos ante inconsistencias.
- Sin cantidad parcial por orden o atribución de ejecución a turno no se distribuyen
  cantidades ni se crea un gráfico diario con cifras supuestas.
- Próximo paso único: revisión ChatGPT del mismo PR Draft. No fusionar, aplicar SQL
  ni publicar Firebase sin autorización independiente.

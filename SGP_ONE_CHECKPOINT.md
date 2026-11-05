## Recepción A/C · candidata v388 en rama · 05/11/2026

Base main `2ed9f8e9d485bde1c66b0a14632dc0c908b0d0fb` (B10 v387/PR198).
Rama `feat/reception-cards-column-filters`: tarjetas por estado con reservas y
ventanas según listado, conserva cinco indicadores; filtros/orden por encabezado
en pendientes y recibidas, sin acoplamiento de datos LP. Regla principal/fallback
preservada; cantidades duplicadas no se suman, conflictos quedan por confirmar.
Estado aluminio desconocido/mixto neutral. Filtros afectan resumen visible;
refresco conserva, cambio de semana limpia, recLoadSequence preservado.
506 pruebas Node y verify:release PASS; Chromium PC1440/móvil390 con transporte
sintético, sin llamadas productivas. Capturas y alcance en
`docs/RECEPTION_CARDS_FILTERS_HANDOFF.md` y `tests/reception-ui/evidence/`.
Referencia implementada desde descripción precisa del padre tras fallo de Library;
comparación final de capturas con bocetos a cargo del padre. Reserva inicial v390 sustituida por candidata v388 para siguiente publicación;
confirmar orden con B10/SALE antes de integrar. Política200 baseline/rollback v387
2eb92f1e5438ff75 acreditada por run42041671863; hashes/HOLD intactos.
IMPLEMENTADO EN RAMA / VERIFICADO AISLADAMENTE; sin SQL, privilegios, merge ni deploy.
No cambios de SALE, GOOGLE, LAC ni workflows. Rama subida (funcional a382dbb).
PR borrador #200 abierto tras autorización explícita nueva de Johan y un único
reintento del rechazo inicial. Siguiente: comunicar SHA/checks al padre y coordinar
revisión e integración con B10/SALE; no se ejecutó merge/publicación.

## PR195 · compatibilidad de aceptación existente · 05/11/2026

Adaptadas pruebas de Power BI, cierres integrados y fuentes al acceso directo B12,
seleccionando explícitamente la misma asignación por identidad (sin cambiar aserciones
cuantitativas/de permisos/cierre). Las tres baterías PC/móvil PostgreSQL aislado PASS.
Añadido job CI aislado B12/B13 con contratos, aplicación, propuesta deshabilitada,
rendimiento50/200/500 y artefactos sintéticos; contents:read, sin credenciales ni deploy.
490 Node/release383 PASS. No cambios en workflows Hosting ni política ni producción.
El SHA anterior tiene Tests/sintaxis verdes; aceptación completa debe corresponder
al HEAD nuevo. Evidencia local: tests/lp01-b12-b13/regression-result.json.

## LAB v383 · revisión, rendimiento y preflight · 05/11/2026

Revisión independiente cerró4 hallazgos: vínculos Picking de otra etapa no prueban
confirmación Ensamble; antigüedad usa primer movimiento acreditado; historial
identifica asignación; fallo de relectura conserva guardado confirmado.
Propuesta deshabilitada explícitamente en frontend: cero RPC; SQL REVIEW intacto,
flag false y sin grants por defecto. RPC nueva ausente en producción.
Native load singleflight; evidencia en segundo plano, máximo3 simultáneas,
cancelación por ámbito/sesión; consultas retenidas40s no bloquean avance6→8 ni
multiplican lecturas en ciclos20s (Chromium/PG sintético PC1440/móvil390 PASS).
490 Node +release383 PASS. DOM real50/200/500 órdenes (100/400/1000 partes),
500 tarjetas hasta127.5ms sin desborde. Latencia simulada100ms/RPC:1.77/7.11/16.80s
en segundo plano; no equivale a rendimiento productivo.
Preflight Supabase READ ONLY/ROLLBACK:3 RPC públicas coinciden con huellas previas,
ACL conservadas y propuesta ausente;9 firmas inventariadas, sin datos individuales.
Gate local real HOLD/LP_ASSETS_NOT_APPROVED; política194 intacta. No SQL aplicado,
acceso ampliado, merge, dispatch ni publicación. PR195 Draft abierto sobre main6467290;
commit funcional401e635. Confirmar CI propia del SHA final antes de integrar.
Evidencia: docs/sql-proposals/lp01-propuestas y tests/lp01-b12-b13.

## LAB v383 · B12/B13 preparados en aislamiento · 05/11/2026

Base main646729005295c79d73bed7d6730aa10d042768b8; coordinador confirmó
v382 publicado/Hosting07abe57ef1374fde. Rama fix/operacion-b12-b13-v383.
Ensamble: una entrada por producción/turno, abiertas por antigüedad nativa,
programadas sin iniciar por prioridad; semana/sistema, detalle directo PC/móvil.
Motor existente reemplaza6→8, conserva historial, SALE desconocido y partes.
Varias asignaciones requieren selección explícita: pendiente regla de total único
por orden sin inventar reparto. Clasificación combina el motor operativo con afectaciones individuales y Picking
pendiente no vinculado, mediante el lector existente (máximo3 consultas simultáneas).
Lectura faltante: clasificación por revisar; revocación: limpiar vista. Sin sumar causas.
Propuesta siguiente turno: contrato nuevo aislado, una RPC sin EXECUTE por defecto,
flag false, eventos privados/inmutables, no cambia SALE/Export ni concede roles.
Activación productiva requiere manifiesto/pins y autorización de esa nueva firma.
490 pruebas Node y release383 PASS. Chromium PC1440/móvil390 contra PostgreSQL
sintético: reemplazo6→8, borrador conservado20s, Picking visible, propuesta bloqueada
sin disponibilidad acreditada; geometría escritorio y sin desborde móvil PASS.
PostgreSQL: CAS/idempotencia/carreras, rollback, permisos privados, revocación
serializada y rechazo posterior, saldo/SALE intactos PASS.
Detalle y límites: docs/sql-proposals/lp01-propuestas/README.md; evidencia tests/lp01-b12-b13.
IMPLEMENTADO EN RAMA, no push/PR/CI nuevo, no SQL productivo, merge ni despliegue.
Siguiente: coordinador revisa la captura con varias asignaciones y contrato de propuesta.
Preparar preflight/política solo tras coordinación; pendiente autorización nueva RPC/flag.

## LAB v382 · backend instalado y activado · 05/11/2026 03:16 UTC

01–11 aplicadas en SGP-ONE-LAB tras autorización específica y confirmaciones nativas.
04 cancelada previamente no se ejecutó; nuevo intento autorizado aplicado una sola vez.
Seis RPC EXECUTE solo anon, v1 interno; sin acceso privado ni grants a otros roles.
Cuatro flags activos; registrador PDT opcionalNC d1195… con owner/ACL/config conservados.
Siete huellas API y once tablas RLS verificadas; cero reportes/eventos/recibos de prueba.
Sesión inválida rechazada por las seis RPC en READ ONLY/ROLLBACK, sin órdenes reales.
Advisor: sin nuevos ERROR; +6 avisos RPC anon y +11 tablas RLS sin policy, esperados.
Detalle: docs/sql-proposals/lp01-afectaciones/production-activation-evidence.json.
NO merge ni frontend publicado por este agente. Padre coordina gates/backend-readiness,
Hosting baseline/inventario/bytes, merge/despliegue y comprobación visible v382.
CI PASS78b547b; los commits de evidencia tienen su propia CI, no heredan ese resultado.

## LAB v382 · instalación parcial contenida; 04 cancelada · 05/11/2026 03:09 UTC

01–03 aplicadas y verificadas en SGP-ONE-LAB; cuatro flags false, cero API expuestas,
reportes/eventos nuevos cero, registrador PDT conserva cuerpo2c9da… (06 no aplicada).
04 no aplicada: confirmación del conector expiró y el intento renovado fue cancelado
por el padre; conector confirmó Nothing was run y catálogo confirma tabla/RPC ausentes.
No reintentar automáticamente.05–11 no intentadas; no merge ni publicación.
CI completa PASS del78b547b/PR194; evidencia y huellas exactas en
`docs/sql-proposals/lp01-afectaciones/production-activation-evidence.json`.
Siguiente: padre revisa el efecto exacto de04 y coordina una nueva solicitud explícita.

## LAB v382 · activación gradual autorizada · 05/11/2026

Johan autorizó explícitamente cambio compartido PDT, seis RPC para anon y activación
gradual. Preflight actual:15 cuerpos y vista coinciden; dos lectores incluyen timeout45s.
Pins/fixture ahora reproducen esa configuración exacta sin modificar dependencias.
Default ACL public concede service_role:01–05 revocan también ese rol solo en objetos
nuevos. Fixture aplica defaults en la BD correcta; revisión independiente lo comprobó.
Scripts07–11 separan lectura, escrituras API y flags; pins7RPC/ACL/RLS fallan cerrado.
Sin grants privados/v1 ni otros roles. Snapshot recovery del registrador, manifiesto y
pruebas en docs/sql-proposals/lp01-afectaciones y tests/lp01-afectaciones-rpc.
Estado al preparar: todavía sin mutaciones productivas; publicación coordinada por padre.

## LAB v382 · NC opcional preparada, contrato compartido · 05/11/2026

Nueva instrucción permite preparar NC opcional en Ensamble/Empaque como Picking.
Contradicción documental previa reportada antes de cambiar. SQL06 remueve solo guard
NC obligatoria, conserva roles/identidad/auditoría/ACL y fija transición2c9da→d1195.
Frontend opcional; NC omitida queda pendiente sin disponibilidad física. Pruebas
PostgreSQL de ambos orígenes, vínculo posterior mismo ID, permisos y rollback PASS.
Manifest01–06 actualizado.06 cambia contrato PDT activo aunque LP esté apagado: requiere
coordinación explícita antes de aplicación, no es instalación pasiva. No producción.
Detalle y evidencia: docs/sql-proposals/lp01-afectaciones/NC_OPCIONAL.md. Siguiente:
482JS/release382 y UI PC/móvil PASS; revisión independiente final sin nuevos riesgos.
Coordinar contrato compartido, CI/instalación/activación.

## LAB v382 · cadena PDT vigente reproducida · 05/11/2026

Wrapper público actual, fuentes/Picking reales y vista multireserva reproducidos en
PostgreSQL17.11 sin red con catálogo completo y filas sintéticas. Wrapper ambas etapas
PASS;63/63 mecanizado/Picking PASS; LP atómico/legacy/Empaque y expiración PASS.
SQL03 fija15 cuerpos/owner/definer/search_path y vista, drift rechazado individualmente;
rollback y defaults sin grants PASS. No bypass al legacy ni cambios productivos.
Manifiesto actualizado. Revisión independiente acota transitividad a NC LP/asociación;
no afirmar hashes de todas las ramas históricas de Picking. Límites LEGACY/sin key,
aplicación entre etapas y now() nativo continúan. CI ampliada, ejecución remota pendiente.
Detalle: docs/sql-proposals/lp01-afectaciones/CADENA_PDT_VALIDADA.md. UI y aplicación PC/móvil PASS;482JS y release382 PASS. Captura Picking: selección
vacía ahora tiene mensaje propio; identidad ambigua sigue bloqueada. NC Picking
opcional conservada; nuevos Ensamble/Empaque requieren NC nativa, coordinar si se
solicita hacerla opcional también. Siguiente: entregar SHA/manifiesto al coordinador
y revisar instalación contenida.

## LAB v382 · contraste SQL productivo SOLO LECTURA · 05/11/2026

Autorizadas y realizadas consultas BEGIN READ ONLY/ROLLBACK, sin filas individuales.
13/16 cuerpos seleccionados coinciden con fixture; LP roles/locks/temporal coinciden.
HOLD: wrapper PDT actual c161750f deriva a legacy8c501e2 y añade Picking parcial;
fuentes/listado Picking difieren también. SQL03 actual falla cerrado; pins intactos.
136 pendientes:77 LEGACY (16 sin key),59 V2 (41 con ledger nativo,13 manuales,5 otros).
120 candidatos lectura por key. Join136→136 sin IDs duplicados; no prueba ausencia de
duplicados semánticos. ACL privadas niegan acceso API; tablas públicas RLS sin políticas.
No cambios productivos, grants ni publicación. Evidencia/plan exacto:
docs/sql-proposals/lp01-afectaciones/CONTRASTE_PRODUCTIVO.md. Siguiente: probar cadena
PDT vigente aislada, revisión/pins/manifest, luego coordinar instalación contenida.

## LAB v382 · revalidación concurrente corregida · 05/11/2026

Prueba PostgreSQL aislada reproduce CADUCIDAD de permiso temporal mientras espera
lock: escritura, recibo y lectura legado. Las tres rutas corregidas deniegan sin
escritura/divulgación. Revocación UPDATE directa ya se serializaba por locks nativos;
se corrige hipótesis anterior. Revisor independiente review_reconciliation comprobó
diff/prueba; no detectó nuevos bloqueos en esa corrección. Regresión atómica PASS.
Job CI aislado incorporado, pendiente ejecución remota del SHA final. Manifest
regenerado; versión382 conservada. No SQL productivo ni publicación. Pendientes:
contratos/ACL actuales, integridad real agregada, LEGACY/alcance entre etapas y
semántica nativa de caducidad de sesión now(). Evidencia y siguiente paso de activación
en docs/sql-proposals/lp01-afectaciones/ACTIVACION_REVISION.md.

## LAB v382 · contraste de metadatos y plan de activación · 05/11/2026

Main remoto confirmado5003c61; Supabase17.11 y columnas/FK PDT/Picking compatibles
por metadatos. Paquete nuevo no observado instalado. Sin SQL ejecutado ni filas
productivas consultadas, conforme al encargo; hashes vigentes/ACL y pendientes reales
no certificados. Revisión separada del mismo agente detecta falta de revalidación de
permisos tras locks en conciliación: bloquea esa activación hasta corrección y prueba.
Tablas privadas PDT sin RLS requieren comprobar ACL/exposición; no se concluye acceso
público por ese dato. Se preservan restricciones LEGACY y entre etapas.
Plan exacto01–05, manifest SHA256, precondiciones, pruebas y recuperación en
`docs/sql-proposals/lp01-afectaciones/ACTIVACION_REVISION.md` y
`activation-manifest.json`. Sin grants, SQL, push ni publicación; v382 sin incremento
adicional por ser la misma entrega pendiente. Siguiente: corregir revalidación en
entorno aislado y obtener autorización de consultas de solo lectura necesarias para
certificar contratos/ACL/integridad agregada, antes de preparar activación final.

## LAB v382 · integración nativa PDT/Picking y panel · 05/11/2026

Resultado local que sustituye las limitaciones técnicas de los hitos anteriores:
escritor atómico PDT+LP, asociación del pendiente original de Picking sin crear otro
PDT, conciliación explícita del legado y confirmación física con permisos acotados.
Panel integrado en Seguimiento y Operación; conserva borradores durante refrescos
y limpia al revocar acceso. Fabricación/longitud usan selección nativa de Picking;
piezas y ventanas se registran por separado. Historia/apertura exige evidencia real.

Validación: 481/481 JS, release v382, PostgreSQL17.11 aislado con datos sintéticos,
rollback/carreras/idempotencia, Chromium1440/390 con escritor nativo y controladores
existentes, refresco20s y revocación. Evidencia en
`tests/lp01-afectaciones-rpc/{atomic-result,native-browser-result,native-app-result}.json`.
Alcance/SQL revisable: `docs/sql-proposals/lp01-afectaciones/README.md`, propuestas03–05.

No publicado ni aplicado a producción. Sin push, grants API ni activación por defecto.
Conserva HOLD de publicación y verificadores. v381 publicada → candidata v382; estos
commits pertenecen a la misma entrega pendiente. Próximo paso: revisión del paquete,
contraste de dependencias y plan de activación/recuperación por el coordinador del hilo.
Límites: LEGACY/manual sin identidad acreditada, aplicación del mismo pendiente entre
etapas y relaciones históricas parciales requieren evidencia/contrato; no se duplican
registros ni se concede disponibilidad. No se amplían permisos PDT de supervisores.

## LAB v382 · RPC y panel contra PostgreSQL aislado · 05/11/2026

Implementados almacenamiento y RPC transaccionales nuevas, sesión/roles/etapa reales,
CAS e idempotencia concurrente, auditoría inmutable, reversión atómica y lectura de
historial compartido solo por etapas autorizadas. Avances proyectados de EJECUTAR
con cantidades/antes; apertura de ambas etapas solo con cobertura acreditada.
PostgreSQL17.11 Docker --network none y datos sintéticos; no Supabase productivo.
480 JS PASS, matriz SQL PASS, panel+RPC Chromium1440/390 PASS y release v382 PASS.
Panel conectado al transporte validado en demo PC/móvil; selector PDT reutiliza tabla
Picking manteniendo origen y NC de Ensamble/Empaque. No convierte piezas a ventanas.
NC_AL exige vínculo PDT único; Guardar aluminio sigue bloqueado: falta adaptador
atómico nativo, sin dos escrituras frontend separadas. Confirmación física y escritura
siguen deshabilitadas al instalar; sin grants API. Disponible requiere conciliación
acreditada del legado actual, que no se migra ni se suma. Pendiente procedimiento de
conciliación/cobertura y certificación de permisos físicos antes de integración.
Detalle y evidencia: docs/sql-proposals/lp01-afectaciones/README.md y
 tests/lp01-afectaciones-rpc/{result.json,browser-result.json}.
Sigue v382, misma entrega no publicada; sin push, PR, cambios productivos ni despliegue.

## LAB v382 · contrato y panel aislado de afectaciones · 05/11/2026

Preparados modelo backend ejecutable (sin persistencia), panel por etapa y DRAFT
de almacenamiento privado; no endpoints ni SQL aplicados. Reportes individuales,
corrección, solución y recepción física separadas, consolidado coordinador, revisión
e idempotencia. 477 JS PASS; Chromium1440/390 PASS; release v382 PASS.
Johan confirmó apertura de Empaque desde primer movimiento acreditado, igual que
Ensamble. Proyector exige cobertura desde origen; sin evidencia devuelve no disponible.
Pendientes técnicos: RPC transaccional con sesión/permisos reales, proyección de
auditoría, historial compartido autorizado, vínculo PDT y reconciliación histórica.
El panel es demostración aislada, no cumplimiento productivo completo. SQL DRAFT
sin prueba PostgreSQL (binarios ausentes). No push, despliegue ni cambios de datos.
Detalle: docs/sql-proposals/lp01-afectaciones/README.md.

## Aclaración de afectaciones individuales y PDT · 05/11/2026

Reglas recuperadas: líder fuente principal, coordinador agrega/corrige; cada causa
es un reporte individual por producción/etapa, con arrastre de la misma identidad.
Confirmación física parcial con cantidad/observación en panel, distinta de solución
en origen. Revisión de PDT confirma rutas multiorigen y manual, pero cantidades de
piezas no acreditan ventanas disponibles; no hay emisor LP implementado. Primera
actividad de Ensamble sí define apertura; Empaque continúa sin disparador acreditado.
Se corrige propuesta documental agregada; no se cambian contratos, datos ni UI.
LAB v382 sigue aislada y sin publicar. Pendiente coordinar implementación backend
y panel completo; formulario agregado actual no satisface el alcance recuperado.

## LAB v382 · historial por día/turno y límites de contrato · 05/11/2026

IMPLEMENTADO LOCAL: panel Historial muestra los últimos totales LP por asignación,
fecha y turno, sin sumarlos ni acreditar cierre/Export. 472 JS PASS, Chromium
1440/390 PASS, release PASS; transporte sintético. Sigue LAB v382, misma entrega
sin publicar. Apertura y afectaciones globales NO IMPLEMENTADAS: RPC omite
cantidades de auditoría y clasifica abierta por saldo; afectaciones existentes
son copias por parte/turno. Se recuperaron reglas funcionales sin reconstruir datos.
[Fuentes, opciones y propuesta](docs/linea-produccion/SEGUIMIENTO_APERTURA_AFECTACIONES_V382.md).
Sin push, PR, SQL ni publicación. Siguiente: coordinación de contrato antes de
preparar cambios de apertura/clasificación y registro canónico por orden/etapa.

## Seguimiento · LAB v382 preparada en aislamiento · 05/11/2026

Base main `5003c61` (LAB v381). Rama local `fix/seguimiento-v382-column-menus`.
Se retiran título y textos repetidos de línea/todas las semanas; tabla y detalle
muestran solo Saldo Ensamble o Saldo Empaque según etapa. Menú desde encabezado:
Ordenar columna / Filtrar columna, búsqueda de valores, casillas, Aplicar/Cancelar;
encabezados accesibles sobre tarjetas móviles, Escape y retorno/ciclo de foco.
Referencia: instrucciones y descripción de capturas remitidas por el hilo principal,
estilo SGP existente y guía Refero de foco/controles nativos. Las imágenes no estaban
disponibles en las rutas locales indicadas; no se afirma haberlas inspeccionado.
SALE, avance por turno, afectaciones y sus contratos/roles SIN CAMBIOS, a la espera
de aclaración funcional coordinada por el hilo principal. No se suman turnos.
469 JS PASS, release v382 PASS, navegador Chromium1440/390 PASS con transporte
sintético: etapas, menú, aplicar/cancelar, búsqueda, teclado, refresco y permisos.
No se ejecutó backend SQL ni se acredita aceptación en planta. Política intacta;
el cambio de controlador queda fuera de sus huellas, manteniendo publicación HOLD.
Sin push, PR, SQL, datos ni despliegue. Siguiente: revisión visual de esta propuesta
y respuesta sobre afectaciones/avance; integrar solo cuando se coordine el alcance.

## PR193 · política preparada sobre vidrio publicado · 05/11/2026

Inspección GET confirmada por el coordinador de publicación:
[run41938425351](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/41938425351),
job126952882628, observación `2026-11-05T00:03:53.052970+00:00`.
Versión `sites/sgp-one-lab/versions/1d4abf7aa4a92f52`, FINALIZED, 94 archivos;
inventario SHA256 `24b3ac6eb974307f57507eef0957d7fb6666cad6017647fe0ff4f6028b7ea371`,
config SHA256 `b1c8097ce32ce29d3d39d04e54f86699c1cd013dcbfc8a4f9b89f033cadc34fd`.
Coincide con #192; baseline/rollback fijados a esa versión para preservar vidrio.
Política: integration_pr193 y solo huellas de production-line-tabs.js y
src/modules/lp01-operation.js actualizadas; verificadores y restricciones intactos.
LAB v381 sin cambios: misma entrega aún no publicada. Política/postcheck/release
local PASS. La transición main→candidato mantiene HOLD; prepare solo construye.
CI del SHA nuevo es obligatoria, no se acredita con resultados de 44ad1e7.
Sin merge, dispatch, despliegue ni datos: los coordina únicamente el hilo principal.
Siguiente: completar CI del nuevo SHA y entregar artefacto/pins al coordinador.

## Seguimiento · versión LAB v380 → LAB v381 · 04/11/2026

Norma explícita de Johan: incrementar versión en cada entrega. Main `9e4a8ec`
conserva LAB v380; este PR prepara LAB v381. Sincronizados badge/título y cache-bust
app/CSS de `index.html` con `releaseLabel`; verify:release ahora también compara
el sello con la versión visible. Norma permanente en AGENTS.md; no habilita deploy.
469 pruebas PASS y release v381 PASS. Sello reproducible probado con SHA completo;
badge real local verificado visible en PC/móvil. Evidencia `version.json` y capturas
en `tests/lp01-tracking-ui/evidence/`. NO PUBLICADO: comprobar v381 y el SHA exacto
en el artefacto y Hosting después del despliegue coordinado. CI del nuevo SHA debe
completarse; no reutilizar como aprobación la CI del candidato anterior.

## Seguimiento · integración/publicación autorizada, PR en preparación · 04/11/2026

Autorización explícita de Johan para integrar/publicar el ajuste concreto de
Seguimiento. Revisión visual PC/móvil completada; main sigue `9e4a8ec` y no existe
PR duplicado. Se añade la regresión de refresco/filtros/navegación al job aislado
existente, sin permisos, secretos ni cambios en el workflow de publicación.
469 pruebas locales y release PASS; gate permanece HOLD por las dos huellas LP.
No se aprueba formalmente ningún PR ni se fusiona/publica desde este paso.
Siguiente: crear PR borrador, verificar CI del SHA exacto y coordinar con el hilo
principal los pins/artefacto/baseline antes de integración y publicación controladas.

## Seguimiento · ambos bloques retirados según confirmación · 04/11/2026

Johan confirmó «Los 2»: retirar de Seguimiento el bloque «Seguimiento de órdenes»
con Línea/Buscar/Actualizar y los accesos «Operación del turno»/«Cierres del turno».
IMPLEMENTADO EN RAMA LOCAL, sobre main `9e4a8ec`; no se eliminan datos ni funciones.
Se ocultan únicamente en Seguimiento: los controles compartidos reaparecen en
Ensamble/Empaque y sus accesos a operación/cierres siguen funcionando. Seguimiento
conserva etapas, filtros de tabla, detalle y actualización silenciosa. No hereda
una búsqueda invisible escrita en Operación. La línea continúa siendo la del
contexto seleccionado en Ensamble/Empaque, visible en el encabezado de la tabla.
469 pruebas PASS, release PASS, Chromium 1440/390 PASS con navegación real y
transporte sintético local (no aceptación productiva). Capturas actualizadas en
`tests/lp01-tracking-ui/evidence/`. Aclaración del bloque superior RESUELTA.
Gate local HOLD / LP_ASSETS_NOT_APPROVED para `production-line-tabs.js` y
`src/modules/lp01-operation.js`. Sin cambios de política/workflows, push, PR,
fusión a main, SQL ni despliegue. Siguiente: aprobar visualmente el paquete local;
luego revisión de CI/artefacto/pins/baseline vigentes antes de autorizar publicación.

## Seguimiento · compatible con main #192 · 04/11/2026

Integración LOCAL de main `9e4a8ecb90664d7296d1e77e241c4a9204d7ff50` en
`fix/seguimiento-silent-filters`. Cambio original `1ff8cfc` conservado; main no
contiene una implementación duplicada. Solo conflictos documentales, resueltos
conservando ambos historiales. Vidrio `app.js`, su prueba, política, workflows y
postcheck quedan idénticos a main. Ningún bloque superior ni control eliminado.
469 pruebas JS PASS, verify:release PASS, Chromium 1440/390 PASS (transporte
sintético), política offline PASS y 7 pruebas postcheck PASS. Simulación pura de
gate: HOLD / LP_ASSETS_NOT_APPROVED por `src/modules/lp01-operation.js`; no se
actualizan pins ni se habilita publicación. Publicación de vidrio en versión
`1d4abf7aa4a92f52` informada por el hilo principal, no reinspeccionada aquí.
SIN PUSH/PR/FUSIÓN A MAIN/SQL/DESPLIEGUE. Siguiente: revisar la integración local y
aclarar el bloque superior; publicación requiere evaluación de artefacto y pins
vigentes bajo los controles existentes. Evidencia: `tests/lp01-tracking-ui/`.

## Seguimiento · ajuste local aislado · 04/11/2026

Base main `fe82ffab`; rama `fix/seguimiento-silent-filters`.
IMPLEMENTADO y VERIFICADO EN AISLAMIENTO: refresco silencioso, Semana Export antes
de Producción, orden/filtros combinables PC y móvil; 462 JS y release PASS.
Sin SQL, datos productivos, push, PR, fusión ni publicación; no toca vidrio #192.
Pendiente aclarar bloque superior a retirar. Siguiente: revisión del cambio local.
[Detalle y evidencia](tests/lp01-tracking-ui/README.md).

## PR192 · vidrio preparado sobre Seguimiento publicado · 04/11/2026

PR191 fusionado en fe82ffab y publicado en Hosting5f20f122c0f91fb9.
Inspección41921168956: versión FINALIZED estable durante la lectura, 92 archivos
de aplicación idénticos al artefacto fe82ffab; sin faltantes, únicamente dos rutas
reservadas Firebase adicionales. El inspector independiente terminó con
READONLY_INSPECTION_NOT_COMPLETE por esas rutas; no se presenta como CI PASS.
El postcheck vigente valida exactamente esas dos rutas por hash/estado retenidos.
Baseline/rollback de PR192 se fijan a5f20f122c0f91fb9 para preservar Seguimiento;
la transición de política obliga HOLD y preparación antes de publicar manualmente.
Vidrio permite semanas identificadas con cobertura parcial y conserva el reporte
general. 466 pruebas locales PASS tras incorporar main; PC/móvil sintético PASS.
Sin cambios Supabase ni aprobación formal de PR. Próximo: CI del SHA final,
merge bajo HOLD, revisar artefacto/SHA/run/digest y publicar con versión esperada.

## PR191 · publicado para pruebas · 04/11/2026 22:01 UTC

**FUSIONADO / APLICADO EN SUPABASE / PUBLICADO.** [Aplicación](https://sgp-one-lab.web.app).
PR191 fusionado después de CI completa del candidato `7f3352546597746a1785075bdf7f55b1020b74e3`;
main publicado `fe82ffab4b439cf3900ad036bdf2d1df96328b40` (mismo árbol probado).
[CI SQL/API/PC/móvil](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/41917114760).
SQL y permiso acotado se conservan según recibos siguientes; ninguna escritura de
negocio ni sesión humana inventada. Vidrio192 no se integró en esta publicación.

Preparación41920285385: 459 tests y denegaciones HTTPS PASS; gate automático HOLD
por transición de política. Publicación manual protegida con SHA/run/ZIP/live exactos:
[41920517071](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/41920517071).
ZIP SHA256 `dbdb6e9933ec2fa725470a6be8f660f92e89f7d1eead9101cd519ba81b260f48`.
Hosting live **`sites/sgp-one-lab/versions/5f20f122c0f91fb9`**, FINALIZED,
release `1793829363336000`, observado nuevamente 22:00:44 UTC.
Publicación ejecutada UNA vez; el workflow quedó FAILURE después del deploy por
`PUBLIC_BYTES_DIFFER`. No repetirlo: la versión ya está activa.

La inspección independiente de solo lectura
[41921168956](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/41921168956)
acredita **92/92 archivos públicos byte idénticos al ZIP**, incluyendo manifest;
misma versión antes/después, sin faltantes. API contiene 94 rutas: las otras dos
son únicamente `__/firebase/init.js` y `__/firebase/init.json`. El postcheck del
publish ya comprobó ambas sin cambios frente al baseline, así como inventario y
configuración anteriores idénticos. Recuperación `1a59beda3dffaed9` sigue FINALIZED,
91 archivos; no se hizo restauración de prueba. Evidencia saneada:
[artifact13367546177](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/41921168956/artifacts/13367546177).
El inspector antiguo también termina FAILURE por comparar las dos rutas de
plataforma como extras; su resultado global NO se presenta como PASS.

La causa exacta del primer desajuste HTTPS no quedó registrada por archivo ni
codificación. La inspección posterior recibió identity y comparó todos los bytes.
Se prepara en rama una corrección acotada: pedir identity, decodificar gzip con
límite si se recibe, usar la raíz canónica para index y registrar el archivo que
difiera. Conserva igualdad exacta, denegación de redirects y los demás controles;
siete regresiones locales PASS. **Esta corrección y este cierre documental NO están
fusionados ni desplegados**; integrar antes de la siguiente publicación, con CI.
No se afirma que gzip fuese la causa observada.

**Siguiente acción:** Johan prueba Seguimiento con usuario real autorizado en PC y
móvil; aceptación positiva, guardados productivos y rendimiento real PENDIENTES.
El padre puede continuar la rama separada de vidrio tomando como live el5f20...;
no reutilizar1a59... como expected_live ni repetir el deploy191.

## PR191 · postcheck de Hosting corregido bajo controles · 04/11/2026

CI2c4ca32 completa PASS. Evidencia real41856841540 identifica únicamente dos
rutas Firebase adicionales. Postcheck conserva inventario exacto y solo acredita
esas dos si su hash/estado coincide con la versión anterior; rechaza cualquier
otro cambio. Añade comprobación HTTPS de todos los bytes del artefacto y mantiene
retención/configuración del rollback. Seis regresiones y política local PASS.
SQL/permiso ya aplicados y verificados; frontend sin nuevos cambios. Esperar CI
del commit de postcheck, fusionar bajo HOLD y publicar artefacto exacto. Vidrio192
se mantiene separado y pendiente de esta publicación.

## PR191 · instalado, permiso verificado, publicación pendiente · 04/11/2026

Confirmación explícita nueva de Johan; ausencia de ejecución previa y preflight
renovado21:13:54UTC comprobados. INSTALL y ENABLE_API exactos APLICADOS: cuatro
cuerpos fijados, metadata/defaults conservados y solo fachada con EXECUTE anon.
Sesión inválida denegada en ambas etapas bajo rol anon y ROLLBACK. Sin datos/RLS
alterados. Preparador incorpora dos denegaciones HTTPS nuevas; pruebas offline PASS.
Política conserva transición HOLD y pins de artefacto/live/recuperación. Siguiente:
CI del SHA final, merge, prepare/HTTPS y publicación explícita con postcheck.
No aceptación humana positiva acreditada. Vidrio sigue en encargo separado.
[Estado y evidencias](docs/linea-produccion/ESTADO_OPERATIVO_ACTUAL.md).

## PR191 · instalación bloqueada, preparación Hosting · 04/11/2026

Seguimiento global `4b50806`: CI completa PASS. Inspección de solo lectura
Hosting41911770281 acredita live1a59beda3dffaed9 FINALIZED/91 archivos.
Política preparada con dos huellas del candidato y baseline/rollback acreditados;
transición HOLD y backend_contracts_verified=false hasta instalar/verificar SQL.
Preflight y respaldo SQL privado completos; INSTALL rechazado automáticamente
por autorización insuficiente para crear dos funciones y modificar dos existentes.
No SQL/grant/merge/publish ejecutados. La autorización previa EXECUTE se mantiene.
Siguiente: confirmación específica INSTALL, preflight renovado e instalación;
después permiso, CI/artefacto final y publicación protegida. Vidrio separado.
[Estado y hashes exactos](docs/linea-produccion/ESTADO_OPERATIVO_ACTUAL.md).

## LP · backend activado y main #190 preservado · 04/11/2026

SQL10/Edge JWT=true acreditados; diez denegaciones HTTPS reales PASS. CI6edf892
6/6 PASS. Activación autorizada14:13UTC: escrituras/BI/perfil=true, XLSXv1, sin09;
órdenes/auditoría/cierres0, no guardados humanos certificados. Main4ef528b (#190)
incorporado en447c5db con fusión limpia y calendario Colombia/saldos futuros íntegros.
Hosting observado14:10UTC cambió a c698e0b8a4356985 FINALIZED/79 archivos; política
baseline/rollback actualizada, no recuperar deshaciendo #190.
CI del sincronizado en curso; frontend LP no fusionado ni publicado. Falta dispatch
del operador con SHA/run/digest finales: el conector no ofrece esa operación.
[Estado único](docs/linea-produccion/ESTADO_OPERATIVO_ACTUAL.md), recibos y siguiente
acción exacta actualizados. Los apartados siguientes son antecedentes.

## LP · SQL10 aplicado y alternativa con JWT · 04/11/2026

Actualización: usuario autorizó expresamente la alternativa exacta JWT=true de
8f85586. Edge lp-powerbi v1 ACTIVE/JWT=true, cinco archivos recuperados coinciden
byte a byte con la fuente aprobada. [Recibo](tests/lp01-roles/evidence/edge-jwt-production.json).
Se habilita comprobador público negativo en el workflow existente antes de
activar; escrituras/BI/perfil siguen false, no Firebase/merge ni guardados reales.
El párrafo siguiente documenta la preparación previa a esa aprobación/despliegue.

SQL10 aceptado por el conector y aplicado20261104033408: ocho cuerpos exactos,
cinco contratos nativos conservados, once tablas privadas RLS, CHECK validado;
escrituras/BI/perfil=false. Sin cuentas, ámbitos, auditoría o cierres de negocio
creados. [Recibo](tests/lp01-roles/evidence/sql10-production.json).
Edge inicial verify_jwt=false fue rechazado automáticamente; usuario eligió
mantener JWT. Alternativa preparada JWT=true + anon público existente solo en
cabecera de gateway; sesión SGP y SQL siguen autorizando al usuario. Clave
privilegiada integrada solo servidor y dos RPC; aprobación/despliegue pendientes.
Cliente/errores/Deno y recorrido XLSX afectado PC/móvil PASS en aislamiento,
sin certificar firma JWT del gateway real ni guardados productivos. CI baseeffb6a0
6/6 reutilizada solo en lo no alterado. No despliegue indirecto, secretos nuevos,
SQL09, merge o Firebase. Estado único y plan contienen límites/siguiente paso.

## Ejecución LP autorizada bajo controles · 03/11/2026 (antecedente)

Estado vigente posterior: códigoe4f8a37 CI6/6 PASS. ACL00 y01/06/08 APLICADOS
contenidos; SELECT confirma flags=false y catálogos protegidos, cinco RPC intactas.
SQL10 NO aplicado: confirmación caducada, pendiente de aceptación específica del
usuario sobre el archivo/hash revisados. No09, activación, Edge, merge ni Firebase.
Salida HTTPS del entorno aún pendiente tras reinicio (revisión5 sin tres destinos).
[Recibo real](tests/lp01-roles/evidence/installation-production.json) y estado único
detallan siguiente paso; los párrafos siguientes conservan antecedentes de preparación.

PR183: sincronización con main4b1e98e conserva ambos bloques de estilos. Corrección
ACL00/00R preparada con consumidores nativos, respaldo privado y reversión probados;
no DML de datos ni cambios RLS. Runtime sin muestras preparado para el publicador
existente; feature push solo prepara, no publica. Inspect real intento2 acredita
live0312f467cf0e9c29 FINALIZED/inventario estable; no publish/recover aún.
[Estado único](docs/linea-produccion/ESTADO_OPERATIVO_ACTUAL.md) y
[plan autorizado y secuencia](docs/linea-produccion/PUBLICACION_CONTROLADA_2026_11_03.md).
Siguiente: CI del nuevo HEAD, después registrar cambios productivos solo si pasan
seguridad/recuperación. No SQL09, apertura automática, GOOGLE/LAC ni datos inventados.
Navegación ajustada: supervisor solo su etapa/selector/retorno; líder ambas, sin
cambiar los accesos históricos de Seguimiento para otros roles. PC1440/móvil390
con SQL10 sintético PASS. Deno2.5.6 compila Edge y lee ambos XLSX anónimos sin red.
CI shallow corregida con fetch-depth=0; los checks nuevos deben terminar antes de instalar.

## Revisión SQL10/CI · dictamen BLOQUEADO (2026-11-03)

Baseb4cf8c8, mismo Draft183. SELECT de metadatos: siete cuerpos nativos coinciden;
catálogos de accesos tienen ALL anon/authenticated sin RLS. Bypass de revocación
reproducido solo en PG sintético. SQL10 añade preflight que aborta; no cambia ACL
ni instala nada productivo. Fixture protegida conserva OID/owner/ACL/RLS y flagfalse.
CI sin runs por conflicto real styles.css frente a main4b1e98e (GitHub dirty y
merge virtual exit1; ba1c546 fusionaba limpio). No defecto de trigger ni workaround.
[Estado único](docs/linea-produccion/ESTADO_OPERATIVO_ACTUAL.md) y
[dictamen/evidencias](docs/linea-produccion/REVISION_SQL10_COMPATIBILIDAD.md).
Siguiente: revisión autorizada de catálogos y sincronización del PR con main para CI.
Sin SQL productivo, usuarios/permisos, rebase/merge o publicación.

## LP · regla vigente de roles y cierre individual (2026-11-03)

Baseba1c546, mismo Draft183. SQL10 propuesto/contenido; alternativa a09, no cadena
09→10. SUPERVISOR ENSAMBLE/EMPAQUE integrados al catálogo y pantallas existentes;
LIDER LINEA opera/cierra ambas etapas de PANELES_2. Cierre individual, sin segunda
cuenta ni asignación temporal por turno, con capacidad/rol/accesos efectivos de
servidor, revocación y auditoría. SQL08/09 quedan como base/antecedentes donde10
sustituye esa política, sin eliminar validaciones de cantidades/fuentes/estado.
SELECT de contratos de Configuración/autenticación03/11 sin cuentas; pruebas reales
sintéticas en PG17.11. No SQL productivo, usuarios/permisos reales, merge o publicación.
[Estado único](docs/linea-produccion/ESTADO_OPERATIVO_ACTUAL.md) y
[matriz, pruebas, instalación/recuperación](docs/linea-produccion/ROLES_CIERRE_INDIVIDUAL.md).
Siguiente: revisión SQL10/CI antes de autorización separada para instalación contenida
/configuración real. No exigir matrices manuales ni reabrir doble validación.

## PANELES_2 · preparación inicial contenida (2026-11-03)

Base82d8a95, mismo Draft183. SQL09 propuesto/deshabilitado, responsabilidad por
cuenta/producción/etapa/fecha/turno, filtros temporales y VALIDAR explícito. Supervisor
solo su etapa; líder ambas, auditado; cierres conservan dos responsables distintos.
FRAMES_2 fuera del piloto, sin borrar compatibilidad. Importador --paneles2 sigue
apply=false.8 grupos SQL sintéticos y6 importador/7 privacidad PASS; UI PC/móvil.
[Referencia única](docs/linea-produccion/ESTADO_OPERATIVO_ACTUAL.md) y
[matriz, pruebas, instalación y recuperación](docs/linea-produccion/PANELES2_RESPONSABLES.md).
Bloquean aplicación el catálogo real actual y matrices aprobadas con suplencia;
PDT/Export en fuente y runtime siguen pendientes. Sin usuarios/roles/grants, SQL
productivo, activación, merge o publicación. SQL01–08/08R y adaptador conservados.

## Cierre funcional integral delimitado (2026-11-03)

Base934340c preservada, mismo Draft183. Cuatro recorridos nuevos SQL08/handler
XLSX/navegador reales PASS (Ensamble/Empaque × PC/móvil), todo sintético en PG17.11
sin red. Revocación tras render denegada, diferencia con motivo, original idéntico,
reapertura/dos versiones y etapas independientes; Export/Programación intactos.
Sin cambios de lógica operativa ni SQL; plan de instalación precisa01→06→08.
[Estado único](docs/linea-produccion/ESTADO_OPERATIVO_ACTUAL.md) y
[matriz integral](docs/linea-produccion/CIERRE_FUNCIONAL_INTEGRAL.md).
No cierre productivo certificado: PDT/Export en fuente, matriz real/runtime e
histórico/consolidado pendientes. No migración, permisos, merge, publish o recover.

## Publicación controlada · preparación vigente (2026-11-03)

PR183: workflow existente preparado con política legacy/no certificada. Adopción
PR y cambios LP/política no despliegan; otros pushes conservan vía habitual con
navegación anterior y public positivo. LP manual solo tras certificación/pins.
Defaultprepare sin secretos; inspect GET preparado, no ejecutado. Publicación y
recuperación LP BLOQUEADAS, IDs live aún no acreditados. No acciones Firebase ni
credenciales/infraestructura creadas. [Procedimiento y pruebas](tests/lp01-publish/PUBLICACION_CONTROLADA.md).
Prevalece ESTADO_OPERATIVO_ACTUAL.md; no fusionar/desplegar/dispatch sin autorización.

## Certificación Hosting · dictamen vigente (2026-11-03)

PR183: BLOQUEADO por falta de acceso autenticado de lectura a Hosting; release/
version live y rollback exacto no acreditados. No reintentar403 ni usar credenciales
más privilegiadas. Plan local explícito y6grupos offlinePASS; CI64d91e2 4/4PASS.
[Dictamen/evidencia y siguiente intervención](tests/lp01-hosting/CERTIFICACION.md).
La referencia única LP sigue siendo ESTADO_OPERATIVO_ACTUAL.md. No publicar ni
crear sitios/canales. Se requiere evidencia del responsable Hosting, sin secretos.

## LP · checkpoint vigente de preparación (2026-11-03)

PR183 continúa en feat/lp01-seguimiento-operacion. Preparación al SGP principal sin
sitios/canales nuevos, sin publicar ni SQL. Estado único actualizado:
[ESTADO_OPERATIVO_ACTUAL.md](docs/linea-produccion/ESTADO_OPERATIVO_ACTUAL.md).
Matriz/artefacto visual y recuperación: [revisión final](tests/lp01-integration/REVISION_FINAL.md).
Rollback live exacto pendiente de acreditar (lectura pública403); no aprobar deploy
basándose solo en run exitoso/commit. Los apartados siguientes son antecedentes.

# LP — referencia operativa única

Consultar [ESTADO_OPERATIVO_ACTUAL](docs/linea-produccion/ESTADO_OPERATIVO_ACTUAL.md)
antes de continuar #183 y actualizarlo al cerrar cada entrega técnica. Ese documento
contiene el estado vigente y las prioridades; los hitos inferiores son antecedentes,
no una autorización ni un estado productivo actual. El protocolo de lectura y
actualización por entrega queda establecido en AGENTS.md; no es un proceso de fondo.

---

# PR #183 — identidad A, diseño verificable y bloqueo PUBLIC (02/11/2026)

Continúa 0a6b48d, misma rama/Draft. A elegida solo para diseño/preparación; NO
autorizados roles/GRANT, credenciales, secretos, jobs, SQL ni conexión técnica real.
Referencia compartida ABRIR humano/técnico y journal append-only solo sintéticos,
separados de SQL instalable/runtime. Sin suplantación de coordinador ni stub de
sesión técnica: nueve grupos pasan con LOGIN/session_user PG17.11 reales locales.
Cobertura: permisos/denegaciones, cierre válido/SIN ACTIVIDAD, concurrencia,
reapertura, contención/revocación en vuelo, idempotencia, recuperación, continuidad.

BLOQUEO REAL: catálogo SELECT muestra 83 SECURITY DEFINER sgp_* EXECUTE PUBLIC,
80 invocables excluyendo triggers; PUBLIC también USAGE public y TEMP en base.
NOINHERIT/REVOKE al rol no sustraen PUBLIC. Helper acotado sin sesión observado
solo en definición, nunca ejecutado. No resolver mediante ACL globales desde LP.
Supabase documenta LOGIN propio pero canal directo/pooler/TLS/session_user no
probados en proyecto; no declarar ejecutor operativo. B comparada, no implementada.

Detalle/matriz/operaciones futuras: docs/linea-produccion/principal-a/DISENO.md.
Evidencia nueva: tests/lp01-principal-a/evidence/. Se reutilizan 111/evidencias
válidas anteriores; aplicación, Programación, Power BI, Export, PDT y 01–06 intactos.
No copias DB, producción modificada, migraciones, accesos reales, merge o despliegue.
Siguiente paso: revisar diseño y resolver el perímetro de A o decidir otra frontera;
preparar integración instalable solo después, con autorización separada.

---

# PR #183 — preparación de apertura automática (02/11/2026)

Continúa a19a9f6. Plan horario de servidor por línea/etapa, bloqueo visible de origen
abierto/cierre no acreditado y preparación offline de intenciones deterministas.
ABRIR añade acreditación del último cierre mediante auditoría; SIN ACTIVIDAD válido
permite continuidad. UI conserva apertura manual del coordinador, sin mutar al leer.

EJECUCIÓN TÉCNICA BLOQUEADA: el modelo vigente exige sesiones humanas SGP. No se
reutilizan ni se usa service_role como worker. No hay privilegios técnicos aprobados,
roles/GRANT nuevos, job, secreto, runtime ni sink de eventos automático. Preparador
siempre PREPARATION_ONLY/canExecute=false. Alternativas A (principal DB restringido)
y B (identidad de carga externa + adaptador restringido) requieren decisión expresa.
No simular autenticación técnica mediante un stub o un usuario coordinador.

Pruebas nuevas delimitadas: horarios/demoras/intenciones y SQL real, referencia
manual de ABRIR/reintentos/concurrencia/recibos y UI PC/móvil. No certifican ejecutor
ni privilegios técnicos. Configuración observada global común por día, sin claves
por línea/festivos; no inventar excepciones ni saltar turnos. No datos sensibles.

Detalle: docs/linea-produccion/APERTURA_AUTOMATICA_PREPARACION.md. Mismo Draft #183;
sin SQL productivo, escrituras habilitadas, credenciales, fusión o despliegue.

---

# PR #183 — cierre SIN ACTIVIDAD aprobado (02/11/2026)

Continúa 21c40f4. Regla de Issue #184 implementada en el mismo motor: CERRAR con
close_type=SIN_ACTIVIDAD, confirmación booleana explícita y motivo. Sin Power BI
solo ante ausencia real de filas LP, asignaciones activas y abiertas pendientes.
Chequeo dentro de transacción con bloqueo SHARE NOWAIT de fuentes externas,
permisos/roles, revisión/UUID, auditoría y cierre tipado/versionado sin archivo.

UI PC/móvil diferencia cierre vacío, motivo y confirmación, reporte CSV y recibo de
commit perdido; conserva reapertura del coordinador e incorporación en revisión.
La carrera asignación/cierre se serializa: posteriores al corte no reescriben
historia, invalidan elegibilidad y requieren reapertura. Siguiente turno configurado
abre después del cierre vacío; no se crea producción, SALE ni partes artificiales.

Pruebas nuevas y regresiones afectadas en PostgreSQL aislado y navegador. Parser,
cliente/handler XLSX, 06, LP Programación, Export y PDT intactos. No se reintenta la
consulta sensible ni se aplica SQL, habilitan escrituras, fusiona o despliega.
Detalles/evidencias/instalación: docs/linea-produccion/SIN_ACTIVIDAD.md.
Persisten solo pendientes independientes: apertura desatendida, ámbitos reales,
puentes PDT/Export y conciliación de cadenas arrastradas.

---

# PR #183 — SALE, siguiente turno y contención (02/11/2026)

Continúa 8defa34 en la misma rama. Implementación en rama y SQL propuesto; no SQL
productivo, activación, ámbitos reales, fusión ni despliegue. Adaptador Power BI y
Programación Calendario intactos; 06 solo participa en admisión/revalidación común.

Empaque persiste SALE inequívoco desde Export elegible/presupuesto y cantidad LP
restante, con capacidad explícita del coordinador. Repartos, sobrecapacidad y
solapamientos quedan pendientes visibles; no inventa asignaciones ni resta NC.
ABRIR valida siguiente turno configurado/origen cerrado, raíz/antigüedad y contexto;
no duplica ejecución y deja registro exacto. Navegación al siguiente turno añadida.
No hay job de apertura autónoma ni permiso nuevo al líder; cadenas ya arrastradas
siguen bloqueadas para corrección retroactiva hasta definir conciliación.

Admisión transaccional compartida + CAS de turno/asignación + revalidación bajo
mutex. Apagar espera escritores admitidos e invalida revisiones; recibo de commit
autorizado permite resolver respuesta perdida con escrituras contenidas.
Pruebas nuevas y regresiones concretas en PostgreSQL aislado y PC/móvil, sin stubs
de persistencia. Reutiliza resto de evidencias; no reintenta consulta sensible.

Detalle/estados/pendientes: docs/linea-produccion/SALE_CONTINUIDAD_CONTENCION.md.

---

# PR #183 — adaptador Power BI XLSX real (02/11/2026)

Continúa 47a06af; reglas del encargo actual aprueban comparar por producción,
línea, etapa, fecha operativa y turno, sumando últimos avances de asignaciones LP.
Recibidos los dos originales: Export, 33/37 filas, total 186; T1/T2 95/91 Ensamble
frente a 90/96 Empaque. Sin duplicados exactos ni ceros/negativos observados.

Implementado LP-PBI-XLSX-1 en navegador y servidor; servidor verifica sesión SGP
antes de descomprimir, vuelve a parsear y guarda bytes originales, hash, filas
fuente y grupos. RPC de importación solo servidor con sesión/rol/ámbito SGP; cierre
reutiliza el motor versionado, conserva asignaciones y exige motivos por producción.
No cambia Programación, partes de Mecanizado ni saldos oficiales del Export.

Pruebas focalizadas nuevas de XLSX/conciliación/permisos, SQL PostgreSQL real
local, originales preservados byte a byte en aislamiento y PC1440/móvil390 con
servicio real compartido + SQL real. Fixtures/capturas publicadas anonimizadas.
Las 111 pruebas se reutilizan salvo las 6 de contrato/reporte afectado; regresión
SQL se ejecuta porque cambió CERRAR/archivos. CI obligatoria no prueba producción.

Pendientes limitados: convenciones no observadas de anulación/fecha nocturna,
variantes no muestreadas, correspondencia real SGP, instalación/Edge/flags/ámbitos
productivos y bloqueos PDT/Export/SALE/arrastre previos. La revisión automática
rechazó enviar nombres reales de XLSX a Supabase por payload potencialmente
sensible: esa consulta no se ejecutó ni se eludió; solo catálogo y pruebas locales.

Detalle: docs/linea-produccion/POWER_BI_XLSX_V1.md. No DDL/DML productivo, habilitación,
fusión, publish, Firebase ni despliegue Edge; todo SQL es propuesta sin aplicar.

---

# PR #183 — preparación de bloqueos productivos (02/11/2026)

Referencia funcional/código/SQL c5178d8; actualización solo documental en la misma
rama. No se rehacen vistas, cambian contratos SQL ni repiten las 111 pruebas.
SELECT dirigidos confirman: esquema LP no instalado; seis roles con cuentas
activas, ninguna LIDER/LIDER LINEA/CONSULTA; accesos por ventana sin asignación
acreditada LP por línea/etapa; fuentes PDT/Export y horarios disponibles.

Se preparan campos/muestras Power BI, contratos lógicos de liberación neta PDT e
inclusión Export, matriz/plantilla de ámbitos sin usuarios inventados y contraste
de reglas. Empaque aún no inicia SALE persistido desde el saldo oficial; arrastre
solo al ABRIR y siguiente turno operativo no validado. Contención por bandera no
certifica drenaje de comandos ya iniciados. Brechas quedan pendientes, sin parche
en esta fase de lectura/preparación. Plan de instalación/recuperación revisado;
no instalar ni habilitar con solo cambiar flags.

Entrega y cinco aportes indispensables del responsable funcional:
`docs/linea-produccion/CIERRE_BLOQUEOS_PRODUCTIVOS.md`. Evidencia agregada y cuerpos
leídos en `docs/linea-produccion/evidence/2026-11-02-cierre-readonly.json`.
No DDL/DML productivo, migraciones, permisos concedidos, backups/copias, fusión,
publish o despliegue. Las pruebas y CI 3/3 de c5178d8 conservan su alcance aislado.

---

# Línea de Producción integral — PR #183 / Issue #184 (01/11/2026)

Rama `feat/lp01-seguimiento-operacion`, base main `bb224f0`. Guía original de 27
bocetos y DOCX aprobado recuperados e incorporados con hashes y matriz de estados.

Implementado en rama: contrato real por línea/etapa/orden/parte/fecha/turno,
último acumulado, SALE, notas y afectaciones agregadas con validación/justificación,
auditoría, idempotencia, arrastre raíz al abrir turno y notificaciones. Cierre exige
archivo previo, diferencias justificadas y comentario; reapertura de coordinador
con versiones inmutables. Dashboard del turno y reportes CSV con fuentes reales.
Vidrio reutiliza modal/reporte; corrección SQL propuesta para clasificar Traslado
como el reporte vigente. Calendario y escritores legacy conservados.

Verificado únicamente en PostgreSQL 17.11 aislado y navegador PC1440/móvil390:
288 = 90 + 90 + 90 + 18, permisos/sesiones/ámbitos, dos líneas, reemplazos de
acumulado, UUID/reintento tras respuesta perdida, concurrencia, arrastre sin duplicar,
consolidación de ventanas, cierre/reapertura/versiones, descarga y Vidrio SQL real.
Supabase solo SELECT de catálogo/contratos y estados agregados de vidrio.

Bloqueos reales: archivo/esquema Power BI no suministrado (CSV-v1 solo QA, apagado
por defecto), inclusión de avances en cargas Export y liberaciones reales PDT en
ventanas consolidadas no certificadas; ámbitos reales pendientes. Falta también
conciliar correcciones de orígenes ya arrastrados, histórico operativo semanal,
reportes consolidados/PDF/imagen y completar Tabla/Kanban. No declarar módulo
completo ni disponibilidad de planta. No se aplica SQL, fusiona, publica ni despliega.

Detalle y pruebas: `docs/SGP_LP01_SEGUIMIENTO_OPERACION.md`,
`docs/linea-produccion/INSTALACION_Y_RECUPERACION.md`, `tests/lp01-operacion/`.
El hito consultivo anterior se conserva debajo como historia, superado en alcance.

---

# Seguimiento y Operación LP-01 — entrega delimitada (2026-10-31 Colombia)

Rama independiente `feat/lp01-seguimiento-operacion`, base main `bb224f0`.
PR Draft #183: https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/pull/183
Seguimiento implementado con las dos RPC de lectura vigentes: asignaciones por
fecha/turno y hoja Export por clave. Filtros, secuencia, detalles, observaciones
existentes, identidad/origen, estados legacy descriptivos y saldos por producción
separados de ejecución. Navegación nueva conserva Programación, hojas y ubicaciones.

Operación permite consultar Ensamble/Empaque y validar borradores sin guardar.
Inicio/avance/cierre, notas persistidas e historial por etapa bloqueados: no hay
etapa en las tablas actuales y registrar suma incrementos sin idempotencia/revisión,
incompatible con el modelo documentado por etapa. No se inventaron transiciones.

Guía de 27 bocetos no localizada tras búsqueda dirigida en repo/ramas/PR/Drive.
B05–B11 se conocen solo por continuidad E2; no se afirma haber revisado imágenes.
Mapa de aprobados/referencias/pendientes y dependencias con PR117–157 en
`docs/SGP_LP01_SEGUIMIENTO_OPERACION.md`. Refero remoto sin suscripción; diseño
basado en SGP vigente y guía craft. No duplicar motores propuestos de otros PR.

QA: 31 pruebas focalizadas y Chromium PC1440/móvil390 con respuestas RPC sintéticas,
red externa bloqueada y cero escrituras. Carga descarta sesiones antiguas y errores
limpian filas. Capturas y resultados en `tests/lp01-seguimiento/`.
IMPLEMENTADO EN RAMA / VERIFICADO EN AISLAMIENTO / PENDIENTE DE REVISIÓN.
Sin cambios productivos, SQL aplicado, RPC/migraciones nuevas, fusión o despliegue;
no GOOGLE/LAC. Programación/Mecanizado/Picking e importadores permanecen intactos.

Siguiente paso único: revisar el Draft y recuperar guía/contrato aprobado por etapa
antes de habilitar escrituras o certificar fidelidad completa a los bocetos.

---

# LP-01 E4 — preparación LAB v374 sobre main vigente

PR #170, rama `feat/lp01-e4-programacion-grupos`. Se incorporó `main` `ce559cb7b92b289b6ab81597f6609939184bf6ba`, que ya contiene el PR #168 de Mecanizado parcial. Se preservaron sus módulos, pruebas, SQL y estilos; el único conflicto fue `index.html` y se resolvió manteniendo LAB v374, `styles.css?v=374` y `app.js?v=374-multi-nc`. `scripts/build-release-info.mjs` también declara LAB v374.

Una regresión de la rama E4 rechazaba fechas válidas en la programación de grupo por una expresión regular con barras duplicadas. Corregida y comprobada en Chromium PC/móvil. `npm test`: 363/363; `npm run verify:release`: aprobado; sintaxis JavaScript y `git diff --check`: aprobados. El grupo usa llamadas individuales secuenciales a la RPC instalada: se muestran aceptadas/rechazadas y no se afirma atomicidad grupal ni idempotencia transaccional. No se creó nueva RPC ni migración. No se fusionó PR #170 ni se desplegó. Continuidad específica: `docs/SGP_LP01_E4_CHECKPOINT.md`.

---

# PR168 — PDT y reservas compartidas sin stubs (2026-10-30 Colombia)

Continuación de `a46d58e` en `feat/mecanizado-programacion-parcial`, mismo PR #168.
Supabase utilizado solo en READ ONLY para definiciones del catálogo implicado.
No copias, respaldos, restauraciones, datos productivos, aplicación de migraciones,
fusión ni despliegue. Bases QA creadas vacías con datos sintéticos y contratos reales.

Corregidos: fuente PANEL por clave exacta y acabado asociado; auditoría acotada al
PDT/evento; reposición de material con 0 ventanas; evidencia de la misma parte y
posterior al faltante; Recepción, Ensamble e informe de avance ante homónimas.
63 escenarios SQL aprobados, incluidos ciclos reales V4/simple/agrupado/auditoría,
NC, validación, avances, entrega, asignación, cierre, histórico y concurrencia.
Huellas de 19 funciones núcleo y vista real verificadas; payload JS real sobre
fuentes SQL. Regresión JS y Chromium 1366/390 aprobados. Evidencias en
`tests/mecanizado-parcial/` y contrato en `docs/sql-proposals/mecanizado/parcial/README.md`.

Estado: IMPLEMENTADO Y VERIFICADO EN AISLAMIENTO; SQL REVIEW, NO APLICADO,
NO FUSIONADO, NO DESPLEGADO. No se certifica PostgREST/Auth gestionado, red,
cuentas operativas, recepción física de material ni teléfono físico. Los DTO QA
no prueban planta. La tarea no pide ni habilita esas operaciones.
Siguiente paso único: revisión del PR #168 actualizado, sin crear otro PR.

---

# Integración PDT manual + fuentes múltiples (rama independiente)

**Cierre PDT unificado — corte operativo (2026-10-29):** decisión funcional nueva: año de producción inmutable; SQL REVIEW 05 rechaza Export con año distinto y protege `UPDATE anio`, sin alterar eventos/historial. 06 configura un instante UTC de publicación; el listado único filtra por `fecha_reporte` para ocultar históricos operativos sin borrarlos. Manuales nuevos aportan `reportes.fecha`; fallos de RPC/fecha bloquean la visualización. QA PostgreSQL 17 aislado: semana ordinaria, rechazo 2026→2027, rollback 05, instalación/corte/rollback 06. Node dirigido: listado único, filtro y fallo cerrado. Pendiente antes de autorización productiva: restauración compatible, ciclo completo con roles reales y fecha efectiva coordinada. Plan: `docs/sql-proposals/pdt/integration/README.md`.

**Hito anterior de Export:** ambos cuerpos productivos fueron contrastados y sus `md5(prosrc)` fijados en 05. La propuesta anterior permitía cambiar el año; queda sustituida por la regla de año inmutable documentada arriba. Evidencia: `docs/sql-proposals/pdt/integration/EXPORT_BODY_CONTRAST.md`.

Se combinaron las bases de PR #139 y #141 sin cambiar sus ramas. Orden REVIEW: #139 → manual 01 → manual 02 → manual 03 → manual 04 → manual 05. Los preflights 02/03 fijan los cuerpos resultantes de #139 y delegan al contrato agrupado/V4/LEGACY para todo PDT que no sea manual. PostgreSQL 17 aislado: siete regresiones SQL transaccionales, prueba de año Export sintético y rollback 04→01 aprobados; Node focalizado 33/33. Los cuerpos Export ya están contrastados; no hay instalación productiva, fusión ni despliegue. Continuación exacta y riesgos: `docs/sql-proposals/pdt/integration/README.md`.

# Issue #140 — PDT manual unificado, Fases 1–4 (rama de revisión)

Fecha Colombia: 2026-10-28. Base `main` `55a309729bb3166cce98e24eb7e840169f4b7890`; rama `feature/pdt-manual-unificado`. Alcance: botón `+ Nuevo PDT`, filtros de programación, selector PANEL con combinaciones y múltiples piezas, NC opcional, observaciones, tabla visual de fuentes en Picking, SQL REVIEW aditivo de cabeceras/detalles/fuentes y RPC con sesión/roles. Sin archivado histórico ni cambios a V4/PR #139.

Estado: IMPLEMENTADO EN RAMA / VERIFICADO EN AISLAMIENTO. No aplicado en Supabase, no fusionado ni publicado. Fase 2: `POR_VALIDAR` manual se valida con fuentes PANEL verificadas, reporte original inmutable, observación obligatoria para corregir y auditoría original/validado. LEGACY/V2 ajenos se despachan a la función original capturada. SQL REVIEW y reversión separados; ningún SQL aplicado a producción. Evidencias en `tests/pdt-manual/` y contrato/reversión en `docs/sql-proposals/pdt/manual/README.md`.

Fase 3 IMPLEMENTADA EN RAMA y VERIFICADA EN AISLAMIENTO: SQL REVIEW 03 con líneas cuantitativas consolidadas por detalle/evento de Picking, asignación y cierre acreditado; funciones originales delegadas para LEGACY/V2 ajenos. El controlador existente habilita avances y Picking manuales y lee la cabecera indexada. Sin tablero nuevo ni cambio a los 101 históricos. QA: PostgreSQL 17.11 aislado, instalación/reversión y escenario transaccional de alta→validación→2 avances→entrega→validación→asignación→cierre; rechazos de sobreavance, diferencia auditada, permisos, duplicados y cambio de fuente. Navegador PC 1366 y móvil 390 con datos sintéticos; capturas en `tests/pdt-manual/`. No se ejecutó SQL productivo, no hay fusión ni publicación.

Fases 4/5: el reporte conserva año/semana originales; el listado toma el período vigente de `sgp_producciones`. El escritor diario cambia `semana_actual` sin cambiar `anio`; el importador envía ambos en `p_datos`. La propuesta de sincronizar un año nuevo fue reemplazada por el guard de año inmutable. `04` audita una transición neta de semana por PDT/transacción. No aplicar SQL, fusionar ni desplegar sin restauración compatible y aprobación separada.

---

# PR116 — corrección final de historial y contrato productivo reportado

Fecha Colombia: 2026-10-27T05:15:13.387476-05:00.
Rama feat/pdt-v2-multiorigin / PR116 Draft / LAB v362 propuesta.
Main de referencia 1a0deae41e3446efde3901932cda90ed73ab4d0d, sin modificación.

El propietario/ChatGPT confirmó huella 641227c7727bd9586b2ef20323a23791 y diferencias
reales: validación directa de fuentes y estado_nuevo en historial. Se corrigieron
ambos puntos en 02; el registro inicial de 01 también informa estado_nuevo.
Validador nuevo usa tablas directas y maestro PANEL con identidad exacta; las
cargas de clave FRAME requieren ID base común y destino PANEL único verificable.
Ambas validaciones conservan la etapa física en estado_anterior/estado_nuevo.
Preflight revisa columnas obligatorias, seguridad y huella reportada; captura
el cuerpo instalado original, sin sustituirlo para LEGACY ni V2 preexistentes.
No migración masiva ni individual automática. Reversión y contención preservadas.

328/328 Node, verify:release y 29 comprobaciones PG17.11 aisladas; matriz LEGACY
32 operaciones idénticas antes/después con estado_nuevo NOT NULL, datos/historial
intactos. Instalación falla atómicamente ante cuerpo/seguridad/columnas distintos.
No se repite visual PC/tableta/móvil: no hay cambio de interfaz en este ajuste.

Se supera el bloqueo histórico por falta de huella; no volver a solicitar las
consultas anteriores. No se adjuntó cuerpo productivo íntegro ni se consultó
Supabase en esta sesión: QA reconstruye los contratos reportados, nunca falsifica
su hash. El instalador oficial rechaza la fixture; el pin QA positivo se inyecta
solo en memoria. No afirmar que el preflight pasó ya en producción.

IMPLEMENTADO EN RAMA / VERIFICADO LOCALMENTE / PENDIENTE REVISIÓN FINAL.
NO APLICADO EN SUPABASE, NO FUSIONADO, NO PUBLICADO por este trabajo.
Siguiente paso: revisión de ChatGPT del mismo PR116 y los SQL antes de autorizar
aplicación/publicación. Evidencias: tests/pdt-multiorigin/evidence; contrato y orden
actualizados en docs/sql-proposals/pdt/multiorigin/README.md.

---

# PR116 — refuerzo de convivencia LEGACY/V2

Fecha Colombia: 2026-10-27T04:55:39.448247-05:00.
Rama `feat/pdt-v2-multiorigin`; PR116 Draft; LAB v362 propuesta.
Base main sin cambios `1a0deae41e3446efde3901932cda90ed73ab4d0d`.

01 continúa aditivo: nuevos PDT V2, ningún histórico migrado. 02 queda separado,
opcional y BLOQUEADO para aplicación hasta comparar la definición productiva
actual del validador de detalles. Ahora despacha la lógica canónica solo a V2 del
ledger de nuevos registros; LEGACY y V2 preexistentes delegan a cuerpos originales
clonados íntegros. Sin cambios a resolver, estado, guards ni validación tradicional.
Filtro e informe CSV distinguen contratos, sin convertirlos ni alterar cantidades.

Pruebas: 327/327 JS, 27 comprobaciones PG17 aisladas; matriz adicional
32 operaciones LEGACY abierto/validado/con historial/cerrado idénticas antes/después,
filas/historial preservados. Fixtures, no verificación productiva. Fuentes reales
suministradas para estado/resolver; validador tradicional versionado en fixture.
PC/tableta/móvil y verify:release aprobados. Evidencia tests/pdt-multiorigin/evidence.

Bloqueo exacto: falta `PDT_VALIDAR_DETALLES_REAL.json` con la definición productiva
completa y metadatos de sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text).
No está entre las siete funciones ni el complemento disponibles. No hay herramienta
Supabase autenticada en esta sesión. Huella prosrc del repositorio no equivale a
huella de definición real. No cambiar preflight para forzar instalación.

IMPLEMENTADO EN RAMA / VERIFICADO LOCALMENTE. NO SQL productivo, fusión ni publicación.
Siguiente paso: revisión del mismo PR116 y aportar la definición ya obtenida para
cerrar el contraste antes de autorizar 02. No reiniciar auditorías generales.

---

# Continuidad vigente — PDT v2 multiorigen / LAB v362 propuesta

Fecha Colombia: 2026-10-26T23:41:28.628629-05:00.
Base main `1a0deae41e3446efde3901932cda90ed73ab4d0d` LAB v361; PR108 y PR115
FUSIONADOS según API. Los hitos anteriores que los muestran pendientes son históricos.
Rama independiente `feat/pdt-v2-multiorigin`; único PR Draft de esta tarea.

Objetivo: corregir Picking `PDT_CLAVE_NO_CORRESPONDE_A_MAESTRO` y reutilizar un
registro PDT en PICKING/ENSAMBLE/EMPAQUE, sin cambios productivos.
Implementado: editor compartido, accesos por producción en los tres módulos,
identidad canónica/maestro PANEL, NC opcional en Picking y obligatoria en los otros,
registro transaccional con idempotencia, metadatos/filtros de seguimiento y SQL
REVIEW fuera de migraciones automáticas. LEGACY y firmas antiguas preservados;
la nueva ruta no retorna a sus INSERT defectuosos. READ/validación/acreditación
conciliados por identidad y relación verificada de reserva compartida.

Evidencias: 326/326 Node; 25 comprobaciones PG17.11 aislado/sintético con funciones
suministradas, error anterior reproducido y ciclo nuevo hasta cierre, concurrencia,
rollback y datos preservados; browser PC1440/tableta768/móvil390 con handlers reales
+ RPC sintéticas; verify:release v362 y sintaxis. Main base reproducía 13 fallos:
se corrige inicialización de partialReceiptBase y assertions de versión fosilizadas.
Detalle, contratos, permisos, orden/reversión: docs/sql-proposals/pdt/multiorigin/README.md.

Riesgos: no acceso Supabase autenticado de planta en esta sesión; snapshots reales
suministrados no prueban cuerpos productivos actuales. La RPC subyacente PANEL es
fixture en QA. Preflight SQL aborta ante huellas/dependencias distintas. Revisar
compatibilidad real antes de aplicar. Publicar frontend sin RPC nueva bloquearía
entregas; aplicar backend validado antes de autorizar publicación. Revertir código
no debe bloquear PDT nuevos activos; preferir corrección hacia delante.

Estado: IMPLEMENTADO EN RAMA / VERIFICADO LOCALMENTE; SQL PROPUESTO PARA APLICACIÓN,
NO APLICADO, NO PUBLICADO ni VERIFICADO EN PRODUCCIÓN por esta tarea.
No migración productiva, Firebase, fusión, datos históricos, GOOGLE/LAC ni workflow
manual. Único siguiente paso: revisión de ChatGPT del PR Draft y del SQL preparado.

---

# Continuidad vigente — Issue111 / PR108 único / estilo5 definitivo

Fecha Colombia: 2026-10-26T20:01:24.255375-05:00.
Rama existente `fix/mecanizado-base-received-progress`; PR108 OPEN/DRAFT reutilizado
para Issue111, sin crear rama o PR duplicado. Main incorporado:
`d4e794f0145db21051035d86703c94fa3337693e` (restauración de parte completa preservada).
Versión propuestaLABv360; badge simple y PR107 móvil conservados. No publicación.

Aprobación final: Issue111 comentarios6430858301/6430873803. **Gris, naranja y lila**,
no azul/verde. Un carril; recibidas/base naranja, procesadas/base lila superpuesto;
total fuera derecha sin porcentaje, procesadas centrada, recibidas en naranja libre.
Etiquetas que no caben se llevan fuera, sin inflar rellenos. ResizeObserver actualiza
solo etiquetas. Leyenda inferior y cinco indicadores, tabla/totales/filtros/tres vistas.
Las entradas anteriores de colores azul/verde son históricas y quedan superadas.

Reglas y fuentes de base/recepción/ejecución del candidato anterior se conservan
sin cambios: no asignaciones como denominador, no sumar R+P, no recortar discrepancias,
no convertir perfiles incompletos a ventanas sin evidencia. Base de referencia facilitada
707+158+227+14=1106, externo1107; unidad pendiente no añadida. 694/577 no validados.
Se mantiene el bloqueo de aceptación productiva: definición/payload de RPC base y
recepción no contrastados con sesión SGP real disponible. Consulta READ ONLY anterior
se conserva sin ejecutarla; no se genera otra auditoría ni se modifica Supabase.

Evidencia local: **313/313JS**, verify:release360 y sintaxis; visualPC1366/móvil390
sobre index/resumen/puente reales y datos sintéticos. Ejemplo aprobado700/600/280
medido85,7%/40%, etiquetas dentro/fuera, mínimo1unidad yresize; contraste6,50/8,44:1.
Se conservan NC-300 y referencia1106, filtros, contradicciones, errores/reintentos,
PDT y calendario26/10T1=8+57=65. Prueba de parte completa65/individual57restante añadida.
Capturas/reportes renovados: tests/mecanizado-base-progress/evidence; hashes preservan
saveProgramming del main, Recepción, Ensamble/Picking, PDT, CSSglobal y cálculo base.

Estado: **IMPLEMENTADO — PENDIENTE DE REVISIÓN**. No PUBLICADO ni VERIFICADO en
producción. Sin datos/tablas/RPC/migraciones productivas, RLS, Firebase, GOOGLE/LAC,
fusión, despliegue ni conciliación Export/base. SHA/CI final en PR108.
Siguiente paso único: revisión de ChatGPT del mismo PR108/Issue111, incluida la
aceptación de fuentes pendientes antes de autorizar integración/publicación.

---

# Continuidad vigente — corrección de base/recibidas/procesadas

Fecha Colombia: 2026-10-26T17:18:45.278283-05:00.
Repositorio SGP-ONE-LAB; base main `275e5dc127609869d5174ab41cb9baadd24d3b0c`.
**PR104 FUSIONADO**, conservando PR107 móvil y badge simple. Nuevo trabajo separado
`fix/mecanizado-base-received-progress`, LABv360 propuesta, un único PR Draft.
Las entradas inferiores PR104 OPEN/DRAFT son históricas.

Cambio implementado: denominador de programación base por año/semana/línea/clave,
no asignaciones de mecanizado. Recibidas por auditoría real completa y relaciones
materiales; incompletas sin ventanas cuantificadas quedan pendientes. Ejecución real
conciliada por producción, sin recortes para aparentar programadas≥recibidas≥procesadas.
Una barra gris/azul/verde anidada por sistema; unidades/porcentaje/gráfico, totales
ponderados, filtros y advertencias. No inventar694/577 del boceto ni añadir la unidad
externa. Referencia facilitada: semana44/PANELES2=707+158+227+14=1106, externo1107.
Diferencia1 visible como referencia de revisión, no ajuste. Antes636 era universo de
asignaciones; diferencia aritmética470, sin afirmar desglose no demostrado.

Estado **IMPLEMENTADO / VERIFICADO LOCALMENTE**, no PUBLICADO ni VERIFICADO en
producción. 312/312JS,25 nuevas; browser PC1366/móvil390 con datos sintéticos,
nesting y filtros, contradicciones/parciales, error/reintento; PDT y65ventanas de
26/10T1 preservados. Capturas marcadas como pruebas locales. verify:release360 y
sintaxis/diff aprobados. Detalles: tests/mecanizado-base-progress/README.md y evidence/.

**Validación de datos pendiente y necesaria antes de integrar:** comprobar definición
/payload reales de RPC semanal (base sgp_producciones) y recepción con sesión SGP;
no disponible en esta ejecución. La lectura directa protegida devolvió0 y no se
interpreta como base vacía. No se revalidaron1106/R/P en una nueva consulta autenticada.
Consulta únicamente READ ONLY preparada en docs/sql-proposals/mecanizado/
BASE_PROGRESS_READONLY_PREFLIGHT.sql, no ejecutada ni migración. No volver a pedir
las funciones PDT ya recibidas. Recibidas incompletas sin asignación cuantitativa no
se convierten de perfiles a ventanas. Sin fallback al denominador incorrecto.

Sin Supabase/Firebase productivo, SQL aplicado, datos, RLS, fusión ni despliegue.
Ensamble/Empaque/Picking y GOOGLE/LAC intactos; no conciliación Export/base ni nuevos
permisos para aprobar incorporaciones. SHA final y CI se consultan en el PR Draft.
Siguiente paso único: revisión ChatGPT del único PR, resolviendo la aceptación de
fuentes antes de cualquier integración/publicación autorizada por separado.

---

# Continuidad vigente — PR104 sincronizado con PR107

Fecha Colombia (UTC−5): 2026-10-26T15:00:50.980709-05:00. Rama existente:
`feat/issue-103-weekly-system-progress`, PR104 **OPEN/DRAFT**.
Main vigente incorporado: `cc3ef6f11fb5bb4142b494a32483b6cdf4c1fbf5`.
PR107 **FUSIONADO**: contención móvil de daily-tabs, app-shell/topbar y tablas;
indicador muestra exclusivamente **LAB v359**. SHA/fecha de compilación conservados
en atributo/title del build, no texto adicional visible. CSS cache-bust359.1.
No se incrementa versión ni se vuelve al indicador antiguo con sufijo PDT/SHA.

Implementación Issue103 preservada: puente app.js y cálculo de avance físico por
sistema idénticos al SHA anterior `f7ccf425859c3130a7051278343fe9bb4b771f88`.
Índice, styles.css y generador de release idénticos a main/PR107; sin sobrescribir
las correcciones móviles. Prueba por hashes en tests/issue103/evidence/pr107-sync.json.

Validación local: **287/287JS**, verify:release359, sintaxis y diff aprobados.
Browser PC1366/móvil390 sobre **index.html real sin ejecutar scripts operativos**,
cliente sintético; badge exacto359, tabs con scroll interno, sin overflow de página,
avance/filtros/barras/errores/reintentos y cantidades anteriores conservados.
Regresiones PDT358 y calendario26/10T1=8+57=65 repetidas y aprobadas en PC/móvil.
Capturas/resultados renovados en tests/issue103/evidence. CI del SHA final en PR104.

No consultas ni modificaciones de Supabase en esta sincronización. No cambios de
Firebase, GOOGLE, LAC, SQL o datos; no publicación ni fusión del PR104. Los registros
inferiores con base7be93c6 corresponden al desarrollo previo, no a la base vigente.
Pendientes originales: sesión SGP real/roles y dispositivo físico/planta; no se
presentan fixtures ni merge de PR107 como aceptación o despliegue de este PR.
Estado: **IMPLEMENTADO EN RAMA — VERIFICADO LOCALMENTE — LISTO PARA REVISIÓN FINAL**.
Siguiente paso único: revisión final de ChatGPT del mismo PR104. No fusionar/publicar.

---

# Continuidad vigente — Issue #103 / LAB v359

Fecha UTC: 2026-10-26T19:18:43.824681+00:00.
Repositorio: SGP-ONE-LAB. Rama: `feat/issue-103-weekly-system-progress`.
Base main verificada: `7be93c644ee402f051a237fbd2fb7564faf7bbaa`.
**PR102 FUSIONADO / LABv358 en main**, conservando PR101/LABv357: programación
individual y Semana/Acabado; PDT sin cerrar y mejoras de rendimiento. Las entradas
inferiores que describen PR102 Draft/no fusionado son históricas, no estado vigente.
Publicación358 no revalidada aquí; no inferirla del merge.

Issue103 implementa el avance físico por sistema directamente en el Resumen semanal:
indicadores, tabla ordenable/barras y tarjetas móviles; semanas/sistema existentes,
lecturas autorizadas agrupadas y paginadas. Carga operativa por fecha/turno intacta y
separada. No suma arrastres como ventanas nuevas; traslados conservan semana origen.
Ambigüedades se excluyen con aviso de cobertura incompleta. Lectura fallida muestra
error/reintento, no ceros ni datos anteriores. Versión propuesta359 no publicada.

Fuentes exactas/reglas/límites: `tests/issue103/README.md`. Lectura real de tablas
55ejecuciones/76programaciones/163estadospororden; sin exportar identidades/usuarios.
Ejemplo PROCESADO43/43 confirma regla de encabezado, no totales semanales completos.
Las RPC protegidas reutilizan contratos vigentes; no había sesión SGP para probarlas
con rol real en este entorno. Tabla de detalles privada no se usa ni se abre.
Sin modificaciones de Supabase, SQL, RLS, Firebase, GOOGLE ni LAC.

Evidencias: `tests/issue103/evidence/`: **287/287JS**,16nuevas, visual PC1366/móvil390,
4consultas de snapshot y0adicionales al filtrar dentro de TTL30s; regresiónPDT358 y
26/10T1=8+57=65 aprobadas. Datos de navegador sintéticos; pruebas no equivalen a
aceptación productiva. `verify:release`359/sintaxis/diff aprobados; CI final en PR.
Se conservan las evidencias anteriores válidas; no se repiten migraciones ni SQL.

Estado: **IMPLEMENTADO EN RAMA — VERIFICADO LOCALMENTE**. No APLICADO nuevamente,
FUSIONADO ni PUBLICADO359. Pendiente lectura autenticada con roles y aceptación en
hardware de planta, conciliación de orígenes históricos ambiguos si fuera necesaria.
No hay nueva persistencia de semana ni gráfico diario de ejecución no demostrable.
Siguiente paso único: revisión ChatGPT del único PR Draft de Issue103; detenerse
antes de fusión/publicación. Consultar SHA final/CI del PR al recuperar continuidad.

---

> Sincronización de PR #102 tras revisión ChatGPT del 26/10/2026:
> main LAB v357 / PR #101 **FUSIONADO**, SHA
> `f073202416f9624fe2eee485c828e80c58e98bec`, incorporado a la rama existente.
> PR102 mantiene **LAB v358** y permanece Draft: no fusionado ni publicado.
> Programación individual de reserva8707142 y columnas Semana/Acabado conservadas.
> SQL histórico sin cambios ni ejecución. Supabase y Firebase no intervenidos.

## Estado ejecutivo vigente — Issue #99 / LAB v358 en rama

Actualizado UTC: 2026-10-26T18:19:48.006490+00:00. Esta entrada prevalece sobre estados históricos inferiores.
Repositorio exclusivo: SGP-ONE-LAB. Base main comprobada para el encargo:
`f073202416f9624fe2eee485c828e80c58e98bec` (LAB v357, PR #101 fusionado); incorporado
a esta rama. Volver a consultar antes de integrar.
Rama independiente: `feat/issue-99-pdt-refresh-performance`. Primer checkpoint de
código guardado y subido: `beb6e80`; consultar el SHA final del PR para la entrega.

| Hito | Estado y evidencia |
|---|---|
| PR #94 — identidad PANEL/FRAME y reparación protegida | FUSIONADO en main, `89c2bbf4713082167961df22d82e511eccfd5f0e`; no repetir corrección de datos. No revalidada aplicación SQL en este encargo. |
| PR #96 — detalle PDT responsive, REPO OK | FUSIONADO, `eb0e1dc197d67072d556c226af318f5cd28a800e`. Contratos preservados. |
| PR #98 — carga por turno, RPC segura y LAB v355 | FUSIONADO, `c6d759751ea7a8e879233ad7d3df9f1c8876321e`. Workflow Firebase live run `40354206607` SUCCESS sobre ese SHA: evidencia de PUBLICACIÓN v355; no prueba funcional autenticada. |
| RPC `sgp_mecanizado_reprogramaciones_listar` | Código/SQL versionados por PR98; instalación efectiva no reconsultada aquí. No inferir aplicación a partir de merge o despliegue. No volver a SELECT directo/RLS abierto. |
| PR #101 — programación individual y Semana/Acabado | FUSIONADO en main, `f073202416f9624fe2eee485c828e80c58e98bec`; funciones saveProgramming/loadMissing conservadas literalmente en PR102. No se presume publicación ni aceptación productiva de v357. |
| Hotfix historial PDT v2 | APLICADO y definiciones VERIFICADAS según evidencia de ChatGPT en Issue99: tres funciones con estado_nuevo y guard de rol real. Archivo equivalente en docs/sql-applied; NO reaplicar. E2E real pendiente. |
| LAB v358, Issue99 | IMPLEMENTADO EN RAMA, VERIFICADO LOCALMENTE con fixtures. No APLICADO nuevamente en Supabase, no FUSIONADO ni PUBLICADO. |

PDT: mismo modal tras escribir, datos leídos otra vez del servidor, contexto conservado,
prevención de duplicados y reintento seguro. Mecanizado: lecturas independientes en
paralelo, agrupamiento40ms/sesión, filtros locales sin recarga de calendario, carga de
órdenes solo al expandir y PDT global sin recarga por cada filtro. Sin cambios de reglas.

Evidencias actuales: `tests/issue99/README.md` y `tests/issue99/evidence/`: 271/271 JS después de sincronizar con main (incluidas cuatro regresiones dinámicas de PR101),
23 aserciones SQL aisladas PG17.11, PC1366/móvil390 con RPC sintéticas, regresiones de
once contratos y caso26/10 T1=8+57=65; sintaxis y verify:release LABv358 aprobados.
Medición controlada45ms/lectura: semanas rápidas24→8, búsqueda3→0 y fecha/turno74→9
solicitudes. Tiempos exactos/muestras antes/después y límites en el README/JSON;
no representan latencia productiva. Las funciones medidas no cambiaron al incorporar PR101;
se reutiliza el benchmark del SHA previo47d09cc, no se presenta como nueva medición.
Comparaciones SHA256 y preservación: tests/issue99/evidence/main-sync.json.
CI del SHA final debe comprobarse en el PR102.

PENDIENTE: revisión ChatGPT del único PR Draft, CI remoto final, medición/aceptación
con sesión y móvil reales tras autorización de publicación. No se modificaron datos,
Supabase, Firebase live, GOOGLE ni LAC; no hubo fusión/despliegue en este encargo.
Las entradas antiguas «PR98 OPEN/DRAFT», «v355 no publicado», «PR101 pendiente» y bloqueos de lectura
son HISTÓRICAS, superadas solo en lo expresamente evidenciado en esta tabla.

Tareas reservadas a ChatGPT, NO incluidas aquí: selector desplegable de semanas,
indicadores de avance por sistema e investigación de53 registros sin semana.
Siguiente acción única: revisar el PR Draft de Issue99. No fusionar ni desplegar
sin autorización; mantener las propuestas SQL fuera de aplicación automática.

---

# SGP_ONE — CHECKPOINT OPERATIVO (Continuity v2.1)

Fecha de conciliación: 2026-10-22 (fecha documental; comprobar fecha/hora de GitHub al recuperar)
Repositorio: `jcastillodelarosa-hub/SGP-ONE-LAB`
Rama oficial: `main`

## Cómo recuperar sin confundir el commit con el contenido
El SHA del commit que escribe este archivo se genera **después** de guardar. No exigir que el checkpoint contenga su propio SHA. Verificar el HEAD real, historial del archivo, SHA de contenido y PR relevantes desde GitHub. El último HEAD comprobado **antes** de esta conciliación es `e1b78f914f0f9b9889de15fd04e9b8325a1b65e9`; NO asumir que siga siendo HEAD.

## Hitos fusionados comprobados (código en main; no implica despliegue)
- PR #44 — Planificador Ensamble LAB v327; commit `6d72f7232cfc6217d7def47500ea2e1007a73ebc`.
- PR #47 — mejoras visuales Planificador/Ensamble/Empaque LAB v327; commit `3b9eadee45e0fe46933c3f5829ff2ece790cceb0`.
- PR #48 — reserva principal en prioridades; commit `0a00d0a847015d0a6f7870a1c33a6f6800754a09`.
- PR #49 — selección y programación desde explorador v328; commit `e6863b72e22c4133362179377bd5c0612fd298ed`.
- PR #50 — conexión Planificador–Programación de Línea v329; commit `114a003c721c915d044a1bbc3a1c5a473501b322`.
- PR #51 — protocolo documental Continuity v2; commit `bd1d603aec481d2909d87c0a5d83f4a0f9a2df1f`.
- Commit `e1b78f914f0f9b9889de15fd04e9b8325a1b65e9` — primera conciliación del checkpoint tras PR #51.

## Versiones y estados, sin inferencias
- `index.html` en main referencia `styles.css?v=327` y `production-line-visual-v327.css?v=1`. Estas son **versiones de recursos visuales**, no un indicador exhaustivo de todas las funcionalidades.
- Funcionalidades v328 y v329: **FUSIONADAS EN MAIN** según PR #49 y #50. No afirmar que la aplicación completa esté publicada o validada en producción.
- `SGP_ONE_MASTER_CONTEXT.md` conserva snapshot de 2026-10-19 (LAB v281/backend v282); es **histórico**, no estado ejecutivo actual.
- `SGP_ONE_ESTADO_ACTUAL.md` es historial con entradas de distintas fechas; sus menciones de trabajos pendientes deben cotejarse con PR posteriores.
- Supabase: el historial documenta RPC `sgp_linea_plan_explorador_v327` aplicada; **no se consultó Supabase vivo en esta conciliación**.
- Firebase Hosting: **despliegue actual no comprobado**.
- PC/móvil: **aceptación funcional del Planificador v327/v328/v329 no comprobada**.

## PR abiertos observados
#46 hotfix v327; #34 CI Firebase; #22 reprogramación/vidrio; #14 cantidad móvil; #6 documentación Skills; #1 Picking/programación. No fusionar sin comparar con main; una rama antigua puede contener cambios ya integrados por otros PR.

## Prueba de continuidad
- Recuperación desde conversación nueva: **SUPERADA** en lectura de documentos, Skills, HEAD y PR; el usuario reportó resultado global **PARCIAL** por desactualización del checkpoint.
- Conciliación documental v2.1: esta edición corrige hitos y criterio de SHA. Verificar el commit de escritura y relectura de main tras guardar.
- Automatización de checkpoints: **NO autónoma**. En cada hito autorizado, escribir, verificar y reportar el commit; si no hay permiso de escritura, entregar texto en chat.

## Alcance de esta operación
Autorizado: conciliación documental del checkpoint y referencias ejecutivas obsoletas. Prohibido: modificar lógica de aplicación, Supabase, Firebase, SGP_ONE_GOOGLE, desplegar o fusionar PR.

## Hito documental posterior — Design Engineering (2026-10-22)
- Skill original SGP `.agents/skills/design-engineering/SKILL.md` creada en main, inspirada en fuentes públicas de Emil Kowalski; **no equivale a instalar una skill oficial en ChatGPT**.
- Orchestrator actualizado para consultar esta skill en solicitudes de interfaz, tablas, animaciones y móvil, tras recuperación de continuidad.
- Estado: **DOCUMENTACIÓN EN MAIN**; no se modificó HTML/CSS/JS operativo, Supabase, Firebase ni SGP_ONE_GOOGLE. No se han ejecutado pruebas funcionales de la aplicación por este cambio.
- Comprobar contenido y SHA del archivo en GitHub en el siguiente chat antes de aplicar recomendaciones.

## Siguiente paso único
Realizar una **prueba de recuperación de solo lectura** desde otro chat: comprobar que Orchestrator encuentra y consulta Design Engineering para una solicitud de diseño SGP; verificar GitHub main y no cambiar código.

---

## 2026-10-24 — Cierre de implementación SGP_ONE LAB v348

- **Proyecto:** SGP_ONE (SGP-ONE-LAB), distinto e independiente de SGP_ONE_GOOGLE.
- **Base verificada:** main merge e6247b761ec14a7efc80951aa767a565daad83fe; PR #82 fusionado por squash. UI index.html LAB v348.
- **Objetivo:** estado de programación SÍ/NO independiente de estado operativo; estados SIN INICIAR, CORTE, MECANIZADO, PROCESADO; Continuar programación parcial; preservar reprogramaciones, reservas compartidas y Picking.
- **Backend:** migración lab_v348_programada_independiente versión Supabase 20261024154023 APLICADA. Previamente se ensayaron migración y reversión en transacción con ROLLBACK. Script de reversión: docs/programada-sin-iniciar-v348-rollback.sql.
- **Evidencia posmigración:** 68 programaciones: 65 SIN INICIAR y 3 CANCELADA; indicador programada 65 true y 3 false sin inconsistencias. Ejecución por orden 11 SIN INICIAR, 2 CORTE, 128 PROCESADO, 5 REPROGRAMADO. Ejecución general 8 CORTE, 2 MECANIZADO, 41 PROCESADO. Historial por orden 283 registros, conservado.
- **Tests:** CI main e6247b7: SGP ONE Tests run 40108179487 SUCCESS (195/195), JavaScript syntax check 40108179523 SUCCESS, verificación paquete release LAB v348. Prueba SQL con sesión falsa rechazada sin escribir historial.
- **Firebase:** workflow Deploy SGP ONE to Firebase Hosting 40108179480 SUCCESS; paso Firebase Hosting SUCCESS, canal live, proyecto sgp-one-lab, versión Hosting bba8e9e940aefd72, URL publicada https://sgp-one-lab.web.app/.
- **Límites:** no se pudo abrir el sitio publicado mediante la herramienta de navegación externa; no se dispone de sesión real de planta. Los flujos autenticados, pruebas visuales PC/móvil y acceso desde red de planta NO están funcionalmente verificados; despliegue exitoso no equivale a esa aceptación.
- **Estado preciso:** IMPLEMENTADO, FUSIONADO MAIN, APLICADO EN SUPABASE y PUBLICADO FIREBASE; PRUEBAS AUTOMATIZADAS Y ENSAYOS SQL SATISFACTORIOS; ACEPTACIÓN OPERATIVA PC/MÓVIL/PLANTA PENDIENTE.
- **Próximo paso único:** validar en navegador autenticado que una reserva parcial muestra Continuar, que una nueva programación aparece como SIN INICIAR y que las etapas, arrastre y Picking preservan las reglas existentes; registrar evidencias sin alterar SGP_ONE_GOOGLE.


## Handoff PDT aluminio 2026-10-24
- PR #91, rama feat/pdt-multifabricacion-avances-nc, baseline main d07894f6.
- Alcance: multi NC, correccion de cantidad y fabricaciones, movimientos parciales, avisos REPO OK derivados.
- Autorizado: rama, PR y pruebas no destructivas. Sin cambios Supabase, fusion ni publicacion.
- Estado: reglas y borrador SQL documentados; RPC e interfaz pendientes.
- Siguiente paso: contratos RPC versionados y pruebas sin aplicar SQL.


## Continuidad PDT 2026-10-24 — avance PR #91
- Rama feat/pdt-multifabricacion-avances-nc; cambios en app.js: REPO_OK ya no seleccionable manualmente; conserva visualizacion de valores historicos. Entrada NC multiples explicita; busqueda individual existente no se presenta como verificacion multiple.
- Funciones puras de saldos, estado NC y cierre por Picking con pruebas escritas, aun no ejecutadas.
- No se han creado ni aplicado RPC; migracion SQL sigue en borrador. Sin cambios a Supabase, main ni Firebase.
- Riesgo: frontend de validacion multifabricacion y avances no conectado a backend; no declarar implementacion completa.
- Proximo paso: completar contrato RPC seguro, integrar UI y ejecutar pruebas; pedir autorizacion separada antes de aplicar SQL.


## 2026-10-24 — Autorización ampliada y bloqueo técnico PR #91
- Usuario autorizó cambios necesarios; no confundir autorización con pruebas superadas.
- Supabase producción inspeccionada solo con SELECT; proyecto ocvxbwzqxbrfndkvjmfx. Se comprobó que sgp_aluminio_pendiente_validar permite ADMINISTRADOR/COORDINADOR/LIDER LINEA/SUPERVISOR DE PICKING, pero no RECEPCION. sgp_validar_sesion_rol tiene equivalencia RECEPCION solo cuando se solicita LIDER, no cuando se solicita LIDER LINEA.
- Archivo supabase/migrations/20261024_pdt_rpc_contracts_REVIEW.sql preparado con RPC de validación multifabricación y avance parcial; **NO APLICAR**: la RPC propuesta delega en el validador antiguo, que rechaza RECEPCION. Debe extraerse comprobación equivalente a función interna segura, sin ampliar permisos involuntarios.
- Otros pendientes de revisión: fecha operativa/turnos, NC múltiples, reversión de movimientos, cierre Picking, RLS/grants, migración histórica, pruebas de SQL y de navegador.
- Estado: PROTOTIPO DE CONTRATOS EN RAMA; NO APTO PARA DESPLIEGUE. No hubo migración, merge ni Firebase deploy.

## Handoff local PR #91 — fases PDT A/B (2026-10-25)

- Rama local `feat/pdt-multifabricacion-avances-nc`, HEAD sin cambio
  `4f486b8e90a40c4f0f4daaa2e16b0aa158e09f49`. Cambios SIN COMMIT NI PUSH.
- Contrato LEGACY/V2 explícito, UUID/snapshot de detalle, avances/reversos/NC,
  adaptador y modal por capacidades; SQL fuera de migraciones automáticas.
- Fase A mantiene cierre v2 deshabilitado y preserva cierre legacy; fase B separada
  incorpora registro positivo, validación, asignación y cierre cuantitativo.
- Evidencia: tests JS, PostgreSQL 17 sin red con fixtures sintéticas y controlador
  Chromium PC/móvil con RPC simuladas; resultados y comandos en
  `docs/sql-proposals/pdt/README.md`.
- NO equivale a restauración de Supabase, prueba de sesiones SGP reales,
  aplicación productiva, integración a main o despliegue Firebase.
- Próximo paso: revisión de diff y contraste de firmas/esquema reales antes de
  autorizar transferencia o aplicación. Preservar protección Hosting de PR #92.

## Consolidación autorizada PR #91 — 2026-10-25

- Propietario autorizó commits, push exclusivamente a la rama existente y actualizar
  el PR #91; no autorizó merge, SQL productivo ni Firebase.
- Base local anterior a consolidación: `4f486b8e90a40c4f0f4daaa2e16b0aa158e09f49`;
  main remoto comprobado `db70f601cc01a470a6a3908cae19caac59dfe34b`.
- Revalidación: 222 pruebas JS; 35 aserciones SQL sintéticas; seis escenarios
  concurrentes; controlador Chromium PC/móvil; release y sintaxis aprobados.
- Revisión de workflows: push a esta rama no publica Firebase; solo CI del PR.
  Pages has_pages=false. No cambios a firebase.json ni workflows.
- Revisados archivos nuevos y diff: sin credenciales privadas detectadas; fixtures
  usan roles/tokens sintéticos. SQL REVIEW fuera de migraciones automáticas.
- Estado de entrega: IMPLEMENTADO EN RAMA; comprobar SHA final con Git/GitHub.
  No APLICADO EN SUPABASE, no PUBLICADO ni VERIFICADO EN PRODUCCIÓN.
- Siguiente paso: revisión técnica de PR #91 y contraste con definiciones reales,
  antes de solicitar cualquier aprobación de aplicación, integración o publicación.

## Preparación local: rol real PDT v2 — 2026-10-25

- HEAD sigue d90d850f2a8ee7d1a111a71073e93a63f04fbac1, cambios SIN COMMIT/PUSH.
- Avances/reversos/etapas requieren rol exacto de sgp_sesion_actual; helper legacy
  y equivalencia Recepción→Líder permanecen intactos. No modifica permisos legacy.
- SQL aislado sintético: 37 aserciones base, 26 regresiones, seis concurrencias.
- Conservada corrección AUDITADA_DIFERENCIA; únicamente VALIDADA acredita entrega.
- Contrato real de sesión y cuerpos completos de funciones aún requieren contraste;
  no hay prueba de autenticación productiva. No SQL productivo, merge ni despliegue.
- Siguiente paso: revisar este diff y contrastar el resultado del preflight real;
  no autorizar instalación por resultados de mocks.

## Cierre autónomo de preparación PDT — 2026-10-25

- Cambios locales preservados; HEAD d90d850f2a8ee7d1a111a71073e93a63f04fbac1.
- Informe único: docs/sql-proposals/pdt/FINAL_READINESS.md.
- 222 JS, 63 SQL sintéticos, seis concurrencias, 12 unitarias de herramientas;
  instalación atómica/fallo inducido, navegador PC/móvil y recuperación de fixture aprobados.
- Dump/restauración comprobada SOLO en fixture sintética, no respaldo de Supabase.
- Bloqueos: falta JSON/cuerpos productivos completos, réplica compatible y prueba
  de autenticación/recuperación productiva. No inventar definiciones 6/8 ni triggers.
- Próximo paso único: propietario ejecuta preflight SQL actualizado y aporta JSON.
- Sin commits/push nuevos, SQL productivo, merge ni Firebase; no tocar otros repositorios.

## Contraste con complemento confirmado — 2026-10-25

- Resultado PARCIAL. Local PostgreSQL 17.11 coincide con versión comunicada.
- Fixture de sgp_sesion_actual incorpora valida/usuario/nombre/rol; 63 SQL y seis
  concurrencias se mantienen, con rollback/instalación AB probados nuevamente.
- Confirmación del propietario: 3 triggers, 19 columnas, 5 extensiones y 7 firmas
  con MD5. No hay artefacto de sus cuerpos/valores en adjuntos ni comentarios PR.
- Siguiente paso único: hacer accesible el export existente, sin repetir SQL.
- FINAL_READINESS.md actualizado; cambios conservados sin commit/push ni producción.

## Evidencia real recibida e integrada — 2026-10-25

- Los dos archivos reales están en scripts/pdt-compatibility/evidence/ sin modificar.
- Siete MD5 coinciden tras CRLF→LF; cuatro del complemento reconstruido coinciden
  directamente. Se mantiene expresamente su procedencia reconstruida.
- 19 columnas y tres triggers reales reproducidos en PostgreSQL 17.11.
- Pruebas con autenticación real por hash: 63 base + 21 adicionales, seis concurrencias;
  fallo transaccional revierte DDL y las 11 definiciones. Dos entregas intactas.
- Bloqueo anterior de archivos RESUELTO. Incompatibilidad confirmada: defaults
  solapados hacen ambigua la llamada legacy de seis argumentos antes/después del PR.
- Retirar defaults requiere DROP/CREATE; intento CREATE OR REPLACE rechazado en QA
  y retirado del SQL propuesto. No se introdujo DROP ni cambio unilateral legacy.
- FINAL_READINESS.md actualizado: PARCIAL para integración final, no producción.
- Siguiente paso único: revisión/aprobación de solución delimitada a sobrecarga 6/8.
- HEAD sigue d90d850f2a8ee7d1a111a71073e93a63f04fbac1; sin commit/push, merge o despliegue.

## Consolidación final autorizada PR #91 — 2026-10-25

- Estado vigente: IMPLEMENTADO EN RAMA; reemplaza los bloqueos históricos anteriores.
- Main observado db70f601cc01a470a6a3908cae19caac59dfe34b; rama existente
  feat/pdt-multifabricacion-avances-nc. El commit de esta entrada consolida el trabajo
  pendiente sobre d90d850f2a8ee7d1a111a71073e93a63f04fbac1, con commit/push autorizados.
- Fuentes reales conservadas y 11/11 MD5 contrastados; complemento reconstruido.
- Compatibilidad 6/8 resuelta en aislamiento con traslado del original a esquema
  privado, entrada pública sin defaults solapados y recuperación sin DROP.
- 222 JS, 63 + 24 SQL, seis concurrencias, 12 Python, seis HTTP y PC/móvil aprobados;
  instalación atómica, rollback inducido y dump/restore/reinstalación QA comprobados.
- Informe y evidencia: docs/sql-proposals/pdt/FINAL_READINESS.md y
  scripts/pdt-compatibility/validation-report.json.
- No Supabase productivo, merge, Firebase, main, GOOGLE ni LAC modificados.
- Límites: dependencias DDL parcialmente reconstruidas; consumidores externos y
  catálogo íntegro/RLS productivos no verificados; no backup productivo recuperable.
- Próximo paso único: revisión PR #91 y autorización separada de réplica restaurada
  para aceptación final. No repetir consultas ya aportadas ni asumir publicación.

## Metodología y demostración PDT v2 — 2026-10-25

- Regla vigente: necesidad → implementación → demostración → correcciones → cierre.
  AGENTS.md y las diez Skills priorizan evidencia reutilizable y pruebas proporcionales.
- Trabajo en feat/pdt-multifabricacion-avances-nc, PR #91; base local 51d77d9a8666f2ede30afc6ca054d5b97bdc516b.
- Demo local: `python tests/pdt-demo/start.py`, abrir http://localhost:8765 en el
  mismo PC. PostgreSQL/PostgREST QA con datos ficticios, controlador y RPC reales.
  No usar este localhost como enlace público del entorno de Codex.
- Recorridos: 5+4, avance parcial/reverso, NC múltiples; entrega positiva,
  validación, acreditación y cierre de PDT dentro de orden parcial.
- Recorrido nuevo de demo APROBADO en Chromium PC/móvil con RPC QA reales:
  distribución, avance/reverso, NC, cierre prematuro rechazado y cierre con evidencia
  dentro de orden parcial. Rutas internas y Origin externo rechazados.
  Pruebas anteriores reutilizadas: SQL/operación no modificados.
  Evidencia: tests/pdt-demo/demo-smoke-report.json y screenshots/.
- Conexión GitHub: hubo 401 al inicio; se recuperó durante la entrega. Commit
  funcional 626f5c46bd32579ef2cec298caaa49911ff8d57b publicado y confirmado por Git/API
  en el PR #91 OPEN/DRAFT. Main continúa db70f601cc01a470a6a3908cae19caac59dfe34b.
- No SQL productivo, merge, publicación, main, GOOGLE ni LAC modificados.
- Próximo paso: abrir la demo local siguiendo tests/pdt-demo/README.md.
  No hay enlace público; acceso externo/publicación requeriría autorización separada.

## Acceso corregido a demostración — 2026-10-25

- No usar localhost de Codex como enlace desde el PC del propietario.
- Alternativa sin instalación: tests/pdt-demo/PDT_V2_DEMO_AUTOCONTENIDA.html,
  descargar desde GitHub (Download raw file) y abrir en Chrome. Es SIMULACIÓN
  VISUAL en memoria: cero RPC, backend, autenticación real o acceso productivo.
- Controlador real reutilizado; recorrido PC/móvil aprobado con red desactivada,
  cero solicitudes HTTP/HTTPS y cero errores JS. Evidencia offline-smoke-report.json.
- Herramientas de esta sesión sin port-forward/preview/túnel autenticado.
  No se publicó URL QA; plan Cloudflare Tunnel+Access con expiración en
  tests/pdt-demo/REMOTE_ACCESS.md, sujeto a autorización externa separada.
- No SQL productivo, merge, main, Firebase, GOOGLE o LAC modificados.
- Próximo paso: propietario descarga y abre el HTML autocontenido; si requiere
  operaciones contra QA remoto, aprobar primero la infraestructura protegida.

## Conexión productiva de respaldo desbloqueada — 2026-10-25

- Environment GitHub: supabase-backup; contraseña utilizada solo dentro del runner.
- Conexión PostgreSQL 17 verificada en modo solo lectura con TLS verify-full,
  pooler suministrado por el propietario y CA públicas del CLI oficial Supabase.
- Evidencia: Actions run 40233611474, commit be5cf504fb2585c15a4f360c00d54850522222bb.
  Job de conexión SUCCESS, preview SKIPPED. Cinco pruebas nuevas de manejo seguro
  aprobadas; no se repitió la batería PDT SQL. El CI existente pasó automáticamente.
- Entrada manual registrada: firebase-preview-linea-produccion.yml, seleccionando
  feat/pdt-multifabricacion-avances-nc. Solo esa rama ejecuta el job de conexión;
  la rama original de preview conserva su condición y comportamiento.
- Respaldo productivo aún NO generado, restaurado ni verificado. Pendiente destino
  privado cifrado fuera de GitHub y ventana coordinada con planta. No subir dumps
  a artefactos/logs/repositorio ni usar un archivo efímero como respaldo recuperable.
- Autorización de instalación/merge/publicación permanece vigente, condicionada a
  respaldo restaurado, integridad y recuperación que preserve escrituras posteriores.
- No migraciones, fusión ni publicación. Firebase live conserva 476 ejecuciones,
  última 40133962854. No automatizar pausas de planta ni restaurar dumps antiguos.
- Próximo paso: recibir destino privado y ventana operativa solicitados al propietario,
  completar respaldo/restauración y continuar la instalación autorizada.

## GCS y restauración aislada preparados — 2026-10-25

- Ventana autorizada por propietario: 25/10/2026 22:00–23:00 Colombia,
  equivalente a 26/10/2026 03:00–04:00 UTC. La coordinación efectiva de
  escrituras con planta NO está confirmada; no detener operaciones ni migrar
  solo por llegar a esa hora. No pedir de nuevo aprobación de SQL/merge/deploy.
- GCS autenticado con OAuth del SDK reutilizando la credencial existente,
  sin crear claves ni activar IAM Credentials API (la primera ruta la requería).
- Inventario real: proyecto sgp-one-lab, CERO buckets, run 40234463659 SUCCESS.
  Sin cambios en IAM, buckets, objetos o servicios; no se exportaron datos.
- Propuesta revisable: tests/pdt-backup/gcs-config/bucket.json y writer-role.json.
  Bucket privado sgp-one-lab-supabase-backups, cifrado GCS, acceso público
  impedido, retención propuesta siete días; permisos sin delete/overwrite/IAM.
  Su creación/consumo puede generar cargos: requiere aprobación expresa conforme
  a la restricción del propietario. No asumir cuota gratuita ni crear el recurso.
- Entorno de restauración preparado: supabase/postgres:17.11.0.006, extensión
  control files verificados y restauración custom SINTÉTICA aprobada, run
  40235106387 SUCCESS. Datos ficticios, contenedor sin red ni puertos publicados.
  El intento local encontró límite de extracción Docker; se resolvió en runner
  aislado sin borrar QA local. No declarar restauración productiva verificada.
- Diez pruebas de las nuevas barreras/conectividad aprobadas; contratos PDT y
  pruebas SQL anteriores reutilizados. No SQL productivo, merge ni Firebase.
- Firebase live sigue en 476 ejecuciones; última 40133962854.
- Próximo paso: aprobación del bucket y su consumo, o destino privado existente
  autorizado; después respaldo consistente/recuperación real antes de instalación.

## Recuperación real desde GCS — 2026-10-25

**VERIFICADA para el alcance PostgreSQL/contratos SGP**, run
[40246169107](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/40246169107),
commit ejecutado `f6ccd4edd7c0c9ea92897c243b941e9478ff73b3`.
Se reutilizó el respaldo existente; no se generó otro ni se consultó producción.
Manifiesto privado (no público): `gs://sgp-one-lab-supabase-backups/supabase/ocvxbwzqxbrfndkvjmfx/20261025T214531Z-0328f4586c6949528a1333cf9b0c14c2/recovery-verified.json`.

- Archivos recuperados desde generaciones GCS fijas, SHA256 y tamaños comprobados.
- PostgreSQL/Supabase 17.11, contenedor nuevo sin red ni puertos, datos solo en tmpfs.
- Restaurados globales sin contraseñas y archivo custom con `pg_restore --create
  --exit-on-error`, conservando owner/ACL/configuración de base. No se filtra el TOC.
- Error PG17 de `GRANTED BY` resuelto preservando `supabase_admin` como bootstrap
  (OID 10), en lugar de crear un homónimo bajo un bootstrap distinto. Solo CREATE
  ROLE duplicado es tolerado; ALTER ROLE y membresías originales permanecen intactos.
- Coinciden conteos de todas las tablas inventariadas en el snapshot y catálogo
  crítico: funciones/cuerpos, relaciones, triggers, políticas, roles, membresías,
  secuencias, extensiones y permisos por defecto. Estos últimos se comparan mediante
  `aclexplode`, preservando grantor/grantee/privilegio/grantable y sin depender del
  orden textual del array ACL. No se relajó la comparación de permisos.
- No se excluyeron objetos SGP ni roles administrados presentes en el dump.
  La copia no es una réplica completa de la plataforma Supabase: no incluye hashes
  de contraseñas, claves externas Vault, bytes de Storage externo, servicios de
  autenticación/gateway ni configuración externa. No se probaron esos componentes
  ni PITR/replay de escrituras posteriores. Conteos no equivalen a hashes por fila.
- Se conservaron las pruebas PDT previas sin repetirlas; 24 pruebas de seguridad
  del mecanismo de respaldo aprobadas. La recuperación real confirma catálogo/datos,
  no declara PDT aplicado o validado en producción.

**Gate productivo pendiente:** control efectivo de escrituras con planta, no
confirmado. Ventana autorizada 25/10 22:00–23:00 Colombia (26/10 03:00–04:00 UTC).
No detener operaciones por llegar a la hora. Las autorizaciones SQL/merge/deploy
permanecen vigentes; no se requiere volver a solicitarlas. Antes de DDL, verificar
ese control y vigencia de ventana. No restaurar este snapshot sobre producción
activa: perdería operaciones posteriores; rollback transaccional antes del commit
y corrección forward compatible después, conservando datos/eventos V2. Si fuera
necesaria recuperación destructiva, primero preservar/reconciliar escrituras nuevas
con un mecanismo probado; no se ha demostrado replay automático.

Sin SQL productivo, fusión ni despliegue. Main sigue en
`db70f601cc01a470a6a3908cae19caac59dfe34b`; Firebase live conserva 476 runs,
último `40133962854`. PR #91 sigue OPEN/DRAFT.

## Instalación productiva autorizada ejecutada — 2026-10-25

El propietario adelantó expresamente la ventana y garantizó ausencia de turno,
usuarios y operaciones de planta durante la intervención. Run
[40246792417](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/40246792417)
SUCCESS, commit ejecutado `36c320bf3f39f227372fc490d2d9890ad632dba2`.

- Control técnico: misma transacción PostgreSQL REPEATABLE READ READ WRITE con
  SHARE ROW EXCLUSIVE NOWAIT sobre tablas public; bloquea escritores ordinarios
  y automáticos, permite las lecturas del respaldo. Si hay conflicto no instala.
  Timeout idle 15 minutos; rollback/desconexión libera el control ante fallo.
- Nuevo respaldo consistente privado GCS, recuperación completa del alcance
  PostgreSQL y catálogo crítico verificados antes del DDL. Manifiesto privado:
  `gs://sgp-one-lab-supabase-backups/supabase/ocvxbwzqxbrfndkvjmfx/20261025T235430Z-d3d77abf5e124c9bbe998e783e8088a9/recovery-verified.json`.
- Diez SQL A/B probados con aceptación y ROLLBACK sobre esa copia real recuperada,
  ejecutados como postgres. Luego aplicados en la transacción productiva que
  conservaba el control de escrituras. Commit confirmado PDT91_PRODUCTION_COMMITTED.
- Aceptación previa al commit: permisos RPC públicos/internos, RLS y ausencia de
  escritura directa en tablas nuevas, guards V2 y sesión inválida rechazada.
  Auth legacy y firma de entrega6 sin cambios. Ningún PDT convertido automáticamente.
- NOTIFY pgrst reload schema enviado transaccionalmente. Bloqueos liberados por
  commit. Registro privado production-install-committed.json junto al respaldo
  contiene SHA256 de cada SQL aplicado. No backup/datos/credenciales en GitHub.
- Main/PR92 incorporado a la rama antes de integrar, conservando protección
  Hosting. Se excluyen también los SQL de Hosting, sin dependencia frontend.
- Siguiente fase: integrar PR91 y publicar con el workflow Firebase live existente;
  verificar acceso HTTPS/recursos, PC/móvil y login/capacidades reales. El smoke
  transaccional crea un usuario sintético y su sesión únicamente dentro de una
  transacción que termina ROLLBACK. No utiliza cuentas/credenciales operativas
  ni declara probadas escrituras reales de Picking por usuarios de planta.

La autorización de merge/despliegue está vigente; no pedirla otra vez. La evidencia
final de publicación y smoke se registra en el PR91 y la entrega de esta ejecución.
No restaurar este dump sobre escrituras posteriores: después del commit conservar
datos/guards y preferir corrección forward; replay automático no demostrado.

## Corrección puntual fuentes PDT v2 — preparada en rama, no publicada

Base main actual e1a5ca5c38456fb746c5954ae4b8e8f127116ea4. Caso reserva8558585,
reporte9: clave pendiente1265779|FRAMES_2 y cuatro fuentes PANEL1265779|PANELES_2.
Identidad maestra, nombre, sistema y reserva/acabado compartidos comprobados en
lectura real (run40256838778). Legacy agrupa y no tiene IDs; no es fallback V2.
UI nueva de distribución/reintento/totales y SQL REVIEW de contexto común preparados;
incluye dependencia de validación y guard snapshot Picking, sin cambiar históricos.
Pruebas limitadas a fuentes/distribución/PC-móvil aprobadas. Evidencia, capturas y
límites exactos en tests/pdt-sources/README.md. No aplicar propuesta, fusionar ni
publicar sin nueva autorización; falta ensayo completo de esa nueva instalación.
No hubo escritura Supabase productivo ni operaciones de prueba sobre datos reales.

## Identidad definitiva por maestro y reparación22 — implementado en rama

Main leído e1a5ca5c38456fb746c5954ae4b8e8f127116ea4. Lecturas40260774688,
40261173332,40263861377 confirman respaldo69, 47 corregidos y22 LEGACY/VALIDADO
FRAMES_2 (11 PENDIENTE/6 PROCESADO/5 PICKING), sin relaciones V2 consultadas.
No repetir47 ni aceptar PANEL en FRAMES_2. Propuesta cruzada anterior bloqueada.
Frontend usa pieza real + clasificación del maestro; backend rechaza clave de
cliente inconsistente y guarda novedad/PDT atómicamente. V2 PANEL estricto.
Reparación22 key-only sin desactivar triggers, con ledger privado y reversión
condicional. Bundle único transaccional preparado mediante builder sin conexión.
235 pruebas JS,17 escenarios SQL en PG17.11 y PC/móvil aprobados; datos sintéticos.
Fuentes, matriz9casos, límites y estados en docs/sql-proposals/pdt/identity/README.md.
No SQL productivo, no Firebase, no main, no fusión/despliegue. Preparar PR Draft
para revisión; aplicar/merge/publicar requieren autorización posterior independiente.


## Issue95 — interfaz PDT v2 y Producción, preparada sin publicación

Registro UTC: 2026-10-26T13:59:35.189655+00:00. Proyecto SGP-ONE-LAB únicamente.
Base main verificada `89c2bbf4713082167961df22d82e511eccfd5f0e`: PR94 ya fusionado.
Rama independiente `feat/issue-95-pdt-v2-ux`; implementación preservada en
`4bdc48a5d3ceb9dc9cdd0297a05602609b792a22`. Fuente: Issue95 de GitHub, sin comentarios
ni imagen adjunta; se implementa su especificación textual del boceto azul/blanco.

Implementado: encabezado/métricas, REPO OK independiente sin acreditar inventario,
distribución en consulta, avances por fabricación, NC, Picking positivo y faltantes
por id_entrega, historial bajo demanda, tabs PC/acordeones móvil, acción fija,
confirmaciones, teclado/foco/errores. Producción con estados y validación separados,
Abrir/menú condicionado, reserva/sistema/semana/cantidad, búsqueda local y orden.
Conserva RPC, argumentos, idempotencia, roles reales, LEGACY/V2 y maestro PANEL/FRAME.
PICKING V2 cerrado queda en consulta; no se amplían permisos de mecanizado a Recepción.
No se cambia ningún SQL del PR94 ni su reparación22; no se repiten las47 correcciones.

Archivos y matriz: `tests/pdt-v2-ux/README.md`; módulos controller/presentation/
production-actions/flow-guidance, app.js, estilos y pruebas. Capturas PC1366×1000 y
móvil390×844, resultados JSON y fixture sintética en `tests/pdt-v2-ux/evidence/`.
Caso sintético9=4+5, tres NC finalizadas, avance0/saldo9; once escrituras RPC probadas
contra cliente simulado, no producción. Historial/faltantes consultados por RPC ya
existentes; faltantes ausentes en la cola no se convierten en cero ni prueba de entrega.

Evidencia local: suite JS238/238 antes de la última regresión vacía; archivo dirigido
4/4 después (incluye una nueva aserción independiente de cantidad no inventada).
Navegador nuevo PC/móvil aprobado; regresión existente en1280/390 aprobada;
node --check, verify:release LABv354 y diff --check aprobados. Sin credenciales
coincidentes en revisión dirigida. No se repiten baterías SQL sin cambios de backend.
Push de rama no activa Hosting: solo pushmain/manual; PR ejecuta Tests/Sintaxis.

Estado: IMPLEMENTADO EN RAMA / VERIFICADO LOCALMENTE; NO FUSIONADO, NO APLICADO A
SUPABASE, NO PUBLICADO por esta tarea. El caso operativo y teléfono físico no se
probaron; capturas no equivalen a validación productiva ni comparación píxel a píxel.
No se modificaron Firebase, Supabase, workflows, main, GOOGLE ni LAC. Se conservan
los cambios históricos de otros worktrees. El checkpoint anterior de reparación22
es histórico; el PR94 ya forma parte de la base de este hito.

Siguiente paso único: revisar el PR Draft de esta rama y las capturas. Detenerse
antes de fusión/despliegue; requieren autorización posterior. No reejecutar SQL94
ni crear otro PR por recuperar continuidad.


## Issue97 — carga operativa de Mecanizado, lista para revisión

Registro UTC: 2026-10-26T15:01:29.686448+00:00. SGP-ONE-LAB únicamente.
Rama `feat/issue-97-operational-calendar`; base main
`eb0e1dc197d67072d556c226af318f5cd28a800e`, incluye PR94 y PR96.
Implementación preservada en `24edbde58a72dbe63a0837387d795f219556d940`.
Fuente: Issue97 de GitHub; no se repitió la auditoría general PDT ni consultas de datos.

Componente real: Resumen 7días×2turnos en programacion-subtabs-v350.js montado por
index.html. src/modules/mecanizado.js solo es una tabla auxiliar. Se corrigen Resumen,
renderProgCalendar y la carga compartida de Producción. Estado SIN INICIAR gris;
origen movido informativo sin ejecución/doble conteo; carga NUEVA/ARRASTRE separada
respecto del histórico/avance; detalle accesible por fecha/turno PC/móvil.

Fuente compartida: RPC existente sgp_mecanizado_pendientes_turno y normalización
común. Semana14pares fijos, máximo4concurrentes, caché30s/sesión/coalescencia; no
consulta por cada orden. Traslado parcial consulta órdenes restantes canónicas por
origen, con caché/lotes4; no resta otra vez un encabezado previamente ajustado.
Conserva contratos/RPC/roles, programación por reserva y orden, prioridad e historial.

Pruebas:254/254 JS y15dirigidas; browser Chromium PC1366×1000/móvil390×844, ambos
calendarios y loader real Producción con fixtures:26/10/2026 T1=8+16+41=65,72,2%de90.
Traslado de12 al27/10 en fixture adicional explica total semanal77; origen26/T2=0
con aviso. Sin escrituras ni red externa. Capturas, resultados y límites exactos en
`tests/issue97/README.md` y `tests/issue97/evidence/`. Sintaxis, releaseLAB354 y
diff --check aprobados. Dos tests estáticos se adaptan a invalidación de caché y
cuarta consulta auxiliar; mantienen el preview no interactivo y seguridad de guardado.

Pendiente antes de integrar: contrastar en catálogo real permisos de SELECT de
sgp_mecanizado_reprogramaciones y vínculo id_destino; id_origen/produccion sí están
en SQL versionado. Metadatos remotos no disponibles desde este entorno. Si el nombre
difiere, adaptar mapeo explícito, no inferir por nombre de producción. Ante errores
se informa carga incompleta; no se presume arrastre0 ni cantidad restante. Verificar
roles reales en entorno autorizado: las fixtures no certifican producción ni móvil físico.

Estado: IMPLEMENTADO EN RAMA / VERIFICADO LOCALMENTE. No SQL nuevo/aplicado, cambios
en Supabase/Firebase/workflows/main, fusión ni publicación. PR94/96 intactos. No se
intervinieron GOOGLE/LAC ni se descartaron cambios de otros worktrees.
Siguiente paso único: revisar el PR Draft de esta rama y sus capturas con ChatGPT.
Detenerse antes de fusionar/desplegar; no repetir pruebas ya aprobadas sin cambios.

Protección final Issue97: el puente de calendario rechaza sesión SGP ausente antes
de consultar DB/caché. Prueba dirigida del código real añadida:16/16 aprobadas; la
suite completa previa fue254/254. CI vuelve a validar el commit completo.

Regresión final de navegación Issue97: una respuesta tardía de la semana anterior
no puede sustituir el encabezado de la semana nueva. Comprobada en Chromium PC/móvil
con el renderer real de app.js; resultados anteriores se conservan aprobados.


## PR98 — RPC de reprogramaciones y LABv355 preparada

Registro UTC: 2026-10-26T15:31:46.158812+00:00. Rama existente
`feat/issue-97-operational-calendar`, PR98 OPEN/DRAFT; base main
`eb0e1dc197d67072d556c226af318f5cd28a800e`, LABv354. Sin cambios concurrentes observados.
Siguiente número preparado LABv355; badge, cache-bust app/CSS, generador de release,
expectativas de pruebas y nombre de verificación visual manual sincronizados.
No se verificó el badge del Hosting por falta de acceso desde este entorno;
LABv355 NO se declara publicado. No se altera el workflow Firebase live.

Dato confirmado por ChatGPT/propietario: los cuatro id_destino son válidos; la tabla
no admite lectura directa del navegador. Se elimina from(tabla) en Programación y
Producción y se incorpora adaptador RPC sin fallback. Propuesta
sgp_mecanizado_reprogramaciones_listar(text): SECURITY DEFINER postgres, STABLE,
search_path vacío, validación SGP + rol real, payload mínimo. Roles de lectura de
Mecanizado; RECEPCION no elude mediante equivalencia legacy. EXECUTE técnico para
anon/authenticated; sin permisos generales sobre la tabla. No desactiva RLS ni cambia
políticas, datos, triggers o helpers. SQL e inversa REVIEW fuera de automigraciones:
`docs/sql-proposals/mecanizado/`, README con procedimiento posterior controlado.

Pruebas:259/259 JS,34 aserciones SQL en PostgreSQL17 aislado usando definiciones
reales disponibles de helpers y datos sintéticos. Lectura privada/RLS/ACL y filas
conservadas; prueba instalación ROLLBACK, inversa y rechazo de inversa sobre cuerpo
modificado. Sin conexión productiva. PC1366/móvil390 con RPC simulada, badge355 y
26/10/2026 T1=8nuevas+57arrastre=65,72,2%de90 aprobados. Los cuatro cambios Issue97
y PR94/96 se conservan. Sintaxis JS/YAML, verify:release LABv355 y diff --check aprobados.
Evidencia: tests/issue97/README.md y evidence/rpc-security-results.json/capturas.

Estado: IMPLEMENTADO EN RAMA / SQL PROPUESTO Y VERIFICADO AISLADAMENTE; NO APLICADO
EN SUPABASE, NO FUSIONADO, NO PUBLICADO. Pendiente revisar/aplicar RPC con autorización
separada y verificar permisos/payload reales antes de cualquier publicación355.
Siguiente paso único: revisión ChatGPT del mismo PR98 y del SQL. No crear otro PR,
no tocar producción, main, Firebase, GOOGLE ni LAC. Conservar commits y cambios locales.

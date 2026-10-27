# PR121 — checkpoint correctivo: turno explícito

Fecha Colombia: 2026-10-27T07:02:56.597510-05:00.
Rama feat/linea-stage2a-packing-resolver; mismo PR121 Draft apilado sobre117.
HEAD previo ce9d01d2dacbd2a4de805806e9b06867d569f3f4; SHA final en PR.

Consumo y corrección exigen turno explícito etapa/fecha/turno del snapshot servidor.
Ausencia (incluso lista completa vacía) -> SHIFT_NOT_FOUND sin cambios. No default
ABIERTO ni creación implícita. CERRADO exige reapertura; EN_REVISION mantiene rol
coordinador/motivo; ABIERTO mantiene CAS/seguridad/idempotencia. Reintento exacto
consulta existencia del turno, no registra otro consumo ni avanza revisión.

VERIFICADO AISLADO: 383/383 Node; 32 pruebas resolvedor (cinco nuevas), sintaxis,
verify:release LABv362 y diff. Hashes de rutas protegidas sin cambios. Fixtures
positivos declaran turnos abiertos y fecha nocturna explícitos. Evidencia domain.json.
Se reutiliza evidencia de arnés PG sin modificaciones; no se repite batería SQL.
No Supabase/frontend/legacy/vidrio/Gateway/otros repositorios. No fusión/publicación.
Etapa2B NO iniciada; adaptador productivo y fuentes reales siguen pendientes.

Siguiente paso único: revisión de ChatGPT del mismo PR121; no integrar runtime ni
iniciar Etapa2B sin autorización nueva.

---

# Etapa2A — checkpoint final de revisión

Fecha Colombia: 2026-10-27T06:49:49.071705-05:00.
Rama independiente feat/linea-stage2a-packing-resolver.
Base exacta PR117 OPEN/DRAFT b923b2496d63de28fb562803a21474028ad88f97.
Main revisado 06b1794b6d83574742f152b2873821830b41cf15 / LABv362.
PR de Etapa2A debe apuntar a la rama de117 (stack), no duplicar su implementación.
Primer checkpoint recuperable: commit b9a1a5c; SHA final en el PR de esta etapa.

IMPLEMENTADO AISLADO: src/server/packing-resolver.js; repositorio servidor como
frontera de sesión/rol/etapa/ámbito, fuentes coherentes por producción, conciliación
Export/local, cantidades por unidad de producción, unión de unidades bloqueadas
PDT y consumo/revisiones/idempotencia. Sin prueba cuantitativa devuelve UNKNOWN;
contradicciones DISCREPANCY, available=null; nunca piezas->ventanas. PDT de Empaque
independiente; legacy activo sin impacto de etapa demostrado bloquea disponibilidad.
No se aceptan snapshots/actor/flags/evidencia/unidades del navegador.
Corrección descendente no deja empacado sin respaldo; mapas activos requieren
conciliación de unidades antes de corregir. Turno cerrado exige reapertura117.

VERIFICADO LOCALMENTE: 378/378 Node (27 nuevas), sintaxis y verify:release;
protected_sha256 preserva Etapa1/runtime/vidrio/Mecanizado/PDT/Export. Tres escenarios
con sesiones REALES PG17.11 aisladas sin red/puertos prueban lock/CAS/idempotencia
como mecanismo; no equivalen a verificar el resolvedor completo en PostgreSQL.
Evidencias tests/linea-stage2a/evidence. No cambio visual, no repetir capturas.

PROPUESTO/PENDIENTE: adapter Supabase y RPC/transacciones productivas, semántica de
cantidades legacy, cuerpos/ACL actuales, inclusión de eventos en corte Export e
identidad de unidades afectadas. No hay acceso Supabase autenticado en esta sesión.
PRODUCCIÓN NO VERIFICADA; NO APLICADO, NO PUBLICADO, NO FUSIONADO. Sin UI, migraciones,
contratos legacy modificados, Gateway/GOOGLE/LAC ni Etapa2B.

La CI de Tests filtra base main; el PR apilado puede ejecutar solo Sintaxis. Las
pruebas Node completas se ejecutaron localmente; no cambiar workflows por ello.
Siguiente paso exacto: revisión de ChatGPT de este PR dependiente y117, y contrastar
las fuentes/revisiones/unidades reales antes de autorizar Etapa2B. No iniciarla.

Comprobación remota final: main avanzó a b228ab2977ee29fa8c3db1db2ec2c2b594e3dc2d
con #118/#120, cambios solo en app.js. Esta rama sigue basada en el SHA validado
b923b24 de117; su diff apilado NO modifica app.js. No se reescribe117 ni se mezclan
hotfixes ajenos. La regresión local corresponde al stack validado, no a ese main
más reciente; preservar esos hotfixes al revisar/retargetear después del padre.

---

# PR117 — checkpoint de revisión correctiva

Fecha Colombia: 2026-10-27T06:22:23.938373-05:00.
Rama feat/linea-stage1-operational-contracts; mismo PR117 Draft.
HEAD previo revisado 4f8348c819923563376bca4488104f8496a2b8c4; SHA final en PR.

Correcciones IMPLEMENTADAS en dominio aislado:
1. CERRADO rechaza toda ejecución incluso del coordinador. REOPEN autorizado con
motivo deja EN_REVISION y conserva snapshot. Corrección exige coordinador/motivo;
CLOSE posterior del líder valida razones y crea otro snapshot sin borrar informes.
2. Conciliación conserva proyección negativa + DISCREPANCIA_SALDO. No excepción,
recorte a cero o alteración del Export. Sin mapeo: SIN_CONCILIAR/proyección NULL.
3. Resolvedor cuantitativo de Empaque NO IMPLEMENTADO. Flags de evidencia son
sintéticos/trusted input de prueba, nunca prueba del navegador. Runtime prohibido.

VERIFICADO LOCALMENTE: 351/351 Node, 23 pruebas de dominio, verify:release LABv362,
sintaxis/diff y hashes de rutas protegidas. Evidencia domain.json actualizada.
DDL aislado anterior sin cambios: no se repite su batería; sin cambio visual.
No RPC/migraciones/Supabase/UI/reportes de vidrio/Gateway/producción ni Etapa2.
NO APLICADO, NO PUBLICADO, NO FUSIONADO.

Siguiente paso exacto: revisión final de ChatGPT del mismo PR117. No iniciar
Etapa2 ni conectar dominio al runtime sin nueva autorización y resolvedor servidor.

---

# Etapa1 — checkpoint de continuidad

Fecha Colombia: 2026-10-27T05:36:59.251556-05:00.
Repositorio SGP-ONE-LAB; rama feat/linea-stage1-operational-contracts.
Base main 06b1794b6d83574742f152b2873821830b41cf15, LAB v362; PR116 FUSIONADO según GitHub.
No confundir los checkpoints anteriores que dicen PR116 Draft con el estado actual.

Objetivo autorizado: arquitectura implementable, dominio aislado, pruebas y SQL
propuesto de Ensamble/Empaque. No UI, backend productivo, migraciones, publicación
ni inicio de Etapa2. No cambios GOOGLE/LAC.

Entregas: docs/linea-etapa1/CONTRATOS_Y_MODELO.md y PREFLIGHT_READONLY.sql;
src/domain/linea-stage1.js sin importación runtime; tests/linea-stage1.test.mjs;
esqueleto aditivo privado y reversión en docs/sql-proposals/linea-etapa1.
Sale por etapa, acumulado sustituible, correcciones auditadas, cierres/snapshots,
arrastres previos a cierre no aditivos, conciliación explícita con Export y
bloqueos PDT independientes. No convertir piezas PDT en ventanas.

Pruebas: 348/348 Node (20 nuevas), verify:release v362;
PG17.11 aislado sin red/puertos: instalación fallida atómica, 7 tablas RLS,
sin acceso navegador, etapas independientes y reversión vacía/con datos.
Los hashes de rutas protegidas demuestran que no se cambia app/reportes/grafo,
Mecanizado/PDT/Export. Evidencia tests/linea-stage1/evidence.

PROPUESTO: esquema y contratos RPC futuros. IMPLEMENTADO: referencia de dominio
y pruebas sintéticas. VERIFICADO: solo pruebas locales descritas; no autenticación
productiva ni carreras PostgreSQL entre RPC. NO APLICADO ni PUBLICADO.
Bloqueos: firmas/cuerpos/permisos instalados de planificación aún no accesibles;
ID/corte de Export e inclusión de eventos por conciliar; resolvedor cuantitativo
de unidades elegibles para Empaque. El esquema esqueleto NO es instalable como
motor completo: faltan RPC/locks/guards/FK y revisión del modelo existente.

Siguiente paso exacto: revisión del único PR Draft de Etapa1 y contraste de los
metadatos instalados con PREFLIGHT_READONLY.sql (solo si no se dispone ya de ese
resultado). No aplicar SQL ni continuar Etapa2 sin autorización nueva.

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

> **Nota ejecutiva de continuidad (2026-10-22):** Este documento conserva hitos históricos, incluidos encabezados antiguos LAB v281. No interpretar esas referencias como versión vigente. PR #47 (visual v327), #48 (reserva principal), #49 (programación desde explorador v328), #50 (conexión Planificador–Programación v329) y #51 (Continuity v2) constan fusionados en main. Las pruebas funcionales y el despliegue actual no se han verificado en esta conciliación. Ver `SGP_ONE_CHECKPOINT.md` y comprobar HEAD/PR antes de actuar.

### Regla de reserva principal — prioridades (2026-10-22)

- Regla aprobada: cuando `sgp_producciones.reserva_al` contiene varias reservas separadas por coma, la producción y todas sus unidades corresponden **únicamente a la primera reserva**. Las siguientes son referencias asociadas, no propietarios adicionales de las unidades.
- Caso verificado: `1312146|FRAMES_2`, `reserva_al=8707142,8710471`, cantidad 2: se contabiliza en 8707142, no en 8710471. El total de 8710471 en FRAMES_2 es 119, no 121.
- `sgp_datos_asignacion_prioridades` y `sgp_guardar_prioridad` ya respetan la primera reserva mediante `split_part(..., ',', 1)`. No se modifican estas RPC ni los datos.
- Ajuste frontend: nota explicativa en listado y ventana de asignación para evitar confundir reservas múltiples con producciones omitidas. Pendiente CI, merge y publicación.

### Planificador de Ensamble — LAB v327 (2026-10-22)

- Código v327 fusionado a main mediante PR #44, commit 6d72f7232cfc6217d7def47500ea2e1007a73ebc.
- Filtros por semana y sistema, tarjetas por reserva/sistema, detalle por parte identificada y producciones; selección de producción enlazada al panel operativo existente.
- Consulta de solo lectura autenticada `sgp_linea_plan_explorador_v327` aplicada en Supabase y versionada en `supabase/migrations/20261022180000_linea_plan_explorador_v327.sql`. Retorna parte únicamente cuando el identificador de prioridad semanal es inequívoco; vidrio preparado, novedad y traslado por `key_produccion`.
- CI PR #44: SGP ONE Tests #1270 y JavaScript syntax check #755 aprobados. Código fusionado y versión visible en index.html de main. Despliegue Firebase y aceptación visual en PC/móvil **pendientes de verificación externa**.
- No se implementó todavía la fase posterior de asignación por día/turno desde tarjetas ni el calendario/resumen de sistemas programados.
- SGP_ONE_GOOGLE no modificado.

### Corrección de integración del Planificador (2026-10-22)

Se detectó que `production-line-tabs.js` ya crea una pestaña superior Planificador, mientras la primera versión de `planner-readonly-v326.js` insertaba las vistas dentro de Ensamble. Se corrigió el montaje en `#productionPlannerPanel`, el acceso a ubicaciones mediante `#productionLocationsTab` y la actualización de datos desde la consulta autenticada de Ensamble. Pendiente prueba funcional real y autorización independiente para nuevas tablas/RPC y despliegue.

## LAB v326 — Planificador de Ensamble, etapa 1 (rama; no publicado)

- Rama: `feat/planificador-ensamble-v326`. Vista de consulta de Planificador dentro de Línea de Producción > Ensamble: Calendario (carga sin fechas inventadas), Tabla dinámica básica y Kanban por estado; buscador y métricas. Reutiliza `assemblyRows` de la consulta autenticada `sgp_consultar_ensamble` y acceso al reporte de ubicaciones existente.
- Las tres vistas son **solo lectura**; sin cambios a Supabase, Export, estados, prioridades, cantidades o programación de turnos. El calendario todavía no asigna fechas ni turnos porque no existe persistencia autorizada.
- Reglas aprobadas: saldo solo del Export; prioridad Program y disponibilidad Sale por coordinador; Ensamblado por líder con explicación de diferencias; Abierto cuando inició y no terminó; fecha/turno; arrastre automático de unidades no ejecutadas como prioridad del siguiente turno, preservando historial; movimientos completos o parciales; vínculo a mecanizado, pendientes aluminio, NC vidrio y reporte de ubicaciones.
- Pendientes: verificar contrato y claves exactas de ubicación vidrio, diseño de persistencia, permisos, concurrencia, QA automatizado/navegador, aprobación explícita de migración, publicación y validación real. No fusionar ni desplegar sin autorización.

## Línea de Producción — avance de consulta Empaque (2026-10-21)

- PR #32, rama `feat/linea-produccion-ensamble-empaque-tabs`. Navegación Ensamble/Empaque y lectura de Empaque mediante `sgp_consultar_ensamble` y sesión SGP existente.
- Reglas: Empaque **no** muestra estado de mecanizado; usa `saldo_ensamble` y vigencia del Export diario para distinguir totalmente ensamblada, pendiente y datos sin validar. Los saldos, estado de reserva y porcentaje de vidrio siguen siendo propiedad del Export diario. No sobrescribirlos con prioridades/comentarios.
- Las prioridades visibles son **referencia de Programación**, no prioridades persistidas de Empaque. Comentarios y prioridades independientes continúan pendientes de diseño/autorización de persistencia.
- Protecciones: descartar consultas anteriores y sesiones cambiadas, limpiar resultados previos, separar importación exitosa de fallos en resumen de eventos y refrescar vista activa después de Export.
- Verificación: GitHub Actions del commit `aeab16651950ed23921e32c9c4206953859eabcc`: JavaScript syntax check y SGP ONE Tests **success**. No equivale a prueba funcional en navegador.
- No se modificaron Supabase, Firebase ni SGP_ONE_GOOGLE; no se fusionó ni desplegó.
- Próximo: prueba con sesión real de roles permitidos/no permitidos, filtro de semana/línea, saldos no inicializados y export reciente; después diseñar escrituras independientes de prioridades/comentarios.

## Línea de Producción — navegación Ensamble / Empaque (2026-10-21)

En rama `feat/linea-produccion-ensamble-empaque-tabs` se cambia exclusivamente el nombre visible del menú Ensamble a «Línea de Producción» y se añaden pestañas superiores «Ensamble» y «Empaque». Ensamble mantiene los IDs, consultas, reporte de ubicaciones y reglas existentes. Empaque es por ahora una pestaña estructural informativa; no se inventan fuentes, tablas, estados ni acciones de empaque. Pendientes: prueba automática, revisión visual, autorización de fusión/publicación y diseño funcional de la hoja de Empaque. No se modifica Supabase.

## LAB v323 — Diseño del reporte de Picking (PROPUESTO EN RAMA)

Se implementó la estética aprobada del reporte de entregas: encabezado corporativo azul con marca SGP tipográfica, subtítulo de Picking, indicadores de colores, tablas con cabeceras azules, resumen por sistema con total y porcentaje de parciales, filtros y diseño responsive. Se conservan los valores reales, la consulta RPC, PDF e imagen PNG; no se modifica Supabase ni reglas de negocio. Rama `feat/lab-v323-picking-report-visual`. Pendiente de revisión de PR, validación visual en navegador y autorización independiente de fusión y despliegue.

## LAB v322 — Reporte de Picking accesible desde Entrega de órdenes (en rama, NO publicado)

Cambio solicitado 2026-10-21: botón «Generar reporte de entregas» dentro de la pestaña «Entrega de órdenes», como el reporte de Producción. Abre modal de reporte con filtros por fecha operativa, turno y sistema, resumen por sistemas, detalle de entregas y faltantes. Sustituye exportación Excel por imagen PNG, conserva PDF y la pestaña de reporte existente. Usa la RPC de solo lectura ya autorizada; no modifica Supabase. Rama `feat/lab-v322-picking-report-direct-image`. Pendiente pruebas de integración navegador, validación de sesión real y autorización explícita de merge/despliegue.


## LAB v321 — Reporte histórico de Picking (en rama, NO publicado)

PR #29: nueva pestaña «Reporte de entregas», filtros por fecha operativa, turno y sistema, resumen por sistema, detalle de eventos y faltantes históricos, PDF y exportación compatible con Excel (SpreadsheetML .xml). Frontend consume RPC paginada de solo lectura `sgp_picking_reporte_entregas_v1` creada en Supabase con autorización explícita del usuario. La RPC rechaza tokens inválidos (PERMISO_DENEGADO), pero no se ha validado aún una sesión positiva ni el flujo completo en navegador. La consulta de fechas respeta `fecha_operativa`; turnos exactos `TURNO 1` y `TURNO 2`. Se preservan 144 pares únicos vs 163 eventos observados en auditoría de 2026-10-21; no se infieren ventanas físicas entregadas. Cambios en rama `feat/picking-delivery-report-preparation`; no fusionar ni desplegar sin nueva autorización. Exportación Excel .xlsx nativa pendiente si se requiere ese formato exacto.

# SGP_ONE — ESTADO ACTUAL Y CONTINUIDAD

> Documento maestro de continuidad técnica y funcional.
> Actualizado: **2026-10-19**
> Este documento debe revisarse antes de modificar SGP_ONE.

---

## LAB v320 — Temas globales (propuesta implementada en rama)

Se incorporan nueve paletas visuales (azul intenso, azul corporativo, azul moderno, lila, naranja, esmeralda, turquesa, rosa y grafito), modo claro/oscuro y controles en Configuración → Apariencia y navegación. Las preferencias se guardan en localStorage del navegador, no se sincronizan entre equipos. Se añaden variables CSS aisladas en global-themes.css para elementos decorativos, navegación y superficies; los colores semánticos de estados operativos se excluyen. Se actualiza LAB a v320 y las referencias de caché.

**Riesgos y verificaciones:** validar contraste en todos los módulos, móviles, estados operativos y las pruebas de regresión; no declarar verificado hasta evidencia visual. Sin cambios en Supabase ni SGP_ONE_GOOGLE. Sin autorización para fusión o publicación en Firebase.

---

## LAB v319 — Navegación: correcciones visuales y retorno automático (2026-10-21)

**Origen:** verificación visual del usuario en LAB v318 tras el despliegue Firebase #386. El logotipo se veía como dos cápsulas, el texto del menú perdía contraste en hover y el botón ☰ convertía de manera persistente el modo automático en modo manual.

**Implementado en rama:** estilos de wordmark SGP (cian) ONE (blanco), sin fondos heredados y con subrayado cian; contraste explícito en hover, foco y seleccionado; el botón ☰ fija temporalmente el menú en modo automático y al segundo clic vuelve a expandir/contraer por cursor, sin alterar la preferencia guardada. Actualizados LAB v319, recursos cacheados y pruebas de regresión. No cambia roles, sesión, datos, Supabase, Firebase ni SGP_ONE_GOOGLE.

**Estado de publicación:** pendiente de CI, revisión, fusión autorizada y prueba real en navegador. La rama no equivale a publicación.

---

## Actualización 2026-10-21 — LAB v318 (regularización de versión)

**Alcance:** regularización del número visible después de fusionar el PR #25 (commit de integración `a045398624aebb9a070abdd1e09a0472e51f9375`). La interfaz seguía mostrando LAB v317 aunque el menú contraíble, el logo textual SGP ONE, la paleta azul intenso y las opciones de apariencia ya estaban integrados en `main`.

**Cambio de release v318:** `index.html` muestra `LAB v318` y usa `styles.css?v=318` y `app.js?v=318` para invalidación de caché. Los assets de navegación mantienen `?v=2`, que es su revisión independiente ya integrada. No se modifica lógica funcional, autenticación, Supabase ni SGP_ONE_GOOGLE.

**Regla obligatoria de continuidad:** cada nueva entrega de cambios funcionales, visuales o correcciones debe incrementar el identificador LAB en una unidad desde la versión realmente vigente en `main`, mantener las referencias de caché coherentes y actualizar la documentación de estado. Los incrementos deben validarse en CI y confirmarse en Firebase y navegador antes de declarar VERIFICADO.

**Estado:** PROPUESTO/IMPLEMENTADO EN RAMA hasta confirmar CI, fusión y despliegue; no equivale a publicación ni verificación visual.

---

## 1. ESTADO EJECUTIVO

**Proyecto:** SGP_ONE  
**Objetivo:** gestión de producción para fabricación de ventanería de aluminio y vidrio.  
**Repositorio operativo:** `jcastillodelarosa-hub/SGP-ONE-LAB`  
**Rama:** `main`  
**Frontend visible:** **LAB v281**  
**Último hotfix backend:** **v282 — permiso RPC de arrastre**  
**Backend de datos:** Supabase directo.  
**Hosting operativo:** Firebase Hosting.  
**Último commit documental verificado:** `17b5fd6add2b8c0797c4181f987cb5a45837bbcb`.

### Estado de publicación al cierre
- JavaScript syntax check: **SUCCESS**.
- SGP ONE Tests: **SUCCESS**.
- Firebase Hosting: **SUCCESS**.
- GitHub Pages build/deployment: **SUCCESS**.
- Hotfix v282: **APLICADO Y PROBADO EN SUPABASE**.
- Validación final del hotfix desde navegador del usuario: **PENDIENTE**.
- Validación visual completa de Pendientes de aluminio v281 por roles: **PENDIENTE**.

### Regla de arquitectura vigente
SGP_ONE-LAB **no usa Gateway**. El LAB continúa con **Firebase Hosting + SDK Supabase local + Supabase directo**.

El Gateway se desarrolla y valida en el proyecto separado **SGP_ONE_GOOGLE**. No introducir Gateway, SQL Connect, Data Connect ni una migración de Supabase dentro del LAB hasta que exista una decisión explícita y una integración controlada.

---

## 2. ARQUITECTURA ACTUAL

### Frontend
- `index.html`
- `styles.css`
- `app.js`
- código auxiliar bajo `src/`
- SDK Supabase del navegador servido localmente como `./vendor/supabase.js`

### Backend
- Supabase proyecto SGP-ONE-LAB.
- Persistencia PostgreSQL.
- RPC operativas con patrón histórico `SECURITY DEFINER`.
- El navegador se conecta mediante el rol PostgreSQL `anon`.
- La autorización funcional se realiza dentro de las RPC mediante `p_token` y validación de rol SGP.

### Despliegue
- GitHub `main` → workflows de validación → Firebase Hosting.
- `scripts/verify-release.mjs` protege el paquete de publicación y evita reintroducir dependencias no aprobadas.
- Firebase Hosting es el entorno operativo del LAB.

### Seguridad conocida
Existen advertencias estructurales previas relacionadas con RLS deshabilitado en tablas públicas y el modelo histórico `SECURITY DEFINER + token propio`.

**No habilitar RLS globalmente como parte de una corrección funcional aislada.** Debe tratarse como un proyecto de endurecimiento separado porque un cambio transversal puede bloquear módulos operativos.

---

## 3. REGLAS TRANSVERSALES QUE NO DEBEN ROMPERSE

1. La identidad de una producción depende del contexto de línea; no asumir que un mismo ID en PANELES_2 y FRAMES_2 representa dos ventanas distintas.
2. La semana operativa debe provenir de la producción/programación, priorizando `semana_actual` y usando `semana_base` como respaldo cuando corresponda.
3. Estados productivos principales: `CORTE → MECANIZADO → PROCESADO → PICKING`.
4. `PROCESADO` significa mecanizado terminado.
5. `PICKING` significa material entregado a línea.
6. Picking de piezas utiliza exclusivamente piezas `PANEL`.
7. No inferir cantidades por reserva cuando no existe una fuente inequívoca.
8. No inventar acabados. Si no existe fuente inequívoca debe mostrarse **ACABADO POR CONFIRMAR**.
9. Los cambios de estado, auditorías, entregas parciales y PDT deben conservar trazabilidad.
10. No reutilizar el campo `auditado` de Picking para la validación de Pendientes de aluminio.
11. Una NC finalizada **no equivale** a PDT validado.
12. La autorización para mecanizar un PDT depende de la validación explícita del pendiente.

---

## 4. RESERVAS MÚLTIPLES Y RESERVA COMPARTIDA

Regla vigente desde v277/v278:

### MULTI-RESERVA
Una producción tiene más de una reserva asociada.

Esto **no significa automáticamente** que sea una RESERVA COMPARTIDA.

### RESERVA COMPARTIDA
Existe cuando al menos una reserva asociada no principal también actúa como reserva principal de otra producción/grupo, por prioridad asignada o por relación principal conocida.

### Consecuencias
- Todas las relaciones conocidas reserva ↔ acabado deben mantenerse disponibles internamente.
- MULTI-RESERVA controla la desambiguación de material.
- RESERVA COMPARTIDA controla la alerta/identificación visual.
- Picking debe poder manejar piezas PANEL de distintos acabados en órdenes multi-reserva.
- No modificar esta semántica al trabajar en Programación, Producción, Picking o Pendientes.

Estado v278: **IMPLEMENTADO, PUBLICADO, PROBADO Y VERIFICADO VISUALMENTE**.

---

## 5. PROGRAMACIÓN

### Funcionalidad vigente
- Programación semanal y diaria.
- Partes/prioridades como 1.1, 1.2, 1.3, etc.
- Calendario por fecha y turno.
- Totales por turno y día.
- Resumen por sistema/acabado.
- Proyecto / Retail.
- Reprogramación por reserva/orden.
- Búsqueda y detalle de órdenes.
- Semana asociada a producción/programación.

### Capacidades aprobadas
- PANELES_2: 180/día, 90/turno.
- FRAMES_2: 80/día, 40/turno.

### Horarios
- Lunes–sábado:
  - Turno 1: 07:00–19:00
  - Turno 2: 19:00–07:00
- Domingo:
  - Turno 1: 07:00–18:00
  - Turno 2: 18:00–05:00

### Estado
Operativa. No existe un cambio pendiente autorizado en este documento que justifique alterar su lógica base.

---

## 6. PRODUCCIÓN / MECANIZADO

### Operación
Los líderes pueden consultar reservas programadas, expandir órdenes, registrar observaciones/novedades y cambiar estado por orden.

Estados operativos:
- PROGRAMADA
- CORTE
- MECANIZADO
- PROCESADO
- REPROGRAMADO cuando corresponda al flujo

### Arrastre de pendientes
Desde v267:
- El turno entrante puede ver pendientes del turno anterior 5 minutos después de iniciar.
- T1: desde 07:05.
- T2: desde 19:05.
- Se reutiliza el `id_programacion` original.
- No se crea una programación duplicada.
- El turno original conserva trazabilidad de **NO CULMINADO** cuando corresponda.

### Hotfix v282 — 2026-10-19
Error observado:
`permission denied for function sgp_mecanizado_guardar_estado_arrastre`.

Causa:
una migración live del 2026-10-14 había revocado `EXECUTE` a `anon`, aunque el frontend llama esta RPC desde el navegador usando precisamente ese rol técnico.

Corrección:
- `PUBLIC` permanece revocado.
- `EXECUTE` concedido a `anon, authenticated, service_role`.
- No se cambió el cuerpo de la función.
- Continúa validando internamente los roles:
  `ADMINISTRADOR, COORDINADOR, LIDER MECANIZADO, LIDER, LIDER LINEA`.

Pruebas realizadas:
- `anon` + sesión ADMINISTRADOR sobre programación real: **14 órdenes recorridas correctamente**, dentro de transacción con ROLLBACK.
- `anon` + sesión CONSULTA: **PERMISO_DENEGADO**, comportamiento correcto.
- Migración versionada: `supabase/migrations/20261019_fix_mecanizado_arrastre_anon.sql`.

Estado:
- Supabase: **CORREGIDO Y PROBADO**.
- Navegador usuario: **PENDIENTE DE REPRUEBA**.

---

## 7. PICKING

### Reglas vigentes
- Solo piezas `PANEL`.
- Ordenamiento prioriza material más avanzado.
- Entrega completa o con faltantes.
- Auditoría independiente de la entrega.
- Si auditoría difiere: estado de auditoría con diferencia.
- Entregas parciales conservan trazabilidad.
- Partidas abiertas muestran reservas/partes pendientes.
- Las órdenes con mismo nombre pero diferente sistema no deben mezclar piezas.
- Semana visible en tarjetas y partidas abiertas.

### Auditoría
El campo `auditado` pertenece a este flujo y **no debe utilizarse como validación de PDT**.

### Estado
Operativo. Las modificaciones v279–v281 de Pendientes no deben alterar el reporte original de Picking.

---

## 8. PENDIENTES DE ALUMINIO — FLUJO V279–V281

Este es uno de los módulos con cambios recientes más importantes.

### Conceptos independientes

#### Estado NC
- Sin NC
- NC enlazada
- NC finalizada

#### Validación PDT
- ⚠ POR VALIDAR
- ✓ VALIDADO

#### Estado físico PDT
- PENDIENTE
- REPO_OK
- CORTE
- MECANIZADO
- PROCESADO
- PICKING

**Una NC finalizada no valida automáticamente el PDT y no debe convertirlo automáticamente en REPO_OK.**

### Reserva solución
- Si existe NC y la NC tiene `reserva_solucion`, esa es la reserva solución efectiva.
- Si el PDT no tiene NC, Coordinación puede registrar una reserva solución manual.
- La reserva manual no sustituye silenciosamente la reserva solución proveniente de una NC.

### Patinador
Antes de VALIDADO puede modificar:
- NC.
- Fabricación.
- Longitud.
- Acabado **cuando sea RESERVA COMPARTIDA**.

Después de VALIDADO estas correcciones quedan bloqueadas para el Patinador.

### Validadores
Pueden validar:
- ADMINISTRADOR.
- COORDINADOR.
- LIDER LINEA.
- SUPERVISOR DE PICKING.

Durante la validación se confirman/corrigen:
- fabricación,
- longitud,
- acabado,
- observación de validación.

La validación es la autorización para que Mecanizado pueda procesar el pendiente.

### Líder Mecanizado
No valida el PDT por definición funcional actual. Puede operar el estado físico una vez cumplida la validación requerida.

### Fuente de piezas
Las ventanas Modificar/Validar reutilizan las piezas PANEL reales de la orden, siguiendo el patrón de Picking → Reportar faltantes.

Si existe fuente de piezas para la referencia, el backend rechaza combinaciones de fabricación/longitud que no pertenecen a la orden.

### Historial
Se conserva trazabilidad de:
- creación,
- edición PDT,
- reserva solución,
- validación,
- cambios de estado físico.

### Tabla v281
Orden aprobado/restaurado:

`SEM. | OP | Reserva | Referencia | Acabado | Marca | Fabricación | Longitud | Cant. | NC | Enlace NC | Estado NC | Validación | Observación | Estado PDT | Acciones`

Acciones:
- Modificar.
- Validar.
- Ver detalle.
- Historial.
- Actualización de estado según permisos/flujo.

El menú Acciones se renderiza en un portal sobre `document.body` para evitar recortes por el scroll de la tabla.

### Estado
- Supabase v279/v280: **IMPLEMENTADO**.
- Frontend v281: **IMPLEMENTADO Y PUBLICADO**.
- Pruebas automáticas: **SUPERADAS**.
- Verificación visual completa por cada rol: **PENDIENTE**.

---

## 9. NC DE ALUMINIO

La tabla/fuente de NC continúa siendo la autoridad para:
- identificación/consecutivo de NC,
- estado de NC,
- reserva asociada,
- referencia,
- `reserva_solucion`.

Pendientes consume esa información, pero no debe rediseñar ni sobrescribir la lógica propia del módulo NC.

Caso utilizado en pruebas:
- NC `1004390`
- estado: Finalizada
- reserva: `8673439`
- referencia: `ES-SGD2020-084A`
- reserva solución: `8712867`

Estado: integración con Pendientes **VERIFICADA EN BACKEND**.

---

## 10. ENSAMBLE

La consulta de Ensamble muestra pendientes de mecanizado asociados a producción.

Después de v279:
- un PDT POR VALIDAR debe diferenciarse de un PDT listo;
- solo la combinación **VALIDADO + estado físico compatible** debe considerarse lista para mecanizado.

No rediseñar Ensamble como consecuencia de cambios en Pendientes sin revisar primero `sgp_consultar_ensamble`.

---

## 11. PORTADA / SALDOS DE PRODUCCIÓN

### Implementación actual
La portada llama la RPC:
`sgp_resumen_saldos_portada()`.

La RPC agrupa por:
`coalesce(semana_actual, semana_base)`

y suma directamente desde `sgp_producciones`:
- `saldo_ensamble`
- `saldo_empaque`

### Diagnóstico realizado 2026-10-19
Para SEM 43, la portada mostraba:
- Ensamble: **1.020**
- Empaque: **31**

Origen comprobado:

| Línea | Registros | Cantidad | Ensamblado | Saldo Ensamble | Saldo Empaque |
|---|---:|---:|---:|---:|---:|
| PANELES_2 | 90 | 883 | 174 | 709 | 22 |
| FRAMES_2 | 85 | 338 | 27 | 311 | 9 |
| Total actual portada | 175 | 1.221 | 201 | 1.020 | 31 |

### Problema identificado
La portada suma los saldos de PANELES_2 y FRAMES_2 como si fueran independientes.

En SEM 43:
- 175 registros de línea.
- 91 IDs de producción distintos.
- 84 producciones aparecen en ambas líneas.

Por tanto, **1.020 no debe interpretarse como un saldo consolidado de ventanas**; es la suma de los saldos operativos de ambas líneas.

Además, el valor depende del último Export diario cargado, por lo que no necesariamente representa el estado de planta en tiempo real.

### Decisión de diseño en curso
El usuario solicitó bocetos para mostrar **los saldos de ambas líneas por separado**, distinguiendo:
- semanas vencidas;
- semana actual.

Los bocetos fueron solicitados/aprobados conceptualmente, pero **NO existe todavía una implementación autorizada/publicada de la nueva portada**.

Antes de modificar la RPC o la portada se debe definir si los indicadores representarán:
1. saldos operativos separados PANELES_2 / FRAMES_2; o
2. ventanas consolidadas sin doble contabilización.

Estado: **DIAGNÓSTICO COMPLETADO / REDISEÑO PENDIENTE**.

---

## 12. RECEPCIÓN / AUDITORÍA DE RESERVAS

Reglas vigentes:
- fecha y turno de recepción;
- fotografías;
- reserva completa sí/no;
- registro estructurado de faltantes;
- pendientes hacia Bodega;
- reversión cuando aplique;
- semáforo por antigüedad;
- estados de reserva diferenciados visualmente.

Estados funcionales utilizados:
- Pendiente por Abastecimiento.
- Pendiente por Bodega.
- Recibida sin legalizar.
- Aluminio entregado / Entregada.

---

## 13. INFORMES

### NC aluminio
Reporte por fechas con:
- totales,
- seguimiento,
- número de cortes,
- peso proveedor/planta,
- referencias afectadas,
- salida PDF/imagen.

### Reporte de turno de Mecanizado
Desde v264:
- Programado.
- Ejecutado.
- Pendiente.
- % avance.
- avance por sistema.
- programación vs ejecución.
- pendientes siguiente turno.
- novedades.
- comentario general.
- salida PNG/PDF.

---

## 14. ROLES

Roles existentes:
- ADMINISTRADOR
- COORDINADOR
- LIDER MECANIZADO
- LIDER LINEA
- LIDER
- RECEPCION
- PATINADOR
- PICKING
- SUPERVISOR DE PICKING
- CONSULTA

La autorización tiene dos niveles:
1. acceso a módulo/ventana;
2. permiso de acción validado en backend.

No asumir que mostrar/ocultar un botón constituye seguridad suficiente. Las operaciones sensibles deben validarse también en RPC.

---

## 15. UI / UX VIGENTE

- Paleta principal azul.
- Evitar morado como color principal de controles.
- Texto blanco sobre botones azules cuando corresponda.
- Ventanas flotantes con cierre visible.
- Scroll funcional en móvil.
- Menú lateral móvil.
- Portada como vista inicial.
- Versión visible.
- Tablas extensas deben conservar legibilidad y evitar superposición.
- En Pendientes, columna Acciones sticky a la derecha.

---

## 16. MIGRACIONES RECIENTES CRÍTICAS

Versionadas en GitHub:
- `20261017_preservar_ubicacion_vidrio_ove_ausente.sql`
- `20261018_pdt_validation_workflow.sql`
- `20261018_pdt_compact_actions.sql`
- `20261019_fix_mecanizado_arrastre_anon.sql`

Importante: existen migraciones históricas aplicadas directamente en Supabase que no estuvieron inicialmente reflejadas en el repositorio. Para desarrollos nuevos, toda modificación DDL/RPC debe:
1. aplicarse de forma controlada en Supabase;
2. quedar versionada también en `supabase/migrations`.

---

## 17. VERSIONES RECIENTES

| Versión | Alcance principal | Estado |
|---|---|---|
| v264 | Reporte de turno Mecanizado | Implementado |
| v265–266 | Estabilización Supabase directo / SDK local / release guard | Implementado |
| v267 | Arrastre pendientes turno anterior | Implementado |
| v268 | Semana y filtros móviles Picking | Implementado |
| v269–274 | Correcciones semana/prioridad/arrastre | Implementado |
| v275 | Pendientes de aluminio | Implementado |
| v276 | Primer soporte reserva compartida; semántica luego corregida | Superado por v277 |
| v277 | MULTI-RESERVA vs RESERVA COMPARTIDA | Implementado |
| v278 | Corrección visual reserva compartida | Verificado |
| v279 | Validación formal PDT | Implementado |
| v280 | Acciones compactas / piezas reales / historial PDT | Implementado |
| v281 | Restauración columnas PDT + menú Acciones | Publicado; validación visual completa pendiente |
| v282 | Hotfix permiso RPC estado de arrastre | Backend aplicado/probado; prueba usuario pendiente |

**Nota:** v282 es un hotfix de backend. La versión visible del frontend continúa siendo **LAB v281** porque no fue necesario cambiar código funcional del navegador.

---

## 18. ERRORES RECIENTES Y LECCIONES

### Login / carga del SDK
Se estabilizó usando Supabase directo y SDK local. No reintroducir detección de Gateway ni dependencias CDN en el LAB.

### Reserva compartida
No confundir una orden con varias reservas con una RESERVA COMPARTIDA.

### Pendientes v280
Una modificación visual sustituyó columnas existentes. v281 restauró la tabla histórica y agregó Acciones sin eliminar información.

**Lección:** los cambios de UX deben ser aditivos salvo aprobación explícita de sustitución.

### Producción v282
Una RPC utilizada desde navegador perdió permiso `anon`.

**Lección:** al crear/reemplazar RPC invocadas desde el frontend, verificar conjuntamente:
- firma;
- `SECURITY DEFINER`;
- `search_path`;
- permisos `anon/authenticated`;
- validación interna del token/rol;
- prueba positiva y prueba negativa de autorización.

---

## 19. PENDIENTES ACTUALES PRIORIZADOS

### P1 — Verificación operativa
1. Reprobar desde navegador el cambio de estado de una reserva de arrastre después del hotfix v282.
2. Completar prueba visual/funcional de Pendientes v281:
   - Semana.
   - orden de columnas.
   - Acciones.
   - Modificar.
   - Validar.
   - Historial.
   - permisos por rol.

### P2 — Portada
3. Definir e implementar la nueva presentación de saldos separando PANELES_2 y FRAMES_2.
4. Mostrar claramente semanas vencidas y semana actual.
5. No presentar la suma PANELES + FRAMES como si fuera automáticamente un saldo consolidado de ventanas.
6. Definir visualmente la antigüedad/fuente del último Export si el indicador depende de una carga diaria.

### P3 — Seguridad técnica
7. Diseñar un plan independiente para RLS/permisos sin modificar el sistema operativo de forma transversal.
8. Auditar las RPC utilizadas por navegador para detectar inconsistencias similares de `GRANT EXECUTE`.

### P4 — Validación por roles
9. Completar pruebas de Patinador, Coordinador, Líder Línea, Supervisor Picking y Líder Mecanizado en el flujo PDT.

---

## 20. PRÓXIMOS PASOS RECOMENDADOS

1. Confirmar en navegador que v282 resolvió el cambio de estado en Producción.
2. Cerrar verificación visual de Pendientes v281.
3. Retomar el rediseño de saldos de portada con PANELES_2 y FRAMES_2 separados.
4. Antes de implementar la portada, aprobar un boceto definitivo y la definición exacta de cada indicador.
5. Ejecutar regresión de Programación, Producción, Picking y Pendientes después de cualquier cambio transversal.

---

## 21. PROTOCOLO OBLIGATORIO PARA PRÓXIMAS SESIONES

### Antes de modificar
1. Leer este documento.
2. Consultar el código actual de `main`.
3. Consultar Supabase cuando la funcionalidad dependa de tablas/RPC.
4. Identificar dependencias entre módulos.
5. Confirmar la regla de negocio vigente.
6. No asumir que algo está implementado por aparecer en conversaciones históricas.

### Durante el desarrollo
1. Aplicar el cambio mínimo necesario.
2. Preservar funciones operativas.
3. Mantener permisos backend además de controles visuales.
4. Versionar las migraciones.
5. Ejecutar pruebas positivas, negativas y de regresión.

### Al finalizar
Registrar claramente:
- qué se propuso;
- qué se implementó;
- qué se aplicó en Supabase;
- qué se publicó;
- qué pruebas pasaron;
- qué falta verificar por el usuario;
- errores conocidos;
- siguiente paso.

Nunca declarar **VERIFICADO** únicamente porque el pipeline terminó correctamente cuando la funcionalidad requiere una prueba visual u operativa del usuario.

---

## 22. RESUMEN DE CONTINUIDAD AL 2026-10-19

SGP_ONE continúa estable sobre **Firebase Hosting + Supabase directo**. El frente visible está en **LAB v281**. El flujo de Pendientes de aluminio ya incorpora validación formal, acciones compactas, piezas reales de la orden, NC/reserva solución e historial, pero falta cerrar la validación visual completa por roles.

El error de Producción `permission denied for function sgp_mecanizado_guardar_estado_arrastre` fue diagnosticado y corregido en Supabase mediante el hotfix backend v282, con pruebas positivas y negativas exitosas. Falta únicamente confirmar la operación desde el navegador real.

La portada mantiene todavía el cálculo histórico que suma `saldo_ensamble` y `saldo_empaque` de PANELES_2 y FRAMES_2. Se comprobó que esto puede duplicar conceptualmente producciones presentes en ambas líneas. El rediseño para mostrar saldos separados de semanas vencidas y semana actual está **pendiente de definición final e implementación**.

**Siguiente punto de continuidad recomendado:** cerrar prueba v282 y luego definir/implementar la nueva portada de saldos por línea.


---

## 30. CONTINUIDAD 2026-10-19 — v283 · CANTIDAD CANÓNICA DE PROGRAMACIÓN

### Objetivo
Evitar que Programación considere `sgp_mecanizado_programacion.cantidad_programada` como verdad vigente cuando la composición/cantidad real de una parte cambió posteriormente.

### Regla aprobada
- Fuente canónica vigente: `sgp_producciones.key_produccion + sgp_producciones.cantidad`.
- `cantidad_programada` se conserva como snapshot histórico y continúa siendo válida para reportes/calendario histórico.
- Una programación nueva debe persistir las `key_produccion` exactas que cubre.
- Los históricos ambiguos no se reconstruyen por inferencia.

### Implementación Supabase
Aplicadas:
- `lab_v283_cantidad_canonica_programacion`.
- `lab_v283_programacion_composicion_consumidores`.

Versionado en:
- `supabase/migrations/20261019_programacion_cantidad_canonica_v283.sql`.

Se agregó:
- `sgp_mecanizado_programacion_detalle`: composición persistida por `id_programacion + key_produccion`.
- `sgp_mecanizado_cobertura_programacion(token, semana)`: devuelve cantidad canónica, cubierta, pendiente y estado de cobertura.
- `sgp_mecanizado_programar`: valida contra saldo canónico y persiste composición exacta.
- `sgp_mecanizado_ordenes_programacion`: usa composición persistida cuando existe; conserva fallback legacy.
- `sgp_mecanizado_pendientes_turno`: arrastre usa composición persistida cuando existe; conserva fallback legacy.

Seguridad:
- tabla detalle con RLS habilitado;
- sin acceso directo para `public/anon/authenticated`;
- RPCs invocadas por navegador conservan `SECURITY DEFINER`, validación interna SGP y EXECUTE para `anon/authenticated/service_role`.

### Reconciliación histórica
Backfill automático únicamente cuando la composición actual era inequívoca y la suma canónica coincidía exactamente con el snapshot histórico.

Casos auditados SEM 43:
- 8689722 / 1.1: canónica 58, histórica 55 → `LEGACY_REVISAR`.
- 8689722 / 1.2: 54 = 54 → `PROGRAMADA`, detalle persistido.
- 8689722 / 1.3: 55 = 55 → `PROGRAMADA`, detalle persistido.
- 8689919 / 13: 35 vs 29 → `LEGACY_REVISAR`.
- 8690338 / 2.1: 55 vs 46 → `LEGACY_REVISAR`.
- 8690338 / 2.2: 65 = 65 → `PROGRAMADA`, detalle persistido.
- 8690348 / 3.1: 37 = 37 → `PROGRAMADA`, detalle persistido.
- 8690348 / 3.2: 38, sin programación → `SIN_PROGRAMAR`.
- 8690348 / 3.3: 39, sin programación → `SIN_PROGRAMAR`.

### Frontend
`app.js` carga `sgp_mecanizado_cobertura_programacion` junto con disponibles/programación y usa `cantidad_cubierta` para:
- saldo por reserva;
- saldo por parte/prioridad semanal;
- clasificación programada/parcial/pendiente.

La versión visible se actualizó a **LAB v283**.

### Pruebas
Se agregó `tests/programming-canonical-coverage.test.mjs` para impedir regresión al cálculo basado únicamente en `cantidad_programada`.

Estado al documentar:
- ANALIZADO: **COMPLETADO**.
- IMPLEMENTADO: **COMPLETADO**.
- APLICADO EN SUPABASE: **COMPLETADO**.
- VERSIONADO EN GITHUB main: **COMPLETADO**.
- PRUEBAS AUTOMÁTICAS: **SUPERADAS** en GitHub Actions tras corregir un test histórico acoplado literalmente a v281.
- PUBLICADO EN FIREBASE: **SÍ**. Workflow `Deploy SGP ONE to Firebase Hosting` run `39293869162`, pasos de release, tests y deploy completados con éxito.
- VERIFICACIÓN VISUAL/OPERATIVA: **PENDIENTE**.

### Riesgo residual
Los registros `LEGACY_REVISAR` mantienen compatibilidad histórica y no reciben composición inventada. Deben revisarse caso por caso si se desea reconstruir exactamente qué nuevas producciones pertenecen a una programación histórica.


---

## 31. CONTINUIDAD 2026-10-19 — v284 · COBERTURA DE PROGRAMACIÓN POR ORDEN

### Problema confirmado
v283 corrigió la cantidad canónica, pero un histórico con snapshot distinto a la composición actual podía mostrar una diferencia numérica como “sin programar” sin saber qué órdenes estaban realmente pendientes.

Ejemplo auditado:
- 8689722 / 1.1: snapshot 55, cantidad actual 58; las 14 órdenes actuales tienen evidencia de ejecución ligada al mismo id_programacion y están PROCESADAS. La diferencia de 3 no representa una orden nueva.
- 8689919 / 13 y 8690338 / 2.1: existe diferencia histórica pero no evidencia suficiente para inferir automáticamente cuáles órdenes quedaron fuera.

### Regla v284
La cobertura se determina por `key_produccion`, no por resta de cantidades.
- PROGRAMADA: key_produccion cubierta por una programación activa.
- PENDIENTE: key_produccion no cubierta cuando la composición ya es conocida.
- REVISAR HISTÓRICO: existe programación legacy pero no hay evidencia suficiente para reconstruir su composición.
- Nunca elegir órdenes por subset de cantidades ni por coincidencia numérica.

### Backend
Aplicado en Supabase:
- `lab_v284_cobertura_ordenes_base`
- `lab_v284_reconciliar_programacion_legacy`
- `lab_v284_backfill_evidencia_ejecucion`
- `lab_v284_revoke_public_cobertura`

RPC:
- `sgp_mecanizado_cobertura_ordenes(token, semana)`
- `sgp_mecanizado_reconciliar_programacion_legacy(token, id_programacion, keys[])`

La reconciliación manual está limitada a ADMINISTRADOR/COORDINADOR. Los RPC conservan SECURITY DEFINER, validación SGP y EXECUTE para anon/authenticated/service_role; PUBLIC quedó revocado.

Backfill seguro confirmado:
- 8689722 / 1.1 → 14 key_produccion, cantidad canónica actual 58, origen RECONSTRUIDA_EJECUCION.
- 8689722 / 1.2 y 1.3 permanecen CANONICA.
- 8690338 / 2.2 permanece CANONICA.
- 8690348 / 3.1 permanece CANONICA.
- 8689919 / 13 y 8690338 / 2.1 permanecen sin composición inventada y requieren reconciliación.

### Frontend
LAB v284:
- carga cobertura por orden;
- muestra PROGRAMADA / PENDIENTE por orden dentro de cada parte;
- bloquea programación de un histórico ambiguo hasta reconciliarlo;
- muestra “REVISAR HISTÓRICO” y permite al Coordinador seleccionar explícitamente las órdenes que ya pertenecían a la programación anterior;
- después de reconciliar, las no seleccionadas quedan pendientes y pueden programarse con el flujo normal.

### Pruebas y publicación
- JavaScript syntax check: SUPERADO.
- SGP ONE Tests: SUPERADO.
- Deploy Firebase workflow run 39298089120: SUPERADO.
- Verificación backend de privilegios: SUPERADA.
- Verificación visual/operativa en navegador: PENDIENTE.

### Estado
ANALIZADO: COMPLETADO.
IMPLEMENTADO: COMPLETADO.
APLICADO EN SUPABASE: COMPLETADO.
VERSIONADO EN GITHUB main: COMPLETADO.
PROBADO AUTOMÁTICAMENTE: COMPLETADO.
PUBLICADO EN FIREBASE: COMPLETADO.
VERIFICADO EN NAVEGADOR: PENDIENTE.

---

## Actualización 2026-10-20 — LAB v306: eficiencia y relaciones de vidrio

**Alcance:** SGP_ONE / Ensamble / Reporte de ubicaciones / Explorador de relaciones.
**Fuente operativa:** GitHub `main`, PR #11 de la rama `feat/lab-v306-glass-week-filter`; actualización preparada para `main`.
**Condición inicial:** historial del documento refleja LAB v281; para el estado presente debe consultarse el código `main` y la versión visible del frontend. 

### Implementación de v306

- Filtro por año/semana de producción, indexado exclusivamente por `key_produccion`, `semana_actual` (alternativamente `semana_base`) y `anio`. Usa las RPC autorizadas `sgp_picking_semanas` y `sgp_consultar_programacion_semana`.
- No altera los indicadores generales ni tablas de Ubicaciones: el filtro se aplica a la sección Eficiencia y a la red de relaciones.
- En la red: reserva, parte y orden muestran **ventanas**, deduplicadas por `key_produccion`; burro muestra **vidrios** según estado seleccionado.
- Seleccionar reserva, parte, orden o burro resalta las conexiones de su cadena completa. La exploración desde parte/orden sigue tanto hacia la reserva como hacia los burros, sin confundir un burro compartido con pertenencia de otras órdenes a la misma parte.
- Doble clic (o dos pulsaciones seguidas) sobre un burro abre detalle de reservas, partes, órdenes y estado de los vidrios; botón accesible desde panel lateral para móvil.
- La nueva pantalla usa datos de la RPC vigente `sgp_reporte_dispersion_vidrio` sin escrituras a Supabase.
- Pruebas: `tests/glass-week-filter-v306.test.mjs` y `tests/glass-relations-v306.test.mjs` con agrupación, semanas y relaciones compartidas.

### Estado de entrega

Código **IMPLEMENTADO** en el PR #11; pruebas automáticas de rama deben verificarse en GitHub Actions; **PUBLICADO y VERIFICADO funcionalmente en Firebase pendientes de evidencia**.
No se modificaron tablas, RPC, políticas RLS ni permisos. No afecta SGP_ONE_GOOGLE.

---

## Actualización 2026-10-20 — LAB v307: indicadores y pop-ups en explorador de vidrio

**Alcance:** SGP_ONE / Ensamble / Reporte de ubicaciones / Explorador de relaciones. Cambios solo de frontend y pruebas; Supabase sin alteraciones.

### Objetivo autorizado
- Pop-up en reserva, parte, orden y burro al pasar el cursor o enfocar. Contiene cantidades de preparados, novedades, traslados, otros y cobertura por cantidad.
- Orden con distintivo visual **Completa** cuando `ventanas>0 && preparados>=ventanas`; **Parcial** en caso contrario. Es una comparación numérica, NO una certificación de vidrio individual por ventana.
- Burro con distintivo **Compartido** cuando dos o más reservas principales tienen vidrios dentro del estado visible, respetando el filtro semanal y la distinción entre reserva principal y reserva múltiple.
- Desglose por reserva principal en los pop-ups y el detalle de burro; distingue el preparado de los otros estados.
- UI compatible con mouse, teclado y pulsación táctil; popup informativo y panel lateral accesible, sin alterar la interacción de selección / doble clic.

### Fuentes y contratos
`sgp_reporte_dispersion_vidrio(p_token)` entrega `key_produccion`, `reserva`, `parte`, `posicion`, `ventanas`, `preparadas`, `novedad`, `traslado`, `unidades` para generar información exclusivamente local. Se preserva el filtro por semana `key_produccion` de LAB v306 y el contrato de roles de la RPC.

### Evidencia / riesgo
Consulta en modo lectura: orden 1066618, reserva 8690348, tiene 9 ventanas y 8 vidrios preparados en el snapshot consultado; debe ser Parcial 8/9.
Riesgos pendientes: verificar hover y panel lateral en móvil, estados `Preparado - Sin Movimiento`, burros compartidos en otras semanas, y comportamiento con roles Consulta.
Estado: **IMPLEMENTADO EN RAMA**, pruebas automáticas/PR/publicación pendientes de cierre. No se ha declarado VERIFICADO.

---

## Actualización 2026-10-20 — LAB v308: detalle de piezas

**Proyecto/módulos:** SGP_ONE / consulta de programación y Picking / modal de detalle de piezas. **Alcance:** frontend, documentación y tests. Código preparado en `feat/lab-v308-piece-detail-layout`, a integrar mediante PR tras pruebas y autorización independiente de fusión/publicación.

- **Orden de columnas:** `Resumen` pasa a Perfil, Cantidad, Descripción; `Ampliado` a Perfil, Marca, Cantidad, Descripción. `Detallado` inicia con Descripción al final, conservando el movimiento manual de columnas.
- **Parte de Picking:** `Por órdenes` preserva el desglose original; `Solo referencias` agrupa `perfil/codigo_sap` y suma cantidades sin separación por producción. Se conservan además `Resumen`, `Ampliado` y `Detallado`.
- **Reserva consultada:** añade `Solo referencias` sobre las piezas ya filtradas de la reserva, sin modificar consultas o permisos.
- **Orden individual:** mantiene las vistas existentes, con columnas reordenadas.
- **Scroll:** `#pieceModal` usa desplazamiento interno de tabla y pestañas desplazables, dejando título y controles visibles, tanto escritorio como móvil. CSS exclusivamente bajo `#pieceModal`, para no afectar otros modales.
- **Fuente de datos sin cambios:** RPC `sgp_picking_piezas_panel` (PANEL exclusivamente), y `sgp_consultar_piezas_semana` bajo sesión existente. Sin escrituras, RLS ni cambios en Supabase.
- **Pruebas:** `tests/piece-detail-views-v308.test.mjs` comprueba agrupación y sumas, preservación de fuente, contextos de las vistas, columnas y scroll. Verificación funcional móvil aún pendiente de publicación.

**Estado provisional:** IMPLEMENTADO en rama; PROBADO/PUBLICADO/VERIFICADO pendientes de resultado de CI y fusión autorizada. No modifica SGP_ONE_GOOGLE.


---

## 2026-10-20 — LAB v310: tercer subnivel de prioridades

**Proyecto:** SGP_ONE (NO SGP_ONE_GOOGLE). **Módulos:** Programación semanal, Mecanizado, Picking, Ensamble. **Rama:** `feat/lab-v310-priority-third-level`. **PR:** https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/pull/16 (DRAFT, no fusionado). **Main base:** `dbba4a12572c5fc2055182112e81e8c44aec4333`.

### Estado real

- **FRONTEND:** IMPLEMENTADO EN RAMA LAB v310, NO PUBLICADO, NO VERIFICADO VISUALMENTE. Conserva asignación por producción; Retail permite 3.1.1/3.1.2; Proyecto indivisible; otras partes bloqueadas; inicial PANELES_2. Picking y Ensamble ordenan y muestran nivel 3.
- **BACKEND:** APLICADO EN SUPABASE SGP-ONE-LAB el 2026-10-20, proyecto `ocvxbwzqxbrfndkvjmfx`. Migración live `20261020204906_lab_v310_prioridad_tercer_nivel`. **Autorización expresa del usuario recibida el 2026-10-20.**
- **RPC modificadas exactamente:** `sgp_mecanizado_disponibles(text,integer)`, `sgp_picking_cola(text)`, `sgp_guardar_prioridad(text,integer,integer,text,text,jsonb)`. Sobrecarga `sgp_mecanizado_disponibles(text)` intacta.
- **SQL versionado:** `supabase/migrations/20261020_lab_v310_prioridad_tercer_nivel.sql`. **Rollback de definiciones originales:** `supabase/rollback/20261020_lab_v310_prioridad_tercer_nivel_rollback.sql` (NO ejecutado).
- **Seguridad:** mismas firmas, SECURITY DEFINER, search_path, roles funcionales y EXECUTE anon/authenticated. Sin ALTER TABLE, RLS, GRANT, cambios de datos persistentes ni despliegues.
- **Integridad:** `sgp_prioridades.id_prioridad` se conserva al editar una parte (upsert sin borrado indiscriminado); bloquea cambio u omisión de claves programadas, agregado a parte programada, Proyecto dividido, prioridad de cuatro niveles, y tercer nivel fuera de PANELES_2.
- **Contrato Picking:** `parte_num` sigue siendo numérico en JSON; la clasificación de tres niveles usa segmentos ordenados sin convertir `3.1.1` directamente a NUMERIC.
- **Cuarta RPC aplicada con autorización adicional:** `sgp_generar_prioridades_restantes(text,integer,integer,text)` admite 1, 2 y 3 niveles en el cálculo de `next_prio`. Migración Supabase `20261020210649_lab_v310_generar_prioridades_tercer_nivel`; SQL `supabase/migrations/20261020_lab_v310_generar_prioridades_restantes.sql`; rollback exacto `supabase/rollback/20261020_lab_v310_generar_prioridades_restantes_rollback.sql` (no ejecutado). Se retiró el bloqueo temporal del frontend de la rama. Conserva SECURITY DEFINER, search_path, EXECUTE, autorización funcional y JSON original.
- **Concurrencia:** validación SQL transaccional de programación activa, sin bloquear inserciones simultáneas de programación por otras RPC. Requiere prueba de concurrencia antes de declarar verificación operativa completa.

### Evidencia de pruebas backend (transacciones con ROLLBACK)

1. Usuario sintético ADMINISTRADOR con sesión temporal y transporte PostgreSQL `anon`: `sgp_mecanizado_disponibles(token,43)` y `sgp_picking_cola(token)` devuelven datos válidos. Sesión temporal revertida.
2. Reserva Retail 8690341 (semana 43, cuatro producciones, sin programación): asignación simulada `10.1.1`, `10.1.2`, `10.2`, conservando todos los UUID; Mecanizado ordena partes correctamente.
3. Programación temporal de `10.1.1` en la misma transacción: Picking devuelve la parte y mantiene `parte_num` numérico; intento de cambiar la parte programada rechazado.
4. Reserva 8690348 con partes programadas: reagrupación rechazada.
5. Prioridad `10.1.1.1` rechazada; Proyecto 8566601 no divisible; rol PATINADOR sin autorización para guardar.
6. Con `10.1.1` programada, otra parte `10.2` puede subdividirse sin alterar programación ni UUID.
7. Tras ROLLBACK: `sgp_prioridades` mantiene **305 registros / 305 UUID únicos / 0 prioridades de tercer nivel persistidas**; `sgp_mecanizado_programacion` mantiene **47 registros / 0 registros LAB_TEST_ROLLBACK**; no quedaron sesiones sintéticas.
8. Permisos `anon` y `authenticated` siguen en EXECUTE; SECURITY DEFINER y search_path intactos.
9. GitHub Actions: ejecutar/regresar a comprobar CI del último commit de la rama. No confundir tests con verificación móvil/planta.
10. Generación automática: prueba transaccional con prioridad simulada `99.1.1` y seis reservas pendientes, `siguiente_prioridad = 100 + reservas_generadas`; PATINADOR rechazado, sesión y asignaciones revertidas. Privilegios anon/authenticated, firma, SECURITY DEFINER y search_path comprobados. GitHub Actions de rama verde antes de aplicar cuarta RPC.

### Pendientes y autorización

1. Cuarta RPC ya autorizada, aplicada y probada con ROLLBACK; falta verificación en navegador cuando se autorice la publicación del frontend.
2. Revisar y aprobar explícitamente fusión del PR #16; **no fusionar ni desplegar** por la sola autorización de las tres RPC.
3. Tras publicación autorizada: validar flujo completo en navegador y móvil, con reservas reales y sin alterar datos de producción; verificar arrastre, Picking PANEL, reserva compartida/múltiple, permisos y concurrencia.
4. No modificar SGP_ONE_GOOGLE.

**Estado final:** BACKEND APLICADO Y PROBADO CON ROLLBACK; FRONTEND IMPLEMENTADO EN RAMA, NO FUSIONADO, NO PUBLICADO, NO VERIFICADO EN NAVEGADOR.


### 2026-10-20 — Corrección de vidrio en arrastre de turno (solo rama, autorizada)

**Objetivo:** que los indicadores Prep./Nov./Trasl. de órdenes pendientes de turno anterior reflejen el vidrio real de su programación original, sin alterar su estado productivo ni crear programaciones.

- **Autorización:** usuario aprobó expresamente implementar en la rama del PR #16, **sin fusionar ni publicar**.
- **Causa en `main` `dbba4a12572c5fc2055182112e81e8c44aec4333`:** `renderProductionBoard` asignaba ceros fijos a todas las órdenes `_carry`.
- **Evidencia Supabase:** reserva 8689746, orden 871039, `key_produccion=1308927|PANELES_2`, programación original `38a9f4c6-5346-4d92-8f55-e0a1b608978d`: **4 preparados, 0 novedad, 0 traslados** en vista y RPC original. Los ceros mostrados en la captura eran falsos.
- **IMPLEMENTADO en rama:** `app.js` consulta `sgp_mecanizado_ordenes_programacion(p_token,id_programacion_origen)` reutilizando RPC existente y caché de solicitudes por ID original. `src/domain/carry-glass.js` relaciona resultados **solo por `key_produccion`**; conserva cantidad, identidad, estado, observación y reservas compartidas de la fila arrastrada; no usa nombre de orden para emparejar. La edición de estados sigue apuntando al `id_programacion_origen` original.
- **Sin dato:** un error de lectura, ausencia de orden o conteo inválido muestra **—**, con aclaración visible, no 0. El valor 0 solo se presenta cuando está registrado explícitamente. Una falla de vidrio no oculta el listado de órdenes ni sus acciones.
- **Archivos:** `app.js`, `src/domain/carry-glass.js`, `styles.css`, `tests/carry-glass-v310.test.mjs` y esta documentación. Sin cambios en tablas, RLS, permisos, RPC, programación ni SGP_ONE_GOOGLE.
- **Pruebas automatizadas:** unión por clave, caso real 871039, órdenes con nombres duplicados pero distintas líneas, conservación de estados y observaciones, errores/ausencias y ausencia de ceros artificiales. Confirmar resultado final del CI de rama antes de dar por PROBADO.
- **Estado:** IMPLEMENTADO EN RAMA, NO FUSIONADO, NO PUBLICADO, NO VERIFICADO EN NAVEGADOR/PLANTA. Se requiere autorización específica posterior para fusionar/publicar.

---

## 2026-10-20 — LAB v311: estado de aluminio en Recepción (rama de propuesta)

**Proyecto:** SGP_ONE, repositorio `jcastillodelarosa-hub/SGP-ONE-LAB`. **Base:** LAB v310, commit `e69e5e159d4fee648f01da2d14fe2ad17de4ae25`. **Rama:** `feat/lab-v311-recepcion-estado-aluminio`.

**Objetivo autorizado:** agregar a la tabla de pendientes por recibir y al histórico de recibidas una columna independiente «Estado aluminio», con la condición logística real del tablero de seguimiento.

**Fuente y alcance:** se reutiliza la RPC existente `sgp_consultar_seguimiento_aluminio(p_token,p_semana)`, ya usada por el tablero, con la misma semana consultada en `sgp_recepcion_listar`. Se toma `estado_reserva` (fuente normalizada del seguimiento), **no** `estado_operativo`, que incorpora recepción/legalización. Las filas se consolidan por `reserva`; ante estados distintos o ausencia de datos se presenta «ESTADO MIXTO» / «SIN DATO» (neutral), sin inventar entrega.

**Colores:** `ALUMINIO_ENTREGADO` verde, `PENDIENTE_BODEGA` amarillo, `PENDIENTE_ABASTECIMIENTO` naranja. El estado de recepción física, faltantes, legalización, contadores, auditoría y botones se preservan sin modificación funcional.

**Archivos:** `app.js`, `index.html`, `styles.css`, `src/domain/reception-aluminum-state.js`, `tests/reception-aluminum-state-v311.test.mjs` y ajustes de pruebas de versión de `tests/piece-detail-views-v308.test.mjs` y `tests/priority-third-level-v310.test.mjs`.

**Seguridad / dependencias:** no se altera Supabase (tablas, datos, RPC, RLS ni grants). La RPC de seguimiento y la RPC de recepción comparten los roles permitidos (ADMINISTRADOR, COORDINADOR, LIDER, CONSULTA) según inspección de solo lectura en Supabase. Un fallo en seguimiento no bloquea auditoría y se muestra advertencia visible. Consultas concurrentes por semana descartan respuestas antiguas.

**Preflight live de solo lectura:** en semana 42 hay 24 reservas en Recepción y 24 con seguimiento activo; no se observaron reservas con estados logísticos contradictorios entre los 100 identificadores activos consultados.

**Estado:** IMPLEMENTADO EN RAMA; PR y CI sujetos a ejecución. **NO PUBLICADO ni VERIFICADO en navegador**. No fusionar ni desplegar sin autorización adicional. SGP_ONE_GOOGLE no se modifica.

---

## 2026-10-21 — LAB v312: selector de archivos unificado (propuesta en rama)

**Proyecto:** SGP_ONE / SGP-ONE-LAB, rama operativa `main`. **Base:** LAB v311, commit `011fd2a885e7590f146b8a9d25641c682503c5fe`. **Rama de trabajo:** `feat/lab-v312-unified-file-pickers`.

**Objetivo:** unificar la presentación de todos los controles de selección de archivos de la web con el estilo del control «Fotos de la reserva» de Mecanizado → Recepción, sin modificar los procesos de importación.

**Inventario confirmado en `index.html`:** 11 entradas `type=file`. Nueve entradas XLSX visibles: Carga semanal — `programmingFiles` (múltiple), `aluminumPiecesFile`, `accessoriesFile`, `glassFile`; Actualización diaria — `dailyExportFile`, `glassLocationFile`, `ncAlFile`, `ncGlassFile`, `aluminumTrackingFile`. Dos entradas de fotografía existentes en Recepción — `recPhotos` (múltiple) y `recCameraPhotos` (múltiple con `capture=environment`) — se conservan sin cambios.

**Implementación:** `index.html` presenta en las nueve cargas XLSX un botón azul claro «Elegir del dispositivo», selección de nombres/cantidad y ayuda contextual; `styles.css` adapta el control a escritorio/móvil; `src/ui/file-picker.js` actualiza el texto de selección con `textContent` al recibir `change`, sin reemplazar el `input` ni tocar el `FileList`; `app.js` inicializa el componente. La selección nativa, atributos `accept`, `multiple`, validadores y botones «Aplicar» se preservan.

**Pruebas:** `tests/file-picker-v312.test.mjs` comprueba el inventario de 11, los nueve estilos, nombres de archivo, preservación de fotos/cámara y los handlers de validación. Se actualizan dos pruebas previas que verifican el número de versión del HTML.

**Seguridad y alcance:** no se modifica Supabase, Firebase, Gateway, roles, tablas, datos ni RPC. No se tocan flujos de recepción ni almacenamiento de evidencias. La revisión de compatibilidad móvil y apertura del selector nativo requiere prueba real de navegador.

**Estado:** IMPLEMENTADO EN RAMA y PR #18 en borrador; CI GitHub Actions del primer commit de PR: 78/78 pruebas aprobadas y verificación de sintaxis correcta. **NO FUSIONADO, NO PUBLICADO y NO VERIFICADO visualmente.** Fusionar/publicar solo con autorización adicional. La verificación de compatibilidad móvil y elección real de archivos sigue pendiente.

---

## 2026-10-21 — LAB v313: tarjetas compactas de archivos Excel (rama de propuesta)

**Proyecto:** SGP_ONE — `jcastillodelarosa-hub/SGP-ONE-LAB`; **base:** LAB v312, commit `bdbe10c3aefbee62ad84ac4529006cd2917383d0`. **Rama:** `feat/lab-v313-compact-excel-file-cards`.

**Solicitud y referencia:** el usuario confirmó que el selector de LAB v312 resulta demasiado alto y desproporcionado; aprobó la mejora visual de tarjeta de archivo seleccionado, con icono verde tipo Excel, nombre, tamaño y botón X para quitar.

**Implementación propuesta en rama:** `index.html` conserva los nueve `input[type=file]` XLSX y dos entradas de fotos, pero sustituye el marco grande discontinuo por un botón de selección de 42 px. Al seleccionar un archivo se sustituye visualmente el botón por una tarjeta compacta de 58 px con icono XLSX verde, nombre, tamaño, X accesible y contador verde. En Programación se muestran tarjetas separadas para los archivos múltiples. `styles.css` mantiene proporciones y diseño responsive. `src/ui/file-picker.js` usa `textContent` para evitar HTML inyectado en nombres, mantiene el mismo `FileList` de los validadores y permite eliminar un archivo con `DataTransfer` donde esté disponible (si no, limpia la selección completa). La X emite `change` para invalidar las validaciones previas. El elemento de entrada permanece nativo y accesible por teclado.

**Protección de regresión:** `app.js` mantiene todas las rutas de importación existentes; los controles NC Aluminio, NC Vidrio y Seguimiento ahora invalidan su previsualización al cambiar o quitar el archivo. Se comprueba la identidad del archivo antes de aceptar una previsualización asíncrona de esos tres módulos. Programación, Piezas, Accesorios, Vidrio, Export diario y Ubicación de vidrio ya tenían invalidación por `change`.

**Pruebas:** se ajustan `tests/file-picker-v312.test.mjs`, `tests/piece-detail-views-v308.test.mjs`, `tests/priority-third-level-v310.test.mjs`; se añade `tests/file-picker-v313.test.mjs` para diseño compacto, icono Excel, nombre/tamaño, eliminación, selección múltiple, `change`, seguridad de nombres y protección de previsualizaciones.

**Alcance y seguridad:** no se modifica Supabase, tablas, RPC, RLS, permisos, roles, datos, Firebase, Gateway ni SGP_ONE_GOOGLE. No se cambia el proceso de recepción de fotos. No se alteran las reglas de importación ni los archivos permitidos.

**Estado:** IMPLEMENTADO EN RAMA; pruebas de CI y PR pendientes. **NO FUSIONADO, NO PUBLICADO y NO VERIFICADO funcionalmente.** La integración y el despliegue requieren autorización adicional; se necesita prueba real de selector nativo en escritorio y móvil.

---

## 2026-10-21 — LAB v314: alineación transversal de carga (propuesta en rama)

**Proyecto:** SGP_ONE, `jcastillodelarosa-hub/SGP-ONE-LAB`. **Rama de implementación:** `fix/lab-v314-upload-alignment-all-tabs`. **Base de `main`:** LAB v313, commit `6bd5be8ec237f4d9acfd8111cd2d033aaf04a7d2`.

**Hallazgo comprobado:** el CSS anterior empleaba `align-items:end` en `.daily-upload-row`, `.weekly-upload-row` y una regla específica posterior para `.daily-upload-simple`. La nueva estructura v313 incluye una ayuda textual debajo del selector; al alinear por el extremo inferior se desplaza el botón XLSX hacia arriba con respecto al campo Línea y a los botones Validar/Aplicar. Se reproduce conceptualmente en las cinco pestañas de Actualización diaria y cuatro etapas de Carga semanal. NC Aluminio y NC Vidrio mantenían un layout de cuatro columnas para tres controles, distinto de las otras tres pestañas de actualización.

**Corrección implementada en rama:** en `styles.css` se agrega una regla específica y tardía de alineación superior de las nueve filas, con altura de etiqueta de 16 px, separación de 7 px y desplazamiento de 23 px para acciones directas y estados semanales. Esto mantiene el borde superior de botones, selectores y tarjetas XLSX en una misma línea, incluso al seleccionar archivos. Los breakpoints de 1100/900/850/700 px eliminan ese margen cuando los botones pasan a la fila siguiente o a una sola columna. En `index.html` se asigna `daily-upload-simple` a NC Aluminio y NC Vidrio para usar el mismo layout de tres controles que Ubicación de vidrio y Seguimiento de aluminio. La versión visible pasa a LAB v314 y se sincronizan los parámetros de caché de `app.js` y `styles.css`.

**Dependencias preservadas:** no se modifica el JavaScript funcional ni los inputs, validadores, lógica de importación, selecciones múltiples, tarjetas Excel, recepción de fotografías, Supabase, Firebase, Gateway, roles o SGP_ONE_GOOGLE. Las reglas de negocio no cambian.

**Pruebas:** `tests/upload-alignment-v314.test.mjs` verifica nueve filas, cinco pestañas diarias, cuatro etapas semanales, layout simple en cuatro pestañas, CSS de alineación y breakpoints, y preservación de selección múltiple/fotografías. Se sincronizan cuatro pruebas existentes que verifican el número de versión. **CI del PR #20:** 90/90 pruebas automáticas superadas (GitHub Actions run 39585741589); comprobación de sintaxis JavaScript superada (run 39585741602). Se realizó además una simulación local aislada de geometría CSS con Chromium a 1366, 1024, 800 y 390 px: los controles de una misma fila mostraron desviación vertical de 0 px en los anchos de varias columnas; en anchos menores se apilan sin margen adicional. Esta simulación no sustituye una prueba visual del sistema completo en navegador real. **Pendientes:** revisión visual funcional en navegador y móvil, fusión y publicación.

**Estado:** IMPLEMENTADO EN RAMA, NO FUSIONADO, NO PUBLICADO, NO VERIFICADO FUNCIONALMENTE. Se requiere autorización independiente para fusionar a `main` y desplegar.

---

## 2026-10-21 — LAB v315 — semana de programación en Recepción/Auditoría de Picking

**Proyecto:** SGP_ONE; repositorio `jcastillodelarosa-hub/SGP-ONE-LAB`. **Base:** `main` LAB v314, commit `ad263c9292fa0dff549c7d6f96afbb0799488a73`. **Rama propuesta:** `feat/lab-v315-picking-reception-week-filter`.

**Solicitud:** mostrar la semana de las reservas y órdenes por recibir en la pestaña Picking → Recepción / Auditoría y permitir filtrar por semana, manteniendo búsqueda por orden, reserva y proyecto.

**Diagnóstico comprobado:** la RPC `public.sgp_picking_recepcion_cola(p_token text)` devuelve órdenes pendientes de validación, pero no incluye semana. La RPC existente `public.sgp_picking_cola(p_token text)` sí devuelve `semana` por `id_programacion`, calculada desde `coalesce(sgp_producciones.semana_actual,semana_base)`. Ambas validan `p_token` y los roles autorizados para Recepción/Auditoría son subconjunto de los de la cola de Picking. Consulta agregada de solo lectura en Supabase: 161 entregas pendientes, 161 con semana identificable; 126 de semana 42 y 35 de semana 43; 0 discrepancias entre semana de cola y semana de orden en los datos observados. La semana **no** corresponde a la fecha de entrega.

**Implementación en rama:** nuevo helper puro `src/domain/picking-reception-weeks.js` que asocia `id_programacion` con `semana` de la cola existente, valida semanas 1–53 y no inventa semanas ante faltantes o conflictos. `app.js` consulta ambas RPC de solo lectura en paralelo; si falla la segunda, conserva la auditoría y muestra aviso, sin atribuir semanas incorrectas. En `index.html` se añade `pickReceptionWeek` con opciones derivadas de las entregas realmente pendientes y conteos por semana; `app.js` combina filtro de semana con búsqueda, conserva selección tras actualizar, muestra semana en la cabecera de cada reserva/parte y en cada orden, y cuenta los resultados filtrados. Se mantiene el contador total de órdenes pendientes. `styles.css` ajusta la presentación responsive. Se actualiza la versión a LAB v315 y los parámetros de caché.

**Reglas preservadas:** las órdenes siguen agrupadas por reserva y parte, separando por semana cuando corresponde; no se modifica estado PICKING, auditoría, faltantes, piezas PANEL, reservas compartidas, roles ni la lógica de entrega. Los botones Ver piezas y Auditar siguen usando los identificadores originales. No se alteran RPC, RLS, tablas, datos, Supabase ni SGP_ONE_GOOGLE.

**Pruebas:** `tests/picking-reception-weeks-v315.test.mjs` cubre asociación por programación, semanas válidas/ambiguas, filtros combinados, conteos, búsqueda, botones de auditoría, degradación si falla la consulta de semanas, presentación móvil y versión; se actualizan las pruebas anteriores de versión. **CI del PR #21:** 98/98 pruebas automatizadas aprobadas en GitHub Actions run 39587569902, sin fallos ni omisiones; comprobación de sintaxis JavaScript aprobada en run 39587570047. Pruebas funcionales en navegador, móvil y roles reales siguen pendientes.

**Riesgos y pendientes:** consulta adicional de lectura `sgp_picking_cola` al abrir/actualizar Recepción; si una programación deja de aparecer en la cola, se etiqueta `Sin semana` en lugar de inventar un dato. Se requiere prueba real con roles Picking/Líder Línea, reservas compartidas, búsquedas, refresco y móvil. **Estado: IMPLEMENTADO EN RAMA; NO FUSIONADO, NO PUBLICADO, NO VERIFICADO FUNCIONALMENTE.** Requiere autorización expresa adicional para fusionar y publicar.


---

## 2026-10-24 — Separación de PROGRAMADA y estado de mecanizado (LAB v348 en rama)

**Alcance:** SGP_ONE / Programación y Mecanizado. No aplica a SGP_ONE_GOOGLE.

**Reglas funcionales confirmadas por el usuario:**
- `programada` es una condición Sí/No independiente del estado operativo; inicialmente NO y SÍ al asignar programación.
- La pantalla de programación debe presentar arriba las unidades no programadas y abajo las programadas, **conservando la lógica vigente** de reservas, partes, producciones, programación parcial, cantidades, prioridades, reservas compartidas y múltiples.
- En la migración de registros existentes, toda unidad con un estado registrado se considera programada; el único estado que se convierte es `PROGRAMADA` → `SIN INICIAR`. Los demás valores permanecen sin cambio. No reactivar registros `CANCELADA` por inferencia.
- Flujo operativo: `SIN INICIAR`, `CORTE`, `MECANIZADO`, `PROCESADO`. `REPROGRAMADO` se preserva en datos existentes, pero conceptualmente es un evento de programación. `PICKING` registra entrega física, con validación y faltantes independientes. Conservar trazabilidad de arrastre e identificadores.

**Implementado solo en rama** `feat/programada-sin-iniciar-20261024`:
- `src/config/domain.js`: flujo de estados operativos y definición Sí/No; Picking separado conceptualmente.
- `app.js`: controles de estado de producción muestran `SIN INICIAR`, `CORTE`, `MECANIZADO`, `PROCESADO`; cambio preparatorio **no compatible todavía de forma verificada con las RPC actuales**.
- `docs/programada-sin-iniciar-migracion.md`: especificación, restricciones y pasos pendientes.
- `index.html`: versión visual y parámetros de caché incrementados de LAB v347 a **LAB v348**. Commit de versión `ed1c95c342fa68fd9211beb2db0f48f76b19a0e7`.

**Pendientes y riesgos:** identificar propietario persistente del indicador para unidades no programadas; auditar y adaptar RPC de escritura, defaults, consultas, reprogramación, arrastre y Picking; construir migración SQL idempotente con pre/post conteos y reversión; implementar separación visual superior/inferior; pruebas de permisos, reservas compartidas, programación parcial, estados y móvil. No aplicar cambios aislados de frontend.

**Evidencia y clasificación:** GitHub rama de trabajo con commits; **IMPLEMENTADO PARCIALMENTE EN RAMA, NO FUSIONADO, NO APLICADO EN SUPABASE, NO PUBLICADO EN FIREBASE, NO PROBADO NI VERIFICADO FUNCIONALMENTE**. `main` continúa en LAB v347 hasta que se confirme otra actualización. No se creó PR ni se desplegó.


---

## 2026-10-24 — Auditoría integral de cierre preparatorio LAB v348 / PR #82

**Baseline confirmado:** `main` commit `f342bf7198d3e7638b412756acce0acad9bca301`; trabajo en `feat/programada-sin-iniciar-20261024`, PR #82 **borrador** (no fusionado).

**Correcciones comprobadas en GitHub:** (1) se homologa visualización de `PROGRAMADA` operacional a `SIN INICIAR` preservando `estado_orden='PROGRAMADA'` de cobertura; (2) lista superior sin programar, parcial con **Continuar**, completadas abajo; (3) estados de Producción y Picking, vista compacta, informe de turno y contraste de distintivo `SIN INICIAR`; (4) migración STAGED con bandera `programada`, backfill sin reactivar `CANCELADA`, restricciones de ambas tablas de ejecución, triggers de sincronización, validación de roles, reprogramación vinculada, RPC de arrastre y cola Picking.

**Datos reales consultados en Supabase (solo lectura):** programación: 64 `PROGRAMADA`, 3 `CANCELADA`; ejecución general: 6 `CORTE`, 2 `MECANIZADO`, 41 `PROCESADO`; ejecución por orden: 2 `PROGRAMADA`, 2 `CORTE`, 128 `PROCESADO`, 5 `REPROGRAMADO`. El esquema operativo todavía no tiene aplicada la columna `programada` ni la migración v348.

**Pruebas verificadas en rama:** GitHub Actions **SGP ONE Tests** run `40103946305`: 195/195 aprobadas, incluidos 10 casos automatizados v348 de integridad documental/estática. **JavaScript syntax check** run `40103946303`: satisfactoria. El workflow incluye `npm run verify:release`, y la versión `v348` y recursos de caché coinciden. Las pruebas de fuente no demuestran que SQL se haya ejecutado.

**Barrera de publicación pendiente:** no existe una base de ensayo independiente; la creación de rama de Supabase exige confirmación de coste por el usuario. No ejecutar la migración STAGED ni fusionar PR/deplegar mientras falten ensayo transaccional, backups/rollback, pruebas positivas y negativas con roles reales, validación en navegador y móvil, y verificación de Firebase. Sin cambios en Supabase, Firebase ni SGP_ONE_GOOGLE durante esta auditoría.

**Estado:** **IMPLEMENTADO EN RAMA + CI VALIDADO, SQL NO APLICADO, NO FUSIONADO, NO PUBLICADO, NO VERIFICADO FUNCIONALMENTE**.

---

## 2026-10-24 — LAB v348: migración Supabase aplicada; interfaz pendiente de publicación

- Alcance SGP_ONE exclusivamente; SGP_ONE_GOOGLE sin cambios.
- Migración lab_v348_programada_independiente registrada en Supabase con versión 20261024154023, proyecto ocvxbwzqxbrfndkvjmfx. Ensayos transaccionales con ROLLBACK previos, incluida reversión de RPC y esquema.
- Verificación backend: 68 programaciones = 65 SIN INICIAR + 3 CANCELADA; bandera 65 SÍ / 3 NO; 0 inconsistencias. Órdenes: 11 SIN INICIAR, 2 CORTE, 128 PROCESADO, 5 REPROGRAMADO. Ejecución general: 8 CORTE, 2 MECANIZADO, 41 PROCESADO. Historial 283 registros; 2 triggers sincronizadores; RPC de arrastre y Picking actualizadas.
- Migración versionada en supabase/migrations/20261024154000_programada_independiente_v348.sql; reversión de referencia en docs/programada-sin-iniciar-v348-rollback.sql.
- CI PR #82: 195 pruebas de código y sintaxis aprobadas en commit fa573a52 y posteriores. Sin pruebas reales autenticadas en PC/móvil/planta.
- ESTADO: APLICADO EN SUPABASE; INTERFAZ IMPLEMENTADA EN RAMA; PUBLICACIÓN Y VERIFICACIÓN FUNCIONAL PENDIENTES.


---

## Propuesta UX — Resumen semanal con selección múltiple de semanas de programación (2026-10-24)

**Estado:** PROPUESTO / BOCETO; NO IMPLEMENTADO NI PUBLICADO. Solicitud de diseño y actualización documental, no autorización de cambios funcionales ni despliegue.

### Necesidad y distinción de conceptos

En Mecanizado → Programación → Resumen deben distinguirse dos dimensiones independientes:

1. **Semana(s) de programación:** semanas de origen de la demanda de reservas/producciones, seleccionables simultáneamente (ejemplo: 43 y 44 de 2026). Selección múltiple mediante chips y desplegable con casillas, con opción de una semana o varias.
2. **Semana calendario de ejecución:** intervalo real lunes-domingo que ocupa las columnas de la matriz y al que se asignan fecha y turno. Navegación anterior/siguiente sin alterar las semanas de origen seleccionadas.

Un registro puede pertenecer a la semana de programación 44 y ejecutarse en la semana calendario 43. No igualar ni sincronizar automáticamente ambas dimensiones. El filtro por sistema es independiente.

### Boceto funcional solicitado

- Encabezado: selector múltiple de semanas de programación (ej. chips «Semana 43», «Semana 44»); selector/navegador de semana calendario; sistema; Actualizar.
- KPIs: **demanda total de las semanas seleccionadas**, **ventanas de esa demanda programadas**, **ventanas pendientes de programar**, **porcentaje de cobertura**, **sistemas**. Mostrar explícitamente alcance y unidad de cada indicador.
- Barras de avance por sistema: numerador = unidades de demanda programadas; denominador = unidades de demanda total del sistema dentro de las semanas de origen seleccionadas. No presentar la distribución relativa del calendario como porcentaje de cobertura.
- Matriz: lunes a domingo por columnas, Turno 1 y Turno 2 por filas, desglose por sistema y totales; filtrar las programaciones visibles por **ambas** dimensiones cuando corresponda.
- Drilldown al pulsar KPI, sistema, celda o cantidad: reservas, órdenes/producciones, sistema, semana de origen, fecha, turno, cantidad programada, cantidad pendiente y estado, según disponibilidad de datos autorizados.
- Diferenciar «avance de programación» de estados físicos SIN INICIAR, CORTE, MECANIZADO, PROCESADO y PICKING. No confundir reservas disponibles con ventanas pendientes.
- En móvil, chips con selección accesible y matriz con desplazamiento horizontal; mantener norma visual global azul.

### Reglas de cálculo y conciliación antes de implementar

- Identificar fuente canónica de semana de origen y demanda total, sin derivar demanda únicamente del listado de disponibles ni de los registros del calendario.
- Conciliar programaciones parciales, reprogramaciones, arrastres entre turnos, reservas compartidas y reservas múltiples sin doble conteo; preservar reserva principal y trazabilidad.
- Para selección múltiple, deduplicar por identificador funcional de unidad/programación según contrato real; no sumar la misma ventana dos veces.
- Si la demanda o cobertura no puede validarse, mostrar «N/D — pendiente de conciliación» con explicación; no inventar porcentajes ni números.
- Validar contratos RPC, roles y permisos antes de cambios; no modificar Supabase sin autorización específica.

### Pruebas de aceptación propuestas

1. Seleccionar solo semana 43, solo semana 44 y ambas: verificar denominadores, numeradores y pendientes sin duplicaciones.
2. Cambiar semana calendario sin cambiar las semanas de programación seleccionadas; comprobar que el calendario cambia y el alcance de demanda permanece estable.
3. Cambiar semanas de programación sin mover semana calendario; verificar el filtro de la matriz y sus detalles.
4. Comprobar registros de adelanto, arrastre, reprogramación y programación parcial, así como reserva compartida y multirreserva.
5. Abrir detalle desde KPI, sistema y celda; conciliar sumas con la fuente de datos.
6. Probar PC y móvil, sin sesión y con roles autorizados/no autorizados; no considerar CI o Firebase equivalentes a verificación funcional.

**Pendiente:** aprobación del boceto y auditoría de los contratos actuales antes de implementar. Esta sección no modifica las reglas de negocio vigentes.


### Ajustes aprobados al segundo boceto — 2026-10-24

**Estado: DISEÑO APROBADO, IMPLEMENTACIÓN PENDIENTE.** El usuario eligió el **segundo boceto** del Resumen semanal con selección múltiple de semanas de programación y solicitó los siguientes ajustes:

1. **Total por día:** retirar el símbolo de sumatoria (Σ); mostrar únicamente la etiqueta «Total por día» y la cantidad correspondiente.
2. **Filtro de semana de programación:** admitir selección única (ej. 44) o múltiple (ej. 43 y 44), independiente de la semana calendario de ejecución.
3. **Ubicación automática en fechas reales:** al seleccionar únicamente la semana de programación 44, situar inicialmente la vista calendario en el intervalo que contenga la primera fecha real con reservas programadas pertenecientes a esa semana de origen, aunque sea anterior o posterior a la semana 44 del calendario. No confundir semana de origen con fecha de ejecución. Permitir navegar a otros intervalos sin perder el filtro.
4. **Detalle por día:** al hacer clic en el encabezado o total de un día, abrir una ventana accesible con la programación de ese día y de las semanas de origen seleccionadas. Mostrar fecha, turno, reserva, producción/orden, sistema, cantidad de ventanas, semana de programación y estado de mecanizado, cuando los datos autorizados existan. Ofrecer cierre y desplazamiento adecuado en móvil.
5. **Consistencia:** el total del día debe coincidir con la suma de sus turnos y del detalle visible para los filtros activos. No inventar cantidades pendientes; conciliar cobertura con fuentes canónicas y reglas de reserva principal, compartidas, multirreserva, reprogramación y arrastre.

**Aceptación requerida:** probar semana 44 aislada, semanas 43+44, cambio de semana calendario, apertura del día y cierre del detalle, datos sin programación, PC y móvil. La actualización documental no implica cambios de código, despliegue ni verificación funcional.


### Regla funcional confirmada por el usuario — semana de programación frente a calendario (2026-10-24)

**Regla aprobada:** cada reserva pertenece a **una sola semana de programación**. La misma reserva puede tener cantidades programadas en varios días, turnos y **varias semanas calendario de ejecución**, sin cambiar su semana de programación de origen.

**Aplicación al resumen:** el filtro de semanas 43/44 se aplica por la semana de programación propia de la reserva, y el calendario navega independientemente por fechas reales de ejecución. No excluir reservas por estar distribuidas entre varias semanas calendario. En el detalle diario se muestran solo los registros de las reservas de las semanas de programación seleccionadas. La fuente exacta del vínculo reserva→semana de programación debe verificarse en los contratos y datos reales antes de publicar; no inferirla de la semana ISO de la fecha de ejecución.

**Estado:** regla funcional confirmada y documentada; verificación de implementación y publicación pendiente.


## PDT aluminio — multifabricación, avances parciales y NC múltiples (2026-10-24)

**Decisiones funcionales aprobadas por el usuario:**
- Patinador puede reportar un pendiente con varias NC enlazadas individualmente.
- Recepción/validador puede corregir cantidad total y distribuir entre varias fabricaciones (longitud/acabado), conservando el reporte original y motivo de corrección.
- Mecanizado registra avances parciales por fabricación y cantidad; cada movimiento guarda usuario, fecha, turno y observación. El saldo se actualiza sin perder el historial; ejemplo 9 reportadas, 5 E17 y 4 E17-1, Brajhan T1 procesa 2 E17, saldo 3+4=7.
- Saldo de mecanizado cero NO cierra PDT: la entrega en Picking confirma el cierre.
- REPO OK deja de ser estado manual: aviso derivado de NC finalizadas que señala posible solución, sin asumir material físicamente disponible.
- Si solo 2/3 NC están finalizadas, mostrar alerta parcial y seguimiento. Si 3/3 finalizadas, destacar REPO OK. Mostrar avisos en Producción y Pendientes, responsable y antigüedad.
- Preservar reglas de reserva principal, reserva compartida, multirreserva, perfiles PANEL, etapas de mecanizado y permisos actuales.

**Alcance autorizado:** desarrollar exclusivamente en rama, crear PR y ejecutar pruebas no destructivas. **PROHIBIDO** aplicar migraciones a Supabase, modificar datos operativos, fusionar a main o desplegar Firebase sin autorización posterior.

**Rama:** `feat/pdt-multifabricacion-avances-nc`; **PR:** #91 (draft). Documento de diseño `docs/PDT_MULTIFABRICACION_IMPLEMENTACION.md`. Migración `supabase/migrations/20261024_pdt_multifabricacion_avances_nc_DRAFT.sql` es BORRADOR, NO APLICADA.

**Estado:** REGLAS APROBADAS; DISEÑO EN RAMA; RPC, frontend y pruebas de integración PENDIENTES. No afirmar que se implementó ni publicó.


## 2026-10-26 — LABv355 preparada en PR98, NO publicada

Continuación en rama feat/issue-97-operational-calendar: reemplazo de SELECT directo
de reprogramaciones por RPC SGP segura propuesta, sin cambiar RLS ni permisos de tabla.
SQL/inversa en docs/sql-proposals/mecanizado; NO aplicados a Supabase. Interfaz y build
se incrementan de354 a355. Caso8+57=65 y controles de Issue97 conservados;259 pruebas JS,
34 aserciones SQL aisladas y PC/móvil aprobados. Ver checkpoint y tests/issue97/README.md.
No fusionado/desplegado; publicación y aplicación productiva requieren autorización
posterior. Este hito no sustituye la versión actualmente publicada.

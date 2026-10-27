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

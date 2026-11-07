# Hoja de Ensamble: preparación del 7 de noviembre de 2026

Estado: local, no publicado ni aplicado. Base LAB v403, `75b05b8`.

## Reglas recuperadas y corrección integrada localmente

Las decisiones funcionales previas están verificadas: el cumplimiento se mide
frente al **plan vigente al cierre**, conservando el plan original y los cambios
con motivo y hora. Una recarga actualiza únicamente las producciones incluidas:
no suma duplicados ni borra las ausentes por filtros. El avance nuevo descuenta
Disponible; corregirlo hacia abajo restituye la diferencia. La primera carga
necesita una referencia para no descontar dos veces trabajo anterior.

El contrato local 2, nunca publicado ni aplicado, proyectaba únicamente el lote
más reciente. Esa semántica queda **superada**: se integró contrato 3 con último
valor por producción del mismo contexto, su archivo/hash de procedencia y
separación entre ausente con valor conservado y nunca informado. Las verificaciones
786/786 y el readback de una sola carga que aparecen abajo acreditan el corte
anterior, no la corrección parcial descrita a continuación.

La regla del plan ya está aprobada; falta su conexión persistida y versionada,
no otra aprobación de la misma regla. El planificador existente usa saldo y
nomenclatura de Ensamble; esto no atribuye sus registros a Empaque ni reconstruye
motivos/historia ausentes. No usar la suma SALE legacy como plan sustituto.
La referencia técnica inicial y el corte de avance incluido aún no están definidos:
no se inventa una fórmula de conciliación ni se cambia Disponible. El estado
`temporalPolicy:UNRESOLVED` del módulo existente describe esa implementación
pendiente, no desconocimiento de la decisión funcional recuperada.

## Entrega

- B12/B13: `src/modules/lp01-assembly-workspace.*`, `lp01-assembly-sheet.*` y dominio
  `src/domain/lp01-assembly-sheet.js`. No nuevo menú lateral ni cambios del calendario.
- Realizado/cobertura: `src/domain/lp01-closure-export.js`. Solo lectura confirmada
  y proyección PREVIEW_ONLY; no escribe ni activa el cierre V2.
- B15: `src/modules/lp01-assembly-close.js`, resumen sin despacho del cierre manual.
- Integración focal en `lp01-operation.js`; CSS nuevo en `index.html`.
- SQL de catálogo: `docs/sql-proposals/lp01-hoja`, con manifiesto y rollback exactos.

## Verificación

Las pruebas Node de dominio, UI semántica y regresiones focales verifican separación
por identidad/ámbito, versiones de cierre, ausencia distinta de cero, no duplicados,
orden y filtros. `tests/lp01-assembly-workspace/dom-results.json` acredita seis grupos
DOM sintéticos: hoja de tres grupos, retención de búsqueda y borrador, contexto
retirado, rutas de cierre/informes y cero comandos de escritura en la consulta.

`tests/lp01-hoja/catalog-test-results.json` acredita seis grupos SQL locales con
PGlite 0.5.15/PostgreSQL 18.6. El servidor productivo es PostgreSQL 17.11. No repetir
estas pruebas intactas como si fueran una nueva auditoría de producción.

Para reproducir solamente el cambio pertinente:

- `node --test tests/lp01-assembly-sheet.test.mjs tests/lp01-assembly-close.test.mjs tests/lp01-closure-export.test.mjs`
- `npm install --prefix tests/lp01-assembly-workspace --ignore-scripts && node tests/lp01-assembly-workspace/dom.mjs`
- `npm install --prefix tests/lp01-hoja --ignore-scripts && node tests/lp01-hoja/pglite.mjs`

QA visual PC/móvil no acreditada: Chromium no arranca por `socket() failed:
Operation not permitted`, incluso con elevación. No hubo recorrido ni capturas.
El DOM usa polyfills de formulario y diálogo: no acredita layout, foco real de
navegador, top layer ni escritura real contra Supabase.

## Puertas de activación

1. Resolver publicación pública y entregar Observaciones v404 primero. Reintegrar
   los cambios focales de `lp01-operation.js`, no sobrescribir ese archivo completo.
2. Verificar hash actual del cuerpo RPC y autorización exacta para aplicar catálogo;
   SQL no cambia acceso persistente. No ejecutar si cualquier precondición cambió.
3. Decidir y confirmar el cambio de capacidad INCORPORAR y el principal automático.
   Las especificaciones identifican controles y no habilitan esos permisos.
4. Implementar cierre/importación/continuidad por producción sin reparto artificial
   entre UUID. Hasta entonces no publicar como módulo operativo completo.
5. QA visual integrada y CI del HEAD exacto, revisión/merge y flujo protegido del
   repositorio. Versionar y fijar pins solo después de integrar v404. No se reservó
   una publicación ni se creó un PR.

Primer corte local de esta preparación: `npm test` **702/702 PASS**;
`npm run build:vendor && npm run verify:release` PASS sobre el sello base LAB v403.
No equivale a una compilación v405 publicada: número/pins se fijarán tras v404.
Los artefactos vendor y node_modules generados para comprobar no forman parte del
cambio fuente. `git diff --check` y sintaxis de módulos nuevos/cambiados PASS.

## Preparación adicional, todavía desactivada

`docs/sql-proposals/lp01-incorporar` prepara comando INCORPORAR para Ensamble
PANELES_2 y descubrimiento explícito `LP-INCORPORAR-1`. Bandera false por defecto,
sin GRANT ni nueva credencial. Siete grupos SQL locales PASS. No activar sin prueba
concurrente PG17 multi-sesión y confirmación específica del nuevo acceso funcional.
El modal frontend valida cantidad/motivo y usa el transporte CAS/idempotente
existente; permanece deshabilitado sin contrato del servidor.

El resumen B15 permite revisar el XLSX localmente (máximo 2 MiB) sin subirlo,
guardarlo ni confirmar el cierre. Distingue ausentes de cero y reemplaza previews.
El comando nuevo de cierre todavía no está conectado.

La apertura automática tiene una decisión funcional pendiente: no se ha aprobado
qué hacer al llegar el horario si el turno anterior sigue sin cerrar. No se permite
ni se impide esa apertura mediante una regla nueva inferida.

El navegador administrado también rechazó abrir archivos file://; no se intentó
publicar ni servir por otra ruta para eludirlo. La QA visual continúa pendiente.

## Verificación ampliada y dependencias finales

Suite integrada de hojas/incorporación/reportes: **728/728 PASS**, sin omitidos,
con DOM sintético habilitado. Servicio V2 aislado: **22/22 PASS** adicionales.
El DOM del workspace cubre navegación con guardado incierto, lecturas independientes
de nota/afectaciones y consulta solo de filas visibles. El controlador integrado
carga el catálogo y no ofrece los controles antiguos de ejecución/cierre manual.
No acredita la fase de captura de eventos de un navegador real ni layout PC/móvil.

B15 histórico ahora incluye PDF/PNG con vendor local y bandas de página sin pérdida
de píxeles. Las descargas se cancelan si cambia sesión, período o render. Una prueba
con jsPDF real serializó cuatro páginas; no es QA visual del PDF o captura real.
Sale del cierre histórico se etiqueta separado del Disponible global de hoy.

Integración pendiente con v404: ampliar su import de `lp01-order-note-rows.js` a
`{paintOrderNoteRows,retainOrderNoteRows}` y pasar
`noteRows:{paintOrderNoteRows,retainOrderNoteRows}` a `mountAssemblyWorkspace`.
Su `beforeRender` conserva nodos/borradores al filtrar. No sustituir ni copiar
por encima el archivo completo `lp01-operation.js` de ninguna de las dos entregas.
Hasta integrar v404, la nota se lee en fila y se edita desde el detalle compartido.

La propuesta V2 de referencia se incorporó en `src/server/lp-export-production-v2.js`
y `docs/sql-proposals/lp01-cierre-export-v2`. No tiene adaptador conectado ni bandera
productiva; no llamarlo motor terminado. Sus pins pasaron después de integrar.
El adaptador transaccional contenido se prepara en un delta independiente.

## Importación V2 y correcciones del delta

`docs/sql-proposals/lp01-export-import-v2` contiene el adaptador transaccional de
importación por producción. Conserva original/hash, cobertura completa y revisión
del universo. La proyección del lote último del contrato 2 queda superada por la
recarga parcial del contrato 3 indicada al inicio; no activar la anterior. El handler
acepta la nueva autoridad solo con opción explícita; el entrypoint publicado no la
activa. La bandera SQL permanece false. El comando legacy no puede cerrar como
manual un período que haya recibido un lote V2. El paquete no instala permisos,
credenciales ni tareas. Pruebas focales de su preparación: 54/54 Node y siete grupos
SQL PGlite, incluidos rollback y revocación. Guard de sus 14 pins PASS al integrar;
guard de referencia anterior también PASS. No se invocó una RPC productiva.

La consulta del turno actual usa exclusivamente el período devuelto por el servidor
y no abre turnos. La revisión focal detectó y corrigió pérdida de borradores en
paneles de afectación secundarios, pérdida de editor ante fallos transitorios de
refresco y programación desconocida mostrada como cero. Todos los paneles montados,
incluidos ocultos, protegen sus borradores/reintentos. Un fallo de red conserva la
última consulta con aviso; revocación o cambio de sesión/ámbito limpia los datos.
Sin catálogo completo, B15 muestra programación Por validar. Evidencia focal nueva:
workspace DOM 12 grupos, controlador DOM 6 grupos y cierre 4 casos PASS. No es QA
visual ni una repetición de las auditorías SQL previas.

CERRAR V2, continuidad numérica y activación siguen siendo entregas distintas. Esta
importación no conecta por sí sola el botón de cierre ni acredita arrastre correcto.
La inclusión de cierres en el saldo Export oficial requiere una fuente autoritativa
de corte/versiones; no se deduce de timestamp, hash arbitrario o diferencia de saldos.

## Concurrencia PostgreSQL 17 preparada para CI

`tests/lp01-incorporar/concurrency` y su workflow acotado preparan nueve casos reales
de múltiples sesiones: CAS concurrente, petición idéntica, choque con planificador,
revocación y contención antes/después de admisión y fallo atómico final. Solo un
contenedor local postgres:17.11 efímero, red none, sin puertos, montajes, secretos o
conexión Supabase. Siete pruebas simuladas de limpieza del contenedor PASS; fixture
reproducible y pins verificados. PostgreSQL 17 multisesión **NOT_RUN**, porque este
entorno no tiene Docker. No se creó ni ejecutó un job remoto. La existencia del
workflow no levanta la puerta de concurrencia; exigir PASS del SHA publicado después
de obtener autorización de publicación. Crear PR no dispara despliegue en este job.

## Fuente técnica del plan y política temporal pendientes

El Disponible global por producción/etapa está definido por su módulo existente
como `operational:false`, `temporalPolicy:UNRESOLVED`. No se transfiere, consume ni
reparte automáticamente entre turnos. Tampoco se puede sumar el SALE legacy de
varios UUID y presentarlo como objetivo único nuevo. El cierre Export puede
preservar cantidades oficiales e historial, pero su comparación operativa y el
cumplimiento requieren conectar el plan vigente al cierre ya aprobado a una
fuente persistida y versionada. Mantener esa puerta contenida; no declarar
satisfechos los motivos por desvío sin conocer ese plan.
Esto es distinto de la prueba del corte Export necesaria para arrastre y de la
decisión sobre abrir cuando el turno previo sigue sin cerrar.

Último corte integrado, sobre código `2ad59a7`: **751/751 Node PASS, sin omitidos**,
incluidos los 22 casos de referencia V2. Resultado en
`tests/lp01-assembly-workspace/node-suite-results.txt`. Los casos de DOM controlador
incluyen también el formato real de fallo de transporte PostgREST (HTTP status 0),
no solo un código de error sintético. No acredita concurrencia, render visual ni
ninguna operación contra la base productiva.

## Checkpoint final del escritor de cierre V2

`docs/sql-proposals/lp01-export-close-v2` añade CERRAR transaccional a la fachada
existente. Puerta independiente `export_close_v2=false`: habilitar importación sola
no habilita cerrar. Persiste Export/cobertura, archivo/lote, autor, motivos, versión
e historial; no suma SALE ni exige validación manual por UUID. Comparación completa
false y plan null/PLAN_AUTHORITY_REQUIRED. Presupuesto/arrastre null con
RECONCILIATION_REQUIRED. Seis grupos SQL PGlite PASS, tres guards y sintaxis PASS
después de integrar. No se repitieron pruebas de otros paquetes sin cambios.

Los consumidores legacy no pueden convertir esta evidencia nueva en ejecución
manual cero ni arrastre. La inversa solo restaura el cuerpo anterior si no existe
historial V2; si existe, contener y recuperar hacia adelante sin borrar cierres.
El prototipo en memoria anterior está marcado LEGACY_PLAN_REFERENCE_NOT_APPROVED,
no es el contrato de objetivo del flujo aprobado.

**Todavía no operativo:** el helper legacy rechaza V2; la lectura nueva usa un
lector versionado independiente. Faltan autoridad de comparación, integración
de carga/cierre y continuidad antes de habilitar. No se
anuncia closeAuthority. Una aprobación de publicación no resuelve estas condiciones.

Orden de continuación: integrar primero Observaciones v404 y su retención de notas;
fijar versión/pins de la entrega final; conectar el plan vigente y definir referencia/corte Export;
completar UI de escritura/continuidad V2; ejecutar PG17 multisesión y QA visual en entorno
permitido; tramitar activaciones específicas y publicar mediante el flujo protegido.
La apertura automática necesita además principal seguro y decisión funcional sobre
el turno anterior pendiente. No repetir instalaciones o auditorías antiguas ni
presentar una entrega de consulta como sustituto silencioso del alcance completo.


## Lectura V2 y evidencia histórica de identidad

El snapshot guarda identity={key,line,production,system} al cerrar, bajo los locks
existentes; cambiar luego nombre/sistema en catálogo no modifica el informe.
`turn_revision` opcional exige entero seguro igual a la revisión del turno y CAS.
Esas dos variaciones están cubiertas por las seis pruebas SQL focales del paquete.

El lector V2 no modifica el helper legacy fijado por pins. Valida contrato/autoridad,
versión exacta, lote, archivo, cobertura/filas de fuente y ausencia explícita. La
hoja usa el wrapper versionado. B15/CSV/PDF/imagen preservan null y los estados
PLAN_AUTHORITY_REQUIRED/RECONCILIATION_REQUIRED, sin porcentajes inventados ni
mezcla con los  UUID manuales. Si falta identidad inmutable, no se reconstruye con
el catálogo de hoy. El controlador prueba CSV V2 desde el modelo validado y bloquea
la descarga después de cambiar la sesión. No hay carga ni cierre activo en la UI.


Verificación del último delta de lectura: **786/786 Node PASS sin omitidos**, con
23 casos nuevos de lector V2 y 11 de B15 V2. DOM del controlador: siete grupos,
incluido CSV V2 y cambio de sesión. La evidencia Node vigente sustituye el corte
anterior 751, sin convertirla en pruebas SQL productivas ni QA visual. El helper
legacy conserva su SHA y semántica, como confirman los guards del paquete.


Puente de contratos final: `tests/lp01-export-close-v2/reader.mjs` ejecutó una única
importación y un único cierre en PGlite y pasó el payload real de consultar al
lector/B15/CSV, sin discrepancias. La fixture capturada es exclusivamente sintética;
los hashes de fuentes y fixture coinciden con `reader-results.json`. Su regresión
Node reutiliza ese readback sin volver a ejecutar SQL. Identidad inmutable, cantidad
7/ausencia null, objetivo/cumplimiento desconocidos y legacy incompatible verificados.
No se repitieron las baterías SQL anteriores; seis grupos del escritor y este puente
son evidencia aislada, nunca aplicación o uso productivo.


## Recarga parcial · contrato 3 integrado

Importar y cerrar usan ahora LP-EXPORT-IMPORT-3 / LP-EXPORT-CLOSE-3. Una carga
filtrada reemplaza únicamente lo informado en el mismo contexto. Cada producción
conserva `valueStatus` CURRENT_FILE/PRESERVED/NEVER_REPORTED y `valueSource` propio
con lote, versión, contexto, universo, archivo original, SHA y filas de origen.
El archivo de cabecera solo describe la carga actual. No representa el origen de
valores conservados. Contrato 2 se rechaza expresamente, nunca se aplicó.

A7/B5 seguido de A3 deja 3/5, no 3/null ni 10/5. Un cero confirmado se conserva;
nunca informado queda null. Retirar/reincorporar una producción recupera su último
origen acreditado del mismo contexto. Corregir/reabrir conserva cierres previos;
corrupción de originales, fuente cruzada y universo obsoleto son rechazados.

Hoja, B15 y CSV distinguen el estado de cada valor. El informe separa archivo actual
y archivo fuente por producción, muestra subtotales actual/conservado/conocido y
mantiene el total desconocido si hay nunca informadas. Permite descargar cada
original acreditado con los controles existentes; no amplía acceso. PDF/imagen
usan el mismo modelo. La revisión local XLSX explica que solo analiza ese archivo,
no proyecta ni escribe el historial efectivo completo.

Verificación del delta: **83/83 Node UI/lectura integrada PASS sin omitidos** y
siete grupos de controlador DOM; **57/57 Node** dominio/referencia del paquete.
SQL aislado: importador siete, cierre seis y recarga parcial cinco grupos PASS.
Los readbacks reales sintéticos se reutilizaron para B15/CSV sin repetir SQL.
Tres guards PASS; sintaxis y diff check PASS. Evidencia en
`tests/lp01-export-close-v2/reader-results.json`, `partial-results.json` y
`tests/lp01-assembly-workspace/partial-v3-node-results.txt`. No es una nueva suite
integral, concurrencia PG17, prueba visual o verificación en planta.

Pins SQL preparados: importador `2e892039eb0a940f41ffa19c9373e46e`, comando
CERRAR `6a0357405be58a0965d520f5b662a9c5`. Bandera de importación, bandera propia
cierre y entrypoint siguen desactivados. Plan queda null/PLAN_SOURCE_REQUIRED;
la regla aprobada no cambia, falta historia/versiones/motivos. Disponible y
continuidad siguen null/RECONCILIATION_REQUIRED hasta definir referencia inicial
con fuente comprobable. Ningún rol, secreto, job, dato operativo o permiso cambió.


## Acople local con Observaciones v404

La subida específica de Observaciones fue autorizada y su candidato está en PR216,
HEAD `8815fc843bddd74534c24b06a3d1201b4ededf94`, todavía sin confirmación de merge ni
publicación al preparar este acople. Se integraron sus diez archivos de aplicación
y pruebas: nueve se conservan con hash exacto; `lp01-operation.js` se fusionó de
tres vías desde la base común v403, resolviendo solo los imports, no sobrescribiendo
ninguna implementación. La hoja recibe paintOrderNoteRows/retainOrderNoteRows.

Se corrigió la guardia propia de Ensamble para proteger también borradores de nota
compacta y guardados en curso, incluidos los aparcados por filtros. El adaptador
real integrado pasó cuatro grupos DOM sintéticos: retención de editor/borrador,
bloqueo de navegación, reintento exacto después de respuesta perdida con una única
revisión y limpieza de sesión. Workspace 13 y controlador 7 grupos PASS. No se
repitieron las auditorías SQL ni la batería de Observaciones sin cambios.

Evidencia exacta: `tests/lp01-assembly-workspace/v404-integration-results.json` y
`compact-notes-results.json`. Pendiente contrastar el HEAD final de main tras v404,
incorporar su versión/política y sellar una nueva versión para la futura entrega de
Ensamble. Este acople no publica Ensamble ni activa cierre, Disponible o permisos.


## Candidata v405 sobre v404 publicada

Integración secuencial completada con main `0f412504d1ea67edb966688cd3b2e9ef875b0d28`.
Se preserva CSS final v404 `6f8081824d4b7a343476c90b657b1aedc9fd9e0ad501aa491594579a482ccf13`,
sus fixtures corregidas y todos sus controles. La política de v405 usa como baseline
y rollback `sites/sgp-one-lab/versions/d3e4f12f98a7cded`, no la v403 histórica.
Inventario baseline acreditado `f6ade6db26b6bad06f5c829fcd78e9aa1a8baa5d9880d1acca505cf3cb1ccaff`;
config `b1c8097ce32ce29d3d39d04e54f86699c1cd013dcbfc8a4f9b89f033cadc34fd`.

Instalado únicamente catálogo/horario el 07/11 a las 13:20:40 UTC, cuerpo resultante
`2e4eeacbfc331f2c6dcde32ee96701d7`; ACL/owner/search_path/SECURITY DEFINER y cinco
dependencias verificadas. No cambió capacidad de escritura ni dato operativo.
La respuesta con sesión real y aceptación en planta siguen pendientes.

La nueva prueba CI de Ensamble inspecciona PC/móvil con módulos reales y RPC
sintéticas: tres grupos, nota compacta, retención, detalle e informe con orígenes
propios. No conecta producción ni concede credenciales. No se repiten auditorías
SQL anteriores por preparar esta publicación. El marcado v405 y los pins locales
no acreditan por sí solos merge o Hosting; esperar CI, artefacto y publicación
controlada exacta. Todas las activaciones pendientes anteriores se mantienen.

Verificación previa al PR v405: 808/808 Node PASS sin omitidos sobre la integración
con v404 final; build/verify:release405, tres guards y política pura PASS. El caso
visual nuevo espera solo la fila consultada visible, respetando carga diferida;
la revisión independiente identificó y corrigió esa espera, sin reintentar el
navegador local restringido. Prueba real PC/móvil pendiente de CI y sus capturas.

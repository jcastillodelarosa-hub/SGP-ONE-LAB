## Candidato v415 · Tecno exclusivo de Ensamble

Cambio local, no publicado. Base main v414 4e41639; Hosting 5db74a4b5327b2fa.
Empaque no muestra pestaña, formulario ni resumen Tecno. Transporte rechaza nueva causa TECNO antes de RPC. Históricos persistidos intactos; sin SQL ni cambios de permisos. Pruebas Node focales y verify:release PASS; 16 pins intactos. Publicación y comprobación visual pendientes.

## LAB v407 · paquete integrado sobre v406 · 07/11/2026

**IMPLEMENTADO LOCAL / NO FUSIONADO / SQL NO APLICADO / NO PUBLICADO.** Base
main199d03135cb228b61d9203a20c4b6bc546a04b5a, Hosting30ba2ca7beb40220.
Se agrupan incorporación post-Export, plan versionado y cadena CIERRE4 con lector,
B15 y CSV. Plan al cierre, motivos/hora, exclusiones y procedencia parcial preservados;
revocación de keys históricas también contiene reportes, historial y recibos.
V3 permanece estricto. No concede roles, credenciales ni jobs. Flags SQL false.
Disponible/continuidad requieren saldo inicial y trabajo ya incluido en ese saldo;
no se inventa el corte. Apertura con anterior pendiente está aprobada, no activada.

Evidencia reutilizada: incorporación 8 grupos, plan 8+4, cadena V4 8 y preflight3,
SQL final→lector independiente PASS; todo sintético. Lector/B15/CSV 76 pruebas
PASS incluidas DOM, sin repetir SQL remoto ni auditorías generales. Prueba PC/móvil
V4 agregada a CI permitido; PostgreSQL17 concurrente V4 sigue sin acreditar.
Integración final: 833 Node PASS, sin omisiones; 16 pins, política y release PASS.

Subida pública en progreso, bloqueada específicamente en el test
`tests/lp01-ensamble-plan/pglite.mjs` por autorización de su detalle de esquema/ACL.
No omitirlo ni cambiar canal para sortear el rechazo. Paquete sin rama/PR aún.
Siguiente: autorización pendiente → subida final → CI exacta → revisión de artefacto
antes de publicar. Aplicación/activaciones SQL requieren su aprobación separada.
Detalles: [V4](../sql-proposals/lp01-export-plan-v4/README.md),
[incorporación](../sql-proposals/lp01-incorporar-post-export/README.md).

Los hitos siguientes son antecedentes y no sustituyen este estado integrado.

## Lector e informe de cierre V4 · siguiente incremento aislado · 07/11/2026

IMPLEMENTADO LOCALMENTE, NO FUSIONADO/APLICADO/PUBLICADO. Base local cc8316e
(candidata v407, aún sin PR). El lector selecciona LP-EXPORT-CLOSE-4 explícito y
valida el plan persistido íntegro junto con procedencia Export existente. V3 sigue
estricto y no adopta el plan actual. B15/CSV muestran objetivo, cumplimiento cuando
es calculable, motivo/hora/versión, historia anterior UNKNOWN y ausencia como null.
No activa carga/cierre, no modifica SQL ni concede permisos. Conserva canContinue y
operationalReady false; referencia inicial Export aún requerida. Primer readback
SQL sintético de la cadena V4 validado, no datos ni certificación productivos.
9 pruebas nuevas PASS incluidas DOM, escape y CSV; 67 regresiones de V3/B15 PASS
con dependencia DOM aislada. Sin repetir auditorías SQL ni navegador bloqueado.

Siguiente: integrar propuesta SQL V4 cuando cierre reautorización histórica del
plan, revisión focal conjunta y sello/pins/CI del incremento final. No publicar
esta rama directamente ni confundirla con candidata v407, que queda intacta.

## Candidata LAB v407 · base v406 publicada · 07/11/2026

Base remota `199d03135cb228b61d9203a20c4b6bc546a04b5a`, Hosting
`30ba2ca7beb40220`, publicación 42391913872 SUCCESS. Export01/02/03 aplicado por
su responsable, sin repetirlo. Árbol base local a2e7e56 cotejado idéntico a main.
Incorporación post-Export y plan versionado integrados **solo como propuestas
contenidas**, no instalados ni activos. Runtime mantiene los botones contenidos;
la nueva regla de apertura se informa como aprobada pero aún sin motor activado.
Publicación del paquete público autorizada explícitamente por Johan; rechazo de
blob documental resuelto en único reintento. CI exacta y activaciones separadas
siguen pendientes. Verificación local final: Node 815 PASS / 9 omitidas, cero fallas;
política, 16 pins, sintaxis y verify:release PASS. No confundir esta candidata con
una entrega operativa completa.

## Cierre Export con plan V4 · siguiente incremento contenido · 07/11/2026

**SQL IMPLEMENTADO/PROBADO AISLADAMENTE, NO APLICADO NI ACTIVADO.** Paquete nuevo
`lp01-export-plan-v4`, desde f2b073c; no modifica cadenas antiguas ni runtime.
Rebase sobre INCORPORAR post-v406 ee5acef, captura de plan integrada y cierre con
selector LP-EXPORT-CLOSE-4. Plan vigente/realizado/comparación persistidos bajo lock;
null no es cero, historia previa UNKNOWN, fuente no materializada bloquea explícito.
Exclusiones activas respetadas, historia conservada. Guarda V4 abarca también keys
canceladas/excluidas del baseline en COMMIT, report/history, receipt y replay;
ACL y filtros activos orders/catalog exactos. 8 grupos PGlite PASS, preflight focal
PASS y readback SQL compatible con lector independiente 8738305. No prueba PG17
concurrente ni productiva. Corte Export inicial sigue desconocido: presupuesto,
Disponible/continuidad/carry bloqueados específicamente, operationalReady=false.
Nueva apertura con anterior abierto está autorizada pero se integra aparte, sin
autocierre/arrastre ni privilegios aquí. Próximo: integrar lector4 y revisar cadena
final contenida; no aplicar/activar hasta autorización y controles correspondientes.
Detalle: [paquete V4](../sql-proposals/lp01-export-plan-v4/README.md).

## v405 publicada; continuación operativa posterior a Export v406 · 07/11/2026

**PUBLICADO / IDENTIDAD VERIFICADA:** PR218 integrado en main
`3fd6276acf28a6f36104ec2d7500d284bdba6823`. [Publicación protegida 42389313884](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/42389313884)
SUCCESS; Hosting `0b477bbb5a8e2dc1`, 137 archivos públicos byte-idénticos al ZIP
revisado y v404 retenida. Sello LAB v405 visible, sin sesión de planta. Aceptación
humana pendiente. No equivale a activar cierre, incorporación o apertura automática.

Siguiente delta **IMPLEMENTADO LOCAL / NO APLICADO / NO PUBLICADO**:
`lp01-incorporar-post-export` conserva exclusiones aprobadas v406 en hoja y escritor,
incluida una vista antigua. 8 grupos PGlite PASS y revisión independiente focal PASS.
Prueba nueva PG17 de exclusión concurrente preparada, pendiente de CI del SHA final.
Lector v406 aplicado y acreditado: MD5 3ecf0a9ec4497de02b1d7ac89bc80819.
La interfaz también rechaza explícitamente `excluida_export=true` (2 pruebas PASS).
Instalación deja bandera false; roles limitados requieren aprobación de activación.
No se han concedido permisos, creado credenciales/jobs ni ejecutado SQL operativo.

Adaptación adicional contenida: transporte Power BI conserva la autoridad V2 en
reintentos, sin degradarla a legacy ni habilitarla en servidor (10 pruebas PASS).
Lector puro LP-ENSAMBLE-PLAN-1 valida versión/alcance/cadena y objetivos exactos,
con historia anterior explícitamente desconocida (6 grupos Node PASS, incluidos
fixtures emitidos por SQL). Plan SQL integrado como propuesta privada: 8 + 4 grupos
PGlite PASS. Aún no está conectado al cierre ni acredita comparación operativa.
Pins y sello v407 sincronizados sobre v406; pendiente CI del SHA final y publicación
protegida, sin activar SQL ni permisos.

Reglas originales recuperadas: objetivo del planificador por proceso/turno;
conservar plan original y cambios con motivo/hora, cumplir contra el vigente al
cierre. Disponible es por orden/etapa, no ese objetivo. Una consulta puntual confirmó
programar/mover iguales a las fuentes capturadas y sin triggers de historial en
asignaciones: se prepara conexión versionada, sin inventar historia anterior.
Primera carga de Export necesita referencia acreditada; no se eligió un corte
concreto. Johan confirmó que el nuevo turno permite trabajar a su hora aunque
el anterior siga pendiente, sin cerrarlo automáticamente ni inferir arrastre.
El impedimento PUBLIC del principal automático todavía no está resuelto. Detalle del paquete y recuperación:
[incorporación posterior a Export](../sql-proposals/lp01-incorporar-post-export/README.md).

Las secciones siguientes son antecedentes y no sustituyen este estado.

## Revisión selectiva Export diario · candidata v406 · 07/11/2026

IMPLEMENTADO EN RAMA `feat/export-approval-nov7`, base v405 publicada 3fd6276.
No aplicado en Supabase, no fusionado, no publicado. Coordinar integración después
de Ensamble v405; no sobrescribir esa entrega.

Johan definió aprobación del coordinador para cantidad, semana, nueva orden y
ausencia. Ausencias aprobadas se consultan aparte, conservan historia y no suman
métricas semanales. No sincronizar cantidades automáticamente. Reaparición requiere
aprobación para volver a las vistas activas. Las órdenes sin diferencias estructurales
conservan actualización normal. Cambios pendientes no mezclan saldos nuevos con
cantidades antiguas.

Interfaz en `src/modules/export-review.js`; SQL revisable, sin autoejecución, en
`docs/sql-proposals/export-approval/`. Preparar guarda propuestas, no cambia órdenes.
Pruebas focales: 8 Node PASS, sintaxis PASS y verify:release v406 PASS.
Backend: pruebas locales PGlite PASS (selección, scopes, reaparición, permisos,
idempotencia y conflictos). Cinco parches de lectores activos/métricas compilados localmente. Pendiente: integración
v405 y entrega coordinada backend/frontend. Sin pruebas sobre datos reales.

## Plan versionado de Ensamble · incremento aislado · 07/11/2026

**IMPLEMENTADO/PROBADO AISLADAMENTE; SQL PROPUESTO, NO APLICADO, DESACTIVADO.**
Checkout independiente desde `518eb2d` (árbol v405), sin modificar integración.
Paquete `docs/sql-proposals/lp01-ensamble-plan`: versiones persistentes por turno,
fuente planificador solo Ensamble/PANELES_2, baseline observado con historia anterior
UNKNOWN, cambios autenticados/motivo/hora y objetivo vigente sin sumar SALE.
Bandera false preserva planner legacy; sin RPC público ni GRANT. Triggers contenidos
registran cambios externos de asignaciones/exclusión/línea sin atribución y bloquean
comparación obsoleta, incluso cambiar/deshacer. Snapshot verifica huella bajo lock.
Comparación une universo completo; realizado desconocido no es cero, plan0 solo
para key elegible actual. Exige columna v406, conserva historia de excluidas.
Evidencia: 8 + 4 grupos PGlite PASS y JSON SQL compatible con lector estructural.
No acredita PostgreSQL17 concurrente ni producción. Comando/import/cierre/runtime
intactos. Próximo paso: rebase e integración coordinada de INCORPORAR post-v406 y
fachada/motivo del planner; luego cierre/import, sin activar ni alterar permisos.
Decisión posterior del usuario: nuevo turno permite trabajar a su horario aunque
el anterior siga sin cerrar; no cierre implícito ni arrastre inferido. Se implementa
aparte, sin ampliar este paquete ni activar ejecutor/privilegios.
Detalles y límites: [paquete del plan](../sql-proposals/lp01-ensamble-plan/README.md).

## Candidata LAB v405 · integración sobre v404 publicada · 07/11/2026

Recuperación completada: PR218 remoto, base v404; árbol inicial idéntico al
candidato local. Los dos rechazos de publicación documental se resolvieron con
autorización específica del documento y del paquete público, sin cambiar de canal.
CI inicial: pruebas generales, sintaxis, contratos, UI nueva PC/móvil y PostgreSQL17
PASS. La UI heredada aún esperaba el formulario manual de Ensamble sustituido;
se adapta a la hoja y contención vigente, preservando cierre real en Empaque.
Revisión focal corrigió respuesta antigua tras revocación de acceso (DOM de carrera
PASS) y ancho de tarjetas de informe móvil. CI exacta del delta sigue pendiente.
Compatibilidad de órdenes ausentes aprobadas: el lector excluye solo el booleano
`oficial.excluida_export=true` de la hoja activa, conservando cierres históricos.
No interpreta ausencia del archivo como aprobación. 39 pruebas focales PASS.
La columna, alerta/aprobación y exposición del campo en RPC son del paquete Export
v406 separado, todavía no aplicado; esta compatibilidad por sí sola no lo activa.

Base main `0f412504d1ea67edb966688cd3b2e9ef875b0d28`, Hosting v404
`d3e4f12f98a7cded`. Observaciones integrada y publicada previamente; su CSS final,
notas compactas y controles se preservan. Ensamble v405 aún NO publicado.

Catálogo/horario **APLICADO EN SUPABASE**: RPC consultar con cuerpo exacto
`2e4eeacbfc331f2c6dcde32ee96701d7`, readback 13:20:40 UTC. Permisos, roles, RLS,
flags y datos operativos intactos. Evidencia de instalación en
`docs/sql-proposals/lp01-hoja/installation-evidence.json`. Falta respuesta visible
con sesión de planta; no confundir metadata comprobada con aceptación funcional.

Alcance de esta publicación: hoja de abiertas/programadas/otras órdenes autorizadas,
observación/afectaciones/Disponible mediante editores existentes, detalle compartido,
lectura e informes de cierres confirmados y revisión local del XLSX sin guardarlo.
No habilita INCORPORAR, cierre Export3, actualización de Disponible por avance,
continuidad ni apertura automática. Esas funciones quedan explícitamente contenidas;
no presentar la entrega como módulo operativo completo ni activar por publicar UI.

Corte local integrado: 808/808 Node PASS sin omitidos, build/verify:release405,
tres guards de los contratos contenidos y política pura PASS. Se recuperó el
objeto histórico Git requerido por la prueba de política; no se cambió su control.
QA nueva PC/móvil pendiente de CI exacta.

v405 acredita baseline y rollback v404. Los pins cambiados corresponden únicamente
al frontend integrado, su cache-bust y handler opcional aún desactivado en Edge.
Mantener HOLD hasta CI exacta y revisión independiente del ZIP oficial. Nueva QA
PC/móvil aislada preparada para CI; no se reintenta el navegador local restringido.
Detalle y próximos pasos: [checkpoint de Ensamble](ENSAMBLE_NOV7_CHECKPOINT.md).

## Estado vigente de la preparación de Ensamble · 07/11/2026

Base de código comprobada: main `75b05b842f866163cd6fea6b54dc21e66eba0ade`,
LAB v403. La preparación local de Ensamble está en la rama
`feat/ensamble-hoja-export-v405`, desde `4c0170d` (último corte verificado `96e4f90`);
**NO publicada, NO aplicada y NO verificada en planta**. Observaciones v404 tiene candidato remoto PR216 `8815fc84`. Su acople está
preparado localmente mediante merge de tres vías, sin sobrescribir operation.js;
falta confirmar el HEAD final publicado e integrar versión/política de release.

B12/B13, nota/afectaciones compartidas, lectura Realizado de cierre vigente, revisión
local XLSX y B15 histórico/PDF/imagen están implementados localmente. Catálogo y
horario tienen propuesta SQL de lectura; INCORPORAR tiene propuesta desactivada con
CAS y descubrimiento. No hay permiso nuevo habilitado, ejecutor automático ni cierre
V2 productivo. Las funciones LP actuales se leyeron de catálogo: no asumir ausente
el esquema ni repetir instalaciones/auditorías antiguas por las notas históricas.

Importación V2 transaccional preparada y desactivada: guarda original y cobertura
por producción, conserva revocación/CAS y contiene el cierre manual legacy. Siete
grupos SQL aislados y pins del paquete PASS. Aún no conecta un cierre operativo.
CERRAR V2 también persiste snapshot por producción en una propuesta SQL con puerta
propia `export_close_v2=false`; seis grupos SQL aislados PASS. Plan/comparación y
continuidad quedan pendientes, sin sumar SALE ni inventar arrastre. El lector
versionado Realizado/B15/CSV ya distingue V2 de legacy, conserva cobertura ausente
y usa identidad histórica. No se anuncia autoridad de cierre ni se habilita su botón.
La nota compacta de v404 ya está acoplada localmente: conserva borradores al
filtrar y protege salida durante edición/guardado/reintento. Cuatro grupos DOM
del adaptador real PASS, workspace13 y controlador7. Sin publicación de Ensamble.
La revisión focal del nuevo frontend corrigió borradores en paneles secundarios,
refrescos transitorios que borraban el editor y programación parcial presentada
como cero; evidencia DOM sintética 12+7 grupos y cierre 4 casos PASS.

Corrección integrada localmente después de recuperar decisiones previas: la recarga debe
actualizar solo las producciones presentes, conservando el último valor conocido
de las ausentes y su fuente individual. El contrato 2 local de lote completo queda
superado; contrato 3 integrado, todavía sin aplicar ni publicar. El cumplimiento
frente al plan vigente al cierre **ya está aprobado**, junto con conservar plan
original/cambios con motivo y hora. Falta la conexión técnica versionada, no decidir
otra vez esa regla. Disponible debe bajar con avance nuevo y restituir correcciones
hacia abajo; la primera carga necesita una referencia técnica para evitar duplicar
el descuento. No se infiere corte/fórmula ni se escribe Disponible todavía.

Delta vigente: 83/83 Node UI/lectura y 57/57 dominio/referencia PASS, siete grupos
DOM controlador y tres guards. SQL aislado importación7/cierre6/recarga5 PASS.
B15/CSV reutiliza readbacks SQL guardados sin repetirlos; conserva fuente individual
y cero, distingue nunca informado y rechaza contract2. Evidencia en el checkpoint.
No se repitió la suite integral para esta corrección focal.

Último corte integral anterior a esta corrección: 786/786 pruebas Node PASS sin omitidos (incluidos los 22
casos de referencia V2), más pruebas SQL/DOM acotadas. Concurrencia PG17 real,
QA visual, activación y publicación siguen pendientes. La cadena SQL sintética
→ consultar real → lector V2 → B15/CSV también PASS, con una importación/cierre.
No está decidido qué debe hacer la apertura automática si el turno previo no cerró.
Tampoco se debe convertir el Disponible global (`temporalPolicy:UNRESOLVED`) o una
suma de SALE legacy por UUID en objetivo del turno nuevo. Comparación operativa y
corte de Export para continuidad siguen contenidos hasta acreditar su fuente.
Detalle y continuación exacta: [checkpoint de Ensamble](ENSAMBLE_NOV7_CHECKPOINT.md).
Las entradas siguientes conservan antecedentes y no sustituyen este estado.

## Estimación numérica NC AL y Producción NC Vidrio · candidata v401 · 06/11/2026

Base publicada v400 37fa457. La estimación de aluminio suma una ventana por cada
pieza pendiente, explícitamente Estimado/por validar, sin recortar al saldo ni sumar
con cantidades guardadas u otras causas. Advierte si supera el saldo: debe ajustarse
antes de confirmar; se conservan máximos y guardado existentes. Detalle intacto.
NC Vidrio muestra Producción (orden), usando el campo fuente orden y preservando
preferencias de columnas. No implica vínculo persistido NC→producción.
Pruebas focales: 18 de resumen/contrato y 5 de columna PASS, sintaxis PASS.
Sin SQL, permisos ni pins modificados. Integración v401 pendiente de CI y publicación
controlada. Vínculo/navegación NC se prepara por separado, no incluido aquí.

## Resumen único NC AL · candidata v400 · 06/11/2026

Base main v399 e0624964. Un único distintivo de aluminio en la fila contraída:
cantidad definida prioritaria o propuesta única marcada Estimado. Varias cantidades
potencialmente solapadas quedan por validar, sin sumarlas ni elegir arbitrariamente.
Detalle expandido, otras categorías, SQL, permisos y pins de publicación intactos.
Ocho pruebas Node dirigidas y sintaxis PASS; no sesión productiva ni QA visual real.
Preparado para revisión. Sin fusión, despliegue ni cambio backend. Siguiente:
validar integración/versión y controles existentes antes de publicación autorizada.

## Disponible manual integrado en candidata v399 · 06/11/2026

Frontend exacto de 82c46056c981644402d95585e4a81b737203fe0a: definición manual
limitada por saldo real de etapa, sin exigir disponibilidad conciliada. Reutiliza
pruebas dirigidas PC/móvil y PostgreSQL del responsable. Coordinación confirmó
SQL07 aplicado en SGP-ONE-LAB; este hilo NO reaplica SQL03/05/07 ni cambia permisos.
Guardado real por Johan pendiente; CI del SHA integrado antes de publicar.

## Corrección de ventanas guardadas, estimaciones y máximo · candidata v399 · 06/11/2026

Base publicada v398 bfdc639, Hosting d07db5ac57713655. La fila conservaba el
indicador de pendientes calculado solo con reportes antiguos y no recibía el
refresco del panel al guardar. Ahora usa vínculos compartidos y actualiza la fila
sin recargar todo; revisiones atrasadas no sustituyen una lectura más reciente.
Cantidades de varios reportes visibles por separado, sin sumar solapamientos.
Estimaciones por pendiente de aluminio y por NC conocida, explícitas y editables.
Un pendiente sin vínculo no invalida la cantidad manual guardada.

Pruebas dirigidas sintéticas PC1440/móvil390 y PostgreSQL aislado: guardado,
refresco de fila, recarga, estimaciones, máximo por etapa, atomicidad/replay y
ACL conservadas. Sin escritura de pruebas productiva. Captura del usuario solo
texto/puntero; capturas sintéticas locales inspeccionadas, sin atribuirlas a planta.

Parche revisable docs/sql-proposals/lp01-window-balance/01_patch_REVIEW.sql:
solo reemplaza lector/escritor existentes; limita CREATE/CORRECT al saldo Export
vigente de la etapa del actor, sin limitar piezas ni sumar causas. Conserva
idempotencia, permisos, revisión y recepción física. NO instalado todavía;
La revisión automática denegó aplicar lp_shared_window_balance_v399 por falta
de autorización explícita del despliegue productivo de dos SECURITY DEFINER.
No se ejecutó ni se reintentó. Paquete intacto; sin GRANT/flags/datos nuevos.
Publicación pendiente de CI, PR, revisión del artefacto y controles oficiales.

## Ventanas propuestas · corrección posterior a v397 · 06/11/2026

Formulario Definir ventanas afectadas antes de reportes/pendientes, estado de
guardado junto al formulario. Aluminio propone una ventana por pieza del pendiente
seleccionado; NC vidrio propone una por referencia informada. Ambas editables,
sin sumar categorías, escribir automáticamente ni confirmar recepción. Cantidades
faltantes/fraccionarias no se inventan; corrección manual no se pisa al cambiar
fuente. Pendiente legado sirve de referencia informativa, sin fabricar vínculo.
Prueba dirigida sintética PC1440/móvil390 PASS; transporte y permisos existentes.
Sin SQL ni cambios de Disponible/rendimiento. Candidata v398, publicación conjunta
pendiente de coordinación con el responsable de esos otros ajustes.
Capturas de usuario resueltas por Library como texto/puntero; materialización
falló download failed. No se afirma inspección de sus píxeles ni se rediseña B10.

## PR208 · acople mínimo de distintivos · 06/11/2026

Parche independiente sobre `5965f6c290c434ef92191d1d26f545a86817dc57`.
Único archivo de producción alterado: `src/modules/lp01-operation.js`.
Combina los snapshots nativo y compartido con los contratos existentes; muestra
Accesorios y conserva lectura heredada identificada cuando falta el servicio
compartido, sin reutilizar totales/disponibilidad como vigentes. Revocación limpia
la vista; identidad incompatible queda pendiente. Ordenar/filtrar conserva chips
y etiqueta heredada. Helpers originales sin cambios, hashes cotejados.

Prueba dirigida `tests/lp01-shared-order/row-summary.py`: PASS en 1440 y 390 px,
con respuestas RPC sintéticas, sin escrituras ni activación. Incluye reportes de
la otra etapa, solapamientos, ausencia del servicio, identidad inválida,
revocación y respuesta tardía tras cambio de sesión. Sintaxis y diff check PASS.
No incorpora el bloque de hojas/cierre; no crea PR, publica ni modifica backend.
Pendiente aplicar este commit al PR208 y la integración coordinada del candidato.

## PR208 · backend activado · 06/11/2026

Instalación y activación autorizadas del paquete e419c27 en Supabase SGP-ONE-LAB.
Readback 09:52:59 UTC: tres RPC anon, writes local true, helpers/tablas privados,
RLS y huellas exactas; controles existentes sin cambios. No reportes sintéticos
productivos. Evidencia en docs/sql-proposals/lp01-shared-order/production-activation-evidence.json.
NC conserva referencia por verificar sin vínculo. Frontend no integrado/publicado;
versión se incrementará en integración coordinada, main sigue v396 a068e14.

## PR208 · corrección NC y privacidad · 06/11/2026

Se restaura estado NC en pendientes del panel compartido reutilizando el lector,
sin liberar ventanas. Prueba dirigida summary-ui PC1440/móvil390 PASS.
No se acredita relación NC-producción/línea canónica en el contrato de fuente:
se conserva número por verificar, lectura sin existencia/estado ajenos y enlace
rechazado en servidor. `nc-scope.py` PASS en PostgreSQL aislado con números
existentes/ausentes, permisos de etapa y rechazo atómico. Paquete SQL propuesto
actualizado; ninguna activación. La evidencia antigua de vínculo exitoso queda
superada. Versión nueva se sellará en la integración coordinada, sin pisar v396.

## Orden compartida · continuidad sobre v396 · 06/11/2026

Base main a068e14 (v396), rebase sin conflictos; cambios previos y borrador NC
conservados. Sin consultar skills propias por instrucción de Johan. Historial del
panel conserva ahora movimientos nativos por reporte/etapa, separados de los
compartidos; referencia NC heredada preservada también sin backend compartido.
Prueba dirigida legacy-history.py PC1440/móvil390 PASS (sintética, sin SQL).
Las cinco pruebas antiguas de turno ya quedaron adaptadas y pasaron; no se
repitieron. Acople de filas/hojas sigue a cargo del otro hilo, con fuentes exactas
entregadas. CI conjunta al congelar; PR denegado, sin nuevo intento ni push.
Contrato compartido sigue PROPUESTO, no instalado; tres RPC anon y bandera local
requieren aprobación específica. No cambios en Picking, SQL productivo ni release.

## Orden compartida · conexión local · 06/11/2026

Cinco pestañas actuales conectadas sin turno obligatorio y sin rediseño;
legacy visible, nota global separada, NC explícita y Accesorios operativos en
PostgreSQL sintético. PC1440/móvil390 guardar/reintentar/recargar/compartir entre
líderes PASS; recorrido B10 real y nota CAS PASS. Tecno usa techo aprobado.
API mountTrackingAffectations intacta; resumen de fila requiere acople por dueño
de lp01-operation.js con sharedOrderSummary (no suma heredado/compartido).
PDF B10 leído por Library solo como texto/puntero; no píxeles originales aquí.
Pendientes acople de filas, actualización de expectativas antiguas de turno y
CI conjunta al congelar. Sin nuevo PR (denegado), SQL ni publicación.
Detalle: docs/sql-proposals/lp01-shared-order/README.md.

## Orden compartida · contrato en desarrollo · 06/11/2026

Rama feat/seguimiento-glass-nc-link rebasada sobre d45c5ed (v394).
NC local previo preservado en stash y worktree; sin escrituras productivas.
Contrato nuevo compartido entre líderes/coordinador por producción/línea,
sin turno obligatorio; NC exacta/asociada, accesorios canónicos y cantidades
manuales. Nota global existente reutilizada; Tecno añade techo aprobado.
PostgreSQL sintético y Node focalizado PASS; vistas aún sin conectar al contrato.
Guía original Library: materialización falló `download failed`; sin bytes/píxeles
locales, sin reintento ni rediseño. Próximo: desbloquear inspección B10 y conectar
cinco pestañas; PC/móvil y CI completa del candidato al terminar. No instalación,
GRANT, bandera, sesión optimizada, integración o publicación desde este corte.
API compartida de montaje preservada; hojas/PDA y PR206 fuera del alcance.
Detalles y permisos exactos: docs/sql-proposals/lp01-shared-order/README.md.

## Seguimiento · corrección visual v394 propuesta · 05/11/2026

Base publicada LAB v393: main `2dedc5e055a2472d034d20d23463e66310fdc64f`,
Hosting `sites/sgp-one-lab/versions/c68abd3d0ba7d720` (run 42110454030).
En la tabla global se retira Avance por turno, se acorta el resumen contraído
de afectaciones y el error de lectura de Disponible queda como `Error · ↻`,
distinto de `Por definir`, con reintento accesible. Detalle, chips, registro,
pestañas y operación por turno permanecen. Sin datos ni permisos cambiados.
En el mismo PR205 se retira la pestaña duplicada «Aluminio»: NC AL conserva
pendientes PDT y reportes, y el chip Aluminio abre esa pestaña. El selector
«Registrar afectación» vive dentro del panel activo NC AL, NC V o Novedades;
la barra de cinco pestañas queda estable. Tecno y Accesorios siguen sin ese
formulario. Materiales no se modifica.
El registro PostgreSQL de 20:40–20:55 UTC muestra 12 `statement_timeout`
(57014) de `sgp_lp_sale_orden_consultar_v1`: el lector de afectaciones llega a
`sgp_lp_operacion.sesion`, que materializa permisos para toda la línea. La
limpieza visual no resuelve ese timeout. Una optimización y recuperación de esa
función compartida están preparadas y probadas solo en rama aislada
`fix/seguimiento-sesion-acotada-proposal`; requieren revisión/activación aparte.
Pruebas visuales PC/móvil, afectaciones y refresco PASS; Node 523/523 y
`verify:release` PASS con vendor generado localmente sobre el delta completo.
La integración adicional de pestañas/registro pasó Chromium sintético PC/móvil,
incluida prueba nativa de nota/NC, turno cerrado, borrador y revocación; la
La CI debe corresponder al SHA actualizado. PR205 está en borrador; falta
aceptación con sesión real. La referencia Library
no se pudo materializar por restricción de red del ejecutor; coordinación sí
inspeccionó los píxeles. Siguiente: validar CI de PR205 y decidir activación SQL separada.

## PR203 · revisión base de borrador preservada · 05/11/2026

Corregido refresco que adoptaba revisión nueva mientras conservaba texto viejo.
`draftRevision` permanece en r1 al leer r2; guardar devuelve conflicto CAS.
Prueba puntual nueva PASS: A/B/refresco/rechazo y descarte explícito para retomar r2.
No SQL ni UI modificados. Evidencia anterior reutilizada; CI del SHA final pendiente.

## PR203 · contratos fuente y brechas · 05/11/2026

Revisión dirigida de catálogo READ ONLY/ROLLBACK, sin datos de negocio:
NC vidrio tiene consulta semanal y PK consecutivo, sin key producción/línea;
no se encontró enlace LP verificado. Accesorios tiene materiales, no causa LP.
Aluminio/PDT usa identidad original; no sumar las vistas separadas.
Permisos y brechas en docs/sql-proposals/lp01-order-details/CONTRACT_GAPS.md.
Library image_file devolvió OCR/punteros sin píxeles renderizados aquí; no nueva
transferencia ni evasión. PR203 sigue parcial; UI y vínculo NC verificado pendientes.
Pruebas previas válidas para código intacto; este incremento solo documenta evidencia.
Siguiente: resolver inspección visual soportada y revisar adaptador NC canónico.

## Observación por orden / Tecno / NC · contratos aislados · 05/11/2026

Rama feat/seguimiento-order-details, base main90518a0 (PR202 preservado).
Nota canónica producción/línea con CAS, UUID, auditoría y permisos NOTA existentes;
lector independiente Export exacto; referencia NC_V manual atómica y no verificada.
SQL REVIEW sin grants, flag false; ningún SQL/dato/permiso/flag productivo modificado.
9 pruebas Node y PostgreSQL17.11 sintético PASS (nota y NC). Sin sesión productiva.
Bocetos Library resueltos pero descarga helper falló, incluido único reintento de
Tecno-observacion-1: píxeles no accesibles. UI/pestañas/PC-móvil/capturas pendientes;
no se integra layout supuesto ni se promete guardado. Módulos nuevos aún no conectados.
SALE, versión visible391, pins/HOLD intactos; versión funcional próxima por coordinar.
Detalle y referencias: docs/sql-proposals/lp01-order-details/README.md.
Siguiente: materializar e inspeccionar bocetos para integrar vistas y probarlas.
IMPLEMENTADO EN RAMA parcialmente / SQL PROPUESTO; no fusionado/aplicado/publicado.

## Seguimiento · Disponible compacto · 05/11/2026

V391 fue publicada en main 90518a07f297c4079cdd97dc1c89ba83ffb94e90,
Hosting sites/sgp-one-lab/versions/cf7a564682e0d50e (run 42085341702).
V392 en PR204 borrador: la celda global muestra la definición guardada por orden
como «Disponible» o «Por definir», con lápiz; Guardar/Cancelar, motivo e historial
quedan en edición puntual. Lecturas de filas visibles con máximo cuatro concurrentes.
No cambia RPC, permisos, datos, saldo Export ni SALE operativo de turnos. PR203
trabaja detalle de afectaciones por separado: compartirán lp01-tracking.js, solo
etiquetas y conexión de la celda se cambian aquí. Política PR204:
baseline/rollback cf7a564682e0d50e; HOLD, pins y verificadores intactos.
Node 513/513, release PASS y Chromium sintético 1440/390 PASS. Un smoke con
`renderTracking` real confirmó que el editor permanece modal, enfocado y
editable tras refresco silencioso; la altura de fila no cambia. Las tres
referencias Library están resueltas y su OCR leído; transferencia de píxeles
bloqueada por política de red
del ejecutor, así que no se acredita comparación visual directa con el boceto.
CI anterior detectó selector heredado «Consultar o definir» en la prueba de
afectaciones contraídas; se actualizó a «Por definir» con lápiz y se conservaron
los casos de registro, revocación y origen de aluminio. Browser nativo del editor
y `renderTracking` sintético PC/móvil PASS. `mountOperation` volvió a cubrir
recarga, foco/selección y reintento incierto tras filtro. CI debe verificarse
sobre SHA final.

## Seguimiento · pendientes visibles y registro · 05/11/2026

Candidata v391 sobre main a01ce776/v390: pendientes de aluminio no representados visibles sin inferir ventanas; acceso de registro por turno real abierto y capacidad servidor. Texto heredado corregido: la asignación es para avance; SALE se consulta por orden. Sin SQL, datos, flags ni cambios al contrato SALE. Ver [lp01-pending-ui/README.md](../../tests/lp01-pending-ui/README.md) para pruebas y brecha fuera de turno. Política PR202: baseline/rollback v390 fbd20418a9bf4438 acreditada por run 42079722091; pins SALE conservados y transición HOLD. CI e integración pendientes.

## SALE por orden · backend activo, frontend local en espera

Backend coordinado en Supabase: instalación `lp_sale_orden_definition_reviewed`
versión 20261105145602, SHA256 4e7a70c5b495a52b2c88f4a418fdecf7eed7f1a26af004fc19608c35059573b1;
habilitación `lp_sale_orden_enable_reviewed` versión 20261105150053,
SHA256 0531259c946b507ac8f2e1be0a91d272371c53ff273a48ae1187485c8b859ff4.
Habilitador anterior f42f6d62 falló antes de GRANT; estado apagado y sin filas
verificado antes del reintento corregido. Postcheck 15:02 UTC: flag encendido;
las dos RPC EXECUTE solo postgres/anon; tablas privadas RLS/ACL solo postgres,
anon sin USAGE ni DML; reader MD5 6ca3e65a9248a55f973d26836744f757,
writer d7aa1edaea6a22004226e4a73a6fb61f. Token inválido denegado en ambas;
cero datos de prueba productivos. ACL históricas intactas. No repetir SQL.

Frontend SALE v390 en rama sobre main 13f50e95 (B10 v389 publicada): integración
real en fila, PC1440/móvil390 y PostgreSQL sintético PASS. Recepción y B10 ya están integradas; PR201 borrador v390; pins de publicación y baseline v389 preparados. CI del SHA final pendiente. Uso de la definición entre turnos sigue sin regla; `operational:false`.
Detalle: [SALE por orden](../sql-proposals/lp01-order-sale/README.md).

## B10 v389 y Recepción v388 publicados

B10 integrado main 13f50e95e97fe23707ec1a18deec9398c2883e87, Hosting
sites/sgp-one-lab/versions/93bde8b172480952, run 42073197726 SUCCESS,
106 archivos verificados por coordinación. Preservar panel inferior ancho,
chips por causa, rótulo Afectaciones y Picking como origen de aluminio.
Recepción integrado antes en main e182f5379b74a5b77a325838bda5208f3a53fc7f,
LAB v388, Hosting sites/sgp-one-lab/versions/ee9bc38852832125.

## B10 visual v387 · preparación independiente

Sobre main3280223/v385; chips aplicables y semanas coloreadas con número/año,
filtros y detalle intactos. Excluye editor/borrador SALE, lector de abiertas y SQL.
500Node/release387 y PC/móvil/refresco/permisos PASS. SALE por orden sigue pendiente.
Baseline/rollback v385 ba7ae3754b4d5a76 acreditada por coordinador. HOLD intacto.
Renumerar entregas aisladas abiertas/SALE a >=388 antes de publicarlas.
Ver [b10-visual-v387/README.md](b10-visual-v387/README.md). PR198 borrador, política198/pins preparados; falta CI exacta y
coordinación para integración/publicación; sin datos ni permisos modificados.

## LAB v385 · PDT compacto y resumen por causa · aislado

PR197 borrador, rama fix/seguimiento-summary-v385 sobre main f644231 (v384
publicada/verificada por coordinador). Sin publicación385 ni SQL.
PDT contraído referencia/piezas/NC/estadoNC/origen, detalle expandible; resumen
por orden/etapa, categorías reportadas y unión/disponibilidad solo acreditadas.
No convertir piezas ni liberar por soluciónNC. Accesorios sin contrato: no disponible.
498Node/release385, PC/móvil/SQL sintético y revisión independiente cerrada.
Ver [summary-v385/README.md](summary-v385/README.md). SALE y abiertas líder separados;
Pins197 y baseline/rollback v384 6d4540070fcda22e preparados con inspección oficial
42024136075 acreditada por coordinador; descarga403 no reintentada. HOLD intacto.
Esperar CI del nuevo SHA y coordinación para integrar/publicar. No incorporar
cadena B14–B27 ni propuesta12.

## PR196 · controles finales LAB v384 · 05/11/2026

Política196, baseline/rollback v383 7f429af5f0b5c5f7 acreditada por coordinador.
Único pin cambiado: lp01-operation.js 9a197353…; HOLD por transición conservado.
Verificadores/backend probe/inventario/bytes intactos. Recuperación lector13
con guard de nuevoMD5 guardada; ninguna instalación productiva desde este hilo.
Pruebas y evidencia: [hotfix-v384/README.md](hotfix-v384/README.md).
CI final debe corresponder al nuevo SHA; no reutilizar CI444c751 como cobertura.
SALE, presentación compacta y bocetos posteriores quedan separados.

## Hotfix LAB v384 · Seguimiento por orden · 05/11/2026

Implementado aislado sobre main17b0115 (PR195 fusionado); no publicado.
Acceso visible a pendientes/PDT; registro sin asignación con turno real abierto,
validación servidor y cero turnos/asignaciones ficticios. SALE sin asignación sigue
sin contrato y se explica. Propuesta13 lector: todos los orígenes de aluminio por
key exacta, identidad real, LEGACY solo consulta, sin grants ni cambios de datos.
Pruebas/requisitos y activación pendiente: [hotfix-v384/README.md](hotfix-v384/README.md).
No interferir con publicación383; reconciliar numeración futura B14–B27.

## LAB v383 · controles de publicación PR195 · 05/11/2026

Política preparada sobre121e1805ad0445a4c91f03d5ba812f0004dd09ad (CI3/3 PASS).
integration_pr195; única huella protegida modificada: src/modules/lp01-operation.js
SHA256 5f0c2847bf6aec5f84a59376dea442e6f73cf4880d4b6ab18396a6419d7e6ae4.
Baseline y rollback: sites/sgp-one-lab/versions/07abe57ef1374fde (LAB v382,
main646729005295c79d73bed7d6730aa10d042768b8). Evidencia aportada por coordinador:
run41962991598 SUCCESS,96/96 archivos públicos exactos y2 rutas de plataforma
intactas; metadata actual se contrasta en el hilo coordinador, no nueva inspección aquí.
Policy, backend-readiness offline4, postcheck offline7, artefacto runtime y release383
PASS. Política real: push=HOLD/POLICY_TRANSITION_REQUIRES_EXPLICIT_REVIEW;
prepare solo construye; drift sigue rechazado. Verificadores, backend probe, inventario,
bytes, recuperación y workflows intactos. Propuesta deshabilitada, sin EXECUTE nuevo.
No backend, merge, ready-for-review, dispatch ni publicación desde este hilo.
Siguiente: CI propia del nuevo SHA de política y coordinación del padre para revisión,
artefacto exacto, controles e integración/publicación; no reutilizar CI121e180 como nueva.

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

## LAB v382 · política de publicación PR194 preparada · 05/11/2026

integration_pr194; única huella protegida cambiada lp01-operation.js=c59d53eb… .
Baseline/rollback246cf9687407ab1a, v381/SHA5003c612: evidencia92/92 bytes aportada
por el coordinador, quien contrasta metadata actual. No inspección Hosting nueva aquí.
Policy/readiness offline, artefacto runtime e inventario/bytes y release382 PASS.
Gate con política real: transición push=HOLD; prepare sin despliegue; drift rechazado.
Sin cambiar verificadores, backend, permisos ni funciones. Padre conserva integración,
dispatch/publicación y GET final. CI debe corresponder al nuevo SHA de política.

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

# Línea de Producción — estado operativo actual

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
[Fuentes, opciones y propuesta](SEGUIMIENTO_APERTURA_AFECTACIONES_V382.md).
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


## Ajuste local de Seguimiento · 04/11/2026

IMPLEMENTADO EN RAMA LOCAL `fix/seguimiento-silent-filters`, base `fe82ffab`.
Sin push/PR, fusión, SQL, datos productivos ni publicación; vidrio #192 intacto.
Actualización de 20 s silenciosa, sin repintado de respuestas iguales, consultas
serializadas y descarte de respuestas obsoletas; limpieza por sesión/rol/ámbito.
Semana Export precede a Producción en PC y abre la identidad móvil. Orden y filtros
combinables por columna, ausentes distintos de cero, sin mutar prioridades ni
agregar SALE/avances/afectaciones entre turnos. Conserva estado/foco/scroll/detalle.
Pruebas: 462 JS PASS y verify:release PASS; Chromium 1440/390 con transporte local
sintético y reloj controlado. No equivalen a aceptación autenticada/productiva.
[Alcance, referencias y evidencia](../../tests/lp01-tracking-ui/README.md).
Siguiente: revisión aislada y aclaración de qué bloque superior retirar antes de
integrar. Los bloques ambiguos se conservan; no se solicita publicar desde aquí.

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

## PR191 · corrección acotada del postcheck antes de publicar

CI de `2c4ca32701fd9ffce888f4d370b1794a44aa5218` completa PASS, incluidos SQL/API
y PC/móvil. El intento prematuro de quitar borrador fue rechazado mientras UI
estaba en curso; no modificó el PR. Se conserva ese requisito hasta CI completa.

El log real del job126667876705/run41856841540 explica el postcheck anterior:
89 rutas esperadas,91 observadas, ninguna faltante y exactamente
`__/firebase/init.js` y `__/firebase/init.json` adicionales. El postcheck ahora
exige inventario exacto de aplicación más esas rutas SOLO si ya existían en la
versión acreditada y conservan hash/estado idénticos. No ignora el prefijo __/:
cualquier otra ruta, faltante, duplicado o alteración aborta. Mantiene comprobación
de retención/configuración anterior y añade comparación HTTPS byte a byte de todo
el artefacto publicado, incluido manifest/release-info. Seis regresiones offline
PASS y política PASS; se ejecutan antes del gate. No cambia frontend ni SQL.
Siguiente: CI del nuevo commit y publicación con pins exactos; no fusionar el
encargo separado de vidrio durante esta ventana.

## PR191 · SQL instalado y permiso acotado verificado · 04/11/2026 21:15 UTC

Tras confirmación explícita del usuario para crear dos funciones y modificar dos,
se comprobó que el intento rechazado no había ejecutado nada. Preflight renovado
21:13:54 UTC idéntico al anterior; respaldo privado SHA256
`f1ef0df8ccb0a5e1e7a1596edb4825d4214fd03780499d0409a1ba671483dad5`.
INSTALL exacto `edeb19dd6ca27eaacf654f8126246437723f3e978314465d608eae8e5955e183`
APLICADO. SELECT posterior verifica los cuatro cuerpos fijados, metadata de las
funciones existentes/default ACL conservados y nuevas funciones inicialmente con
ACL exclusiva del owner. ENABLE_API exacto
`0a1d772065d463af5f3ae879906169c7b5dbbe5112457db399e0fb1444e591b7`
APLICADO: solo la fachada recibe EXECUTE anon; authenticated/service_role sin
acceso a las funciones nuevas, lector privado sin API. No RLS/datos modificados.

Prueba SQL con SET LOCAL ROLE anon y ROLLBACK: sesión inválida rechazada como
SESION_NO_AUTORIZADA en Ensamble y Empaque. No sesiones humanas ni datos ficticios.
Preparación añade dos comprobaciones HTTPS negativas de esta RPC al verificador
existente; no acepta ausencia de función ni error de privilegios como éxito.
Cuatro pruebas offline del verificador y política PASS. Contratos backend
acreditados; transición de política sigue HOLD y publish exige SHA/run/ZIP/live.

**Siguiente paso:** CI del candidato final, merge con política HOLD, prepare y
denegaciones HTTPS reales, inspección vigente, publicación explícita y postcheck.
Aceptación positiva con usuario real y rendimiento real siguen pendientes.
El rechazo documentado debajo está resuelto para INSTALL con la autorización nueva.

## PR191 · publicación contenida · 04/11/2026 21:00–21:05 UTC

CI del candidato `4b5080608dafc83e53c2b3d498a4c4a827162399`: sintaxis,
tests y aceptación SQL/API/PC-móvil completos PASS. La red actual permite
api.github.com; inspección Hosting [41911770281](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/41911770281)
PASS: live `1a59beda3dffaed9`, FINALIZED, 91 archivos, inventario/configuración
leídos mediante la API con la cuenta existente. Se acredita esta versión como
baseline y recuperación; no se ejecutó una restauración de prueba.

La política actualiza únicamente las dos huellas afectadas por Seguimiento,
referencia PR191 y baseline/rollback acreditados. La transición permanece HOLD;
`backend_contracts_verified=false` impide publicar mientras falte la instalación.
No se cambia el gate ni sus rutas, permisos, workflows o alcance. Vidrio se trabaja
por separado y no forma parte de este PR.

Preflight Supabase de solo lectura 21:01:57 UTC: siete cuerpos existentes coinciden
con los pins, nuevas funciones ausentes, RLS de las tablas implicadas habilitado.
Respaldo privado fuera del repositorio, carpeta0700/archivo0600, SHA256
`1a3ec26f1949c686218869b89b428216738cc331ecdaf5b34ae2785ec39af1ea`.
INSTALL fue rechazado por revisión automática por falta de autorización explícita
para esta instalación exacta (crear dos funciones y modificar dos existentes).
No se aplicó SQL, EXECUTE, merge ni publicación. La aprobación previa del permiso
API se conserva; no se amplía para superar el rechazo de instalación.

**Siguiente paso:** obtener confirmación específica del INSTALL de hash
`edeb19dd6ca27eaacf654f8126246437723f3e978314465d608eae8e5955e183`,
refrescar preflight y ejecutar instalación/verificación antes del permiso separado.
Después acreditar contratos, CI del SHA final, prepare/ZIP y publicación protegida.
Los apartados siguientes conservan antecedentes y límites de aceptación humana.

## Candidato Seguimiento global — revisión en borrador

Rama `feat/lp01-seguimiento-global-review`, base main `ab1d2d6`.
B08–B11 reutilizado con consulta por línea/etapa de todas las semanas y producciones
sin asignación. Export conserva prioridad; desconocido/cero con pendientes queda
en conciliación. Seguimiento coordinador/administrador; VALIDAR solo coordinador.
Implementado y verificado en aislamiento; sin instalación ni publicación.
[Alcance y pruebas sintéticas](SEGUIMIENTO_INCREMENTO_AISLADO.md).
Pruebas anteriores válidas reutilizadas; CI del nuevo SHA pendiente al preparar
este commit. Próximo paso: revisar CI y el PR, manteniendo por separado las
aprobaciones de instalación, EXECUTE anon, fusión y publicación.


**Actualizado:** 2026-11-04, UTC/America/Bogota. PR183, rama existente.
**Código de referencia verificado:**6edf892; main4ef528b (#190) incorporado
conservando LP, ambos bloques styles.css, calendario Colombia y saldos futuros.
Fusión local limpia; GitHub indicó no fusionable temporalmente durante su cálculo.
**FASE ACTIVA:** publicación segura de Seguimiento, Ensamble y Empaque PANELES_2.
No retomar apertura automática, PDT/Export ni módulos aplazados.

- **APLICADO/VERIFICADO Supabase:** ACL00 y SQL01/06/08/10. SQL10 versión20261104033408,
  ocho cuerpos exactos; firmas/owner/ACL administrativas preservadas, CHECK validado,
  once tablas privadas RLS. Catálogos sin acceso directo anon/authenticated. No09,
  usuarios/sesiones inventados o datos de negocio modificados.
  [Recibo10](../../tests/lp01-roles/evidence/sql10-production.json).
- **PUBLICADO Edge:** lp-powerbi v1 ACTIVE/verify_jwt=true, alternativa8f85586 aprobada
  expresamente; cinco fuentes recuperadas byte-idénticas. Credencial privilegiada
  solo servidor/allowlist dos RPC. JWT público identifica proyecto; sesión SGP/SQL
  autoriza persona. [Recibo](../../tests/lp01-roles/evidence/edge-jwt-production.json).
- **VERIFICADO HTTPS real:** diez comprobaciones PASS, run41841837220/job126615309539.
  Sin credenciales401/UNAUTHORIZED_NO_AUTH_HEADER, firma alterada401/UNAUTHORIZED_LEGACY_JWT;
  sesión inválida rechazada, ambas etapas protegidas y origen ajeno403. Clave pública
  sola también llega al control de sesión: no acredita usuario. Verificador corregido,
  sin relajar Edge/SQL; tres regresiones offline PASS.
  [Resultados y límites](../../tests/lp01-roles/evidence/backend-https-production.json).
- **ACTIVADO/VERIFICADO Supabase:**04/11 14:13UTC, escrituras/BI/perfil=true,
  adaptador LP-PBI-XLSX-1, SQL09 ausente. Solo dos filas de configuración, bajo
  contención/preflight. Órdenes/auditoría/cierres aún0; no prueba guardados humanos.
  [Recibo real](../../tests/lp01-roles/evidence/activation-production.json).
  [Cuatro grupos nuevos PG17.11 sintéticos PASS](../../tests/lp01-roles/evidence/activation.json):
  atomicidad, ACL/formato, contención concurrente, reintentos y recuperación.
- **CI:**6edf892 seis checks PASS, incluida activación y SQL/PC-móvil.447c5db
  incorpora main #190, cinco checks PASS y aceptación SQL/PC-móvil en curso.
  Documentación posterior no hereda automáticamente CI; se consultan sus propios checks.
  Menú nativo, supervisor limitado a su etapa, líder ambas, XLSX/cierres conservan las
  evidencias aprobadas. No repetir manualmente baterías no afectadas.
- **HOSTING NO PUBLICADO / PR NO FUSIONADO:** política runtime preparada/huellas exactas;
  adopción en main HOLD sin despliegue automático. Livec698e0b8a4356985 FINALIZED,
  79 archivos, acreditado04/11 14:10UTC tras publicación habitual de #190. Baseline
  y rollback actualizados a esa versión; no asumir que el live anterior sigue vigente.
  [Recibo recuperación](../../tests/lp01-roles/evidence/hosting-main190-production.json).

**Bloqueo operativo restante:** el conector no ofrece workflow_dispatch; al sellar
el SHA final hace falta que un operador inicie el workflow protegido con parámetros
exactos. La red local sigue restringida; no se cambia/proxifica para sortearla.
No hay sesión SGP humana disponible para acreditar guardados reales/PC-móvil en planta.
No se confunden pruebas sintéticas o denegaciones HTTPS con esa aceptación.
**Siguiente acción:** concluir CI del candidato sincronizado; fusionar bajo
controles y entregar SHA/run/digest exactos
al operador para publish en el mismo Firebase. Después verificar versión e interacción
real. [Plan y recuperación](PUBLICACION_CONTROLADA_2026_11_03.md).

Esta es la **referencia operativa única de LP**. Describe el estado vigente, no un
historial. Antes de trabajar leer AGENTS.md, este archivo y el estado real del PR;
contrastar HEAD/cambios locales para detectar entregas posteriores. Al finalizar
cada entrega técnica, actualizar aquí estado, evidencia y siguiente acción dentro
del mismo PR y commit o conjunto de commits. Si hay trabajo paralelo sobre los
mismos archivos, usar aislamiento antes de editar; preservar cambios ajenos.
La actualización es una obligación de cada entrega, no un proceso automático en
segundo plano. No sustituye la supervisión ni concede autorizaciones productivas.

## 1. Estados y entorno

| Estado | Significado y situación actual de LP |
|---|---|
| PROPUESTO | Publicación Hosting protegida pendiente.04/05/07/08R y diseño A no aplicados.09 excluido |
| IMPLEMENTADO | Seguimiento/Operación, adaptador XLSX y controles en rama. Identidad técnica solo como referencia sintética, no integrada en el runtime |
| APLICADO | Supabase: ACL00 y SQL01/06/08/10; escrituras/BI/perfil=true por activación autorizada14:13UTC. Sin09 ni asignaciones humanas nuevas |
| PUBLICADO | Edge lp-powerbi v1 ACTIVE/JWT=true, fuente verificada. **Frontend no publicado** en Firebase ni worker automático; backend LP autorizado habilitado |
| VERIFICADO | CI6/6 baseeffb6a0; verificaciones focalizadas de alternativa local y PG/PC/móvil sintéticos. Supabase real: ocho cuerpos10, ACL/roles/constraint/contención por SELECT. Gateway JWT/SGP: diez denegaciones HTTPS reales PASS. **No guardados productivos o verificación en planta** |
| FUSIONADO | #183 sigue sin fusionar. La existencia de otro PR fusionado no prueba aplicación/publicación de sus SQL |

## 2. Fase activa y prioridades obligatorias

**FASE ACTIVA: Seguimiento, Ensamble y Empaque.** Prioridad inmediata: publicación
segura del alcance aprobado PANELES_2, tras comprobaciones de runtime y CI
del código sincronizado. JWT autorizado/desplegado y SQL10 instalado: no repetirlos.
Conservar las cinco pestañas, Programación/ubicaciones y el adaptador XLSX.
No publicar una muestra o consulta contenida como si fuese operación integral.
El bloqueo PUBLIC de apertura automática sigue independiente; no se retoma ese
trabajo ni Vidrio/Dashboard/Tabla/Kanban para sortear los controles de publicación.

1. Completar servidor XLSX con JWT y controles de publicación aprobados.
2. Verificación HTTPS, activación controlada y publicación en el SGP existente.
3. Comprobación real PC/móvil y trazabilidad de operaciones por rol autorizado.
4. Integraciones PDT/Export conservan sus bloqueos de origen; no reabrirlas aquí.
5. Apertura automática, Vidrio/Dashboard y Tabla/Kanban siguen aplazados.

Conservar el calendario existente, sus asignaciones, prioridades y cantidades.
No crear divisiones adicionales ni equiparar partes de Mecanizado con raíces LP.

## 3. Funcionalidades implementadas y evidencia reutilizable

Todas las filas son **IMPLEMENTADO EN RAMA / VERIFICADO EN AISLAMIENTO**, con los
límites indicados; esa evidencia no acredita guardados productivos humanos.

| Funcionalidad y límite | Código / contrato | Pruebas y evidencia |
|---|---|---|
| Seguimiento: línea/etapa/turno, búsqueda, prioridades, abiertas/nuevas, cantidades, observaciones y afectaciones | [vista](../../src/modules/lp01-followup.js), [dominio](../../src/domain/lp01-followup.js) | [pruebas](../../tests/lp01-followup.test.mjs), [PC/móvil](../../tests/lp01-seguimiento/evidence/browser-results.json) |
| Operación: último acumulado por asignación/turno, etapas independientes, notas, permisos, CAS, UUID y auditoría | [interfaz](../../src/modules/lp01-operation.js), [motor 01 propuesto](../sql-proposals/lp01-operacion/01_operacion_REVIEW.sql) | [15 grupos SQL](../../tests/lp01-operacion/evidence/postgres.json) |
| XLSX real v1: comparación por producción/línea/etapa/fecha/turno, suma de últimos avances LP, diferencias justificadas, original y versiones | [adaptador](../../src/domain/powerbi/adapter.js), [servidor](../../src/server/lp-powerbi-handler.js), [06 propuesto](../sql-proposals/lp01-operacion/06_powerbi_xlsx_REVIEW.sql) | [hallazgos y límites](POWER_BI_XLSX_V1.md), [8 grupos SQL](../../tests/lp01-powerbi/evidence/postgres.json), [PC/móvil](../../tests/lp01-powerbi/evidence/browser.json) |
| SALE Empaque persistida cuando elegibilidad/presupuesto/capacidad lo permiten; decisiones/repartos ambiguos quedan al coordinador | [reglas y código 01](SALE_CONTINUIDAD_CONTENCION.md) | [10 grupos SQL](../../tests/lp01-continuidad/evidence/postgres.json), [PC/móvil](../../tests/lp01-continuidad/evidence/browser.json) |
| Continuidad al ABRIR siguiente turno configurado: raíz/antigüedad/afectaciones y contexto, ejecutado destino cero; contención drena comandos y conserva recibos autorizados | [01](../sql-proposals/lp01-operacion/01_operacion_REVIEW.sql), [documentación](SALE_CONTINUIDAD_CONTENCION.md) | [SQL](../../tests/lp01-continuidad/evidence/postgres.json), [admisión XLSX](../../tests/lp01-continuidad/evidence/xlsx-admission.json) |
| SIN ACTIVIDAD: vacío real, confirmación/motivo, responsable autorizado, sin BI, auditoría/versiones, reapertura coordinador | [regla y motor](SIN_ACTIVIDAD.md) | [9 grupos SQL](../../tests/lp01-sin-actividad/evidence/postgres.json), [PC/móvil](../../tests/lp01-sin-actividad/evidence/browser.json) |
| Apertura preparada: HORARIOS_TURNOS, cierre previo acreditado, bloqueos/demora y fallback manual; **sin ejecutor automático** | [preparador](../../src/server/lp01-opening-preparation.js), [contrato](APERTURA_AUTOMATICA_PREPARACION.md) | [6 pruebas](../../tests/lp01-apertura.test.mjs), [6 grupos SQL](../../tests/lp01-apertura/evidence/postgres.json), [PC/móvil](../../tests/lp01-apertura/evidence/browser.json) |
| Integración independiente: contexto Mecanizado/PDT filtrado en servidor por usuario/etapa/línea/turno/producción; homónimas sin diagnóstico expuesto y Export desconocido sin falso cero, sin créditos | [límites de lectura](../../src/domain/lp01-sources.js), [interfaz](../../src/modules/lp01-operation.js) | [SQL real](../../tests/lp01-fuentes/evidence/postgres.json), [PC/móvil](../../tests/lp01-fuentes/evidence/browser.json), [reproducción y límites](../../tests/lp01-fuentes/README.md) |
| Diseño A: fachadas humanas/técnicas separadas, núcleo ABRIR compartido y journal append-only; **solo prototipo sintético, no instalador** | [diseño y matriz](principal-a/DISENO.md), [referencia guardada](principal-a/shared-reference.sql) | [9 grupos SQL reales con LOGIN local](../../tests/lp01-principal-a/evidence/postgres.json), [huellas](../../tests/lp01-principal-a/evidence/verification.json) |
| Vidrio contextual/ubicaciones y cierres CSV versionados; Dashboard limitado a datos del turno consultado | [alcance delimitado](../SGP_LP01_SEGUIMIENTO_OPERACION.md) | [evidencia inicial](../../tests/lp01-seguimiento/evidence/), [SQL/reportes](../../tests/lp01-operacion/evidence/postgres.json) |

## 4. Aprobado pero pendiente; decisiones que no se deben reabrir

[Issue #184](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/issues/184),
[DOCX y guía recuperados](references/) y [matriz individual B01–B27](REFERENCIAS_27_BOCETOS.md)
son las referencias funcionales. La antigua mención del Issue a guía no disponible
está superada por los adjuntos versionados y sus hashes; no volver a pedirla.

Ya aprobados: acumulado editable con último valor vigente; etapas independientes;
afectaciones en ventanas con consolidación sin suma ciega; continuidad de abiertas;
saldo oficial solo Export; conciliación BI por producción y turno; cierre y
reapertura auditados, incluida regla SIN ACTIVIDAD. Los dos XLSX reales ya se
recibieron y su adaptador está implementado. SALE persistida y drenaje ya están en
rama: no tratarlos otra vez como meras sugerencias pendientes.

Pendientes de completar según reglas aprobadas: liberación PDT neta/asociada y
compensaciones; inclusión verificable de avances en cortes Export; ámbitos de
cuentas reales; integración/despliegue controlado del servicio XLSX; consolidado
de etapas y reportes complementarios; fuentes históricas Dashboard/Vidrio.
A seleccionada **solo para diseño**, no autorización de privilegios ni activación.

No promover toda la guía a «aprobada»: B10/B11 con ajustes; B12–B16 aprobados;
**B17 sin aprobación**; B19 con ajustes/B21 aprobado; B24 aprobado y B26 aceptado
al continuar; B27 aprobado documentalmente, aplazado en esta fase. Los restantes
estados antecedentes/superados/continuidad se conservan en su matriz; no son
permiso para inventar reglas ni rehacer el calendario.

## 5. Bloqueos reales y responsables de resolución

Responsables expresados por función, **sin inventar personas ni conceder accesos**.

| Bloqueo / causa | Evidencia verificable | Responsable y salida requerida |
|---|---|---|
| Edge desplegado; verificación de gateway/servidor HTTPS aún pendiente | [Recibo real Edge](../../tests/lp01-roles/evidence/edge-jwt-production.json), [alternativa](../../tests/lp01-roles/evidence/jwt-alternative.json) | Revisar comprobador público del workflow existente antes de activar; no repetir aprobación ya concedida |
| Gateway/servidor y publicación reales aún no comprobados; sin writes habilitados | Comprobador HTTPS en Actions preparado, inicialmente NOT_REQUESTED; no sesiones válidas ni guardados de prueba productivos | Tras despliegue aprobado, habilitar comprobador público en el workflow existente. Para verificar datos/guardados reales, usar cuenta autorizada sin compartir credenciales |
| **Apertura automática: A no garantiza «solo ABRIR» en la base actual.** EXECUTE de PUBLIC alcanza 83 SECURITY DEFINER SGP, 80 invocables sin triggers; PUBLIC también recibe TEMP. NOINHERIT/REVOKE al rol no lo sustraen | [SELECT conservado](../../tests/lp01-principal-a/evidence/supabase-catalog.json), [contraejemplo sintético](../../tests/lp01-principal-a/evidence/postgres.json). Helper real solo inspeccionado, nunca ejecutado | Responsable de seguridad/DB y propietario del proyecto: delimitar propuesta compatible de perímetro y autorizar su alcance, o decidir otra frontera. Codex no revoca ACL globales ni implementa B automáticamente |
| LOGIN/TLS/red/pooler reales no acreditados; no existe enlace técnico integrado/activado | [viabilidad y límites](principal-a/DISENO.md) | Responsable infraestructura/Supabase: runtime/ruta e identidad aprobados y prueba controlada posterior; sin secretos/roles ahora |
| Emisor PDT real pendiente de acreditar entrega/cobertura neta; asociación por raíz y contención de anulaciones ya preparadas en 07, verificadas solo sintéticamente | [contrato LP-PDT-LIBERACION/1 y brecha](CIERRE_BLOQUEOS_PRODUCTIVOS.md#2-pdt-datos-existentes-y-contrato-que-falta) | Responsable funcional/PDT: caso y consolidación de solapamientos; mantenedor integración: adaptador/emisor trazable, sin convertir piezas en ventanas |
| Cambio de corte Export no prueba qué avances incluye; riesgo de descontar dos veces | [LP-EXPORT-INCLUSION/1](CIERRE_BLOQUEOS_PRODUCTIVOS.md#3-export-diario-contrato-de-inclusión-separado-de-power-bi-de-cierre) | Responsable fuente Export y mantenedor: procedencia/cortes/eventos incluidos y protocolo idempotente; no deducir inclusión por fecha o diferencia de saldo |
| Configuración real de supervisores mediante Gestión de Roles/Usuarios; SQL10 ya disponible, no asignar cuentas por inferencia | [Regla vigente](ROLES_CIERRE_INDIVIDUAL.md), [recibo real10](../../tests/lp01-roles/evidence/sql10-production.json) | Administración autorizada configura cuentas existentes desde Configuración. No exige matrices08/09 ni PRIMARY/BACKUP para el cierre individual aprobado |
| Corrección retroactiva de cadenas ya arrastradas y variantes BI no observadas sin contrato/evidencia suficiente | [continuidad](SALE_CONTINUIDAD_CONTENCION.md), [variantes XLSX](POWER_BI_XLSX_V1.md#hallazgos-pendientes-limitados-a-su-caso) | Funcional + mantenedor de fuente: evidencia específica/conciliación, sin inferencias sobre anulaciones, nocturnos, ceros ausentes o reparto |

No se vuelve a consultar información sensible previamente bloqueada ni a conciliar
históricos por inferencia. Los SELECT nuevos acreditan solo instalación/metadatos,
no operaciones exitosas de usuarios reales ni cobertura PDT/Export en planta.

## 6. Siguiente acción técnica exacta y límite de continuación

**Vigente:** ACL y sincronización resueltas; SQL01/06/08/10 contenidos y verificados.
[Recibo SQL10](../../tests/lp01-roles/evidence/sql10-production.json).
**Siguiente acción exacta:** Edge aprobado/desplegado y fuente comprobada; revisar
comprobador HTTPS habilitado en Actions. Solo con PASS, activar/pin/publicación
protegida. Un JWT
anon público no sustituye la identidad SGP ni certifica una sesión humana.
No reintroducir matrices09 ni usar otra vía para eludir confirmaciones. El
dictamen anterior de ACL insegura se conserva como antecedente histórico enlazado.

Antecedente Paneles2/09 SUPERSEDIDO: las asignaciones por turno y dos cuentas eran
la regla anterior, conservada solo en la evidencia histórica. No usar el importador
3C/--paneles2 como autoridad de los roles del perfil10 ni reinstalar09.

Antecedente integral (evidencia vigente en lo no modificado):

**Cierre funcional integral preparado hasta los límites de fuente/runtime.**
4 recorridos nuevos PC/móvil PASS con SQL08 y handler XLSX real: revocación tras
render denegada en SQL sin auditoría nueva, último acumulado, diferencia obligatoria,
original idéntico, reapertura y dos versiones, etapa opuesta abierta, Export y
Programación intactos. [Evidencia](../../tests/lp01-cierres-integrados/evidence/browser-sql08.json).
Se conservan pruebas válidas de SIN ACTIVIDAD, continuidad, locks e idempotencia;
no se repiten ni se presentan como productivas. CI del nuevo cambio pendiente.
**Siguiente acción exacta:** recibir matriz/catálogo/períodos aprobados por canal
privado y pin; ejecutar importador3C con apply=false y revisar diff sin aplicar.
PDT/Export requieren los campos de origen ya identificados, sin reabrir auditorías.
Histórico/consolidado requieren fuente contrastada. [Matriz completa](CIERRE_FUNCIONAL_INTEGRAL.md).

Antecedente de Hosting, no tarea productiva autorizada en este encargo:

**Actualización de evidencia GitHub:** inspect41707119884 sobre934340c tiene GET
Hosting y resumen saneado SUCCESS; publish/recover OMITIDOS. Esta ejecución fue
previa/externa a este encargo, no se relanzó. No se deducen IDs ni se certifica
retención/rollback por el estado verde; revisar su resumen antes de otra autorización.
Los bloqueos históricos de autenticación de41696116331 (IAM Credentials API403)
y41698141346 (error genérico después de OAuth) se conservan como antecedentes,
no como prueba de que la lectura actual sigue fallando.934340c cambió OAuth a
JWT de la misma cuenta/alcance Hosting y diagnóstico seguro; cambios conservados.
La política continúa legacy/no certificada, sin autorización de publicación.

**Publicación controlada preparada, NO ejecutada.** firebase-hosting.yml conserva
proyecto/cuenta/grupo live existentes; policy legacy/no certificada. Primera
adopción y cambios LP/política retienen deploy. Pushes habituales posteriores
publican artefacto positivo con navegación anterior, sin activar LP pendiente;
no se bloquea main globalmente ni se publica raízrepo. Dispatch defaultprepare
sin secretos; inspect GET solo; publish/recover bloqueados por policy, identidad
live y pins. Después de aprobación visual, pushes ordinarios preservarán LP
readonly congelado por hashes. [Mecanismo, riesgos, pruebas y recuperación](../../tests/lp01-publish/PUBLICACION_CONTROLADA.md).
7grupos política+4artefacto y PC/móvil habitualPASS; gateCLI/YAML/verifyreleasePASS.
API en tests es transporte sintético: ninguna identidad/version Hosting nueva
acreditada. CIbasebb7d052 4/4PASS reutilizada. Cero dispatch, Firebase, infraestructura,
claves, permisos, SQL o datos productivos. Publicación LP sigue BLOQUEADA.
**Siguiente acción:** revisión técnica de política/workflow y eventual autorización
soloinspect con la misma cuenta; no publicación para conocer la versión.403/permisos
insuficientes deben detenerla sin otro rol. No fusionar ni ejecutar ahora.

Antecedentes de certificación:

**Antecedente de certificación Hosting (superado en acceso por inspect41707119884):**
Sin conector Hosting, CLI/gcloud, selectorADC/manifiesto o identidad técnica configurada.
No se reintenta403 público ni se extraen secretos de CI/cuentas humanas. Proyecto
solo inferido de.firebaserc; sitio/live/release/version NO acreditados. Candidato
Git4b1e98e no equivale a versión activa ni rollback exacto.
[Dictamen, evidencia, publicación offline y recuperación](../../tests/lp01-hosting/CERTIFICACION.md).
Plan local valida ZIP/manifiesto/hashes y publica nada: raízpublic separada, sin
privados/backend, deploy_command=null, BLOQUEADO.6 grupos nuevos offline PASS.
CI64d91e2 4/4completadaPASS reutilizada, sin repetir batería general.
**Siguiente acción:** responsable Hosting con lectura ya autorizada aporta vínculo
live→release→version, inventario/config y vía de recuperación1o2. Sin secretos ni
privilegios nuevos. Reconstrucción Git solo alternativa funcional con aceptación
separada, nunca rollback certificado. No pedir aún despliegue. Sin cambios Firebase,
sitios/canales, SQL, roles, usuarios, datos o secretos.

Antecedentes de integración preparados:

**Vigente: preparación al SGP principal, sin sitio/canal nuevo.** Artefacto completo
/tmp/sgp-lp183-main-visual conserva app/index/config y limita únicamente LP a
snapshot sintético local, sin cliente/token/RPC productivos. Preparador reproducible
sin SQL, lista positiva de assets y manifiesto. Programación/ubicaciones no se
sustituyen. PC/móvil del artefacto completo PASS con sesión anfitriona sintética;
autenticación/funciones de datos reales no certificadas.3unitarias nuevas y21
regresiones directas PASS. Base7faa136 CI4/4PASS.
[Matriz, riesgos, publicación y recuperación](../../tests/lp01-integration/REVISION_FINAL.md).

**Bloqueo antes de aprobación live:** metadata pública devuelve403; candidato
anterior4b1e98e identificado por run exitoso, fuente reconstruida localmente, pero
versión activa/bytes exactos de rollback no acreditados. Además no publicar raíz
repositorio: hosting actual no excluye private/. El artefacto positivo lo excluye.
Workflow pushmain publica automáticamente: no fusionar como prueba. No SQL/BD,
usuarios, roles, RLS, secretos, publicación ni nuevos recursos modificados.
**Siguiente acción:** revisión final de matriz y artefacto, y responsable hosting
acredita versión live/artefacto de recuperación exacto. No pedir todavía deploy
productivo sin ese control. Propuestas anteriores de canales quedan anuladas.

Antecedentes:

**Vigente: cinco pestañas horizontales aprobadas integradas en la estructuraSGP:**
LP-01 Programación / Seguimiento / LP-02 Ensamble / LP-02 Empaque / Reporte de
ubicaciones. Un controlador LP compartido, contexto/título por etapa y acciones
internas para detalle/cierre, sin nuevas portadas ni menú lateral. Programación y
ubicaciones conservan módulos/contenedores/contratos. Demo explícita de solo
lectura con datos sintéticos; no conexiones ni operaciones productivas.
[Capturas de las cinco pestañas, diferencias y publicación pendiente](../../tests/lp01-demo/PESTANAS_APROBADAS.md).
PC1440/móvil390 y teclado PASS;34 regresiones JS PASS; SIN ACTIVIDAD PC/móvil con
SQL real aislado PASS. No cambio de SQL/RLS/datos, no despliegue. La propuesta
anterior de sitio independiente queda como antecedente, no destino aprobado.
**Siguiente acción:** revisión funcional y autorización específica de un canal
remoto aislado de revisión, sin sustituir el SGP actual. Publicación productiva
requiere revisión de artefacto/destino/rollback y autorización aparte; no habilitar
escrituras ni fuentes pendientes para mostrar estas pestañas.

Antecedentes de demostración:

**Prioridad inmediata: demo visual antes de encargos5–9.** Paquete separado local
/tmp/sgp-lp183-preview, navegación menúSGP→Seguimiento/Ensamble/Empaque→detalle/cierre.
Reutiliza interfaces actuales y snapshots de PostgreSQL sintético, aviso permanente,
solo lectura; comandos rechazados, sin conexiones productivas ni credenciales.
PC1440/móvil390: ambas etapas, búsqueda/expansión/informes, cero peticiones externas,
cero errores y sin overflow. [Capturas, diferencias y plan](../../tests/lp01-demo/README.md).
B10–B16 contrastados visualmente; densidad/UUID/detalle/NC de piezas difieren del
boceto y están documentados, sin declarar fidelidad completa ni aprobar B17.

**Siguiente acción vigente:** revisar capturas y autorizar expresamente, si procede,
nuevo sitio/canal estático Firebase sgp-one-lp183-demo / lp183-review por7d.
URL propuesta con identificador asignado por Firebase; no creada ni publicada.
No usar hosting SGP actual, workflows ajenos, SQL o escrituras. No hay URL pública
aún. Encargos5–9 quedan pospuestos hasta revisión visual. Estado: IMPLEMENTADO Y
VERIFICADO LOCALMENTE; NO PUBLICADO. Los bloqueos de fuentes/ámbitos reales siguen
independientes y no se superan para demostrar la interfaz.

Antecedentes conservados:

**Encargo 4: brecha de evidencia integrada cerrada en aislamiento.** Se reutilizan
los motores y ambos XLSX originales: Node handler real → parser vigente → RPC06/08
→ PostgreSQL17.11 sin red. Por etapa: motivo obligatorio para diferencia1,
primera versión, reapertura exclusiva de coordinador, corrección, segunda versión
sin diferencias y original idéntico, una sola auditoría de importación tras retry.
Sin roles/ámbitos actuales válidos no importa ni recupera original. SIN ACTIVIDAD
con órdenes (incluso cero) denegado; vacío genuino cierra sin BI, confirmación/motivo,
identidad/hora/auditoría, dos versiones y siguiente turno HORARIOS_TURNOS.

Catálogo/cuentas/LP/cantidades son sintéticos y se preparan **antes** de operar,
sin recortar órdenes tras ABRIR. T1 de originales: Ensamble95 / Empaque90. No se
publican filas/nombres/bytes reales ni se consulta su correspondencia en Supabase.
[Recorrido, brechas pendientes y pruebas](../../tests/lp01-cierres-integrados/README.md).
No hay cambio de aplicación/SQL/permisos que aplicar desde esta entrega.

**Dependencias reales delimitadas:** correspondencia canónica y scopes aprobados;
universo LP/filas del siguiente turno; variantes XLSX no observadas; host Edge/
autocommit/orígenes y activación autorizados. En el universo sintéticoT1, T2 no
concilia producciones no asignadas/arrastres sin cobertura: se mantiene bloqueado
sin fabricar ceros ni modificar Programación. No se afirma defecto productivo del
archivo por ese escenario. PDT/Export siguen bloqueados exclusivamente en fuente,
sin crédito de liberación ni inclusión fabricado por cerrar Power BI.

**Siguiente acción exacta vigente:** revisar la matriz de brechas de Encargo4 y
recibir por canal privado autorizado matriz/catálogo/períodos acreditados; generar
su diff con el importador3C (apply=false). Antes de considerar cierreT2 real,
acreditar universo LP y cobertura del archivo de ese turno; mantener pendiente solo
ese caso. Sin instalar SQL, permisos, activar runtime/escrituras, fusionar o desplegar.

Componentes conservados y evidencias anteriores:

**Encargo 3C terminado en rama/aislamiento.** [Importador privado](../../src/server/lp01-scope-import.js)
y [CLI](../../scripts/lp01-import-scopes.mjs) reutilizan el revisor existente, ahora
con período opcional y revocación. Estados completos referencia/propuesta, catálogo
y períodos del contrato servidor con manifest/pin SHA256 externo. No DB, endpoint,
identidad técnica, SQL aplicable ni aplicación de accesos: apply=false siempre.
Duplicados/roles/cuentas/producciones/vigencias ambiguos se rechazan. No se agrega
cobertura de cuentas parciales ni se convierte una ausencia en revocación.

Custodia privada: entradas y resultados en private/lp01-scopes, ignorado por Git,
0700/0600, sin symlinks, originales preservados. Hash alterado/resultado cambiado
rechaza el reintento sin sobrescribir. Logs genéricos sin identidades/rutas/huellas.
Pin/referencias acreditan integridad respecto a la entrega privada, no certifican
por sí solos la autoridad funcional ni el origen productivo de un archivo.
[Contrato, reproducción y ejemplo sintético de diff](../../tests/lp01-ambitos-import/README.md).

**Continuación funcional del Encargo3 realizada:** flujo real SQL08/RPC sintético
para PANELES_2/FRAMES_2 × ENSAMBLE/EMPAQUE, 288=90+90+90+18, SALE explícita,
último acumulado80→90=90, afectaciones superpuestas consolidadas explícitamente,
nota/auditoría, cierre versionado, reapertura de líder denegada y arrastre exclusivo
de P2–P4 al nocturno con prioridades/raíces/antigüedad/afectaciones conservadas,
sin duplicar avances. Export y asignaciones completas no cambian. CSV-QA solo es
entrada al motor de cierre; no certifica nuevo formato XLSX ni inclusión Export.

**Dependencia de3C conservada:** recibir por canal privado autorizado la matriz y el
estado de referencia aprobados, catálogo completo y períodos acreditados contra
HORARIOS_TURNOS, con el pin del manifiesto. Ejecutar el CLI privado y revisar su
diff sin aplicar accesos. No afirmar períodos productivos emitidos por una función
LP aún no aplicada. Validación funcional con ámbitos/fuentes reales queda pendiente.
PDT y Export siguen bloqueados exclusivamente en fuente; host, SQL y activación
requieren revisión/autorización separadas. No desbloquearlos mediante fixtures.

Evidencia temporal y componentes previos conservados:

**Encargo 3B implementado en rama y verificado en aislamiento.** SQL08 exige vigencia
[inicio inclusivo, fin exclusivo), reloj real y cobertura de todo el período obtenido
de HORARIOS_TURNOS y America/Bogota, incluidos nocturnos. Cada cierre requiere PRIMARY
completo y BACKUP distinto completo, sin sumar cuentas parciales ni ampliar roles.
Revocación serializada en ambos órdenes de concurrencia; comprobación tras espera
y antes de COMMIT. Vencimiento revierte órdenes y auditoría, no confirma éxito.
Las seis funciones de sesión/lectura/comando/recibo/importación/archivo conservan
firma y ACL. Fachadas XLSX solo reciben autorización temporal, adaptador intacto.
No se alteran01–07, RLS ni permisos reales; SQL08 requiere01 y06 exactos y escrituras
contenidas. Filas antiguas sin intervalo fallan cerradas, sin backfill inferido.

[Contrato, reproducción, instalación y reversión](../../tests/lp01-ambitos-temporales/README.md).
SQL08R conserva datos/columnas: solo revierte fachadas/helpers si no hay scopes y
escrituras están contenidas; con scopes/deriva/uso operativo exige corrección hacia
adelante. No se creó respaldo ni se ejecutó ningún SQL productivo.

**Límites pendientes de producción:** matriz real aprobada y prueba del host RPC
con autocommit/constraints diferidas, revisión y autorización separadas. La garantía
al confirmar no incluye clientes SQL privilegiados que fuercen constraints
inmediatas y mantengan la transacción abierta. Contención global conservadora de
scopes: observar latencia antes de activar; no existe importador productivo nuevo.

**Ese importador está implementado en3C**; el siguiente paso vigente es la
recepción/revisión privada de la matriz delimitada al inicio de esta sección. Falta matriz real por canal privado; no inventar responsables. PDT y Export
siguen bloqueados únicamente en sus contratos de origen, sin reabrir diagnósticos.

Antecedentes verificados de componentes conservados:

**Entrega independiente terminada:** consulta contextual en ambas etapas y lectura
Export estricta, probadas con SQL real sintético y PC/móvil. El contrato vigente
agrega PDT por nombre: se reproduce mezcla entre claves diferentes. La fachada LP
filtra el resultado a las producciones autorizadas/incorporadas y omite los campos
diagnósticos ante homónimas. El cliente no invoca la RPC histórica amplia. Se
conservan firmas y permisos; 01 añade solo materialContext a la lectura existente,
con UNAVAILABLE si la fuente no está instalada o el rol carece de acceso. No se
modificó el cuerpo histórico ni se adjudican ventanas a una parte/etapa.

**Asociación implementada en preparación privada:** 07 registra solicitud pendiente,
recibo de evento/entrega/versiones/historial, cadena consolidada de producción/etapa,
distribución explícita por raíces y vínculo obligatorio en cada nuevo LIBERAR.
Sin recibo privado acreditado no crea créditos ni aumenta SALE. Duplicar una entrega
entre V2/V4, repetir evento, usar otra raíz o consumir tras anulación se rechaza.
Anulación consumida mantiene SALE/historial y exige conciliación, sin compensación
negativa automática. Cantidad sin asignar no se reparte por inferencia.

**Encargo 1B: bloqueado únicamente en emisión.** Contratos reales de registro,
validación, cierre/cobertura y anulación se contrastaron mediante SELECT de cuerpos
/columnas, sin invocar RPC ni leer registros operativos. Cobertura material no
produce raíz/etapa LP, versiones inmutables ni unión neta de ventanas antes/después.
No se identificó un caso canónico completo; esto no afirma que no existan entregas
físicas válidas. Inspector de origen implementado devuelve pendiente y crédito0,
incluso ante flags/raíces/cantidades declarados por cliente. No hay emisor conectado.
[Matriz exacta, pruebas y campos faltantes](../../tests/lp01-origen/README.md).

**Encargo 2B cerrado como BLOQUEADO EN FUENTE para aplicación.** Inspección acotada
del escritor/delegado, columnas y triggers de cargas/historial, sin filas operativas.
Hay corte/key/línea/saldos y JSON original, pero faltan official_inclusion_hash,
LP_event_ids_and_revisions y per_root_complete_inclusion_scope. JSON, fechas o
variaciones de saldo no acreditan esa correspondencia. No se fabrica manifiesto.
[Matriz/evidencia y límites](../../tests/lp01-export-reader/README.md).

Lector privado servidor implementado en preparación: transacción REPEATABLE READ
READ ONLY, parámetros key/línea/etapa, historial/carga/saldo consistentes y corte
esperado. Integra el planificador sin aceptar manifiestos del navegador. Siempre
PENDIENTE_EVIDENCIA/apply=false con el contrato nativo actual; sin reset de presupuesto,
SALE o Export. Requiere pool y contexto previamente autorizados del servidor: no
hay endpoint, conexión productiva ni identidad nueva configurada.

**Encargo 3A preparado y verificado aisladamente:** matriz por rol/operación,
cobertura de las cuatro combinaciones línea/etapa y revisión privada de cuentas
existentes, roles incompatibles, producciones, responsables/suplencias, duplicados
y vigencias. PRIMARY y BACKUP distinto deben cubrir individualmente todas las
producciones del cierre; no se suman coberturas parciales para dar permiso global.

Artefacto privado local generado sin identidades: private/lp01-scopes/review.json,
ignorado por Git, directorio0700/archivo0600; cuatro combinaciones pendientes, no
responsables inventados. Plantilla pública contiene listas vacías, no cuentas reales.
No se imprime el snapshot ni rutas/errores sensibles. [Matriz por operación,
reproducción y límites](../../tests/lp01-ambitos/README.md).

Servidor SQL real probado con identidades sintéticas: lectura/avance/observaciones/
afectaciones/cierre, SALE/validación/reapertura exclusivos del coordinador, scopes
cruzados, cambio de etapa, siguiente turno configurado, cuenta inactiva y cierre con
cobertura parcial denegados. Las autorizaciones no dependen de controles visuales.
Sin cambios SQL, RLS, usuarios, roles o ámbitos reales.

**Pendiente de aplicación real:** faltan asignaciones privadas aprobadas y revisión
funcional de responsables/suplentes. Vigencias/duty se validan en el revisor, pero
SQL01.permisos por sí solo no almacena esa política temporal ni duty; SQL08 lo
prepara y verifica aisladamente, todavía sin aplicar. No se declara aplicada
una restricción por intervalo o por duty; sesión vigente/cuenta activa sí se exigen
actualmente en servidor. No aplicar una matriz temporal sin revisión/autorización de SQL08 y del host.

**Ese trabajo independiente está preparado en SQL08 (3B), sin aplicar datos
reales ni ampliar permisos. El importador está implementado en3C; continuar
con la revisión real delimitada al inicio. Recibir la matriz real solo por canal
privado. PDT y Export siguen BLOQUEADOS EN FUENTE exclusivamente por sus contratos
de origen, no por esta matriz ni como impedimento para continuar Operación.

En paralelo documental, seguridad/DB debe revisar `principal-a/DISENO.md` y delimitar
una propuesta compatible que resuelva PUBLIC. El diseño A completado en e611d27
no autoriza cambios de ACL ni selección automática de B. No repetir el diagnóstico
ni bloquear integraciones independientes por esta revisión pendiente.

## 7. Dependencias y compatibilidad

| Dependencia | Estado vigente / límite |
|---|---|
| [#168 Mecanizado parcial](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/pull/168) | GitHub observado: FUSIONADO, cabeza `0274466`. No acredita SQL aplicado. Mantener identidad/partes/entregas; no equiparar P1 con UUID de asignación LP |
| [#174 Picking/Recepción](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/pull/174) | GitHub observado: OPEN/DRAFT, cabeza `8c54b93`. Compatibilidad de pendientes/auditoría/recepción; no asumir instalador aplicado ni editar su worktree desde LP |
| Supabase | Backend principal. Catálogo conservado muestra esquema LP ausente y bloqueo PUBLIC; 01–06 son propuestas, no actualizaciones productivas ejecutadas |
| PDT | Reutilizar contratos LEGACY/V2/V4 vigentes y cobertura acreditada; resúmenes/estados no prueban disponibilidad neta de ventanas. Propuestas históricas #117–132/B2 no se presuponen instaladas ni se fusionan por dependencia nominal |
| Export | Único escritor del saldo oficial. Presupuesto LP local conservador no sustituye saldo; inclusión/corte debe acreditarse antes de conciliar otra carga |
| Power BI | XLSX cierre por etapa independiente; nunca altera saldo Export. Mantener adaptador v1 intacto salvo necesidad demostrada; runtime/SQL pendientes de autorización |
| Vidrio/Dashboard/Reportes | Conservar modal/ubicaciones/navegación y reportes existentes; completar fuentes/desglose e histórico después de flujos críticos, sin KPI fabricado |

## 8. Pruebas y CI

Encargo4: **4 recorridos completos PASS** (2 etapas × fixtures anonimizadas /
originales locales), handler y SQL08 reales en PostgreSQL17.11 sin red. Por recorrido:
2 cierres normales y2 SIN ACTIVIDAD versionados, roles/revisión/revocación, original
idéntico y auditoría idempotente, siguiente turno y cobertura incompleta denegada.
[Fixtures](../../tests/lp01-cierres-integrados/evidence/fixtures.json) /
[originales, solo hashes y recuentos](../../tests/lp01-cierres-integrados/evidence/originals.json).
**16 regresiones directas PASS**. Aplicación, adaptador y SQL01–08/08R comparados
con9dce260 sin modificaciones. PC/móvil previo reutilizado al no cambiar UI.
CI de9dce260 observado4/4PASS; CI nueva pendiente de consulta tras push, no atribuida.


Encargo3C: **12 unitarias nuevas PASS,7 grupos privacidad CLI PASS,23 regresiones
directas PASS y artefacto privado previo PASS**. [Evidencia pública solo sintética](../../tests/lp01-ambitos-import/evidence/).
**4 grupos PostgreSQL17.11 PASS**: cinco escenarios de cobertura comparados con el
guard SQL08 en los cuatro ámbitos y flujo funcional integral descrito arriba con
sesiones/RPC reales, sin stubs de autorización/horario/cierre/cantidades. No se
aplica salida del importador: los ámbitos son fixtures independientes del harness.
Demo:1 alta,2 cambios,2 vencimientos,1 revocación,6 sin cambios; categorías solapadas,
apply=false. SQL01–08/08R comparados byte a byte con a3a0955, sin modificaciones.
Sin UI nueva: PC/móvil previo reutilizado. CI del nuevo HEAD pendiente de consulta,
no se atribuyen resultados de CI previa ni funcionamiento productivo.


Encargo3B: **9 grupos SQL PASS**, PostgreSQL17.11 sin red, RPC/locks/constraints
reales con cuentas/scopes exclusivamente sintéticos. Instalación y recuperación,
ACL/RLS conservados, cuatro ámbitos, límites temporales, nocturno domingo,
cobertura individual, revocación concurrente, expiración antes de COMMIT,
idempotencia y cierre/reapertura/arrastre. [Evidencia con SHA256 SQL](../../tests/lp01-ambitos-temporales/evidence/postgres.json).
**15 regresiones JS PASS + artefacto privado PASS**. SQL06/07 y adaptador originales
intactos; autorización de fachadas XLSX cubierta por rechazo real de función06.
Sin cambios UI: evidencia PC/móvil anterior reutilizada. CI nueva queda pendiente
de consulta tras push; no se atribuye CI previa al nuevo HEAD.


Encargo3A:9 unitarias nuevas PASS, prueba de artefacto privado PASS (0700/0600 y
sin datos/rutas en logs), 7 grupos SQL con RPC reales en PostgreSQL17.11 aislado
PASS y6 regresiones directas del lector/revisor PASS. [Evidencia pública solo
sintética](../../tests/lp01-ambitos/evidence/). No son cuentas/ámbitos de planta.
CSV-QA suministra evidencia del cierre de prueba, no certifica formato BI nuevo.
Sin cambios UI, PC/móvil válido reutilizado; sin pruebas generales manuales. CI del
HEAD se consulta en #183, no se atribuye CI previa a esta entrega.


Encargo2B/avance3:6 unitarias nuevas +8 regresiones directas del planificador PASS;
lector JavaScript/SQL sobre PG17.11 aislado PASS: snapshot coherente ante carga
concurrente, segunda lectura rechaza corte antiguo, sin mutaciones del lector.
[Evidencia y límites de fixtures](../../tests/lp01-export-reader/evidence/).
Unitarias de transporte no se confunden con la prueba transaccional real. No se
certifica un manifiesto ni escritor productivo: el escritor concurrente es sintético.
Sin UI nueva/endpoint, PC/móvil previo reutilizado. CI nueva se consulta en #183;
no se repiten pruebas generales manuales ni se atribuye CI previa al código nuevo.


Encargos1B/2:8 pruebas unitarias sintéticas aprobadas y3 casos SQL de la función
real capturada de cobertura manual en PG17.11 aislado: parcial6/10, completa10/10,
anulada. [Evidencias](../../tests/lp01-origen/evidence/). No se certifican emisor,
caso productivo ni manifiesto Export real. Sin cambios UI, se reutiliza PC/móvil;
no se repiten pruebas generales válidas. CI nueva se consulta en #183. SQL01–07 y
contratos fuente intactos; sin nuevas funciones DB/grants ni escrituras productivas.


Entrega bb6de31: **8 grupos SQL nuevos aprobados** en PostgreSQL17.11 aislado,
[evidencia](../../tests/lp01-liberaciones/evidence/postgres.json). Se ejecutan el
LIBERAR y la auditoría reales: pending sin crédito, reparto4+3 neto7, raíces,
concurrencia/reintentos, solapamientos, anulaciones, etapas y permisos privados.
La entrega física del recibo es fixture: no se certifica el emisor PDT real.
Sin cambios UI/entrada pública, no corresponde repetir PC/móvil; se reutiliza su
evidencia válida. Workflow añade solo el test nuevo; CI nueva se consulta en #183.


**Entrega técnica 74f068f verificada localmente:** siete pruebas nuevas de fuentes;
24 regresiones afectadas (Operación6, Seguimiento7, continuidad2, Power BI9);
cinco comprobaciones de lectura SQL, 15 regresiones SQL afectadas del motor LP
y recorrido real PC1440/móvil390. Evidencia
en [tests/lp01-fuentes](../../tests/lp01-fuentes/README.md). Paquete verify:release,
sintaxis, huellas de funciones capturadas, integridad de fuentes protegidas y diff
aprobados. No se repitieron manualmente las 111 previas. Se conservan sus evidencias
y las del diseño A, sin atribuirles integración productiva.

**CI de referencia fd07cb3: 4/4 aprobada**, consultada en GitHub:
[diseño A](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/41565187523),
[SQL/PC/móvil LP](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/41565187439),
[general](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/41565187440),
[sintaxis](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/41565187498).
CI de la entrega nueva se consulta en el PR tras subir estos commits; no atribuir
los resultados anteriores al código nuevo. El workflow existente incluye las
pruebas nuevas, sin jobs operativos ni secretos añadidos.

Los tests nuevos usan funciones capturadas reales y fuentes sintéticas. La vista
upstream de reservas es fixture: no certifica su SQL productivo. El SQL real
reproduce la mezcla histórica PDT por nombre y el rechazo de sesión caducada;
no hay stubs de esos comportamientos. LOGIN local/CSV-QA previos tampoco prueban
Supabase/TLS/XLSX real fuera de su alcance. Catálogo nuevo: SELECT de definiciones,
sin filas productivas ni invocación RPC. La CI no acredita operación en planta.

## 9. Riesgos y autorizaciones pendientes

Riesgos activos: permisos heredados PUBLIC; suplantación si se sustituyera identidad
por token humano; duplicación si se infiriera inclusión Export/liberación PDT;
asignación ambigua de SALE; confundir CI o SQL propuesto con producción aplicada.

Requieren autorización **posterior y separada**: modificación de ACL/default ACL;
creación de propietario/LOGIN/roles y grants; registro de ámbitos reales;
generación/rotación de credenciales/secretos; prueba real de autenticación;
instalación SQL y respaldo/recuperación productivos; activación de escrituras/jobs;
fusión, publicación o despliegue Firebase/Edge/worker. Lista y recuperación completa
en [diseño A](principal-a/DISENO.md#operaciones-posteriores-que-requieren-autorización-expresa)
y [plan de instalación](INSTALACION_Y_RECUPERACION.md). No existe autorización por
implicación de este protocolo; no crear copias de bases ni activar turnos.

## 10. Trabajos aplazados expresamente y antecedentes

- Tabla/Kanban al final; no rehacer Calendario ni crear nuevas divisiones.
- Automatización productiva y alternativa B hasta resolver seguridad/decisión.
- Repartos sin regla aprobada, festivos/overrides sin fuente y conciliaciones de
  cadenas sin contrato; no bloquean los casos inequívocos ya implementados.
- Dashboard histórico/por sistema, consolidado integral de etapas, PDF/imagen,
  complementos Vidrio y configuración B27 después de operaciones críticas.
- Formulario definitivo NC Vidrio B17 sin aprobación; no dar por aprobados los
  bocetos pendientes/superados. GOOGLE y LAC fuera del alcance.

Antecedentes, no fuentes paralelas de estado vigente:
[alcance inicial y continuidad](../SGP_LP01_SEGUIMIENTO_OPERACION.md),
[diagnóstico histórico de bloqueos](CIERRE_BLOQUEOS_PRODUCTIVOS.md),
[checkpoint histórico del repositorio](../../SGP_ONE_CHECKPOINT.md).
Si sus peticiones antiguas contradicen avances de este documento, usar la evidencia
más reciente y actualizar este estado; no repetir trabajo ni solicitar otra vez
reglas/archivos ya aprobados o recibidos.


## 9. Continuidad ejecutiva — decisión funcional y publicación (2026-11-03)

**Solicitud vigente del responsable funcional:** «corrijamos y publiquemos». Existe autorización expresa en la conversación para corregir y publicar Línea de Producción, **sujeta a controles de seguridad, respaldo, recuperación, CI y verificaciones reales**. Esta autorización no equivale a que una migración ya esté aprobada técnicamente ni a que el sistema esté publicado. El estado real prevalece sobre esta nota y debe verificarse al iniciar cada nuevo chat.

**Objetivo integral, no parcial:** Línea de Producción = **Seguimiento + Ensamble + Empaque**. No reducir el alcance a las dos últimas ventanas. El usuario necesita ver y utilizar las tres, en PC y móvil, cuanto antes. No sustituir el objetivo por otra ronda de bocetos o un rediseño. Reutilizar lo ya implementado en el Draft PR #183 y las pruebas válidas; demostrar un resultado real pronto.

**Regla funcional de acceso:** reutilizar **Gestión de Roles y Gestión de Usuarios existentes**, sin crear administración paralela. Supervisor Ensamble: acceso operativo a Ensamble, sin acceso a Empaque. Supervisor Empaque: acceso operativo a Empaque, sin acceso a Ensamble. Líder de Línea: acceso operativo a ambas etapas. Seguimiento, Coordinador, Administrador y Consulta conservan la matriz de accesos autorizada, que debe contrastarse con el código; no inferir permisos adicionales de esta nota. Ocultar menús/botones **no** reemplaza autorización de servidor: denegar también acceso directo a ruta/RPC, y respetar intersección rol + accesos individuales, revocaciones y auditoría. Cierre individual autorizado para su etapa, en ambos turnos, sin PRIMARY/BACKUP obligatorio; piloto PANELES_2, no FRAMES_2.

**Bloqueos técnicos confirmados antes de esta nota:**

- Draft PR #183, rama `feat/lp01-seguimiento-operacion`, HEAD observado `601efbd683a2415a20af004a4735a5eca81f721c`, no fusionado, conflicto `styles.css` frente a `main` (`4b1e98e37fdd9f615266c963088c8d1313b51266`). Conservar estilos del modal Usuarios y la corrección móvil de Programación; sincronizar rama y obtener CI del HEAD resultante.
- En Supabase, `public.sgp_rol_accesos` y `public.sgp_usuario_accesos` tienen RLS deshabilitada y DML directo concedido a `anon`/`authenticated`. La prueba aislada reprodujo bypass de revocación; **no** ejecutar SQL10 mientras esta condición exista. El preflight de SQL10 ya aborta de manera segura. Proteger la autoridad de accesos mediante cambio mínimo compatible con RPC de administración existentes, después de comprobar consumidores, dependencias, respaldo y reversión. No limitarse a visibilidad frontend; no desactivar RLS ni ampliar privilegios.
- SQL10 reemplaza SQL09 (no instalar 09); esquema LP y escrituras productivas no acreditados como instalados; activación y apertura automática no deben inferirse de fixtures. Las brechas de PDT/Export y de apertura automática siguen documentadas en sus apartados; **no bloquear por ellas una demostración independiente y segura** de Seguimiento/Ensamble/Empaque cuando no dependa de esas funciones.

**Secuencia mínima para finalizar:** (1) resolver conflicto y ejecutar CI dirigida; (2) corregir seguridad de catálogos con pruebas de Gestión de Roles/Usuarios, permisos cruzados y revocación; (3) verificar preflight, respaldo/recuperación y migraciones necesarias para el alcance efectivamente publicable; (4) publicar por el flujo protegido existente; (5) comprobar Seguimiento, Ensamble y Empaque con usuario autorizado en PC y móvil, y confirmar qué acciones persisten realmente. No afirmar operativo completo si solo hay consulta o demo. Si una integración externa no esencial impide una función, publicar únicamente un alcance explícito y seguro **previa decisión funcional**, sin presentar modo consulta como sustituto silencioso del módulo operativo.

**Directriz de trabajo del usuario:** elegir siempre la vía más sencilla y rápida que sea segura; plantear de inmediato una decisión concreta cuando desbloquee el trabajo. Evitar auditorías generales, arquitectura adicional, reabrir decisiones aprobadas, pruebas repetidas y conversaciones largas de Codex. Un único encargo técnico acotado al PR #183, con evidencia y parada ante bloqueo real. Mantener SGP_ONE_GOOGLE y LAC separados.

**Estado al registrar esta decisión:** DOCUMENTACIÓN ACTUALIZADA; IMPLEMENTADO EN RAMA / VERIFICADO EN AISLAMIENTO; **NO FUSIONADO / NO APLICADO / NO PUBLICADO / NO VERIFICADO EN PLANTA**. Esta actualización documental no modifica SQL, permisos, usuarios, producción ni Firebase.

## Hoja Ensamble B12/B13: trabajo local del 7 de noviembre de 2026

**Estado: IMPLEMENTACIÓN LOCAL Y PRUEBAS AISLADAS. No fusionado, aplicado ni publicado.**
Base real `75b05b842f866163cd6fea6b54dc21e66eba0ade` / LAB v403. La entrega
Observación compacta v404 se mantiene separada y debe integrarse primero. No sustituir
esta base por los antecedentes históricos de SQL10/PR183 citados arriba.

- B13: una fila por producción autorizada, abiertas por saldo Export parcial,
  programadas sin iniciar, otras y completadas en historial. No suma SALE ni
  ejecución manual entre asignaciones. PC usa tabla y móvil las mismas filas como
  tarjetas. Semana original, sistema y reserva conservados.
- B12: detalle por producción con Disponible existente, afectaciones y observación
  compartidas; reutiliza los transportes y permisos vigentes. No crea registro de
  producción manual ni abre turno al consultar. B16 reutiliza las pestañas y los
  pendientes ya existentes; no se declara un formulario Picking nuevo terminado.
- Realizado: solo `power_bi` del cierre confirmado vigente, con vínculo de archivo,
  versión, etapa y período. Reabrir deja el valor pendiente. No infiere una cantidad
  por diferencia de saldos y no convierte ausencia en cero.
- B15: resumen por sistema y acceso a informes confirmados. El nuevo cierre está
  contenido porque el backend vigente usa ejecución manual por UUID de asignación.
  No se habilita el cierre nuevo ni se afirma terminado el arrastre por producción.
- Catálogo/horario: propuesta aditiva de la RPC de lectura existente, con controles
  de sesión/ámbito originales y rollback por huella. Sin GRANT, roles, RLS ni jobs.
  Véase [paquete exacto](../sql-proposals/lp01-hoja/README.md).

Pendientes que impiden declarar operativo integral: ejecutor automático autorizado,
comando INCORPORAR del líder con motivo y cierre/continuidad por producción. La
publicación pública requiere la confirmación solicitada por separado; ninguna ruta
alternativa de subida se ejecutó. No publicar silenciosamente un alcance reducido.
La prueba de navegador no pudo iniciarse por restricción de socket del entorno.
Las pruebas DOM sintéticas no sustituyen QA visual ni operación en planta.

Evidencia y alcance de esta preparación: [checkpoint](ENSAMBLE_NOV7_CHECKPOINT.md).

Ampliación local de la misma noche: INCORPORAR ya está implementado como propuesta
contenida (bandera false y descubrimiento explícito), con modal frontend y siete
grupos SQL aislados aprobados. Sigue pendiente activación autorizada y prueba
concurrente PG17. B15 incorpora revisión local del XLSX sin guardarlo, informes de
cierres confirmados por sistema y descargas PDF/imagen con vendor existente. La
referencia de cierre V2 tiene 22 pruebas y modelo SQL aislado, pero no RPC/adaptador
productivo conectado. Suite integrada UI/reportes: 728/728 PASS. No modifica el
estado NO PUBLICADO/NO APLICADO ni acredita QA visual o uso en planta.

### Integración Export v406 / hoja v405

Preparado `docs/sql-proposals/export-approval/03_lp_hoja_REVIEW.sql` contra
MD5 instalado `2e4eeacbfc331f2c6dcde32ee96701d7`. Proyección de excluida_export
 y filtro simultáneo de órdenes/catálogo activos. Historial, reportes, horarios y
 permisos intactos. Prueba local PGlite de compilación, predicados y conservación
 PASS; endpoint productivo no ejecutado. Instalar 01/02/03 conjuntamente después
 de integrar v405, no aplicar aislado. Sin SQL productivo ni publicación.

## 2026-11-07 — Candidato v408 hoja/vidrio (no publicado)
Diseño aprobado implementado en rama `feat/hoja-vidrio-acordeon`: Semana primero, Reserva/Prioridad (parte real), orden por reserva/parte y vidrio con OVES/Tipo V + acordeón cantidad/dimensiones/Marca. SQL aditivo preparado con guard, no aplicado. 43 tests focales PASS. Continuidad: `docs/linea-produccion/hoja-vidrio-v408/README.md`. Depende de integración v407 bloqueada en subida específica; no se reintentó ni evitó el control.

## 2026-11-08 — Hoja: filtros y ordenación v409 (en rama)
Base main 5246771 / v408 publicada y aceptada visualmente por Johan. Filtros por
Semana, Producción, Reserva, Prioridad (parte), Sistema, Saldo Export y Realizado:
menú del encabezado como Seguimiento, ascendente/descendente, búsqueda de valores,
selección múltiple, aplicar/cancelar y limpiar. Mantiene grupos Abiertas/Programadas/
Otras/Historial y orden por reserva/parte al limpiar. En móvil, mismos encabezados
accesibles sobre tarjetas. Disponible, afectaciones y notas conservan sus editores;
no se filtran datos aún no consultados. Sin SQL, permisos ni automatismos nuevos.
44 pruebas focales y DOM existentes PASS. Chromium local bloqueado por socket del
contenedor; recorrido PC/móvil incorporado al workflow UI existente, pendiente CI.
No fusionado ni publicado. Siguiente: CI del commit, revisión de artefacto y
publicación por controles vigentes. Baseline v408 y 16 pins conservados.

## 2026-11-08 — Turno por horario e Incorporar v410 (en desarrollo)
Base main9708cab / v409 publicada.
Nuevo flujo autenticado calcula período con horario servidor y materializa solo
cabecera actual vacía; no autocierra anterior, copia raíces ni infiere arrastre.
No es job: sin usuario no genera filas. Repite petición sin duplicar turno/auditoría.
En hoja se sigue horario actual, salvo selección histórica o borrador pendiente.
INCORPORAR se rebasa al lector v408 con prioridad/reserva y exclusiones intactas.
Escritor idéntico al acreditado PG17 run42421811138; ocho grupos focales sobre
lector actual PASS. Apertura ocho grupos SQL sintéticos PASS, concurrencia nueva
pendiente. Frontend contratos fail-closed y controlador DOM PASS.
No SQL aplicado, no activación, no publicación todavía. No confundir el cierre
Export4 preparado con operativo: faltan integración plan, UI/servicio y primera
referencia para conciliación; ausentes del archivo parcial nunca se vuelven cero.
Siguiente: prueba concurrente acotada, instalación conjunta+readback, activación
autorizada, CI/artefacto y publicación protegida. No repetir auditorías generales.

### 2026-11-08 — Hoja de Empaque v411
Tabla y detalle compartidos con Ensamble, filtros y ordenación, saldo propio,
Abiertas/Programadas/Otras, observaciones y afectaciones. Sin vista de ubicaciones
ni detalle de vidrio. No copia objetivos del plan común sin etapa. Planificación
nueva, incorporación y cierre por Export de Empaque siguen pendientes de conexión.
Alcance: `docs/linea-produccion/EMPAQUE_V411.md`.

## Siguiente entrega: cierre Export dual · integración local

Rama `feat/export-close-v412`, base main8cb2293. UI conectada al controlador CAS:
original XLSX, importación con autoridad explícita, recibo por producción, motivos,
confirmación y reintento del mismo comando. Discovery `LP-EXPORT-DUAL-1` requerido;
sin él conserva la revisión local. Carga parcial nunca inventa cero ni suma lotes.
Gateway opt-in por `SGP_LP_EXPORT_MODE=LP-EXPORT-DUAL-1`, default LEGACY. Sin aplicar,
desplegar ni activar. Lectura Empaque admite solo writer dual y plan propio inmutable;
no hereda objetivos Ensamble. Informe/CSV conservan corte inicial desconocido y
continuidad bloqueada. Callback inclusión Empaque depende de commit compañero d59b178.
Pruebas focales de lectores, reportes, comandos y gate: PASS; DOM sintético cierre y
controlador Empaque PASS. Falta paquete SQL dual rebasado y fixture de readback real,
prueba conjunta backend/UI, pins y versión integrados por coordinador. No publicar
este tramo aislado. Manifest/guard gateway antiguo necesita actualización explícita
junto al nuevo backend, no relajación del pin.

## 2026-11-08 — Corrección Empaque v414 (candidato, no publicado)
Saldo Empaque explícito en tabla/tarjetas/filtro. Estado Ensamble antes del saldo:
Ensamblada verde para cero, Abierta(saldo) estrictamente parcial, Sin iniciar para
saldo=cantidad, Por validar para fuente inválida. Sin cambiar saldos ni órdenes.
Empaque filtra evidencia compartida por origin_stage/etapa y PDT por origen/vínculo
explícito, en transportes (detalle/selector/historial) y resumen. No deriva Tecno de
Export global en Empaque. Afectaciones propias y observaciones globales conservadas;
revisión CAS original intacta. Sin SQL ni permisos. 60 pruebas focales PASS; pendiente
CI/publicación por flujo existente. No se declara cambio aplicado hasta esa entrega.

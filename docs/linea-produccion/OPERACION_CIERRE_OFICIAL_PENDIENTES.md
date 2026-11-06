# Hojas y cierre oficial · entrega parcial para coordinación · 06/11/2026

Base vigente tras rebase: `a068e14083bb92db6e72c71934d8cf240ef345ff`
(main Picking v396), comprobada por fetch. Base inicial histórica: d45c5ed/v394. Rama aislada `feat/lp01-operation-official-close`; checkout original
`/workspace/SGP-ONE-LAB` conservado (rama work, dependencias sin seguimiento).
PR207/Picking v396 publicado se preserva íntegro. La reserva anterior v396
para LP queda retirada; versión futura pendiente de coordinación, no reutilizar
v396 como entrega nueva. Metadatos del checkout conservan temporalmente la
baseline publicada. Sin publicación ni cambio de HOLD/pins/política. No integrar
como bloque terminado.

## Implementado y verificable en esta rama

- Clasificador `operationProcessState`: por etapa, abierta solo con
  `0 < saldo Export < cantidad`; cero va a completadas, falta/incompatibilidad
  a revisión. Empaque parcial no depende de que Ensamble termine. La lista
  agrupada existente de Ensamble consume el cambio y ordena por semana original;
  no duplicación por asignaciones. Afectaciones y ejecución manual no deciden estado.
- Extensión opt-in V2 del **mismo** lector XLSX `powerbi/adapter.js`.
  `parsePowerBI(bytes,{stage,...})` guarda la etapa elegida explícitamente;
  reconoce variantes de espacios/capitalización de encabezados autorizados.
  Conserva validaciones ZIP/XML, total, filtros y hash. V1/handler/SQL06 activos
  permanecen con sus contratos anteriores: no reciben documentos V2.
- `powerbi/official-reconciliation.js`: producción + proyecto + sistema + línea
  exactos; ambigüedades pendientes, sin reparto ni suma de dimensiones dudosas.
  Horario del archivo contrastado con target configurado y zona explícita;
  falta de target bloquea sin inventar horas. Año/semana nunca son fecha de trabajo.
- `lp01-official-close.js`: transición pura con revisión/idempotencia, un total
  por orden/etapa/línea/día/turno; archivos parciales conservan ausentes;
  corrección reemplaza y registra delta. Cierres versionados guardan el plan
  vigente **al cerrar**, no solo el de la importación. Cobertura ausente es null.
  Pendientes se conservan hasta conciliación; JSON serializable conserva historial.
- Proyección de Disponible desde última definición/base acreditada; cargas
  históricas no descuentan otra vez, corrección inferior revierte consumo nuevo.
  Una definición intraturno sin base cuantitativa devuelve `PENDING_BASE`:
  estos resúmenes no acreditan hora/operario individual. No modifica saldos ni
  acumulados del Export semanal y nunca suma etapas como ventanas terminadas.
- Confirmación posterior de Johan aplicada: `Cant. Procesada` está en ventanas
  también para `PIEZA DE ALUMINIO CUERPOS`. No afecta unidades de PDT.

**Límite preciso:** el contrato de cierre es dominio puro probado; no es una RPC,
ni un almacén durable, ni una activación. Actor, catálogo, plan, horario y base
deben provenir del servidor autenticado. No se aceptarán del navegador como
autoridad. Serializar/recargar en pruebas no acredita persistencia en Supabase.

## Bloqueos y trabajo no terminado

1. Referencias: Library resolvió la guía `libfile_8eb9eaa8a3388191b3ce358f9a22661a`
   y ambos XLSX nuevos (`libfile_89b06c66ccb481918c749603e182b2c4`,
   `libfile_8c7e5b57516c81919e6e69defabc5a9b`). Materialización con helper vigente
   y un reintento local acotado falló con `download failed` en los tres.
   `/workspace/operation-references` quedó vacío. No píxeles originales inspeccionados,
   no comparación B12/B13/B14, no nuevos layouts. No se usó otro executor ni URL
   inventada. Los tests usan fixtures históricos/sintéticos del repo, **no** validan
   aún los archivos del 03/11 (19/86 y17/97).
2. Persistencia **por implementar**: SQL06 resuelve actualmente solo por producción
   y exige todas las asignaciones. No satisface identidad triple/carga parcial.
   El handler y el botón actual siguen V1 y el campo manual sigue visible: no
   presentar este PR como recorrido PDA completo. Adaptar el mismo handler/RPC
   con selección explícita del contrato revisado, guardas transaccionales,
   sesión/rol/ámbito, CAS y auditoría, sin otro importador.
3. Disponible activo tiene contrato `LP-ORDER-SALE-1`, `operational:false`,
   `temporalPolicy:UNRESOLVED` (ver `services/lp01-order-sale.js`). El nuevo cálculo
   no se conecta a ese servicio. Falta persistir base por definición y evidencia
   del período intraturno antes de habilitar descuento automático. No inventar
   un timbre para resolver esa brecha; pendiente decisión de base acreditada.
4. Apertura automática: `lp01-opening-preparation.js` devuelve
   `PREPARATION_ONLY`, `automaticExecutionEnabled:false`; no existe activación
   acreditada del ejecutor técnico. El target del servidor usa configuración
   `HORARIOS_TURNOS_GLOBAL_VIGENTE`/America/Bogota. Se preserva la preparación y
   su bloqueo de identidad técnica; no se inventa horario, job ni credencial.
5. Otras/incorporación con motivo, plan inicial e historial: pendiente conectar
   lector autorizado de catálogo y operación existente de planificación. La RPC
   global de Seguimiento restringe a coordinador/admin; no se reutiliza para líderes
   ampliando permisos. `operationProcessState(...,{scheduled:false})` solo
   clasifica; no significa incorporación implementada. Tabla B13/B14, adaptación
   B12 final, eliminación del avance manual e integración Empaque aún pendientes.
6. Pestañas/notas/NC: consumidor compartido existente conservado. Ninguna edición
   a tracking-affectations, affectation-tabs, affectations-panel, order-note,
   NC/Accesorios ni a la optimización de sesión separada.

## Verificación y próximo paso

29 pruebas dirigidas PASS; batería Node completa **535/535 PASS**, release v396
PASS, diff sin errores. Chromium local con el renderer existente a1440/390 y
50/200/500 órdenes: sin desborde, máximo175.3ms. Es comprobación del DOM existente,
no aceptación visual contra originales ni prueba productiva. Resultados en
`tests/lp01-b12-b13/dom-performance-result.json`; contrato en
`tests/lp01-official-close.test.mjs`. CI remota se consulta sobre SHA exacto del PR.

Siguiente paso concreto: desbloquear los bytes originales en este executor y
completar la adaptación transaccional del cierre existente antes de retirar
el ingreso manual en UI. Para activar backend, preparar en esa entrega SQL
revisable, dependencias, ACL antes/después, hashes y recuperación no destructiva;
**este PR no contiene un instalador listo ni solicita aprobación de activación**.
No repetir auditoría general de Export o grants. No fusionar ni publicar.

## Incremento local tras coordinación del componente compartido

Se leyó el contrato de `feat/seguimiento-glass-nc-link` en
`37b5f6e53b20209e2d11ed9312a5daf13e38c1e9`, sin copiar su implementación.
El contenedor existente de afectaciones del detalle de ambas etapas consume
ahora `mountTrackingAffectations` mediante un adaptador de ámbito:
`mountOperationOrderContext`. Target null, key canónica y scope.stage; el
componente compartido decide capacidades y requisitos de registro. La hoja
no recorta capacidades por estado del turno. Al abrir ese panel deshabilita
los controles antiguos de afectaciones/nota para evitar dos escritores activos.
No se reescribe ninguna pestaña ni transporte compartido. Su backend nuevo y
sus vistas siguen en el hilo dueño; este cambio no acredita su activación.

Pruebas dirigidas del incremento: 3 nuevas (ambas etapas, sesión/selección/host
obsoletos) y8 de listas PASS; sintaxis/diff PASS. Se reutilizan las535 anteriores
para código intacto; no se atribuyen al SHA nuevo ni se repite CI completa.

Ruta PDF directa proporcionada por coordinación: Library
`libfile_2f0d0baa08f481919c5a2e27786f5d96`, páginas16–18. La lectura devolvió
notas B12/B13/B14 y solo `image_asset_pointer`, sin ImageContent ni bytes de
imagen visibles. No es inspección de píxeles. No se materializó el PDF completo,
ni se repitió HTML, ni se reconstruyeron URLs. Continúa la limitación visual.

PR propio: creación denegada por revisión automática tras push confirmado de
`d5fa54b`. Motivo: autorización de implementación no acredita permiso específico
para abrir PR/compartir contenido. Se consultó historial; sin evidencia nueva
suficiente, no se reintentó ni se cambió de herramienta. PR del otro bloque
igualmente fuera de alcance. Este incremento se conserva **solo local** para
coordinación; ninguna publicación. CI del candidato completo sigue pendiente.

## Persistencia añadida en aislamiento, posterior a26fc8fdd

La brecha de almacenamiento del apartado2 ya tiene servicio y RPC propuestos,
probados en PostgreSQL17.11 aislado. Ver
[paquete de persistencia](../sql-proposals/lp01-official-close/README.md).
El mismo handler Power BI tiene opt-in V2 deshabilitado por defecto. Se guardan
originales y recibos, se recarga estado, se reemplazan correcciones parciales y
se conservan cierres anteriores. Concurrencia real a una revisión: solo uno
confirma. No se conectó el cambio de estado del turno nativo ni Disponible activo,
ni se retiró el campo manual de UI. Sigue siendo una entrega parcial sin
activación, producción, push nuevo o PR. 7 escenarios PG nuevos y5 HTTP PASS;
se reutiliza evidencia previa intacta, CI completa única pendiente de congelación.
sharedOrderSummary pendiente de ruta/contrato exactos del dueño; sin duplicación.

## Rebase sobre Picking publicado · 06/11/2026

Main exacto `a068e14083bb92db6e72c71934d8cf240ef345ff`. Commits conservados:
`d5fa54b → 3f5feb0`, `26fc8fdd → d594b14`, `e7ddbf0 → 8760a4b`.
Respaldo local `backup/lp01-official-close-before-a068e14` apunta a e7ddbf0.
Solo conflicto de index.html (título/cache de release), resuelto con main íntegro.
index.html, build-release-info, app.js, styles.css, módulos/SQL/evidencia Picking
y política no tienen diff contra main. LP, contrato SQL nuevo y sus pruebas
coinciden byte por byte con el incremento previo; se reutilizan las pruebas
válidas, sin nueva batería SQL/Node/Picking. verify:release y diff-check PASS.
Ese verify conserva la versión de baseline396; no acredita una nueva entrega396.

Sin push/PR ni ejecución productiva. Archivos completos exactos del resumen
compartido siguen pendientes de entrega por coordinación; no imports rotos,
lectura de worktree ajeno ni recreación del helper. Próximo: incorporar esos
archivos y probar únicamente integración de resumen, indisponibilidad/legado y
revocación; reservar CI completa y versión nueva para candidato final.

### Incremento local: transporte oficial y resumen compartido (2026-11-06)
- Base conservada: main `a068e14083bb92db6e72c71934d8cf240ef345ff`, v396 Picking. Sin cambios de publicación, SQL instalado ni permisos.
- Cliente `submitOfficialClose` utiliza el mismo gateway Power BI con adaptador explícito V2; valida recibo, UUID y revisión. Respuestas perdidas/incompatibles quedan inciertas para reintentar el mismo comando. Aún no conectado al formulario de cierre ni habilitado en servidor.
- Ambas hojas consultan el resumen compartido por identidad y etapa, incluyendo reportes del otro líder. Seguimiento usa la misma composición. Servicio ausente conserva lectura heredada identificada; revocación limpia vista; datos inválidos no se convierten en cero.
- Copias exactas propiedad de Seguimiento, entregadas por coordinador desde c4b2dad/95e61e1: `src/domain/lp01-shared-order-summary.js` SHA256 `1e42b6e0d1d053485e26e86824444116adc2b618a3388a8d94422b3aeeb06320`; `src/services/lp01-shared-order.js` SHA256 `d80119996812c8fdaa39d70f31d13f0169aac42abd34894449c`. Ambas cotejadas. Al integrar ramas conservar una sola copia del proveedor, sin duplicar su commit ni mantener variantes.
- Evidencia dirigida: 6 pruebas de composición (Ensamble/Empaque, compartido/legacy/revocación/identidad); 4 del cliente oficial; 5 del transporte previo afectado por extracción. PASS. Comprobación sintáctica y diff --check PASS. Sin repetir batería general ni las 11 pruebas anteriores.
- Sigue pendiente: instalación autorizada del contrato oficial y su conexión con cierre nativo, formulario/importación/historial visible y Disponible persistente; apertura automática con configuración real e incorporación de Otras; terminar tabla compacta original y comparación PC/móvil contra píxeles B12/B13/B14 aún no accesibles. El resumen no constituye aceptación visual ni verificación productiva.
- PR continúa denegado por revisión automática por falta de autorización específica para publicación externa. Sin reintento, push nuevo ni CI general; se reserva CI única para candidato completo.

### Conexión local de pantallas (2026-11-06, siguiente incremento)
- Ambas hojas ahora consumen el mismo renderer de tabla compacta por clasificación Export. Completadas queda en desplegable de historial; lista izquierda/detalle derecho también en Empaque. Sin comparación de píxeles originales: se siguió especificación autorizada.
- El panel de cierre usa READ/IMPORT/CLOSE en el mismo endpoint. READ reutiliza contexto autenticado, no escribe ni devuelve firmas de recibos. Carga XLSX original, guarda, recarga cantidades y cierres con plan/diferencia. Conserva payload/UUID incierto entre remontajes del detalle y separa sesión/etapa/línea/fecha/turno. No equivale a activación ni cierre nativo.
- Realizado manual oculto/deshabilitado, submit manual anulado; detalle compartido abre directamente. No se crean afectaciones alternativas. Control manual de apertura oculto; se muestra estado real de preparación automática, sin horarios de relleno.
- Disponible permanece `Por validar`: contrato actual `LP-ORDER-SALE-1` declara `operational:false` y `temporalPolicy:UNRESOLVED`; no acredita baselines intraturno. Panel admite proyección con definición acreditada, pero no fabrica esa definición desde SALE. Falta persistir base/estado/evidencia y conectarlos.
- Otras sigue pendiente: `sgp_linea_plan_programar` existente recibe producción/fecha/turno/cantidad/prioridad, no motivo ni UUID idempotente ni contexto de proceso. No se invoca como sustituto de una incorporación autorizada del líder. Falta contrato transaccional que conserve plan inicial y motivo, permisos existentes y resultado recuperable; no se añadieron grants.
- Apertura automática pendiente del ejecutor técnico descrito por `LP-AUTO-OPEN-PREP-1`, incluido anclaje inicial, cierre anterior y horario de servidor; no se simuló apertura desde el navegador.
- Cierre nativo continúa pendiente: el diario oficial no cambia `sgp_lp_operacion.turnos`. READ actual comparte las restricciones del contexto de escritura (requiere contrato habilitado y turno nativo no cerrado); debe separarse consulta histórica de admisión de escritura antes de producción para consultar períodos nativos cerrados. Esta limitación no se presenta como historial productivo completo.
- Pruebas dirigidas nuevas/código alterado: 14 PASS (3 controlador/READ, 3 ruta, 8 listas). Chromium panel PC1440/móvil390: carga/guardar cierre/recarga con fixture sintética, sin pageerror. Renderer actualizado: 50/200/500 órdenes sin desbordamiento exterior; máximo237.4ms. Evidencia en `tests/lp01-official-close/panel-browser-result.json` y `tests/lp01-b12-b13/dom-performance-result.json`. No es prueba de escritura productiva ni aceptación visual contra PDF.

### Flujo local persistente conectado (incremento posterior)
Sustituye los pendientes de código descritos arriba para Disponible/Otras/lectura histórica/cierre nativo/apertura: ya implementados localmente, con activación separada y deshabilitada por defecto.

Disponible persiste definición, motivo, autor y bases; Otras conserva plan inicial e incorporación con motivo y prioridad. Las hojas consumen esas proyecciones. READ histórico ya no exige turno abierto ni escrituras habilitadas. El puente 03 enlaza cierre oficial y nativo atómicamente y el ejecutor servidor abre según horario configurado, sin botón ni saltar períodos. Continúa bloqueando datos ambiguos/bases intraturno ausentes/cobertura incompleta.

Evidencia nueva y alcance: cuatro escenarios PostgreSQL de workflow, tres de puente nativo, cinco pruebas de dominio y dos de runner; recorrido UI sintético PC/móvil con definir/incorporar/importar/cerrar/recargar. No repetir suites antiguas para este incremento. Ver README y manifest actualizados del paquete SQL.

Pendiente para entrega activada: integrar componentes compartidos del propietario, revisión del paquete SQL/identidad servidor/job y aprobación específica, instalación/despliegue coordinados y CI única del candidato conjunto. Los hashes compartidos originales siguen coincidiendo. La última instrucción anula el permiso de reintentar PR: no hubo intento. Comparación exacta con píxeles originales y ensayo de los dos XLSX nuevos siguen sin evidencia disponible.

### Candidato integrado con PR208
Dependencia completa `95e61e1144d575591985078a95959d11cc5ba156` integrada por merge, helpers idénticos sin variantes, Picking/calendario/metadatos de v396 intactos. Capturas de aplicación completa PC1440/móvil390 en `tests/lp01-official-close/evidence/`; Seguimiento con chips contraídos y detalle, Ensamble/Empaque con tabla y detalle. Disponible de las tres vistas comparte ledger. Apertura de PR autorizada explícitamente después de los bloqueos históricos; se hará una sola creación contra la rama de PR208, sin merge/publicación ni activación.

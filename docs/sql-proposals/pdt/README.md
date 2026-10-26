> **Regla vigente PANEL/FRAME:** maestro como autoridad, sin contexto cruzado.
> Implementación y plan de reparación exclusiva de los22 pendientes en [identity/README.md](identity/README.md).
> SQL solo preparado, sin aplicación productiva; propuestas anteriores de cruces quedan obsoletas.

> Estado posterior: PDT v2 A/B APLICADO EN SUPABASE el 25/10/2026, run 40246792417 SUCCESS.
> Respaldo actualizado/restauración real y control transaccional de escrituras verificados.
> Instalación, autorización y bloqueos de las notas históricas siguientes quedan sustituidos
> por el último hito de FINAL_READINESS.md y el estado final del PR91.

> Estado vigente 2026-10-25: 11/11 huellas contrastadas; 63 + 24 aserciones SQL,
> seis concurrencias y contratos 6/8 por HTTP aprobados. Solución sin DROP preparada,
> diez propuestas forward fuera de migraciones automáticas. Ver [FINAL_READINESS.md](FINAL_READINESS.md).
> Los apartados siguientes son historial; sus bloqueos de adjuntos/ambigüedad fueron superados.
> No aplicado ni verificado en producción. Se requiere aprobación separada de instalación/merge/despliegue.

## Consolidación local de seguridad y preflight — 2026-10-25

Reejecución aprobada: 63 aserciones SQL (37 base + 26 regresiones) y seis
escenarios concurrentes en fixture aislada. Autorización exacta de sesión vigente;
equivalencia legacy sin cambios; AUDITADA_DIFERENCIA sigue sin acreditar cantidades.
Seis pruebas adicionales del comparador de catálogos aprobadas.

Preflight solo lectura preparado para una réplica existente, ANTES de instalar:

```bash
python tests/sql/pdt/run-isolated.py --compatible-db sgp_pdt_qa_91_REPLICA --production-catalog /ruta/catalogo-productivo.json
```

Acepta el JSON completo generado por PDT_PREFLIGHT_SUPABASE.sql, tanto objeto
como resultado exportado del SQL Editor. Compara funciones/argumentos/cuerpos,
columnas/constraints/índices, owners/ACL, triggers, políticas, roles, membresías,
secuencias y grants por defecto. Ignora OIDs de objetos que cambian al restaurar;
conserva orden de argumentos y columnas. Nunca ejecuta definiciones ni instala.

Bloqueo restante: no está disponible el export productivo completo ni una réplica
contrastada contra él. Los resúmenes recibidos no contienen los cuerpos completos
ni los tres triggers de programación. Debe confirmarse además que
sgp_sesion_actual(text) retorna JSON/JSONB escalar con valida booleana y rol real,
sin transformar RECEPCION a LIDER. El preflight rechaza ausencia de catálogo,
contrato de sesión incorrecto, mocks y diferencias estructurales no revisadas.
Por tanto NO hay aceptación sobre Supabase real ni autenticación real demostrada.
Cambios locales preservados SIN COMMIT/PUSH; HEAD d90d850f2a8ee7d1a111a71073e93a63f04fbac1.

Las notas siguientes registran etapas anteriores.

> Estado posterior — permisos exactos PDT v2 (2026-10-25):
> - Avance, reverso y etapa llaman a sgp_pdt_validar_rol_real(text,text[]).
>   Obtiene la sesión exclusivamente desde sgp_sesion_actual(text), exige objeto
>   JSON con valida=true y rol real permitido; solo después resuelve el actor con
>   el helper legacy. No confía en un rol enviado por el navegador.
> - No reemplaza sgp_validar_sesion_rol ni su equivalencia RECEPCION→LIDER.
>   Conserva LIDER, LIDER MECANIZADO, COORDINADOR y ADMINISTRADOR legítimos.
> - Nuevo helper interno SECURITY DEFINER/search_path vacío y EXECUTE revocado
>   para PUBLIC/anon/authenticated. Firma real de sesión requerida: JSON/JSONB
>   escalar con valida booleana y rol sin equivalencia; contrato consumido en app.js.
> - Pruebas sintéticas: 37 aserciones base, 26 regresiones y seis escenarios
>   concurrentes. Recepción rechazada sin movimientos/historial parciales;
>   sesión inválida, nula o sin rol rechazada. Legacy y auditoría preservados.
> - El modelo de sesión/equivalencia NO es autenticación real. Faltan los cuerpos
>   completos de las funciones productivas: solo se recibieron resúmenes de sus
>   hallazgos, y los adjuntos disponibles no contienen CREATE FUNCTION.
> - Sin commit/push ni aplicación productiva. Las notas siguientes describen
>   etapas anteriores y quedan sustituidas donde contradigan esta actualización.

> Contraste dirigido posterior, 2026-10-25 (hallazgos aportados por propietario):
> - Equivalencia RECEPCION→LIDER amplía avances, reversos y etapas v2. El modelo
>   aislado reproduce ese acceso; NO equivale a aprobarlo. Corrección propuesta:
>   autorización estricta por rol real para esas RPC nuevas, conservando LIDER
>   legítimo y sin modificar el validador global ni legacy. Falta su contrato real.
> - Corregido localmente el guard de origen: permite auditoría legacy de líneas
>   REGISTRADAS, incluidos VALIDADA/AUDITADA_DIFERENCIA. Líneas VALIDADAS siguen
>   protegidas. Únicamente evento VALIDADA permite validar/acreditar la línea.
> - Prueba aislada: 37 aserciones base (35 previas + 2 estados auditados), 11
>   regresiones adicionales con ROLLBACK y seis escenarios concurrentes aprobados.
>   Tres regresiones documentan ampliación de rol PENDIENTE de resolución.
> - El runner sintético carga el trigger de duplicados versionado y prueba rechazo
>   de completa duplicada y aceptación de parcial. Esto NO verifica el cuerpo real.
> - Las firmas de entrega 6/8 no se reemplazan. Fixtures 4/5 siguen siendo mocks;
>   tipos/cuerpos reales y triggers de programación aún faltan para aceptación exacta.
> - No hay nuevos commits/push, aplicación productiva ni cambio en funciones globales.

> Compatibilidad real pendiente (2026-10-25): se corrigió únicamente la firma
> sintética de estado a cuatro parámetros. Las entregas mock de 4/5 parámetros
> NO reproducen las firmas reales 6/8 y faltan los tres triggers de programación
> y autenticación real. El runner exige modo explícito: `--synthetic` para mocks
> o `--compatible-db <base-aislada>` para preflight SOLO LECTURA. Este último
> detiene la instalación ante diferencias; no instala SQL aun si pasa el inventario.
> No usar los 35 tests anteriores como aceptación sobre el esquema productivo.

# PDT v2 — fases A/B, estado local actual

Fecha: 2026-10-25. Rama `feat/pdt-multifabricacion-avances-nc`.
HEAD previo a consolidación: `4f486b8e90a40c4f0f4daaa2e16b0aa158e09f49`.
Estado de consolidación: IMPLEMENTADO EN RAMA Y PROBADO CON FIXTURES; NO APLICADO EN SUPABASE.
El propietario autorizó commit/push y actualizar PR #91 el 2026-10-25; consultar el SHA final en Git/GitHub.

## Contratos actuales

- `contrato_pdt=LEGACY` por defecto; legacy no migrado mantiene sus rutas y cierre.
- Validar con el contrato nuevo crea UUID por detalle, referencia de fila fuente y
  snapshot, y cambia a V2 en la misma transacción. No se migra automáticamente
  ningún PDT validado legacy. No hay degradación V2→LEGACY.
- El identificador importado no es permanente: se conserva como referencia;
  el UUID de detalle y snapshot sobreviven a recargas. Selección explícita de fila
  PANEL por id_pieza, key_produccion, sistema, perfil y atributos; sin agrupaciones
  por marca/uso ni correspondencias por nombre de producción.
- Reportada inmutable; validada independiente; distribución bloqueada tras validar.
- Avances/reversos por detalle y clave idempotente, con bloqueo del PDT. Reverso
  compensatorio y único; no puede reducir procesado bajo cantidades comprometidas.
  Revertir PROCESADO devuelve a MECANIZADO si corresponde.
- NC múltiples aditivas antes/después de validar; alias/consecutivo se resuelven sin
  ambigüedad. Snapshot al vincular, referencia CSV histórica preservada y estados
  inactivos/desconocidos explícitos. La finalización no prueba entrega ni material.
- La protección anterior que bloqueaba cierres globalmente fue sustituida por
  guard V2. Las funciones legacy seleccionadas reciben guard por p_id UUID, con
  definición original archivada privadamente. Firma/cuerpo desconocido aborta
  instalación: revisar definiciones reales, no ejecutar a ciegas. No se reemplazan
  las dos firmas de sgp_picking_entrega_orden.
- app.js y Producción/Pendientes usan capacidades de lectura. RPC de capacidades
  ausente conserva legacy; errores de permisos/red no se esconden como ausencia.
  Ningún fallo de escritura v2 se reintenta por RPC legacy.
- UI usa los modales actuales, distribución por fila PANEL, cantidades, NC, avance,
  reverso y etapas. Fase A no ofrece cierre; fase B se anuncia separadamente.

## Fase B cuantitativa mínima

`20261026_pdt_picking_B_REVIEW.sql` añade líneas positivas ligadas a evento y detalle,
asignaciones y certificado de cierre. No reconstruye entregas desde faltantes ni
programación. Picking registra cantidades reales; Recepción/Coordinador valida
solo cuando el evento fuente está VALIDADA; la asignación consume una línea una vez.

Alcance deliberado: línea completa asignada a un solo detalle; no se divide una
línea entre PDT. Un evento/fila fuente no puede duplicarse entre líneas activas.
Para otras distribuciones se requiere ampliar el contrato, no inventar cobertura.

Cierre por Picking/Coordinador/Supervisor/Administrador solo con PROCESADO, saldo
cero y todas las cantidades acreditadas. Orden global parcial es compatible.
Anulación abierta preserva línea y auditoría; después de cierre exige conciliación
separada y no reabre automáticamente. Se protegen cambios de estado/identidad en
entregas y contexto de programación únicamente cuando tienen evidencia PDT vigente.

## Orden de instalación exclusivamente aislada

1. `20261024_pdt_multifabricacion_avances_nc_DRAFT.sql`
2. `20261025_pdt_fail_closed_REVIEW.sql`
3. `20261024_pdt_rpc_contracts_REVIEW.sql`
4. `20261024_pdt_reverso_REVIEW.sql`
5. `20261024_pdt_nc_vincular_REVIEW.sql`
6. `20261024_pdt_listar_v2_REVIEW.sql`
7. `20261025_pdt_legacy_guard_REVIEW.sql`
8. `20261025_pdt_capacidades_REVIEW.sql` (publica fase A, cierre deshabilitado)
9. Opcional: `20261026_pdt_picking_B_REVIEW.sql` (publica fase B al finalizar su transacción)

Todos siguen fuera de supabase/migrations. No son una instalación productiva
aprobada. Para producción revisar esquema y definiciones reales, firmas, grants,
plan de bloqueo/índices y consolidar instalación atómica versionada. No reaplicar
capabilities fase A sobre fase B; el script rechaza esa degradación.

## Pruebas reproducibles

- `npm test`: suite JS completa; incluye adaptador, ausencia de backend, error sin
  fallback de escritura, identidad fuente y cantidades.
- `python tests/sql/pdt/run-isolated.py --synthetic`: solo contenedor `sgp-pdt-qa-91`, red NONE,
  sin puertos publicados. Crea base nueva sgp_pdt_qa_91_<id>; datos sintéticos.
- `python tests/pdt-v2-browser.py`: Chromium, RPC simuladas, 1280×900 y 390×844;
  distribución 5+4, avance parcial, entrega positiva y cierre del modal accesible.
- SQL de pruebas incluye transacciones, rollback de conversión y seis casos
  concurrentes reales. Los tokens de fixture son nombres de roles y NO son sesiones
  SGP auténticas. Esto prueba las listas de roles de las RPC, no el login real.
- PostgreSQL 17 Docker oficial, digest observado
  sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe.

La base es una fixture estructural mínima, NO una copia ni respaldo Supabase.
No se ha probado recuperación productiva ni equivalencia con su esquema completo.

## Pendiente antes de producción

- Verificar cuerpos y firmas instaladas, incluido resolver y ambas entregas;
  los metadatos comunicados por el propietario no sustituyen esa revisión.
- Backup recuperable demostrado, permisos reales y prueba de restauración.
- Estados exactos de auditoría: AUDITADA_DIFERENCIA no acredita cantidades en esta
  versión; requiere conciliación. Confirmar separación registrador/validador.
- Probar instalación en réplica compatible, usuarios reales y navegador de planta.
- Conciliar históricos expresamente; sin conversión ni reconstrucción automática.
- Incorporar main/PR #92 en una fase autorizada conservando protección Hosting.
- Autorizar por separado aplicación SQL, transferencia GitHub, merge y publicación.


## Resultados de aceptación locales de fases A/B

- Suite `npm test`: 222 pruebas, 222 aprobadas, 0 fallidas.
- PostgreSQL 17 sintético: 24 aserciones fase A y 11 fase B, total 35.
- Seis escenarios concurrentes aprobados: sobreavance, reintento, sobreentrega,
  doble asignación, cierre/reverso y cierre/anulación.
- Rollback de conversión comprobado y dos overloads Picking de fixture intactos.
- Chromium 1280×900 y 390×844: distribución 5+4, avance parcial, captura de
  cantidad positiva y botón de cierre de modal alcanzable. RPC simuladas.
- Sintaxis de app.js/controlador/servicio: aprobada. Release y contrato estático
  adicional de arrastre aprobados. Sin cambios en firebase.json ni workflows.
- La opción de validar legacy permanece; preparar/activar v2 es explícito.
- Sesiones/roles de Supabase real, restauración, instalación sobre esquema real
  y funcionamiento en planta NO verificados.

Base sintética de la última aceptación SQL:
`sgp_pdt_qa_91_1792936041617364153` dentro de `sgp-pdt-qa-91`, sin red ni puertos.
Los datos sintéticos se conservan en tmpfs mientras viva el contenedor. No es
un respaldo durable ni contiene datos de producción.

Reversión propuesta: antes de uso productivo, deshabilitar publicidad de nuevas
capacidades y mantener v2 en lectura con sus guards. Conservar detalle/movimientos/
evidencia; no degradar marcador, borrar historia ni restaurar datos antiguos sobre
escrituras nuevas. Para restaurar definiciones legacy archivadas hace falta revisar
qué registros v2 existen y conservar prevención de bypass. Priorizar corrección
aditiva; cualquier restauración productiva necesita backup recuperable y plan de
preservación de escrituras posteriores, aún pendientes.

<details>
<summary>Informe anterior a fases A/B — histórico, sustituido por el estado superior</summary>

# PR #91 — SQL de revisión, no instalación

Estado 2026-10-25: PARCIAL, solo archivos locales. Base de trabajo
`4f486b8e90a40c4f0f4daaa2e16b0aa158e09f49`; main observado
`db70f601cc01a470a6a3908cae19caac59dfe34b`.

Los cinco SQL DRAFT/REVIEW se trasladaron desde `supabase/migrations` para
evitar que una herramienta de migración los aplique por su ubicación. Ninguno
está autorizado para producción. No editar el historial de migraciones de una
base donde estos archivos se hubieran aplicado: comprobarlo antes de integrar.
Los workflows revisados no invocan migraciones Supabase; esto no demuestra la
ausencia de automatización externa. Firebase no se ha desplegado.

Orden para una futura instalación AISLADA, después de resolver los bloqueos:
esquema → rpc_contracts → reverso → nc_vincular → listar_v2 → fail_closed.
Los archivos contienen transacciones independientes: no es todavía una entrega
atómica de instalación. Preparar una migración aprobada única antes de liberar.
Las comprobaciones IF NOT EXISTS no demuestran equivalencia de esquemas previos.

## Cambios preparados

- Cantidad original preservada; 9 → 8 exige motivo, como ya hacía HEAD.
- RLS y revocación de acceso directo dentro de la creación de tablas.
- Creación repetida de constraints protegida por nombre y tabla.
- Reintentos de avance/reverso reconocidos después de bloquear y encontrar el
  PDT, antes de rechazar un estado posterior; sesión/rol siempre se comprueban.
- NC aditivas antes/después de validar, nunca después del cierre. Resolución
  de alias a consecutivo único; nuevas asociaciones auditadas una sola vez.
- Listado v2 incorpora RECEPCION, cantidad reportada explícita y NC históricas.
  Estado, responsable y fecha proceden de la misma fila seleccionada. Referencias
  ambiguas no eligen una NC arbitraria. No se inventa fecha de finalización.
- Guard de cabecera rechaza nuevos cierres por cualquier ruta ordinaria,
  incluida RPC legacy. Protege cantidad original y campos validados; para PDT
  con detalles impone etapas consecutivas y saldo cero antes de PROCESADO.
- UPDATE/DELETE de detalles, movimientos y vínculos quedan bloqueados.
- Reversos se bloquean conservadoramente si existe cualquier entrega de la
  producción: no se asume cobertura ni se mezclan cantidades. Esta restricción
  puede bloquear entregas de otro sistema con igual nombre; es contención,
  pendiente de sustituir por identidad y asignaciones verificadas.

## Bloqueos obligatorios

1. El importador `src/domain/aluminum-pieces-importer.js` no suministra un
   identificador de pieza estable. Las consultas por producción de texto y las
   diferencias de identidad JS/SQL requieren resolver producción/sistema/reserva
   y unicidad de la fuente. NO activar validación nueva hasta resolver RF-06.
2. No hay evidencia verificada de entrega cuantitativa por detalle PDT. El
   guard bloquea TODOS los cierres nuevos, incluso pendientes legacy sin detalle.
   Es una medida temporal que altera operativa: NO aplicar a planta como solución.
3. No se implementó un cierre exitoso ni tabla ficticia de evidencia. Propuesta:
   relación aditiva entre línea física de entrega validada y detalle, cantidad
   asignada, claves de operación y restricciones de consumo acumulado; su FK y
   capacidad dependen del esquema real aún no inspeccionado.
4. La protección de tablas no autoriza INSERT directo: mantener grants revocados
   y revisar TODOS los SECURITY DEFINER instalados que pudieran escribirlas.
   Dueño/superusuario puede deshabilitar triggers: no representa acceso ordinario.
5. El adaptador `src/services/aluminum-pending-v2.js` está probado aisladamente,
   pero NO conectado a `app.js`; falta endpoint real de capacidades. No habilitar
   operaciones mediante capacidades inventadas. Errores nunca provocan otra RPC.
6. Conservación histórica NC no equivale a disponer de archivo durable de todas
   las versiones de su origen. Referencias desaparecidas se muestran desconocidas;
   snapshot/historial de NC requiere inspección y contrato adicional.
7. Conservar PR #92 al actualizar desde main. Esta rama aún no lo incorpora;
   no copiar ni modificar workflows bajo esta autorización.

## Pruebas SQL pendientes — base aislada

Preparar copia estructural SIN datos operativos, sin conexiones de producción,
roles técnicos anon/authenticated y sesiones sintéticas por rol. Inspeccionar
funciones instaladas, tablas, triggers y grants antes de adaptar las fixtures.
Cada caso: BEGIN, fixture propia, operación, aserciones y ROLLBACK. No envolver
los scripts con COMMIT internos dentro de una supuesta transacción de prueba.

| Caso | Fixture/operación | Aserción |
|---|---|---|
| Cantidades | Reportada 9; validar 5+4 y, en otro caso, 8 con motivo | Original 9; suma 9/8; historial |
| Motivo | Validar total 8 sin observación | Error, sin detalles ni historial parcial |
| PANEL | Fuente no PANEL/sistema ajeno | Error sin escrituras |
| Roles | Token sintético por cada rol permitido/prohibido | Permiso exacto; grants no bastan |
| Avance | Detalle 5; avance 2 | Saldo 3 |
| Exceso | Dos sesiones intentan 4+4 sobre 5 | Una falla; neto nunca supera 5 |
| Idempotencia | Misma clave/contenido y clave con contenido diferente | Un movimiento; conflicto en segundo caso |
| Reverso | Avance 2; reverso total y repetición | Neto vuelve a cero una sola vez |
| Entrega existente | Cualquier evidencia para la producción | Reverso bloqueado hasta conciliación |
| NC | Antes/después de validar; duplicado, alias, inactiva/desconocida | Solo adición; duplicado sin nuevo historial; desconocida rechazada |
| NC histórica | CSV, alias ambiguo y origen desaparecido | Referencias preservadas; estado explícito |
| Cierre legacy | Resolver, estado PICKING o UPDATE directo | Error; ninguna cabecera cerrada |
| Inmutabilidad | UPDATE/DELETE detalles/movimientos/vínculos | Error |
| Etapas | Salto PENDIENTE→PROCESADO o PROCESADO con saldo | Error |
| Cierre futuro | Orden parcial pero PDT cubierto; PDT parcialmente cubierto; evidencia reutilizada | PENDIENTE: falta contrato real |
| Concurrencia futura | Cierre/reverso y doble asignación en dos sesiones | PENDIENTE: falta evidencia cuantitativa |

Se preparó `guard.synthetic.test.sql` con aserciones y ROLLBACK para fixture
sintética en base desechable. No cubre todavía llamadas RPC ni concurrencia.

No hay PostgreSQL/psql disponible en esta sesión. Ningún caso SQL ni permiso
real se declara superado. Las pruebas JS no sustituyen estas pruebas.

## Evidencia local de esta entrega

- `npm test`: 215 pruebas superadas, 0 fallidas (incluye 20 de PDT/adaptador).
- `node --test tests/mecanizado-arrastre-contract.test.cjs`: superada; contrato estático.
- `npm run verify:release`: superada; NO implica publicación ni prueba funcional.
- Sintaxis de los dos módulos JS modificados/nuevos: superada.
- `git diff --check` y espacios de SQL nuevos: sin errores.
- SQL, grants/roles reales, concurrencia y navegador: no ejecutados/verificados.
- HEAD inicial/final: `4f486b8e90a40c4f0f4daaa2e16b0aa158e09f49`.
- Sin commits, push, edición de PR, integración, cambios remotos ni despliegues.
- PR #91 sigue OPEN/DRAFT; sus checks remotos corresponden al HEAD anterior,
  no a estos cambios locales.

</details>

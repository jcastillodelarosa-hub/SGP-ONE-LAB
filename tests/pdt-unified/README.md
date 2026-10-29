# Issue 144 — validación PDT aislada

Rama de infraestructura: `feat/issue-144-pdt-isolated-validation`, desde main
`55a309729bb3166cce98e24eb7e840169f4b7890`. No modifica PR142 ni la rama de respaldo.

Entrada registrada: `.github/workflows/firebase-preview-linea-produccion.yml`.
En **Run workflow**, seleccionar esta rama y operación **validate-pdt-unified**.
El job usa el entorno protegido `supabase-backup`; sus revisores pueden tener que
aprobar el acceso. Ningún otro job coincide con esta rama/operación.

El candidato se fija a `b7e7908f822789e3315b2f222f7eda680a13590c` (PR142 comprobado).
El recuperador lee exclusivamente el `recovery-verified.json` del 29/10/2026,
run40 `40858549034`, prefijo terminado en
`20261029T103434Z-0567ffc8929b47a49cdb3745b1285f1e/`.
Comprueba estado, fecha, proyecto, privacidad del bucket, generaciones, tamaños,
SHA256, conteos y catálogo. No selecciona el respaldo más reciente ni vuelve a
respaldar producción. Usa la infraestructura existente `restore-backup`, con
una entrada programática que obliga a restauración existente, rechaza instalación
productiva/contraseña y retorna antes de las rutas de escritura GCS o producción.

La identidad existente se usa para GCS; el token de datos queda reducido a
`storage.objectViewer` en el prefijo privado. No se inyecta contraseña de Supabase,
service_role ni credencial Firebase en el contenedor. El contenedor
`supabase/postgres:17.11.0.006` tiene `--network none`, sin puertos ni montajes de
credenciales. Se comprueba `server_version_num=170011` y se destruye en `finally`,
incluso si falla un guard, una prueba o recibe SIGTERM. GitHub puede destruir el
runner ante una terminación forzada; no se conserva base ni volumen persistente.

Instala los siete scripts REVIEW **sin modificar cuerpos ni huellas**:
grouped-source01 → manual01–05 → integration06. Ante preflight fallido se detiene.
No llama a `install-production`, `production_install` ni `06_ACTIVAR_REVIEW.sql`.

`contracts.sql` usa usuarios QA temporales, `sgp_login`/`sgp_sesion_actual` reales y
RPC con `SET LOCAL ROLE anon`. No sustituye helpers, tablas, views ni permisos RLS.
Prueba diez roles, permisos permitidos/denegados, alta PICKING/ENSAMBLE/EMPAQUE,
NC existente, idempotencia, validación, avances parciales, entrega, recepción,
asignación, cierre, listados por rol, Export real de semana/repetición, rechazo
de año, auditoría, corte UTC reversible y despacho no manual LEGACY/V2.
Los datos QA y modificaciones de estados en el clon se revierten. Se comparan
huellas privadas de PDT/historial antes/después de instalar y tras el rollback de
pruebas. Finalmente se ejercitan las reversiones 06 y manual05→01 antes de activar.
El rollback de grouped-source no se certifica: su contrato depende de fuentes
agrupadas; el contenedor completo se destruye al finalizar.

Si faltan fuentes PANEL con cantidad >=2, un evento Picking compatible, NC,
cohortes LEGACY/V2, o el contrato de login real no coincide, NO-GO con código seguro;
no se fuerzan guards ni se reconstruyen dependencias sintéticas.

Solo se publica el resumen de ejecución: nombres/status por fase, hashes,
versión y GO/NO-GO. No se suben artefactos, backups, resultados de consultas,
mensajes SQL crudos, usuarios, sesiones ni identificadores operativos. La prueba
UTC inserta una configuración efímera dentro de ROLLBACK; no activa producción.
La suite Node prueba el listado combinado y filtrado del candidato. Las lecturas
SQL por roles no son una verificación de navegador ni prueba física PC/móvil.

## Verificación local de infraestructura

- `python3 -m unittest discover -s tests/pdt-unified -p 'test_*.py'`: 8/8.
- `python3 -m unittest discover -s tests/pdt-backup -p 'test_*.py'`: 24/24.
- YAML parseado, Python compilado, `git diff --check` aprobado.
- `npm run verify:release`: aprobado sobre la base de infraestructura, LABv365;
  el workflow lo repite sobre el candidato junto con sus pruebas Node focalizadas.

La simulación de fallo de restauración emite deliberadamente un mensaje de error
sanitizado y comprueba que se elimina el contenedor; es una prueba positiva.

**Estado: PREPARADO, validación restaurada aún NO EJECUTADA; publicación NO-GO.**
El socket Docker local rechaza acceso y el fetch Git local sigue bloqueado por el
proxy administrado. Se usa el conector GitHub autorizado para entregar la rama.
No existe herramienta de `workflow_dispatch` entre las capacidades disponibles:
no confundir un PR/CI con una ejecución protegida exitosa. Abrir la entrada manual
anterior para ejecutar sin fusionar. Si la política del entorno protegido rechaza
esta nueva rama, su administrador debe autorizarla en `supabase-backup`.
El workflow publica NO-GO si falla un paso anterior a la restauración.

Instante UTC y administrador de publicación productiva: **pendientes**.

## Continuación del run41 — diagnóstico conservado

Ejecución examinada: [40863621247](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/40863621247),
job123412751610, infraestructura `9dfbcbf`, candidato `b7e7908`.
El login GCS, la descarga de imagen, el release y las32pruebas Node terminaron
correctamente. El paso real falló a las11:13:31UTC con
`RESTORE_INTEGRITY: ISOLATED_VALIDATION_FAILED`.

**Causa subyacente no determinada con los registros disponibles.** El recuperador
sustituía cualquier `SafeFailure` por el mismo texto y no cambiaba la fase al
entrar en el hook PDT. El informe se escribía únicamente en Step Summary, sin
copiarse al log accesible por API. Sin el JSON de ese resumen no se puede distinguir
retrospectivamente entre discrepancia de recuperación/integridad y fallo del
validador. No se afirma corrupción del respaldo, problema de permisos ni defecto
funcional PDT. La anotación RESTORE_GLOBALS de11:12:57UTC correspondía a una prueba
unitaria de fallo controlado que terminó OK; no era el fallo de la restauración.

La corrección conserva códigos locales de una lista cerrada, categorías y nombres
de secciones de catálogo permitidos, sin incluir excepciones crudas, SQL, filas,
usuarios ni tokens. Separa `PDT_UNIFIED_VALIDATION` después de superar integridad,
conserva el detalle seguro ya capturado por fase SQL y copia el informe sanitizado
al log además del resumen. La salida de fallo de la prueba unitaria se captura
para evitar una anotación engañosa. No cambia ninguna comparación, guard ni SQL PDT.

Regresión:11/11pruebas del validador +24/24respaldo; verify:release365 y diff correctos.
Los casos nuevos inyectan discrepancias de conteos/catálogo y un fallo del hook:
verifican NO-GO, ausencia de invocación del hook si falla integridad, fase/código
correctos, redacción y eliminación del contenedor en todos los casos.

Para repetir: abrir el workflow Preview, **Run workflow**, seleccionar
`feat/issue-144-pdt-isolated-validation` y `validate-pdt-unified` sobre el nuevo HEAD.
**Crear una ejecución nueva**: Re-run jobs del run41 reutiliza el commit anterior.
Tras aprobar `supabase-backup` si se solicita, revisar el informe y los campos
`restore`, `failure.phase`, `failure.code`, `failure.category` y `phases` en el log.
Hasta completar esa nueva ejecución, la validación restaurada y publicación
continúan NO-GO. No se fusiona, instala en producción ni publica Firebase.

## Run42 — localizar el contrato rechazado sin cambiar su lógica

Evidencia: [40864879141](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/40864879141),
job123417003041, infraestructura `7fdd6ec`, candidato `b7e7908`.
El log confirma `HASH_COUNTS_CATALOG_VERIFIED`, siete fases SQL PASS y
`failure.phase=contracts`, `failure.code=ISOLATED_SQL_REJECTED`. No hay ningún
marcador PASS funcional. Esto acota el fallo a preparación/autenticación inicial
del archivo de contratos; no demuestra cuál de esas comprobaciones falló.
No se atribuye el error a una RPC específica, permisos ni datos del respaldo.

Correspondencia revisada de contratos, sin cambiar sus llamadas ni argumentos:

| Contrato | Funciones/ruta | Fase |
| --- | --- | --- |
| Autenticación | sgp_login, sgp_sesion_actual; catálogo autorizado | Existentes + manual01 |
| Alta, NC e idempotencia | sgp_pdt_manual_registrar_v1, fuentes/catalogo | manual01 |
| Validación | sgp_aluminio_pendiente_validar_detalles_v1 | manual02 |
| Avance, entrega y cierre | registrar_avance_v1, estado_v2, entrega_registrar/validar, asignar, cerrar | manual03 |
| Recepción/Mecanizado/Picking | manual_listar_v1, pendientes_listar_v2 | manual03 + ruta V2 existente |
| Semana y año | auditar_programacion, aplicar_export_diario | manual04/05 |
| Corte UTC | sgp_pdt_corte_operativo_v1 | integration06 |
| Regresión no manual | despachos y originales capturados | grouped-source01 + manual02/03 |

Corrección delimitada al diagnóstico: `CONTRACT:` identifica cada bloque y la
preparación de sesión, helpers, tablas temporales y rollback. Notices con etiquetas
fijas identifican la última comprobación iniciada (`PDT_QA_STEP`). El cliente usa
salida verbose capturada en memoria para extraer solamente SQLSTATE, sin publicar
el mensaje nativo, contexto SQL, filas, usuarios, contraseñas o argumentos RPC.
Los identificadores de contrato/comprobación están en listas cerradas; un marcador
desconocido o de otro contrato no se publica como comprobación fallida.
El código de error se obtiene de la línea ERROR, nunca de los nuevos notices.

El informe conserva `failure.phase=contracts` y añade `contract`, `check` y
`sqlstate` cuando existen. `check` indica el último checkpoint alcanzado dentro
del bloque, no una atribución automática de defecto a la RPC. El contrato activo
queda FAIL; los siguientes permanecen NOT_EXECUTED. Los marcadores de diagnóstico
no cuentan como PASS ni sustituyen la comprobación de evidencia completa.

Verificación local: 15/15 pruebas del validador, 24/24 de respaldo, verify:release365,
compilación Python y diff correctos. Cuatro regresiones nuevas comprueban errores
SQL nativos, errores nombrados precedidos de notices, preparación/etiquetas
incorrectas y cobertura de las listas cerradas. Comparación local del archivo SQL
confirma que al retirar únicamente marcadores/notices y el ajuste de visibilidad
de notices se recupera exactamente el contenido previo: mismas comprobaciones,
RPC, permisos, transacciones y ROLLBACK. No se modifica SQL01–06 del candidato.

Repetir mediante **Run workflow**, misma rama, operación `validate-pdt-unified`,
creando un run nuevo en el nuevo HEAD. No usar Re-run del run42 porque ejecutaría
`7fdd6ec`. Revisar los nuevos campos del informe sanitizado antes de corregir
cualquier contrato funcional. La causa subyacente sigue pendiente de esa evidencia;
publicación NO-GO. Sin cambios productivos, merge ni despliegue.

## Run43 — CHECK real de roles de autenticación

Evidencia: [40865974450](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/40865974450),
job123420730691, infraestructura `b7fe74e`: restauración verificada, siete fases
PASS, contrato `real-role-authentication`, checkpoint `auth.account-create`,
SQLSTATE23514. La consulta de catálogo `pg_constraint` se ejecutó después en una
transacción **READ ONLY** sobre el proyecto autorizado, sin leer usuarios ni datos
operativos y sin escrituras. Identificó un único CHECK de `sgp_usuarios`:
`sgp_usuarios_rol_check`, exclusivamente sobre la columna `rol`.

Su definición y procedencia quedan versionadas en `auth-role-contract.json`.
Admite COORDINADOR, LIDER MECANIZADO, LIDER LINEA, RECEPCION, PATINADOR, PICKING,
SUPERVISOR DE PICKING, CONSULTA y ADMINISTRADOR. **LIDER no está permitido**.
El procedimiento anterior intentaba insertar también ese décimo rol.
Esta evidencia procede del catálogo vivo de solo lectura; no se afirma haber
consultado directamente el contenedor ya destruido del run43. El preflight nuevo
verifica en la restauración nombre, tabla, columna, validación y huella MD5 de la
misma definición (`622dc5a90326fe330e7dee48c5617032`). Si no coincide, aborta;
no adapta ni debilita restricciones para hacer pasar las pruebas.

Se conservan diez casos: nueve con creación temporal, login, sesión y permisos
reales; LIDER es una regresión negativa del CHECK. Su INSERT debe producir
check_violation, con CONSTRAINT_NAME/SCHEMA_NAME/TABLE_NAME exactamente iguales al
CHECK esperado. Otro rol, restricción, tabla, esquema o SQLSTATE no se ignora.
La subtransacción revierte el INSERT rechazado; se comprueba que no dejó usuario.
LIDER no recibe token ni sesión sintética. Los nueve roles permitidos recorren el
login y la autorización originales como anon. El contador exige9logins,1rechazo,
9tokens y ningún token LIDER; toda la matriz y las operaciones siguen bajo ROLLBACK.
El informe distingue `real_login_roles:9`, `schema_denied_roles:[LIDER]` y
`total_role_cases:10`. No significa diez roles autenticables en el esquema real.

Validación local:17/17pruebas del validador,24/24respaldo, verify:release365 y diff
correctos. Las dos regresiones nuevas verifican la matriz frente a la evidencia
versionada, los guards estrictos del rechazo y la presentación honesta del informe.
La prueba SQL del CHECK/login se ejecutará en el clon de la siguiente ejecución;
no se certifica aún su éxito con el respaldo. Sin cambios en restricciones,
funciones productivas, RLS, permisos, fases REVIEW, producción, main o Firebase.

Repetir con **Run workflow**, rama `feat/issue-144-pdt-isolated-validation`, operación
`validate-pdt-unified`, nueva ejecución sobre el nuevo HEAD. Revisar el preflight
`auth.role-check`, la matriz `authentication` y los contratos siguientes.
No usar Re-run del run43 porque reutilizaría el código anterior. NO-GO productivo
hasta completar la validación aislada.

## Selección de programación y diagnóstico agregado

La ejecución posterior a `1122b19` confirmó restauración, siete fases y
autenticación PASS; `manual.sources` recibió `PDT_MANUAL_PROGRAMACION_AMBIGUA`.
La función versionada `sgp_pdt_manual.programacion(p_key,p_reserva)` obtiene la
pertenencia desde `sgp_produccion_reservas_v` y el período desde
`sgp_producciones`. `catalogo_v1` expone su resultado, que **no incluye**
`key_produccion`. El validador anterior leía esa clave ausente del JSON y la
pasaba como NULL a `fuentes_v1`. Su guard exige exactamente una programación
válida; con la clave NULL considera varias producciones de la reserva y rechaza
el caso. La consulta productiva de solo lectura aportada por el usuario halló
558 parejas con una programación válida y ninguna ambigua. El error se debe a
la selección del caso de prueba; no evidencia ambigüedad de datos ni ausencia
general de programación. No se modifica la función ni sus restricciones.

El selector usa ahora `key_produccion` de la unión de producción y reserva,
consulta `programacion(key,reserva)` y exige cardinalidad exactamente uno bajo
el mismo filtro de año/semana que `fuentes_v1`. Solo entonces llama la RPC. Si no
encuentra PANEL, cantidad y evento Picking compatibles, conserva el rechazo
explícito de precondición, sin fabricar relaciones.

Los siete contratos funcionales se ejecutan como transacciones reversibles
separadas. Autenticación alimenta los demás; manual alimenta ciclo; ciclo
alimenta listas y período. Corte UTC y despacho LEGACY/V2 dependen solo de la
autenticación y siguen ejecutándose aunque falle el caso manual. Cada prueba
incluye únicamente las precondiciones necesarias, captura su fallo sanitizado
y deja dependientes como `BLOCKED` con `blocked_by`. La fase de rollback queda
`BLOCKED` si algún contrato funcional falla. El resultado agregado permanece
NO-GO hasta que todos pasen. Las conexiones con error se cierran y revierten
automáticamente la transacción; las exitosas terminan con `ROLLBACK` explícito.

Verificación local: 19/19 pruebas del validador, 24/24 de respaldo,
`verify:release`, compilación Python y `git diff --check`. Las nuevas regresiones
fijan la clave y cardinalidad del selector, y comprueban que un fallo manual
bloquea solo los dependientes y deja ejecutar corte y despacho. La ejecución
real de los contratos requiere un nuevo Run workflow en el clon protegido.

# Encargo 3C — importador privado de ámbitos

Base GitHub/checkout `a3a0955`, mismo Draft #183. IMPLEMENTADO EN RAMA y
VERIFICADO CON DATOS SINTÉTICOS; ninguna aplicación/publicación productiva.

## Uso privado y contrato

`src/server/lp01-scope-import.js` y `scripts/lp01-import-scopes.mjs` solo preparan
archivos locales: **apply=false, authorization=NONE**. Sin DB/red, credenciales,
endpoint ni generador de SQL aplicable. SQL01–08/08R y roles originales intactos.
El revisor existente `lp01-scope-review.js` es el único motor de prevalidación:
ahora admite período opcional y revocación, conserva su API previa y no sustituye
la autorización SQL08 en cada operación real.

Preparar por un canal privado autorizado `private/lp01-scopes` con modo0700,
archivos JSON0600 de una sola referencia/enlace, sin symlinks. Todo ese directorio
está excluido por `.gitignore`; no subirlo a GitHub/CI ni imprimir su contenido.
No se crean carpetas con identidades en el nombre. La CLI rechaza permisos locales
más amplios en vez de corregir silenciosamente la custodia de entradas.

Cuatro entradas separadas, con sus huellas SHA256 y referencias de aprobación:

- `reference.json`: `{contract:"LP-AMBITO-TEMPORAL/1",assignments:[...]}`,
  estado de referencia aprobado completo, no una lista de cambios inferida.
- `proposed.json`: mismo contrato, estado propuesto completo. Cada fila identifica
  user/key/line/stage/duty/validFrom/validUntil y opcionalmente revokedAt/role.
  La cuenta/producción deben existir en catálogo; role solo puede coincidir con el
  actual, nunca modificarlo. No aliases, nombres/reservas ni comodines.
- `catalog.json`: `{accounts:[{id,role,active}],productions:[{key,line,active?}]}`
  de cuentas existentes y universo completo aprobado de producciones a cubrir.
  Solo se observa este snapshot; no se consultan ni crean cuentas/privilegios.
- `periods.json`: `{contract:"LP-AMBITO-PERIODOS/1",
  source:"sgp_lp_operacion.periodo(date,integer)",zone:"America/Bogota",records:[...]}`.
  Cada registro line/stage/date/shift/start/end conserva fecha operativa y límites
  del contrato servidor vigente. Exigir los cuatro ámbitos y cada período requerido.
  No se calcula un horario alternativo en el importador. No pegar planes del
  navegador ni declarar como real una salida obtenida solo en PostgreSQL aislado.

`manifest.json` debe tener exactamente contract `LP-AMBITO-IMPORTACION/1`, asOf,
referenceRevision y entries con reference/proposed/catalog/periods. Cada entry:
`{file:"nombre.json",sha256:"64hex",approvalRef:"referencia privada"}`.
Todos los archivos deben ser distintos, nombres simples relativos al directorio
privado, sin subdirectorios. Arrays o campos inesperados, claves JSON repetidas,
UTF8 inválido, archivos mayores de8MiB e intervalos mal formados se rechazan.

Ejecución desde el checkout:

`node scripts/lp01-import-scopes.mjs manifest.json HUELLA_MANIFIESTO_RECIBIDA`

**La huella esperada debe proceder del responsable por el canal privado**, no ser
recalculada por esta CLI a partir de un archivo alterado. Las referencias de
aprobación son declaraciones para revisión: hashes verifican integridad respecto
a esa referencia, no firman aprobación ni prueban autoridad funcional/origen
productivo. Manifest y entradas originales se conservan byte a byte en la salida.
Cambiar un archivo obliga a nueva revisión y manifiesto/pin; no sobrescribir
silenciosamente un resultado anterior alterado.

## Cobertura temporal, diffs y límites

Fechas con segundos y Z/offset explícitos, calendario válido, fracción máxima de
milisegundos (subconjunto conservador sin pérdida de precisión JS). UTC y -05:00
representando el mismo instante no generan cambios. Se exige inicio<fin y aplica
[inicio,fin), incluyendo reloj asOf de revisión. Una misma cuenta debe cubrir
íntegramente cada período; fin igual al fin del turno cubre ese período, pero
operar exactamente al fin de vigencia se deniega. Turno nocturno conserva fecha
operativa aun cuando su fin pertenece al día siguiente. No agregar intervalos ni
cuentas parciales para cerrar. PRIMARY y BACKUP distintos requieren rol de cierre;
duty no concede acceso ni transforma un líder en coordinador.

El universo del catálogo debe ser completo para los períodos revisados. El revisor
exige todos sus productos activos por línea, de manera conservadora; no reduce
ámbitos a partir de cantidades iguales ni presupone disponibilidad de una raíz.
SQL08 decide sobre las órdenes/asignaciones realmente implicadas al ejecutar.
El importador no certifica que un archivo aislado incluya toda la configuración
real; requiere revisión funcional de catálogo/períodos y autorización posterior.

Salidas privadas en `private/lp01-scopes/import-<huella>`:

- Originales manifest/source-reference/source-proposed/source-catalog/source-periods.
- `review.md`: estado y recuentos, sin interpretar un pendiente como aplicado.
- `diff.txt`: identidad y valores antes/después por alta, cambio, vencimiento,
  revocación y conflicto, texto plano para revisión funcional.
- `report.json`: diff detallado, motivos por fila, cobertura por período y procedencia.

Categorías de diff pueden solaparse: acortar una vigencia es cambio y vencimiento;
no se suman recuentos como número de concesiones. Ausencia de una fila previa es
conflicto `missing_requires_explicit_revocation`, nunca DELETE implícito. Revertir
revocación y programar una revocación futura quedan pendientes; SQL08 considera
revocada cualquier fila con revoked_at no nulo. Filas vencidas/revocadas pueden
figurar en el diff y no cuentan como cobertura. Datos ambiguos/roles incompatibles
bloquean revisión lista, no se elige una coincidencia ni se inventa un responsable.

Exit0: propuesta lista para **revisión funcional**, sin accesos aplicados.
Exit2: estructura íntegra con pendientes/conflictos/cobertura incompleta, artefacto
privado disponible. Exit1: entrada/custodia/integridad inválida, mensaje genérico,
sin eco de JSON, rutas, huellas ni identidades. Directorios0700/archivos0600,
escritura temporal y rename; reintento exacto verifica el artefacto previo sin
sobrescribirlo. Resultado alterado => rechazo. Entrada privada nunca es artifact CI.

## Evidencia y demostración exclusivamente sintéticas

- `node tests/lp01-ambitos-import.test.mjs`:12 casos, revisor real compartido:
  repetición, offsets, nocturno/límites exactos, vigencias, cuentas/roles/etapas,
  duplicados, responsables parciales, diff, revocación y formatos incompatibles.
- `node tests/lp01-ambitos-import/privacy.mjs`:7 grupos con CLI real, modos locales,
  reintentos y copias originales, entradas/manifiesto/resultado alterados, JSON
  ambiguo, symlink, archivos legibles públicamente y ausencia de responsables.
- `node tests/lp01-ambitos-import/demo.mjs`: genera únicamente desde fixture
  sintético el [ejemplo público de diff](evidence/demo-synthetic.json):
  **1 alta,2 cambios,2 vencimientos,1 revocación,6 sin cambios**. Categorías
  solapadas, apply=false. No lee entradas privadas ni acepta argumentos de archivo.
- `python tests/lp01-ambitos-import/postgres.py`: [4 grupos SQL](evidence/postgres.json)
  en PostgreSQL17.11 desechable sin red, sin stubs del motor validado. Cinco casos
  de cobertura del importador coinciden con el guard realSQL08 en cuatro ámbitos.
  Los períodos se obtienen de periodo SQL existente; no se simula su horario.
- Continúa el Encargo3 funcional: RPC reales con sesiones capturadas y fuentes
  sintéticas:288=90+90+90+18 en ambas líneas/etapas, SALE explícita de coordinador,
  corrección de acumulado80→90 que deja90 (no170), afectaciones2+2 consolidadas
  explícitamente en2, nota/auditoría, cierre versionado, reapertura de líder
  denegada y arrastre de exactamente P2–P4 al nocturno conservando raíces,
  antigüedad, prioridades y afectaciones, sin duplicar avances. Export y
  asignaciones de Programación completos permanecen iguales antes/después.

La configuración de scopes en esa base es fixture del harness, **no una aplicación
del importador**. CSV-QA solo suministra entrada al cierre real; no certifica XLSX
ni inclusión Export. Sin UI nueva: PC/móvil previo válido reutilizado. Regresiones
afectadas: revisor9, lector6, artefacto privado previo y operación/continuidad8.
No batería general manual ni cambios en SQL01–08/08R. CI puede repetir pruebas
por el diff acumulado del PR; no se atribuye al nuevo HEAD una CI anterior.

## Pendientes y siguiente paso

Faltan matriz/catalogo/períodos reales aprobados por canal privado y su pin de
referencia. En producción el esquema LP/SQL08 sigue sin aplicación acreditada:
no se afirma que una consulta a periodo esté disponible allí ni se aplica SQL
para obtenerla. El responsable DB/funcional debe acreditar los períodos contra
HORARIOS_TURNOS con la lectura autorizada correspondiente, antes de revisión real.

Importador preparado y flujo funcional aislado verificado. Siguiente acción exacta:
recibir y prevalidar esa matriz privada con su universo/períodos completos; mantener
PDT/Export bloqueados solo en fuente y host/escrituras pendientes de autorización.
La comprobación funcional de fuentes y ámbitos reales permanece pendiente, sin
activar accesos para demostrarla. No reabrir bocetos, autoapertura ni otros módulos.

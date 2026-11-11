# Carga semanal: reprogramar producciones existentes

Estado: **IMPLEMENTADO LOCALMENTE, NO APLICADO EN SUPABASE, NO PUBLICADO**.
Base `dc1f89beca30c9483a197b2896c1db314ac34a1d` (main, LAB v437).
Candidata LAB v438, rama `fix/weekly-reprogramming-v438`.

Regla confirmada por Johan el 11/11/2026: «Pero es que en estos caso debe
mover la produccion a la semana que se esta cargando».

## Comportamiento

- Las producciones nuevas se insertan. Las ya existentes por `ID|ID_LINEA`
  pasan a la semana entrante en `sgp_producciones` (base y actual) y
  `sgp_base_semana`. No se eliminan ni se crean nuevas identidades.
- Se conservan cantidad, ensamblado, empacado, saldos, estados, reservas,
  fuente original e ID de carga de la producción. El lote entrante, usuario,
  fuente nueva, semanas anteriores y vínculo base previo se registran en
  `sgp_carga_semanal.movimientos`, privado y sin acceso cliente.
- No se reescriben programas históricos, avances, PDT ni eventos de OPT.
  El trigger PDT ya instalado añade su propio evento de reprogramación.
  Esta regla no cambia el criterio histórico de los cortes OPT.
- La RPC conserva su firma, autorización ADMINISTRADOR/COORDINADOR y ACL.
  Añade serialización entre semanas, locks de filas y conserva atomicidad.
- Los materiales repetidos de producciones existentes se reutilizan por
  multiconjunto tipado, conservando IDs y filas originales completas.
  Metadatos de lote, archivo y período no definen un material nuevo.
  En vidrio se ignoran únicamente `Sem prog.`/`Año prog.` al comparar
  datos_origen; el JSON persistido no cambia.
- Cambios de cantidades/atribución o material sin relación atribuible a la
  orden reprogramada bloquean con detalle antes de modificar la carga.
  Ausencia en el nuevo archivo no borra material anterior. No es una
  deduplicación general de filas ajenas SIN_RELACION.
- `sgp_consultar_piezas_semana` usa la semana efectiva de la producción.
  No se muta `sgp_aluminio.semana`: hacerlo invalidaría snapshots usados
  por PDT. La previsualización de cargas conserva sus conteos históricos
  de importación; no sustituye el resultado detallado de aplicación.
- Cambio de año permanece bloqueado por contrato vivo de PDT; no se
  desactiva el trigger ni se amplía este hotfix a ese caso.
- Una semana ya cargada sigue bloqueada. No hay reintento automático de
  errores inciertos. Altas, reprogramaciones y material reutilizado se
  muestran por separado en la respuesta y en la interfaz.

## Aplicación autorizada y estado

SQL instalado mediante `lab_v438_weekly_reprogram_existing` con autorización de Johan.
Postcheck: writer MD5 `1a6faea29924aed3f0533f800a9b7832`, reader
`aa00d98bec9779c94fb2f1625e38526a`; ACL intactas, helpers privados, ledger
RLS activo y vacío. Semana47 permanece sin bases ni lotes. No se cargaron datos
ni se movieron producciones por instalar código. Publicación v438 autorizada,
pendiente de CI y evidencia final de Hosting. No repetir la instalación.

Secuencia de referencia:

1. Repetir únicamente `00_preflight.sql` y contrastar hashes/ACL con el
   backend vigente. Si cambiaron, detener y conciliar la diferencia.
2. Aplicar `01_install_REVIEW.sql`, que incluye escritor y lector en una
   única transacción con guardas de versión. No cargar datos reales como prueba de instalación.
3. Comprobar firma, hashes, ACL, RLS de la tabla privada y definición del
   lector. Confirmar que no se creó lote ni se movió producción alguna
   solo por instalar el código.
4. Publicar frontend v438 mediante flujo protegido y SHA/artefacto exactos
   cuando exista autorización de publicación. Los pins no se modificaron.
5. El usuario realiza la carga prevista con sus archivos reales. No
   afirmar éxito de semana 47 hasta consultar su lote y resultado.

La instalación agrega un esquema privado, una tabla de historial, dos
helpers internos y reemplaza dos RPC existentes. No cambia grants de
objetos existentes, RLS general, credenciales ni datos operativos.

## Recuperación

`03_restore_code_REVIEW.sql` verifica la versión instalada y restaura solamente
el código. `00_live_baseline.sql` y `00_reader_baseline.sql` contienen las definiciones
exactas anteriores. Restaurarlas recupera el código previo y conserva el
historial nuevo. Tras una carga aceptada **no** borrar el esquema/historial,
no ejecutar una carga inversa y no mover semanas automáticamente: primero
reconciliar cualquier actividad posterior. El código anterior vuelve a
rechazar claves existentes; no es una reparación de datos.

## Pruebas

- `PGLITE_MODULE=<ruta autorizada>/@electric-sql/pglite/dist/index.js node tests/weekly-reprogramming/run.mjs`
- `node --test tests/weekly-reprogramming.test.mjs tests/weekly-sources.test.mjs`
- `npm test`, `npm run build:vendor`, `npm run verify:release`, sintaxis y diff.

58 aserciones SQL sintéticas PASS: 45→47→48, dos líneas, base única,
balances/cantidades conservados, historial y trigger PDT, multiconjuntos,
material ausente/cambiado/sin relación, rollback de fallo tardío, repetición,
roles anon/authenticated, aislamiento ACL, lector, año inmutable, rechazo
de reinstalación y recuperación de código sin revertir datos.
989 pruebas Node PASS, 10 omitidas. Fixture replica columnas/contratos
vivos y usa datos ficticios. No prueba PostgreSQL multisesión, navegador,
archivos reales ni operación de planta.

# OPT: preparación documental de importación

Estado: **IMPLEMENTADO EN COPIA AISLADA, PRUEBAS SINTÉTICAS**. No endpoint
operativo, SQL aplicado, importación persistida, despliegue ni verificación física.
No introduce una aprobación humana obligatoria. La evidencia puede producirse
automáticamente por validación determinista del PDF completo y datos SGP del servidor.

## Entrega y baseline

- Copia de la candidata local `c5b95021183c0aa53a363eb4b0ec924f21f75092`,
  proporcionada por la tarea como código de PR253 `919f824` más preparación CI.
  Esta tarea no volvió a consultar GitHub ni afirma el estado remoto actual.
- Único cambio al extractor: devuelve también `sourceMaterialRows` y
  `sourceProfileSummaries`, ya extraídos. No altera la geometría ni sus reglas.
- `functions/opt-import-manifest-core.mjs`: validador puro.
- `functions/opt-import-manifest-server.mjs`: composición privada propuesta,
  con lector PDF y lector SGP inyectados al iniciar el servidor. No contiene red,
  credenciales, consulta SQL, endpoint ni escrituras.
- `tests/opt-import-manifest.test.mjs`: casos sintéticos. Las bytes `%PDF-...`
  del test de composición **no son un PDF real**; allí se inyecta el lector.

## Contrato público del módulo puro, no del navegador

```js
validateOptImportManifest({document, extraction}, server)
```

`document` contiene `sha256`, `sourceKey`, `origin` (`RETAIL`, `PROYECTO` o
`DESCONOCIDO`), `opt` y `mode` (`INDICE` o `INDIVIDUAL`). `extraction` es el
resultado íntegro de `extractCoordinatePlans(pages)` calculado en servidor a partir
de las mismas bytes cuyo SHA se está validando. No se prefiltran piezas por línea.

`server`:

```js
{
  schema: 'sgp.opt.server-evidence.v1',
  pdfSha256: 'SHA256 de las bytes',
  revision: 'identificador de la lectura consistente',
  scope: {linea:'PANELES_2', anio:2026, semana:46, modo:'BASE'},
  indexRows: [{
    rowId:'fila de índice', pdfSha256:'SHA256 de las bytes',
    sourceKey:'fuente exacta', origin:'RETAIL', opt:'consecutivo',
    reservation:'reserva', system:'sistema'
    // Solo si constan explícitamente en fuente documental:
    // sourceRowId, documentProduction, reference, key_produccion, id_programacion
  }],
  bindings: [{
    documentProduction:'producción documental', key_produccion:'clave SGP',
    id_programacion:'UUID', reserva:'reserva asociada', sistema:'sistema',
    id_linea:'PANELES_2', anio:2026, semana_base:46,
    activa:'SI', excluida_export:false,
    reserva_principal:'principal real', programacion_reserva:'principal real',
    reserva_snapshot:'principal real', estado_programacion:'SIN INICIAR',
    cantidad_snapshot:1
  }]
}
```

`cantidad_snapshot` acredita una programación válida con cantidad positiva;
**no** se usa para asignar cantidades de cortes, que pertenecen al PDF. `semana_actual`
no sustituye `semana_base`. Las reservas asociadas permanecen asociadas a su
principal real, no se sustituyen por ella al asignar.

El lector servidor tiene que resolver `documentProduction` a la identidad real SGP
mediante un campo o relación acreditados. No puede inventar la relación partiendo
de un prefijo arbitrario de `key_produccion`, el nombre del sistema, la longitud o
el orden de filas. Debe validar la pertenencia real en `sgp_produccion_reservas_v`
y la relación producción/programación/detalle usada por `sgp_opt_shared.bound`.

La lectura debe ser completa para esas producciones documentales, incluidas otras
líneas, reservas y programaciones. Prefiltrarla hasta dejar un único candidato
ocultaría ambigüedad. Las filas del índice son relaciones del PDF concreto
verificadas por servidor; nombre de archivo o consecutivo solos no bastan.
En modo individual el servidor necesita una relación documental explícita con el
mismo formato, aunque no haya XLSX. Si esa evidencia no existe, devuelve bloqueo.

**Esta estructura valida contenido, no autentica su origen.** Un objeto con
`schema`, `verified:true` o `approved:true` no prueba autoridad. El servidor no
debe aceptar este objeto ni `extraction` desde un request o desde el navegador.
Debe verificar sesión/acceso al contexto y obtener las relaciones por su propio
canal privado, en una lectura consistente. El módulo no implementa ese canal.

## Composición disponible

```js
const prepare = createOptImportPreparation({readPdfPages, readServerEvidence});
const result = await prepare({pdfBytes, source});
```

- `source` solo localiza la fuente; el servidor debe comprobarla en su índice.
- La composición copia las bytes, valida encabezado/tamaño y calcula SHA256 real.
- `readPdfPages(bytes)` debe leer todas las páginas y devolver coordenadas/reglas
  pintadas en el formato existente. Después corre el extractor real.
- `readServerEvidence({document, documentaryRows})` es una dependencia privada de
  arranque; no se obtiene de una petición ni acepta evidencia de confianza cliente.
- Datos cliente adicionales como `manifest`, `serverEvidence`, `sha256`,
  `extraction` o indicadores de aprobación no se utilizan.
- Errores de lectura no generan aprobación ni fallback a datos del navegador.

## Qué se concilia y qué permanece separado

1. Exige detalle de proyecto con celda impresa, resumen de materiales y resumen
   de perfil. Comprueba que ninguna extracción tenga errores o cortes inciertos.
2. Compara el multiconjunto entero de perfil, acabado, medida exacta y referencia
   documental con cantidades. Compara también largo/código/cantidad de barras.
3. Reutiliza `reconcileIndividuals` para cobertura por fila, referencias completas
   y cantidades; `ROW_GROUP_MATCH` es válido para unidades documentales repetidas.
   Varias filas indistinguibles permanecen bloqueadas, nunca se reparten por orden.
4. Reutiliza `reconcileOptSummary` para totales, y contrasta el balance impreso de
   cada perfil. Comprueba el largo sobrante sin certificar hipótesis de sierra,
   reutilización, posición física, pasada de corte o barra de inventario.
5. Resuelve el vínculo SGP solo por producción documental y selectores explícitos
   del índice. Cero o varios destinos, hechos contradictorios o programación
   inválida producen bloqueos concretos con fila y candidatos cuando aplica.

### PDF mixto de toda la empresa

Se concilia e incluye **todo el PDF**. Una identidad SGP inequívoca de otra
línea conserva sus unidades y medidas con
`asignacion:null` en `pieces`, `scopeStatus:'FUERA_ALCANCE'` y explicación del
destino resuelto en `units`. Todas las unidades con vínculo válido de PANELES_2 conservan su asignación y semana original, aunque difiera de la semana visible. La semana es filtro de consulta/registro, no razón para perder el vínculo del documento inmutable.
La identidad y la línea deben ser inequívocas antes de excluir por ámbito.
No se exige programa de mecanizado a una línea excluida y no se le crea ninguna
asignación. Para PANELES_2 siguen siendo obligatorios el programa único vigente,
la actividad, el estado exportable y todos los vínculos operativos. Una identidad
SGP ausente, desconocida o contradictoria no se oculta tras un `null`.

La propuesta SQL actual hace el manifiesto y las asignaciones inmutables. Volver a
importar el mismo PDF para otra línea con asignaciones diferentes no es un
replay: requiere reconciliación/versionado posterior, que esta entrega no implementa.
No borra ni sustituye el documento previo para permitir una reasignación.

## Resultado

Bloqueo: `status:'BLOCKED'`, `importable:false`, `manifest:null` y `blockers`.
Éxito: `status:'DOCUMENTARY_MANIFEST_READY'`, `importable:true` y `manifest` con:

- `pieces`: forma exacta de la propuesta SQL `import_manifest`, incluidos `null`
  para unidades inequívocamente fuera del alcance. No tiene usuario, turno ni evento.
- `units`: trazabilidad a la fila documental y coordenadas, `length32`,
  `millimetersExact`, estado inicial `PENDIENTE` y ausencia de identidad de inventario.
- `totals`: todas las barras/cortes/longitudes documentales.
- `scopeTotals`: unidades asignadas y fuera de alcance, sin descartar ninguna.
- Fuente exacta, SHA del PDF, revisión del servidor y contexto BASE. Cada unidad conserva originalScope y distingue OTHER_ORIGINAL_WEEK sin desasignarla.

Identidad determinista: `(PDF SHA, página inicial del patrón, fila geométrica del
patrón, repetición de barra, número de corte)`. El número de corte se obtiene de
columna/slot/unidad impresos ordenados, nunca de longitud, destinatario ni orden de
entrada del arreglo. Se conserva la página real del corte, incluso en continuaciones.
Cambios futuros del algoritmo requieren revisar la compatibilidad de identidad;
no se promete estabilidad entre versiones arbitrarias del extractor.

La conversión usa `1/32 inch = 127/160 mm`, calcula el decimal mediante enteros
BigInt y verifica su representación JSON. No usa tolerancias, `toFixed` ni redondeo.
El rango legal de piezas respeta `0 < longitud_mm < 100000` de la propuesta SQL.
No se calcula `manifest_sha256` de SQL mediante `JSON.stringify`: el hash SQL
corresponde a la representación canónica `jsonb::text` y debe calcularse allí.

`importable:true` significa que este paso documental pasó. No demuestra persistencia,
autorización de ejecución, turno ni corte físico. `productionEnabled` y
`physicalCompletionVerified` siempre son `false`. El usuario marcará lo cortado
posteriormente por el flujo compartido con su usuario y periodo servidor.

## Evidencia y límites

Pruebas nuevas: 30/30 PASS localmente, incluidas mezcla de líneas sin pérdida de
cantidades, ambigüedad, fuentes Retail/Proyecto/individual, referencias repetidas,
aislamiento cliente y comprobación exhaustiva de las 125.984 longitudes legales.
Regresiones del extractor, conciliación individual y resumen: 27/27 PASS. Se
reutilizó esa evidencia tras cambiar únicamente el validador; no se repitieron SQL,
navegador, CI completo, suite global ni publicación. No hay prueba con PDFs privados
ni consultas SGP reales en este encargo.

El lector y endpoint servidor ya están integrados en esta candidata, con pruebas
sintéticas de PDF/índice/SGP y persistencia atómica. Véase
[contrato del endpoint](../opt-import-endpoint/README.md). La ejecución alojada y
la activación se verifican por separado; las pruebas sintéticas no acreditan
disponibilidad productiva.

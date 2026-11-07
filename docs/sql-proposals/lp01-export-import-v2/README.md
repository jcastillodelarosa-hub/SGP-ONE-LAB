# Importación Export · contrato 3 transaccional contenido

IMPLEMENTADO EN PAQUETE LOCAL / PROBADO CON POSTGRESQL AISLADO / DESACTIVADO.
Este incremento implementa **IMPORTAR**, no CERRAR V2 ni el motor completo.
ENSAMBLE/PANELES_2 exclusivamente. No aplicado, publicado ni activado.

## Transporte y persistencia reales

Se reutilizan `createPowerBIHandler`, el parser LP-PBI-XLSX-1, sesión SGP y el RPC
existente `sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb)`, restringido
a service_role. No nueva ruta, RPC, credencial, rol, ACL ni job.

El factory añade la opción interna `exportProductionV2=false`. El entry point
Deno `supabase/functions/lp-powerbi/index.ts` permanece idéntico y **no la activa**.
Una petición con `command.authority='EXPORT_PRODUCTION_V2'` solo pasa si el servidor
habilitó expresamente esa opción. No se acepta la autoridad desde un flag del
navegador como autorización. Sin ese campo, el transporte conserva la ruta legacy.

El SQL propuesto añade `config.export_production_v2 NOT NULL DEFAULT false`.
Requiere bandera explícita, escrituras/formato actuales, piloto exacto, sesión,
operación y ámbitos vigentes. No hay sentencia de activación en el instalador.

El handler real vuelve a parsear y hashear los bytes originales antes del RPC.
La transacción real existente mantiene admisión/config, mutex por ID y etapa,
lock de turno, CAS, restricciones de corrección y triggers de auditoría/ámbito.
La rama V2 bloquea además catálogo/programación con SHARE NOWAIT y reautoriza;
un programador/exportador concurrente incompatible produce rechazo/reintento,
no una espera con orden de bloqueos invertido. Concurrencia multisessión pendiente.

Dentro de la misma transacción:

- Conserva el archivo original y SHA en `archivos`, deduplicando únicamente bytes.
- Guarda en el recibo/auditoría una versión de importación y cobertura completa
  PRESENT/ABSENT del archivo actual. Los ausentes conservan su último valor y fuente
  del mismo contexto; quantity=null solo si nunca informado, nunca cero implícito.
- Guarda universo fuente del servidor y su huella: órdenes/revisiones, identidad
  canónica y programación. Una raíz programada sin incorporar no puede desaparecer.
- Agrupa Export por producción y no modifica asignaciones, plan, ejecutado ni saldo.
- Nueva carga reemplaza los PRESENT y conserva los ABSENT acreditados; todas las
  versiones previas quedan. No suma cargas.
  El mismo ID/payload devuelve recibo; reutilizar ID con otro contenido se rechaza.
- Si un mismo hash ahora resolvería a identidades diferentes del original guardado,
  rechaza sin reescribir el archivo histórico.
- Ante revocación al confirmar, archivo, auditoría y revisión se revierten juntos.

Respuesta adicional: `contract='LP-EXPORT-IMPORT-3'`, `authority`, `importId`,
`universeRevision`, `universe`, `rows`, `reported`, `absent`, `preserved`,
`neverReported`, `updateMode=REPLACE_PRESENT_PRESERVE_ABSENT`,
`canClose=false`. No anuncia `closeAuthority` en consultar.

Cada fila incluye valueStatus/valueSource con archivo/hash/lote originales. El
contrato y pruebas de recarga/cierre se detallan en
[PARTIAL_REIMPORT_V3](../lp01-export-close-v2/PARTIAL_REIMPORT_V3.md). Contract2 nunca
fue aplicado y se rechaza como fuente de una nueva recarga3.

## Límite deliberado de este checkpoint

CERRAR legacy no debe interpretar evidencia V2 contra ejecutado por UUID. El delta
secuencial de comando, sobre **4d73b1b0df7d7edb53d1adf3e462f48e** posterior a
INCORPORAR, añade solo esa frontera: si el período tiene una importación V2,
CERRAR devuelve `EXPORT_V2_CIERRE_TRANSACCIONAL_PENDIENTE`. Otra carga legacy no
permite eludirla. ABRIR no se altera; no se guarda ningún cierre V2 ni se modifica
realizado, arrastre o presupuesto. Esto no decide si puede abrirse un turno con
el anterior sin cerrar. La propuesta INCORPORAR y su descubrimiento no se tocan.

Por tanto **no está listo para habilitar el flujo de cierre**. El paquete posterior de CERRAR y su lector3 existen
localmente, pero faltan fuente versionada del plan, continuidad/presupuesto por
producción y validación multisessión. El frontend sigue preview-only. Esta entrega reduce la
brecha del importador real; no sustituye con callbacks su transacción SQL.

## Dato exacto pendiente para presupuesto

La fuente oficial observada en el código conserva `ultima_carga_diaria`, historial
y saldo, pero no un vínculo acreditado entre ese corte y las versiones de cierres
LP ya incluidas. Para descontar solo una vez, por key/etapa se necesita:

1. Identidad inequívoca del corte y evidencia de su contenido/cobertura completa.
2. Lista de cierres LP y versiones incluidos en ese saldo, o una frontera equivalente
   emitida por la fuente oficial que cubra correcciones/reaperturas sin ambigüedad.
3. Evidencia de exclusión de cierres posteriores y tratamiento de ausentes filtrados.

Fecha de carga, diferencia entre dos saldos o hash de JSON arbitrario no prueban
inclusión. Para V2 no se necesita inventar una distribución por raíces; la futura
conciliación será por producción/período. Hasta ese vínculo,
`budget/continuity=RECONCILIATION_REQUIRED`; no se calcula disponibilidad nueva.
No se afirma que este dato sea la única brecha: plan versionado y activación segura
siguen pendientes en el paquete completo.

## Pins y recuperación

`manifest.json` fija cuerpos antes/después y SHA256. Importador base reconstruido
exactamente del SQL08 versionado: **eae247d88b7e82d4dc365840dfb03e45**. No se hizo una
nueva lectura productiva ni se presume que ese hash sea el estado vivo. El preflight
rechaza cualquier diferencia, además de cambios de sesión, ámbitos, admisión,
matriz de roles, perímetro service_role, RLS y command posterior a INCORPORAR.
No sobrescribir ni relajar pins si difieren.

`02_restore_adapter_REVIEW.sql` exige bandera false y drena config antes de restaurar
exactamente los dos cuerpos previos. Conserva columna false, archivos y auditoría;
no borra evidencia ni deshace incorporaciones. El handler se revierte con el hunk
inverso exacto del delta; el entry point nunca cambió. Reinstalación, rollback
repetido o fuente modificada se rechazan.

Prerequisito de pruebas: paquete INCORPORAR en el repositorio; el harness usa sus
fuentes capturadas de autenticación y aplica su propuesta solo en PGlite en memoria.

    node tests/lp01-export-import-v2/adapter.mjs

Siete grupos PASS, PostgreSQL18.6/PGlite0.5.15, handler Request/Response real,
XLSX sintético y sesiones/roles/ámbitos reales capturados, sin credenciales externas.
Incluye revocación diferida al COMMIT y rechazo atómico. No es prueba de Edge
productiva, concurrencia real, sesión de planta ni activación autorizada.

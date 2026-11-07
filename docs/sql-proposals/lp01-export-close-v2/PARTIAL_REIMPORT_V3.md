# Recarga parcial por producción · contrato 3

IMPLEMENTADO LOCALMENTE / DESACTIVADO / NO APLICADO. Piloto ENSAMBLE/PANELES_2.
Los directorios, nombres de factory y autoridad `EXPORT_PRODUCTION_V2` se conservan
para no cambiar capacidades ni flags. Los formatos sí cambian explícitamente a
`LP-EXPORT-IMPORT-3`, `LP-EXPORT-CLOSE-3` y `LP-REALIZADO-CIERRE-3`. El estado de la
referencia aislada es `LP-EXPORT-PRODUCTION-3.0.0-ISOLATED`.

## Regla y procedencia

Una recarga sustituye únicamente las cantidades presentes en su archivo, nunca
las suma. Las ausentes conservan el último valor acreditado en una importación
confirmada por COMMIT del mismo key/etapa/línea/fecha/turno. Si nunca existió una
cantidad acreditada en ese contexto, el valor sigue null. Cero explícito es cero,
incluso cuando luego queda ausente. Reapertura/corrección no borra esas fuentes.

Por fila:

- `coverage`: PRESENT/ABSENT **en el archivo actual**.
- `valueStatus`: CURRENT_FILE, PRESERVED o NEVER_REPORTED.
- `quantity` (importación) / `realized` (cierre): valor efectivo, null solo si nunca
  informado. `preserve=true` para ABSENT.
- `sourceRows`: filas del archivo actual, `[]` para ABSENT.
- `valueSource`: null si nunca informado. En otro caso contiene `importId`,
  `importVersion`, `universeRevision`, `context={stage,line,date,shift}` y
  `file={id,name,sha256,adapter}`, más las `sourceRows` **del origen de la cantidad**.

El archivo del encabezado es el de la recarga actual. No se atribuye a él una
cantidad conservada. El lector proyecta `fileId/sha256/importId` por fila desde
`valueSource`, o null sin fuente. Los informes deben distinguir original actual y
originales conservados. Totales de presentes, conservados y nunca informados se
mantienen separados; un total completo con un valor desconocido no es cero.

Ejemplo: A7/B5 → archivo A3 produce A3 CURRENT_FILE, B5 PRESERVED. El B5 continúa
apuntando al lote/archivo que informó B5, no al de A3. Un C nunca informado es null.

## Qué comprueba SQL

El mismo fragmento `../lp01-export-import-v2/project-rows-fragment.sql` reconstruye
la proyección en IMPORTAR y otra vez en CERRAR, bajo admisión, mutex/CAS, lock de
turno y SHARE NOWAIT ya existentes. Busca la última fila PRESENT confirmada de cada
key en el mismo contexto, no sigue cadenas de ABSENT ni usa cantidades del cliente.
Verifica recibo/versión/huella, original binario/SHA, metadata de archivo y grupo de
filas/cantidad. Una fuente alterada o cruzada se rechaza; no se convierte en cero.
CERRAR exige igualdad exacta de la proyección reconstruida y el recibo vigente.

La huella de universo sigue exigiendo reimportar si cambian órdenes/programación/
identidad. Reimportar reconstruye el universo vigente y conserva valores anteriores
por key del mismo contexto. Nuevas keys sin fuente son NEVER_REPORTED; sus originales
anteriores no se borran ni se redistribuyen a otras keys/UUID.

Contract2 nunca se aplicó ni publicó: no se migra silenciosamente. Una nueva carga
con historia de la autoridad V2 en formato2 se rechaza. El lector rechaza snapshots2.
Recibos antiguos solo pueden devolverse como replay histórico con su formato propio,
que el handler3/lector3 no acepta como un resultado3. Instalación sigue exigiendo la
base exacta anterior a estas propuestas; no es un actualizador de una instalación2.

## Plan, Disponible y contención

La regla funcional ya está aprobada: cumplimiento frente al plan vigente al cierre,
conservando plan original y cambios con motivo/hora. No falta otra decisión funcional.
El planificador identificado como hoja de Ensamble y el RPC capturado
`tests/lp01-hoja/production-readonly/sgp_linea_plan_programar.sql` validan
`saldo_ensamble`: la ausencia de columna etapa, por sí sola, no demuestra que falte
fuente para Ensamble. La brecha técnica pendiente es un historial íntegro de
versiones/cambios/motivo/hora y su vínculo con el plan efectivo al cierre. No se
extiende esa fuente a Empaque ni se sustituye por SALE UUID o Disponible global.

`plan/difference/pendingAgainstPlan=null`, `PLAN_SOURCE_REQUIRED`,
`comparisonComplete=false`. `budget.available` y `continuity.quantity` siguen null,
`RECONCILIATION_REQUIRED`, sin tocar Disponible. Falta acreditar la referencia
inicial/corte Export para aplicar solo deltas sin descontar dos veces. Este delta
no implementa esos cálculos ni autoriza cerrar/cumplir operativamente.

Ambas puertas siguen default false; no hay enable, permisos, roles, credenciales,
jobs, cambios de helper legacy, módulos UI o producción. Los consumidores legacy
siguen contenidos tras historia de cierres de esta autoridad. La inversa exacta
sigue rechazando cualquier cierre existente; se conserva toda historia.

## Evidencia focal

- `node tests/lp01-export-import-v2/adapter.mjs`: transporte/importador real aislado.
- `node tests/lp01-export-close-v2/adapter.mjs`: cierre y recuperación aislados.
- `node tests/lp01-export-close-v2/partial.mjs`: secuencia parcial, procedencia,
  cero conservado, nunca informado, universo, reapertura, corrupción y rollback.
- `node --test tests/lp01-closure-export-v2.test.mjs tests/lp01-export-production-v2.test.mjs tests/lp01-export-partial-v3-reader.test.mjs`.

Las dos fixtures `tests/fixtures/lp01-export-partial-v3-*-readback.json` proceden del
`consultar` real en PostgreSQL18.6/PGlite con datos sintéticos. No son datos de planta.
B15/CSV se integra por separado por coordinación. No se repite auditoría productiva
ni se acredita concurrencia multisesión con este motor de una sola conexión.

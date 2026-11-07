# Plan versionado de Ensamble · piloto contenido

**IMPLEMENTADO Y PROBADO EN SQL AISLADO / PROPUESTO / NO INSTALADO / DESACTIVADO.**
Base aislada `518eb2d76c2036be1bc31d225b01068129fbdebe`, árbol de v405.
Solo ENSAMBLE/PANELES_2. No modifica el checkout de integración, cuerpos del
planificador, comando, importación, cierre, lectores runtime ni permisos existentes.
No publica RPC, concede EXECUTE, crea credenciales ni activa funciones.

## Resultado real

`01_plan_REVIEW.sql` crea tablas privadas persistentes de versiones, cabeceras,
recibos y mutaciones. No es una referencia en memoria. Las pruebas sí emplean una
base PostgreSQL WASM efímera y datos sintéticos, no prueban instalación productiva.

- Captura el estado fuente **antes** y **después** del cambio, versiona cada turno
  afectado y conserva filas completas, IDs y `origen_id` de divisiones/movimientos.
- Los adaptadores privados `plan_programar`/`plan_mover` llaman los cuerpos reales
  capturados, sin sustituirlos. Actor desde sesión validada, nunca desde payload;
  reutilizan además sesión LP y ámbitos individual/de rol/temporal. Motivo y UUID
  de petición son entradas nuevas obligatorias; reintento idéntico devuelve recibo.
- La primera versión es `OBSERVED_AT_ENROLLMENT`. No se llama plan original:
  `historyBefore=UNKNOWN`, actor/motivo/petición históricos nulos. Se conserva el
  original **observado** y los cambios desde entonces, no se reconstruye el pasado.
- La fuente existente no distingue etapa. Solo se acredita como Ensamble. No se
  reutiliza ni se infiere un plan de Empaque.
- La huella incluye todas las asignaciones del período y el booleano de exclusión.
  Los objetivos suman cantidades de asignaciones no CANCELADA y no excluidas por
  aprobación Export. Nunca SALE, Disponible, ejecución manual o saldo Export.
- Falta del archivo no significa exclusión. Se exige la columna v406 booleana
  NOT NULL, sin crearla. Los snapshots anteriores nunca se reescriben al excluir.

## Cobertura y fail-closed

La bandera privada `plan_control.enabled` se instala **false**. En ese estado los
triggers no generan historia ni exigen nuevos campos al planificador legacy.
Los cuerpos/OID/owner/ACL/search_path/SECURITY DEFINER existentes quedan intactos.

Con bandera true, cambios fuera de una ruta instrumentada dejan mutaciones sin
atribución y ensucian la cabecera (`dirty`), incluso cambiar y deshacer. Se cubren
INSERT/UPDATE/DELETE de asignaciones y únicamente cambios de `excluida_export` o
`id_linea` de producción. No se inventa motivo ni actor de esos cambios. Cancelar
por una ruta no instrumentada **no** recibe una autorización nueva: invalida el
plan acreditado y deja evidencia. Los otros campos del catálogo no son objetivos.

`plan_snapshot(date,integer)` conserva locks SHARE NOWAIT de producciones y
asignaciones hasta COMMIT y vuelve a comprobar fuente/huella/generación/dirty.
No basta con encontrar una última versión. El caller mantiene esa transacción
abierta hasta guardar el cierre y reautoriza **todo** su universo. La huella es
SHA256 del JSONB canónico PostgreSQL con fuente normalizada a UTC; un hash de navegador no acredita nada.

Las versiones, eventos y recibos rechazan UPDATE/DELETE; los clientes técnicos no
pueden leer/escribir estas tablas ni ejecutar helpers. Los contextos de captura
son privados y transaccionales, no GUCs confiados al cliente. Un contexto sin
finalizar impide COMMIT. Fallo posterior de auditoría/cierre revierte el conjunto.

Cada cambio de bandera cambia generación. Rehabilitar no vuelve válidos snapshots
capturados antes de un intervalo sin observación. La primera captura de la nueva
generación vuelve a declarar historia previa UNKNOWN y conserva las generaciones
anteriores. No hay endpoint de reset ni corrección automática de un dirty.

## Contrato para cierre

Contrato exacto y llamada mínima en [CONTRACT.md](CONTRACT.md). Ejemplos generados
por SQL en `tests/lp01-ensamble-plan/snapshot-sql.json` y `comparison-sql.json`.

`plan_comparar(date,integer,realizedRows)` une todos los objetivos actuales con la
proyección Export **ya acreditada por el escritor de cierre**. No importa archivos
ni confía en cantidades declaradas por el navegador. Devuelve:

- `difference = realized - plan`.
- `pendingAgainstPlan = max(plan - realized, 0)` si realizado es conocido.
- Realizado no informado es null, no cero.
- Plan cero solo para una key explícita elegible actual, no excluida y del piloto,
  realmente sin asignaciones activas en ese turno. No se calcula porcentaje.
- `comparisonComplete=true` requiere realizado conocido para toda la unión de
  keys y un plan vigente acreditado. Puede ser true aunque la historia anterior
  sea UNKNOWN. No afirma historia original recuperada ni conciliación/continuidad.

El helper privado **no reemplaza** la autorización de cobertura del cierre. El
caller debe autorizar el universo completo plan + Export, sin filtrar silenciosamente
objetivos no autorizados o faltantes. SQL LP-EXPORT-CLOSE-3 y su lector actual aún
no están conectados y seguirán rechazando/ignorando esta autoridad hasta su rebase.

## Integración mínima que falta

1. Parent integra fragmentos [INTEGRATION.md](INTEGRATION.md) en INCORPORAR
   post-v406, usando actor `u` autenticado y motivo ya auditado, dentro de su misma
   transacción. No editar/aplicar la cadena vieja import/close para evadir pins.
2. Planificador: preparar un transporte revisado para `motivo` + `requestId`, sin
   quitar las firmas antiguas. La UI actual `planner-operations-v326.js` no puede
   proporcionarlos. Estos adaptadores son privados, sin endpoint/GRANT; no activar
   captura hasta completar esa frontera. No hace falta inventar un motivo legacy.
3. Import/cierre: rebase separado contra INCORPORAR post-v406, reautorización de la
   unión completa y snapshot inmutable dentro de la transacción final. Quedan
   pendientes UI de motivos/cierre, conciliación y continuidad por producción.
4. PostgreSQL17 multisessión: acreditar cambio contra cierre, cambio+revocación,
   contención, orden de locks con escritores legacy/Export y exclusión concurrente.
   PGlite no certifica esas carreras. No se ejecutó Docker/browser/SQL remoto.
5. Instalación y activación requieren aprobación específica, estado final de v406
   y readback. Ningún SQL de este paquete fue aplicado.

## Recuperación

`02_contain_REVIEW.sql` apaga la bandera y cambia generación, conservando toda la
historia y los datos fuente. Los escritores originales nunca fueron reemplazados;
continúan funcionando. Los triggers quedan inertes, no se borran tablas/columnas,
no se restauran cuerpos por debajo de otra entrega ni se elimina evidencia.
La futura activación debe drenar el origen bajo el mismo lock de asignaciones;
no habilitar capturas en medio de escrituras antiguas pendientes.

## Evidencia focal

- `node tests/lp01-ensamble-plan/pglite.mjs`: **8 grupos PASS**. Instalación atómica,
  compatibilidad false, permisos privados, fuentes reales, versiones/replay,
  rollback/inmutabilidad, movimientos/origen, dirty y huella independiente.
- `node tests/lp01-ensamble-plan/comparison.mjs`: **4 grupos PASS**. Comparación,
  ausencia/zero, ámbito/exclusión, revocación real individual/de rol, cambio+undo
  de catálogo y contención; exporta ambos ejemplos SQL, no mocks JSON manuales.
- Parent verificó el ejemplo SQL con su lector estructural: versión2/objetivo3,
  historia anterior UNKNOWN conservada. No se repitió SQL para esa compatibilidad.

No prueba productiva, no publicación, no apertura automática ni Empaque.

## Decisión posterior recibida por coordinación

Usuario confirmó que el nuevo turno puede trabajar al llegar su horario aunque el
anterior siga sin cerrar. No autoriza cerrar el anterior ni inferir arrastre. Esta
entrega de plan no implementa apertura ni ejecutor y no modifica sus privilegios.
La aprobación de publicar el paquete técnico no constituye activación productiva.

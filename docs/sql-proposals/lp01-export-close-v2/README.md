# CERRAR Export V2 · adaptador SQL transaccional contenido

IMPLEMENTADO LOCALMENTE / PROBADO EN POSTGRESQL AISLADO / DESACTIVADO.
Piloto exacto ENSAMBLE/PANELES_2. Contrato3: ver [recarga parcial](PARTIAL_REIMPORT_V3.md). Delta posterior a IMPORTAR V2 e INCORPORAR.
No instalado en Supabase, no publicación, no nueva autorización o credencial.

## Qué añade realmente

Una rama ejecutable de CERRAR en la **fachada existente**
`sgp_lp_operacion_comando(text,jsonb)`. Inserta snapshot en `cierres`, cambia estado
/revisión del turno y registra el recibo en `auditoria`, todo en la misma transacción.
No es el servicio de referencia en memoria del primer paquete.

Campo explícito `close_authority='EXPORT_PRODUCTION_V2'`, `import_id` del recibo y
`file_id` del original, más el CAS/ID/observación/motivos actuales. `turn_revision`
se admite opcionalmente para el transporte existente, solo como entero JSON seguro
igual a `revision` y a la revisión bloqueada del turno. Solo actividad
con Export acreditado; SIN ACTIVIDAD V2 se rechaza. La ruta vacía legacy sigue
existiendo donde no hay importación V2, con sus controles anteriores.

La columna privada `config.export_close_v2` se crea NOT NULL DEFAULT false. También
requiere la bandera de importación, escrituras y formato XLSX aprobados. Instalación
exige importación contenida. No contiene activación. No cambia roles, ámbitos,
permisos, SECURITY DEFINER, propietarios, search_path, trabajos ni rutas públicas.

Antes de guardar:

- Mantiene sesión, operación CERRAR, ámbitos, mutex ID/etapa, lock del turno, CAS,
  coordinación en correcciones y triggers reales de autorización al COMMIT.
- Congela catálogo/programación SHARE NOWAIT y reautoriza. Rechaza fuentes ocupadas,
  sin esperas en orden invertido con sus escritores externos.
- Exige el último lote importado, revisión actual del turno, original/hash exactos
  y universo fuente igual al importado. Cambios de plan/key/nombre/línea o reapertura
  requieren reimportar; una observación posterior también invalida ese CAS de lote.
- Persiste Export por key sin usar SALE como plan autorizado ni exigir validación
  manual por UUID. Plan y comparación quedan null/PLAN_SOURCE_REQUIRED. Una fila
  por producción; ningún reparto UUID.
- PRESENT sustituye con cantidad explícita, incluso cero. ABSENT conserva la última
  cantidad acreditada con su fuente, o null si nunca informado.
  Ausentes requieren motivo. Los desvíos no se calculan sin plan acreditado. Cantidad/filas presentes deben coincidir
  con el archivo persistido. Motivos ajenos y campos adicionales se rechazan.

Respuesta/snapshot: `LP-EXPORT-CLOSE-3`, autoridad, versión, ID de lote, huella de
universo, archivo/hash, filas por producción y motivos. UUID y ejecución manual se
conservan dentro de `manualHistory/HISTORICAL_ONLY`, no como realizado vigente.
Los snapshots anteriores permanecen al corregir. Un reintento devuelve su recibo;
el mismo ID con otro propósito se rechaza.

## Identidad histórica por producción

Cada fila guarda `identity={key,line,production,system}` directamente desde
`public.sgp_producciones`: `key_produccion`, `id_linea`, `produccion`, `sistema`.
Se copia al cerrar bajo el bloqueo SHARE NOWAIT existente, para PRESENT y ABSENT,
sin normalizar ni completar campos. `system:null` se conserva como dato desconocido;
un cambio posterior del nombre o sistema no modifica reportes históricos.

Esta identidad describe el catálogo **al cerrar**, no acredita un corte Export ni
cambia su huella de importación. No se reconstruye consultando el catálogo futuro.
Los lectores V2 pueden aceptar snapshots anteriores sin `identity` como identidad
no disponible, nunca inventarla. No altera autoridad del plan, flags o permisos.

## Cierre independiente, continuidad todavía desconocida

**No necesita inventar disponibilidad para persistir el cierre.** El realizado
proviene del Export por producción/fecha/turno, no del saldo diario.

La regla aprobada es el plan vigente al cierre con original/cambios/motivo/hora.
Falta su historial técnico completo, no una decisión funcional. `plan`, `difference` y
`pendingAgainstPlan` quedan null para todas las filas; `comparisonComplete=false`
y `planComparison=PLAN_SOURCE_REQUIRED`. Programación y órdenes/SALE se guardan
como referencias HISTORICAL_REFERENCE_ONLY/HISTORICAL_ONLY sin sumarlas.
Disponible global no se transforma en plan ni se reparte entre turnos o UUID:
`../lp01-order-sale/README.md` define `operational:false` y
`temporalPolicy:UNRESOLVED`. **Esta preparación no satisface comparación ni motivos
de desvío, y no autoriza un cierre operativo sin plan.**
`budget.available=null` y `continuity.quantity=null`, ambos
`RECONCILIATION_REQUIRED`; `allocation=NONE`, `canContinue=false`.

Falta el vínculo acreditado corte Export oficial→cierres/versiones incluidos,
con cobertura de correcciones y de ausentes. Fechas de carga, diferencias de saldos
y hashes creados por el navegador no lo sustituyen. Detalle del dato requerido en
`../lp01-export-import-v2/README.md`. La conciliación futura será por producción,
no requiere fabricar aportes de UUID.

## Protección de consumidores legacy

Un cierre V2 no puede volverse ejecución manual cero para el motor viejo:

- ABRIR legacy se rechaza antes de insertar el turno o materializar arrastre cuando
  existe historia V2 anterior o del período que pretende abrir en el piloto.
- SALE/EJECUTAR/LIBERAR e INCORPORAR se rechazan para keys con historia de cierre V2
  mientras no exista el adaptador de conciliación. No se calculan cantidades falsas.
- Las operaciones de notas/corrección autorizada siguen su contrato; INCORPORAR de
  una producción no afectada conserva su comportamiento. Su propuesta original no
  se modifica; el control añadido pertenece a este delta secuencial.
- La protección depende de la evidencia V2, no de que una bandera siga prendida.
  Apagarla no vuelve segura la interpretación por UUID.

Estas son fronteras técnicas de contratos incompatibles. **No deciden la pregunta
funcional de abrir automáticamente si el turno anterior sigue sin cerrar**: el
camino previo sin evidencia V2 conserva sus reglas originales, sin cambios aquí.

## Compatibilidad de lectura versionada, sin activación

`consultar` no se modifica y no anuncia `closeAuthority`. La carga/cierre frontend
sigue preview-only. El helper legacy `closureExportRealized` permanece intacto y
rechaza V2, incluso con cobertura completa; esa evidencia SQL sigue válida.

La integración posterior de lectura utiliza
`src/domain/lp01-closure-export-v2.js`: selecciona explícitamente el contrato del
cierre vigente y valida contexto, versión, identidad, lote/archivo, cobertura y
cantidades. El formato3 exige valueStatus y valueSource por cantidad. ABSENT
conserva la cantidad anterior acreditada o null si nunca informado; formato2 se
rechaza explícitamente. Ver PARTIAL_REIMPORT_V3.md para procedencia exacta. Reabrir invalida el Realizado vigente. Los informes pueden
validar una versión archivada sin presentarla como actual.

B15 usa identidad histórica del snapshot y no el catálogo actual. Identidad/sistema
sin evidencia quedan por validar. Plan, cumplimiento, presupuesto y continuidad
siguen desconocidos. CSV V2 sale del modelo validado por `assemblyReportCSV`, no de
`reportCSV` legacy; el controlador conserva la ruta anterior para informes legacy.
PDF/imagen reutilizan el modelo versionado. Estos cambios no habilitan escritura.

El nuevo escritor no basta para activar el módulo: faltan historial versionado del plan y
comparación/motivos de desvío, UI de carga/cierre, conciliación/continuidad por
producción y pruebas PostgreSQL multisessión. Importar habilitado por sí solo no
habilita cerrar: la puerta independiente export_close_v2 permanece false.

## Instalación y recuperación propuestas

`01_close_adapter_REVIEW.sql` exige el comando **73590860eab986bc35d690556c1be6a9**
posterior a IMPORTAR V2, importador candidato3 fijado en su `manifest.json`, helpers de
sesión/ámbito/admisión/roles, RLS y perímetro. Preserva metadata existente. Cualquier
mismatch rechaza; no se inspeccionó ni modificó producción para esta entrega.

`02_restore_without_closures_REVIEW.sql` exige ambas banderas false, drena config,
verifica el cuerpo candidato y restaura exactamente el anterior **solo si no hay
cierres V2**. Conserva columna false y toda evidencia de importación.

Si ya hay cierres V2, restaurar el motor viejo habilitaría un consumidor incompatible:
la inversa lo rechaza con `EXPORT_V2_HISTORY_REQUIRES_FORWARD_RECOVERY`. No borrar
cierres para superar el control. Contener banderas y conservar los guards; la
recuperación posterior debe ser hacia adelante y preservar historia. Los rollbacks
anteriores también rechazan este cuerpo por sus pins, impidiendo saltarse la cadena.

## Pruebas

    node tests/lp01-export-close-v2/adapter.mjs
    node tests/lp01-export-close-v2/guard.mjs

Seis grupos PASS en PostgreSQL18.6/PGlite0.5.15: instalación atómica/metadata,
CERRAR real, motivos, CAS, ausencia/cero, cambio de universo, revocación al COMMIT,
reintentos, corrección e historial, no reparto, bloqueo antes de apertura legacy,
presupuesto desconocido, recuperación segura, identidad histórica inmutable y
compatibilidad del CAS opcional de transporte. El ensayo de INCORPORAR usa un
turno creado únicamente como fixture, no ABRIR ni apertura automática.

No se afirma concurrencia de varias conexiones, aplicación de SQL, sesión de planta,
prueba Edge/UI ni disponibilidad operativa. No hay dependencia imposible para
persistir el snapshot; la operación posterior completa sí necesita esos pasos.

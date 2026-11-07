# LP-ENSAMBLE-PLAN-1

Helper privado `sgp_lp_operacion.plan_snapshot(d date,t integer) RETURNS jsonb`.
Solo acepta una cabecera acreditada de la generación vigente; otra situación
lanza PLAN_DISABLED, PLAN_ENROLLMENT_REQUIRED, PLAN_UNTRACKED_CHANGE,
PLAN_SOURCE_CHANGED o PLAN_SOURCE_BUSY. No devuelve un snapshot viejo como actual.

```text
{
 contract: "LP-ENSAMBLE-PLAN-1", status: "ACCREDITED_CURRENT",
 source: "PROGRAMACION_LINEA", stage: "ENSAMBLE", line: "PANELES_2",
 date: "YYYY-MM-DD", shift: 1|2, generation: integer,
 versionId: uuid, version: integer >= 0,
 capturedAt: timestamptz, fingerprint: sha256_hex,
 sourceRows: [{assignment: <fila fuente completa>, excluded: boolean, line: "PANELES_2"}],
 targets: [{key: string, quantity: nonnegative_safe_integer, assignmentIds: [uuid]}],
 baseline: {versionId: uuid, kind: "OBSERVED_AT_ENROLLMENT", capturedAt: timestamptz,
            sourceRows: [...], historyBefore: "UNKNOWN"},
 historyComplete: false, historySinceEnrollment: "COMPLETE",
 changes: [{versionId: uuid, version: integer, previousVersionId: uuid|null,
            operation: string, actor: string|null, motive: string|null,
            at: timestamptz, requestId: uuid|null, fingerprint: sha256_hex}]
}
```

La fila fuente conserva `id,key_produccion,fecha,turno,cantidad,prioridad,estado,
origen_id,observacion,creado_por` y cualesquiera otras columnas reales existentes.
Campos que no existen no se rellenan; los nulos quedan nulos.

Versión0: operation OBSERVED_AT_ENROLLMENT, actor/motive/requestId/previousVersionId
nulos. Las posteriores enlazan la anterior, con actor validado en servidor, motivo
no vacío hasta2000 caracteres, hora de servidor y UUID de petición. Baseline no
contiene una atribución retroactiva. Una petición puede cambiar dos turnos; cada
turno mantiene su propia cadena. Ningún objetivo procede de SALE/Disponible.

## Comparación privada

`sgp_lp_operacion.plan_comparar(date,integer,jsonb)` recibe únicamente
`[{key,realized:number|null}]`, derivado del Export validado por el caller, y devuelve:

```text
{
 contract: "LP-ENSAMBLE-PLAN-COMPARISON-1",
 planSnapshot: <LP-ENSAMBLE-PLAN-1>, planComparison: "ACCREDITED_CURRENT",
 comparisonComplete: boolean,
 rows: [{key,plan,planStatus:"ACCREDITED_CURRENT",realized,
         difference,pendingAgainstPlan}]
}
```

Union de todas las keys de targets y realizado. `plan=0` solo para key explícita
del piloto no excluida, sin asignación activa. Cantidad realizada ausente/null
produce realized/difference/pendingAgainstPlan null. Complete exige universo no
vacío y todos los realizados conocidos; no exige historia previa conocida.
Difference positivo significa más realizado que objetivo. No hay porcentaje,
ni Infinity, ni nueva autorización de presupuesto/continuidad.

Estos campos son un contrato para el futuro rebase de LP-EXPORT-CLOSE-3. El cierre
actual no lo anuncia. La integración debe guardar `planSnapshot` íntegro y su
comparación dentro del snapshot del cierre, verificar permisos de **todas** sus
keys, exigir motivos de desviación según la ruta aprobada y conservar
`reconciliation=RECONCILIATION_REQUIRED`/continuidad contenida hasta su adaptador.
No recalcular un plan histórico leyendo asignaciones futuras.

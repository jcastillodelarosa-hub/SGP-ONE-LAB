# Cierre Export con plan vigente · contrato4 · contenido

**IMPLEMENTADO EN RAMA / SQL SINTÉTICO PASS / NO APLICADO / DESACTIVADO.**
Base aislada `f2b073c5fb25e50fa24fc1d4b8e3e93defbe2f4e`; no se copiaron los
uncommitted de integración. No SQL remoto, activación, GRANT, credencial ni publicación.

## Delta funcional

Cadena nueva, **alternativa** a las propuestas viejas import/close, no sumada a ellas:

1. Instalar previamente INCORPORAR post-v406 (01+03) y plan privado desactivado.
2. `01_import_plan_REVIEW.sql`: rebasa IMPORT3 sobre comando `ee5acef…`, conserva
   exclusión aprobada y añade captura versionada antes/después de INCORPORAR cuando
   la bandera privada de plan esté habilitada. Actor `u` de sesión, motivo ya
   auditado; misma transacción, CAS y recibo. No crea otro endpoint.
3. `02_close_v4_REVIEW.sql`: exige selector explícito `close_contract` y persiste
   LP-EXPORT-CLOSE-4 con plan_snapshot/comparación reales bajo locks. Fuente y
   objetivos no salen de SALE. Conserva original observado, cambios, motivo/hora,
   historial previo UNKNOWN y cantidades Export con procedencia original.
4. Contención/restauración propuestas `03` y `04`: flags false, pins exactos,
   inversas solo sin historia incompatible. Con cierres/imports acreditados,
   recuperación hacia adelante; no borrar archivos, versiones ni auditorías.

Importador mantiene contrato LP-EXPORT-IMPORT-3 y actualización parcial:
PRESENT reemplaza, ABSENT conserva valor/fuente anteriores o null si nunca informado.
Su nuevo proyector admite explícitamente historia CLOSE3 y CLOSE4; no cambia los
paquetes ni lectores estrictos V3 anteriores. Archivo excluido no se importa como
activo; no se infiere inclusión por reaparecer en un archivo. No hay fuzzy matching.

La guarda previa de raíz programada sin incorporación se conserva, exceptuando
exclusiones aprobadas: un objetivo activo sin materializar produce
`EXPORT_V2_INCORPORACION_EXPLICITA_REQUERIDA`, no desaparece del denominador.
Cierre revalida además cobertura y permisos de todo el plan + Export.

## Contrato4 exacto

Comando: CERRAR, `close_authority='EXPORT_PRODUCTION_V2'` y
`close_contract='LP-EXPORT-CLOSE-4'`, además de contexto, ID, revisión, lote/archivo,
observación y motivos existentes. Sin selector4 o con3 se rechaza. No se acepta
plan/huella/cantidades del navegador como autoridad.

Snapshot conserva los campos y procedencia de CLOSE3, cambiando:

- `contract='LP-EXPORT-CLOSE-4'`.
- `planSnapshot`: LP-ENSAMBLE-PLAN-1 íntegro, generado por SQL y congelado al cerrar.
- `planComparison='ACCREDITED_CURRENT'`, `comparisonComplete` del helper privado.
- Por fila: `plan` numérico, `planStatus='ACCREDITED_CURRENT'`,
  `difference=realized-plan`, `pendingAgainstPlan=max(plan-realized,0)`.
  Si realizado es null, ambos derivados son null, no cero.
- `initialReference={status:'EXPORT_CUT_REFERENCE_REQUIRED',cut:null,includedClosureVersions:null}`.
- `operationalReady=false`, `canContinue=false`; presupuesto/continuidad siguen
  RECONCILIATION_REQUIRED, sin cantidad ni reparto/arrastre.

Motivo obligatorio por ausencia y pendiente, conservando reglas previas. No se
agrega obligación por sobrecumplimiento ni porcentaje infinito cuando plan=0.
Comparación completa no afirma historia anterior completa. Identidad, archivo,
valueSource/valueStatus, manualHistory y scheduledReference siguen conservados.
El V3 estricto rechaza el4; el lector4 es integración paralela del parent.

## Frontera de privacidad V4

Un plan íntegro puede contener keys canceladas/excluidas en sourceRows o baseline
que no aparecen en las filas activas. Nueva guarda **privada** valida esas keys
además de rows, antes del cierre y al COMMIT. Se reutiliza al consultar reportes,
history, resultado e idempotencia. Revocación posterior oculta/deniega el snapshot
completo, no expone sus metadatos antiguos. V3 conserva sus reglas.

Los únicos cambios de consultar están en esos filtros V4 de historia/reportes.
Los filtros v406 de orders/catalog, horarios y descubrimiento INCORPORAR quedan
exactos. Owner/OID/ACL/search_path/SECURITY DEFINER existentes se preservan. Los dos
helpers y trigger nuevos no tienen EXECUTE público ni para roles de aplicación.

Instalación drena config antes de plan_control y exige INCORPORAR, plan e import
contenidos; cada bandera nueva nace false. No relajar pins para aplicar encima de
la cadena vieja. El importador original sigue restringido a service_role.

## Bloqueos reales que permanecen

- Primera referencia/corte Export y cierres/versiones ya incluidos no identificados.
  No calcular Disponible, doble descuento, reconciliación o carry por diferencias
  de saldo/fechas. El cierre4 conserva ese bloqueo explícito aunque conozca plan.
- Planificador necesita transporte de motivo/UUID y captura acreditada antes de
  activar su bandera. Un cambio externo/dirty no se sana automáticamente.
- Handler/consultar no anuncian autoridad de cierre4, UI/activación siguen aparte.
- Falta PostgreSQL17 multisessión de esta cadena y verificación final del backend.
- Abrir el nuevo turno aunque el anterior siga abierto está aprobado. Este paquete
  no implementa ejecutor/apertura, no autocierra ni infiere arrastre. El guard
  legacy contra interpretar historia Export como ejecución por UUID permanece.

## Evidencia exacta

- `node tests/lp01-export-plan-v4/adapter.mjs`: **8 grupos PASS**, PGlite sintético.
  Cuerpos capturados reales, instalación/inversas/metadata, flags/selectores,
  INCORPORAR versionado, cierre parcial/comparación, revocación al COMMIT y
  posterior sobre key solo del baseline, correcciones/exclusiones, fuente no
  materializada, recuperación sin pérdida. No repite la batería general.
- `preflight-results.json`: guard focal final, INCORPORAR activo bloquea instalación
  sin alterar su cuerpo; contención permite ambas fases. No certifica concurrencia.
- `sql-readback.json`: cierre realmente persistido/consultado en fixture, nunca planta.
- `interface-results.json`: readback final valida con lector independiente del
  parent `8738305e3b1901bd99b07b384a8c355bcb969408`; sin editarlo ni repetir su suite.
- Paquetes anteriores plan/import/close, runtime/handler y permisos sin cambios.

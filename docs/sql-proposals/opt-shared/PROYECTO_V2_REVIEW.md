# PROYECTO v2: propuesta local, NO aplicada

Base: main f1897786f55df8c473a6b2d04d189ffaf3356d62 (v447). La fuente
es consecutivo OPT → pares exactos reserva/sistema del índice original, no una
producción numérica supuestamente impresa dentro del PDF.

## Contrato privado

1. `sgp_opt_import_contexto_proyecto_v2(text,jsonb,text,jsonb,text[])` recibe token,
   scope, OPT canónica, selectores `[{reserva,sistema}]` y `p_referencias text[]`
   exactas del PDF. Deduplica y ordena pares/referencias.
   Devuelve `OPT-IMPORT-CONTEXT-PROYECTO-2`, scope, opt, selectores, revision y
   bindings y `profileDestinations:[{referencia,destino_productivo,tipo_pieza,activa}]`.
   `activa` es texto SI/NO, alias de maestro.activo. La revisión incluye OPT,
   selectores, referencias, todas las coincidencias SGP y el maestro consultado.
   No se ocultan clasificaciones inactivas. Una referencia ausente no produce fila.
   `documentProduction` en bindings sigue siendo identidad interna SGP, no un
   selector exigido al PDF.
2. `sgp_opt_importar_proyecto_validado_v2(text,bytea,jsonb,jsonb,jsonb)` recibe
   los mismos parámetros base del canal v1. Requiere una sola fuente PROYECTO,
   modo INDICE, source_key canónica, evidencia `OPT-SERVER-VALIDATION-PROYECTO-2`
   y algoritmo `opt-import-manifest-project-v2` con índice original.
   Relee contexto validado, bloquea las filas existentes de producción/programación,
   bloquea también filas del maestro exactas por referencia y compara revisión antes
   de crear aprobación/importar en la transacción. `sgp_binding.referencias` es el
   array de referencias utilizado para esa relectura.
   Receipt conserva `OPT-IMPORT-1` y añade `contract_version:2`.

Actor y scope existentes, SECURITY DEFINER con search_path vacío, EXECUTE solo
service_role, RLS/roles/tablas existentes intactos. No activa config ni importa datos.
Contexto no oculta otras líneas/semanas, identidades inactivas ni programas múltiples.
La regla física es la ya vigente en `sgp_pdt_linea_maestro_v3`: maestro activo,
tipo en PANEL/FRAME/COVER/REFUERZO/MUNTIN, destino en PANEL/FRAME, y tipos
PANEL/FRAME coherentes con destino. `destino_productivo` resuelve línea;
`lineas_aplicables` NO la resuelve. El validador usa el snapshot y bloquea
clasificación ausente/inactiva/inconsistente. Programa único no convierte una
pieza FRAME en PANEL. Todo el documento se conserva, incluso unidades fuera
de ámbito. `documentary_source_groups`, si presente, debe ser array y se conserva
en evidencia; no concede autorización ni redefine cantidades.
La validación documental JS debe rechazar candidatos ambiguos y contabilizar todos
los selectores; el SQL no reparte piezas entre reservas por orden o cantidad.
Se conserva la observación transaccional v1: locks de filas, no predicate/gap locking.

## Instalación futura, solo con revisión/autorización

Aplicar primero context_proyecto_v2 y después channel_proyecto_v2. No reemplazan v1.
Inversa separada elimina únicamente los dos nuevos entrypoints, sin borrar datos.
Verificar definiciones reales, permisos y pruebas SQL aisladas antes de publicar.

## Redondeo y advertencia persistente

Nuevo canal exige `rounding_policy` versión `OPT-PRINTED-ROUNDING-1`, modelo
`INDEPENDENT_NEAREST_1_32_CLOSED_ENVELOPE`, originalPrecisionVerified=false y
originalsPreserved=true. Conserva `rounding_evidence` y `validation_warnings`
completos. Conserva título original validado y snapshot `profile_destinations`
obtenido del current_context SQL después de revalidar revisión, nunca de una copia
entregada en evidencia. La evidencia de redondeo es un array no vacío de perfiles con printedSummary y
objeto diagnostic. `printedDelta32` es un objeto de strings enteros
`{stock,cuts,balance}`, NO un número. Status admitidos PRINTED_EQUALITY o
ROUNDING_COMPATIBLE; este último exige advertencia conocida. El SQL valida
shape/procedencia privada, no calcula tolerancias ni acepta decisión del navegador.

`rounding_read_warnings_REVIEW.sql` añade validationWarnings al catálogo y estado,
solo [] o [{code:'OPT_PRINTED_ROUNDING_COMPATIBLE'}]. No expone evidencia privada.
Las definiciones originales se contrastaron con producción en lectura únicamente.
Se preservan ACL existentes con CREATE OR REPLACE; helper privado sin EXECUTE para
clientes. Inversa independiente restaura las definiciones previas.

## Validación reproducible sin datos operativos

- Estáticas: `node --test docs/sql-proposals/opt-shared/test-project-contract.mjs`.
- Motor PostgreSQL/WASM local/CI: `node scripts/test-opt-project-sql.mjs`.
  Instala @electric-sql/pglite@0.5.16 en directorio temporal desde registro oficial
  con scripts deshabilitados, ejecuta pruebas sintéticas y limpia el directorio.
  No modifica package.json ni lockfile. El harness también permite resolución
  estándar del paquete o `OPT_PGLITE_MODULE` para una instalación local existente.
- El conjunto predeterminado contiene solamente identidades sintéticas y prueba
  contexto, revisiones, cambios del maestro, formas inválidas, warning obligatorio,
  persistencia/relectura del warning, ACL, transacciones e inversas.
- CI NO configura `OPT_REAL_FIXTURES`. Esa variable es una opción local para
  entradas privadas fuera del repositorio; los archivos y resultados no se publican.

Límites: actor/scope/import_manifest base son mocks mínimos; no acredita importación
real ni el importador base entero. Motor de una sola sesión: no prueba contención
concurrente intersesión ni aislamiento productivo. No declarar verificado en producción.

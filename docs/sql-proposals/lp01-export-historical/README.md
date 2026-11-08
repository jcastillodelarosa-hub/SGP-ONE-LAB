# Export factual histórico (propuesta, sin aplicación)

Dependencia: instalar `lp01-historical-turn/01_prepare_REVIEW.sql` (cabecera, indicador inicialmente false). Después `01_sources_REVIEW.sql`, `02_adapters_REVIEW.sql` y discovery `lp01-historical-turn/02_discovery_REVIEW.sql`. Discovery no se reemplaza aquí. Integrar esos cuatro archivos en una sola transacción antes de activar el indicador por separado. No importar ni cerrar el archivo del usuario como parte del despliegue.

## Resultado

Cabecera histórica no acredita plan. El primer Export resuelve exactamente producción + línea, valida permisos del período y registra únicamente sus keys. Archivos posteriores pueden agregar keys del mismo período y conservan valores anteriores de keys ausentes. Registro privado inmutable, vinculado a cabecera y primer archivo validado. No se insertan órdenes, inclusiones ni asignaciones; tampoco se actualizan cantidades oficiales, Disponible o programación.

`LP-EXPORT-IMPORT-3` y `LP-EXPORT-CLOSE-4` incorporan `writerScope=LP-EXPORT-HISTORICAL-1`. Universo: contexto exacto, `orders=[]`, `scheduled=[]`, `historicalKeys` ordenadas y `productions` correspondientes. Snapshot plan: `LP-HISTORICAL-UNAVAILABLE-1`, status `HISTORICAL_UNAVAILABLE`, contexto exacto, `sourceRows=[]`, `targets=[]`, `historyComplete=false`. Cierre: `planComparison=HISTORICAL_UNAVAILABLE`, `comparisonComplete=false`; filas con plan/difference/pendingAgainstPlan null y referencias/asignaciones vacías. Realizado factual conserva procedencia por archivo. Conciliación y arrastre siguen bloqueados, corte inicial null.

Producción ambigua, ajena al permiso, actualmente excluida o no identificable impide importar; no se inventa correspondencia. Motivo se exige para ausencia en archivo parcial. La variante histórica solo funciona con cabecera acreditada e indicador preparar_historico activo. Triggers impiden añadir raíces operativas/inclusiones a ese turno.

## Alcance y permisos

Una tabla privada `export_historical_keys`, cuatro helpers privados y cinco triggers. RLS y revocación total a roles de aplicación. Confirmación diferida de nuevas keys SECURITY DEFINER verifica archivo exacto y permisos actuales; confirmación diferida de recibos reutiliza el fence privado existente. No nuevo endpoint público ni cambio de GRANT.

Se preservan owner, ACL, SECURITY DEFINER y search_path de seis funciones existentes; guards exactos contra hashes leídos en producción:
- export_dual_ordenes
- export_dual_universo
- export_dual_comparar
- sgp_lp_operacion_importar_xlsx: 9a17d2e401b556f0a0c118113248aaa6
- sgp_lp_operacion_comando: a8ca3d3886b48ff93a7f64de9e6033f6
- export_v4_plan_visible

Cada SQL lleva los pins de entrada completos. Se conserva el código previo de esas funciones con ramas históricas explícitas. La proyección interna usa el tipo de fila existente solo para recorrer keys, con campos operativos null; no persiste órdenes ni UUID de asignación ficticios. El universo público no presenta esas proyecciones como órdenes.

Gateway requiere el cambio de `lp-powerbi-handler.js` del paquete UI histórico: aceptar el marcador histórico únicamente con despliegue dual y controles actuales. Requiere redeploy Edge con mismo auth/CORS; SQL solo no basta.

## Prueba focal integrada

Instalar dependencias raíz y `npm install --prefix tests/lp01-export-plan-v4 --ignore-scripts --no-audit --no-fund`.
`node tests/lp01-export-historical/flow.mjs`

La fixture instala artefactos SQL reales y cabecera del paquete hermano, llama prepare como anon, importer como service_role y cierre como anon para ambas etapas. Verifica archivo parcial preservado + nueva key, plan desconocido, replay, bloqueo de producción no identificable, indicador revocado y ausencia de cambios en programación/órdenes/inclusiones/cantidades oficiales. Genera `tests/lp01-export-historical/readback.json` con datos sintéticos para la prueba de lector/UI. Ese archivo no se publica ni contiene datos del XLSX del usuario.

# Vidrio B21: fechas de preparación

Implementación aislada sobre LAB v417. Backend APLICADO en SGP-ONE-LAB mediante `glass_preparation_b21`; interfaz pendiente de integrar/publicar por coordinador. No reaplicar SQL.

- Una fecha por año, semana efectiva, línea PANELES_2, reserva principal y prioridad original completa. No usa turno ni orden de asignación del planificador.
- Catálogo activo excluye `excluida_export`; prioridades de la misma semana/año/línea. Una prioridad ambigua queda visible pero no editable. La cantidad se suma una sola vez por producción.
- Fecha es solicitud de preparación, NO confirmación de disponibilidad ni estado de bodega.
- Selección múltiple, fecha individual, guardado atómico, búsqueda, filtro fecha/semana y Excel con todas las producciones de las filas filtradas desplegadas y fecha heredada.
- Lote mecanizado usa el campo semanal `sgp_producciones.lotes`. Lote vidrio tiene columna separada, sin inventar valores: la carga de vidrio actual no aporta ese campo. OVES permanece OVES, no es lote.

## Instalación

`install.sql` crea únicamente esquema privado `sgp_glass_preparation`, tablas `dates/events` con RLS sin acceso directo, helpers `actor/source/fingerprints` y dos RPC públicas autenticadas por sesión SGP. No reemplaza escritores existentes, no cambia roles, RLS ni grants de tablas existentes y no modifica datos de producción. CREATE falla y revierte si ya existe el esquema, evitando reinstalación accidental.

Lectura: roles reales ADMINISTRADOR/COORDINADOR/LIDER/CONSULTA con acceso existente `ensamble`. Escritura: ADMINISTRADOR/COORDINADOR con ese mismo acceso. El alias RECEPCION→LIDER no concede escritura ni lectura nueva. Tokens se validan con expiración real. Guardado requiere revisión y fingerprint del catálogo, registra evento y admite reintento de la misma solicitud sin duplicar. Un error revierte el lote completo.

Aplicar solamente mediante migración autorizada. Antes: confirmar ausencia del esquema. Después: verificar firmas/ACL/RLS y que las tablas estén vacías. No insertar una fecha ficticia en producción como prueba. Si se necesita revertir después de uso, conservar fechas/eventos y corregir hacia adelante.

## Integración

```js
import {mountGlassPreparation} from './src/modules/glass-preparation.js';
const preparation=mountGlassPreparation(document.querySelector('#glassPreparationPanel'),{getClient:getSupabaseClient,getToken:getAppToken});
// Al seleccionar «Fechas de preparación»:
preparation.load();
```

No monta ni carga sola; no toca navegación, estilos ajenos o estados de producción. Un guardado fallido conserva la solicitud para reintento. Un cambio de sesión vacía datos y exige recarga.

## Evidencia focal

- `node --test tests/glass-preparation.test.mjs`: 3 PASS (grupos, prioridad, cantidad, Excel expandido, revisiones y permisos cliente).
- `cd tests/glass-preparation && npm install`, luego `node sql.mjs`: PASS PGlite, datos sintéticos; sesión/roles, semana efectiva, prioridad exacta, guardado/replay, rechazo revisión/fuente cambiada y ACL privada. No acredita concurrencia PostgreSQL remota.
- `node tests/glass-preparation/dom.mjs`: PASS DOM selección/fecha/guardar/readback/filtro/cambio de sesión, RPC sintéticas.
- `python tests/glass-preparation/browser.py`: preparado PC1366/móvil390. En este entorno Chromium aborta por `socket() failed: Operation not permitted`; no declarar comprobación visual como realizada.
- Sintaxis JS y `git diff --check` PASS. No se repiten baterías ajenas.

## Aplicación verificada

`apply_migration glass_preparation_b21` devolvió success. SHA256 exacto de `install.sql`: `9cad64459eac19b9bcc48a787400962ac0bf0aec45fb0ef1d60d2097b9145763`.
Readback: dates=0/events=0, ambas RLS=true y ACL sólo postgres. Helpers actor/source/fingerprints sólo postgres, RPC públicas DEFINER postgres con search_path vacío y EXECUTE sólo owner/anon/authenticated. Ninguna fecha sintética ni dato operativo escrito.
MD5 de definiciones aplicadas: read `b01ce4652d84ce7b6ef84c250e7e6dde`; save `e5bbe942e0cedce132d1a4264019763a`; actor `9f69c1511e66427360b5b121ac380699`; source `69f0ff88d635d50c371d8e984a7675fc`; fingerprints `ffceb31a014180860caa738ae8b3e9c7`.

## Excel autónomo para planta/Gateway

`src/domain/glass-preparation-xlsx.js` genera OOXML/ZIP local, sin CDN, paquetes, fórmulas ni relaciones externas. Conserva todas las producciones de los grupos filtrados, fecha heredada, cantidades numéricas y lotes separados. Encabezado fijo y autofiltro incluidos. Cadenas que empiezan con `=` se guardan como texto, nunca como fórmulas.

Dos pruebas Node PASS: ZIP/CRC y XML/relaciones completos, expansión de producciones, fecha, Unicode/escaping, texto tipo fórmula y controles XML inválidos. Un workbook generado fue leído con `openpyxl`: 3 filas/10 columnas, tipos numéricos/texto, ambas producciones con fecha heredada, lotes, freeze pane y autofiltro correctos. No requiere conectividad para exportar.

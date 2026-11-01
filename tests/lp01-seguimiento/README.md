# Seguimiento / Operación — evidencia delimitada

- `catalog-readonly.json`: siete funciones vigentes consultadas en Supabase por
  SELECT de catálogo. No se invocaron escritores ni se leyeron filas operativas.
- `schema-readonly.json`: columnas de asignación/ejecución. No existe etapa; el
  contrato de consulta entrega ejecución agregada, no historial por etapa.
- `js-results.json`: 31 pruebas dirigidas de dominio, navegación y planificador.
- `evidence/browser-results.json`: Chromium1440/390, navegación real y módulo real;
  fixtures RPC explícitas, toda red externa bloqueada, cero llamadas de escritura.
  Incluye cambio de sesión, errores, filtros, borradores y regreso a vistas previas.
- Cuatro capturas: tracking/operation en PC/móvil. Las cifras son sintéticas.

Reproducir desde raíz con vendor generado y Python Playwright instalado:

```sh
npm ci
npm run build:vendor
node tests/lp01-followup.test.mjs
node tests/production-line-tabs.test.mjs
node tests/planner-integration.test.mjs
node tests/linea-produccion-v328.test.mjs
python tests/lp01-seguimiento/browser.py
```

El script levanta y cierra su servidor local; no necesita sesión ni Supabase.
No se certifican contrato escritor, backend gestionado, cuentas de planta, red
corporativa ni dispositivos físicos. Las escrituras están bloqueadas por la
incompatibilidad de semántica/etapa documentada; no son funcionalidades completadas.
Guía original de 27 bocetos no localizada: alineación definitiva pendiente.
Continuidad: `docs/SGP_LP01_SEGUIMIENTO_OPERACION.md`.

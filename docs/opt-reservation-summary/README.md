# Cortes por reserva: consulta directa y Resumen

Estado: IMPLEMENTADO LOCALMENTE, NO PUBLICADO. Base d6a3001 (LAB v448).
Candidata integrada LAB v449, aún no publicada.

## Referencia aprobada

Johan eligió opción 1: tablas apiladas en nueva pestaña Resumen, conservando
Referencias y esquema y acciones existentes. Boceto inspeccionado:
`Opcion_1_Dos_pestanas_OPT.png`.

Se reutilizan tokens/componentes SGP actuales: panel blanco, azul de acción,
controles accesibles y cuadrícula de filtros. Las dos tablas ocupan el ancho
disponible, una debajo de otra. En móvil conservan columnas, desplazamiento
horizontal y primera columna fija. No se altera `.layout` del esquema.

## Flujo

1. Entrar en Cortes por reserva directamente.
2. Elegir año, semana de origen y línea, pulsar Consultar reservas.
3. Elegir reserva/sistema del catálogo compartido.
4. Referencias y esquema conserva el visor, matriz, estado, selección de piezas,
   confirmación/registro y reporte. Cambiar de pestaña no registra ni desmarca piezas.
5. Resumen consulta únicamente la API documental de lectura.

Existe una sola instancia del selector de alcance visible en ambas pestañas
principales. No se necesita cargar índice ni PDF para consultar el catálogo.
Cambiar alcance invalida selección/documentos; respuestas tardías se descartan.

## Evidencia documental

Consume `summaryApi.load(group)` / `invalidate()` del contrato separado
`src/services/opt-document-summary.js`, integrado localmente desde el commit 3fac00d. No modifica API
de cortes, SQL, permisos ni datos. Sin adapter muestra indisponibilidad explícita.
Por documento: OPT/SHA, scope DOCUMENTO, estado AVAILABLE/NOT_PERSISTED,
cutRows, materialRows y avisos. Nunca atribuye totales multirreserva del PDF a
una sola reserva ni sustituye cantidades impresas por cantidades de piezas.
Ausencia se muestra como «No informado», distinta de cero. Scrap muestra el porcentaje impreso conservado por el extractor; si no existe,
la longitud impresa se identifica como longitud. No convierte remanentes ni deriva %.
Los documentos históricos sin resumen persistido conservan esa indicación.

## Verificación local

- 1265 pruebas PASS, 10 skip; 10 suites DOM PASS.
- RPC documental: 11 comprobaciones SQL aisladas PASS. Backfill aislado PASS
  (exactamente nueve, SHA/identidad, atomicidad, evidencia preservada, replay y ACL).
- Cobertura: consulta desde Cortes en navegador fresco sin archivos; selección
  retenida al alternar tabs; invalidación semana/sesión; control de escritura;
  tablas text-only, valores ausentes/cero, respuestas obsoletas y errores/reintento.
- `npm run verify:release` y `git diff --check` PASS.
- Prueba navegador nueva `reservation-summary-browser.cjs` preparada para
  1440 px/390 px: apilado, scroll, referencia fija, ausencia overflow y capturas.
  No ejecutada localmente por restricción Chromium conocida; no es evidencia visual.
- No acredita publicación, datos productivos ni disponibilidad backend.

Contrato documental integrado localmente. E2E DOM usa scope, catálogo y adapter
resumen reales con RPC sintética; verifica tablas antes de volver a selección
y registro de cortes. No certifica permisos SQL productivos.

Siguiente paso: revisar acceso RPC y backfill de históricas, ejecutar navegador/CI, revisar
capturas y completar versión nueva antes de una publicación autorizada.

## Verificación integrada con originales, solo local

Se verificaron nueve PDF disponibles para diagnóstico: extracción integrada →
constructor/validador del resumen → adapter de lectura real con RPC sintética →
DOM. Resultado: 137 perfiles y 181 filas de material; cantidades y porcentajes
impresos iguales a las celdas mostradas. No se incorporan archivos ni resultados
privados a Git. La reserva de la prueba es sintética, no una asociación real.
Este conjunto incluye excepciones y **no corresponde al lote de nueve OPT
históricas guardadas**. No puede utilizarse como lote de backfill. Cada documento
histórico exige comprobación independiente de identidad/SHA/evidencia vigente.

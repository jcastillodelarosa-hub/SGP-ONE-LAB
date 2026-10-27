# Etapa 2F — certificación por alcance y semántica Export

Base PR130 `bfdb3097a47c7886e9422eba4c7f557b36b1ab48`. Main observado
`6b96aa387765693ab94b1542280b408a5097b325`; preservados PR125/128/131 sin merge/rebase.
Fuentes: confirmación explícita del encargo2F, artefactos y matrices2E, capturas
PDT/autorización previas. No hay conector Supabase autenticado disponible aquí.

## Qué se cierra y qué no

**VERIFICADO CON FUENTE REAL — REPORTADO POR CHATGPT:** comprobaciones productivas
de solo lectura realizadas por ChatGPT según el propietario. No se presentan como
consultas directas de esta sesión ni como un volcado completo recibido.
`CONFIRMACIONES_CHATGPT.json` conserva literalmente el alcance reportado, con
proveniencia y sin inventar tipos, cuerpos, firmas ni hashes actuales.

| Hecho | Estado y evidencia | Límite pendiente |
|---|---|---|
| sgp_previsualizar_export_diario existe, SECURITY DEFINER, EXECUTE anon/authenticated | VERIFICADO CON FUENTE REAL (reportado ChatGPT) | Firma por overload, cuerpo vigente, controles internos, propietario/search_path |
| sgp_aplicar_export_diario, mismas propiedades | VERIFICADO CON FUENTE REAL (reportado ChatGPT) | Lo anterior más transacción, escrituras e inclusión de eventos |
| sgp_picking_validar_recepcion, mismas propiedades | VERIFICADO CON FUENTE REAL (reportado ChatGPT) | Huella vigente para contrastar cuerpo ya capturado; ámbitos efectivos |
| sgp_sesion_actual, mismas propiedades | VERIFICADO CON FUENTE REAL (reportado ChatGPT) | Huella vigente para reutilizar captura; contexto propietario/privilegios |
| Historial Export contiene id_carga_diaria, key_produccion, saldo_ensamble, saldo_empaque, datos, fecha_hora | VERIFICADO CON FUENTE REAL (reportado ChatGPT) | Tipos, constraints/FK, columnas restantes, significado/contenido de datos |
| Estructura sgp_pdt_entrega_lineas verificada por ChatGPT | VERIFICADO CON FUENTE REAL (reportado ChatGPT) | Resultado completo no entregado aquí: no se inventa lista de columnas o relaciones |
| Mapeo de cabeceras Ens./Emp./saldos | VERIFICADO EN CÓDIGO, fuente2E main por SHA | No acredita significado contable instalado |
| Semántica bruta/neta, diario/acumulado y corte→evento | PENDIENTE DE EVIDENCIA REAL | No se cerró mediante metadatos ni coincidencias numéricas |
| Cobertura PDT/producción/reserva/parte y cargos/ámbitos | PENDIENTE DE EVIDENCIA REAL | No se cerró con la existencia de líneas de piezas |
| Cooperación de todos los escritores | PENDIENTE DE EVIDENCIA REAL | Los grants/huellas no prueban locks compatibles |

No volver a diagnosticar como ausentes esas cuatro funciones. El reporte es por
NOMBRE; no certifica todos sus overloads ni que la lista de grants sea exhaustiva.
Confirmar estructura no equivale a haber recibido todos los tipos o resultados.

## Diagnóstico semántico exacto

| Campo | Evidencia disponible | Qué NO puede inferirse |
|---|---|---|
| Ens. | Normalizador versionado lo asigna a sgp_producciones.ensamblado | No sabemos si el origen registra acumulado, diario, bruto o neto |
| Emp. | Asignación versionada a empacado | No prueba qué turnos/eventos ya incluye |
| Saldo Ens. | Columna oficial versionada y nombre confirmado en historial | No sustituir Ens. por cantidad−saldo ni sobrescribir saldo desde ejecución local |
| Saldo Emp. | Igual para Empaque | No deducir unidades elegibles o inclusión de ejecución por igualdad aritmética |
| datos del historial | Nombre confirmado; contenido/tipo no entregado | No asumir que siempre sea objeto JSON con Ens./Emp. ni que incluya UUIDs locales |
| id_carga_diaria + fecha_hora | Identifican/contextualizan un corte según estructura reportada | No acreditan inclusión por fecha, cercanía de cargas o coincidencia de saldos |

El Importador sigue siendo autoridad exclusiva de saldos oficiales. Las llamadas
preview/apply presentes en código y su instalación confirmada no demuestran su
algoritmo actual. Sin cuerpos/evidencia de origen se detiene SOLO el puente real
Export; se conservan motor, contrato y recibos aislados existentes.

Para acreditar inclusión se requiere decisión explícita por UUID/eventHash/corte,
con evidencia del proceso de importación, ligado atómicamente a historial/carga.
No rellenar INCLUDED/EXCLUDED comparando fechas o cantidades. Reutilizar el ACK y
manifiesto2E, no crear otro ledger; sellado de manifiesto sigue NO CERTIFICADO hasta
verificar su productor. Si el sistema externo no identifica eventos, definir captura
explícita revisada; no puede decidirse una conversión automáticamente en esta fase.

## Captura PDT completa y ejecución parcial

Las líneas PDT cuantifican piezas. La existencia/estructura de esas tablas NO
prueba una equivalencia pieza→ventana ni cobertura de todo el dominio. Para una
captura completa hacen falta inventario servidor por key y etapa, tratamiento
explícito de LEGACY/keyless/compartidas, versión consistente de todas las fuentes
y cooperación de sus escritores. Una consulta vacía o una muestra no prueba cero.

Se mantiene D2 sin reimplementarla: estimación separada de cantidad consolidada
validada, revisión CAS/UUID, actor/fecha/turno/motivo/fuente, invalidación de cambios,
sin suma de PDT superpuestos ni IDs físicos. Una NC cerrada, piezas positivas o
entrega complementaria no liberan cantidad sin revisión vigente. Ensamble apto
excluye afectadas; Empaque consume parcialmente lo elegible, descontando lo ya
empacado entre todos los turnos. La base bruta/neta debe acreditarse antes de elegir
el modo de descuento; no se cambia por coincidencias de números.

No se migran históricos ni se reclasifican asignaciones legacy como Ensamble o
Empaque por defecto. La parte y las reservas compartidas necesitan relaciones
verificables; nombre de producción/reserva no basta ni separa PANEL/FRAME.

## Adaptación implementada y datos todavía necesarios

`linea-source-evidence-review.js` es un adaptador de AUDITORÍA, no autorización:
normaliza los hechos reportados por alcance, explicita metadatos incompletos,
separa cargos candidatos de bindings instalados y reutiliza la barrera2E.
No expone servicios, concede roles ni emite disponibilidad/certificados C2.
`review-evidence.mjs` genera reporte con SHA256 del archivo de entrada.

No se implementaron adaptadores operativos de Export/PDT/roles sin evidencia
suficiente. No se retocaron schemas/RPC/writers2B–2E. Consulta preparada
`CONTRASTE_DELTA_READONLY.sql`: usar resultados completos ya disponibles en
ChatGPT antes de volver a ejecutarla. Solo busca lo faltante:

1. Cuerpos y firmas vigentes de preview/apply; huellas de autorización/Picking
   capturados previamente (sin volver a solicitar esos cuerpos si coinciden).
2. Relaciones/tipos/FK y contexto de datos del historial. La muestra100 devuelve
   claves/tipos, NO valores: no certifica semántica, acumulación o cobertura.
3. Labels de roles activos sin usuarios/contraseñas y funciones de ámbitos,
   escritores candidatos/huellas. No supone que los candidatos cubran SQL dinámico
   o procesos externos. No repite los grants/DEFINER ya reportados.

Si la huella de una captura conocida no coincide, contrastar la diferencia vigente
antes de reutilizar sus controles. Un hash de la definición no certifica ámbitos,
RLS o cooperación de escritores. La query se probó solo en QA READ ONLY.

Integración real: **PARCIAL**. Los bloqueos de semántica, inclusión, cobertura,
ámbitos y escritores siguen abiertos. No se cambia ese estado por los doce tests
nuevos ni por una fixture. Siguiente paso: revisar este paquete y aportar SOLO los
resultados pendientes, sin repetir lo ya entregado ni pedir identificadores físicos.

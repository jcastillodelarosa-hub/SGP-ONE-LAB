# Etapa 2E — fuentes reales y contratos de integración

## Procedencia y límites

Base funcional aprobada2D `2fc09ea50fa6acb58733f25def7edd466b1acbc6`, más checkpoint
`a716bdaf8fc23bf757d808369ba48f86e1463b63`. Este trabajo no altera ningún PR padre.
Main leído por objeto exacto `0a1a5fd53cf622817f164e4031e6c83e7ab0ac56`, incluidos
PR125 (fecha operativa Picking) y PR128 (primera validación visual PDT). El tracking
local origin/main estaba atrasado: no se utilizó como prueba de actualidad.
No merge/rebase, cambio de versión ni importación de código operativo.

**VERIFICADO EN SUPABASE:** ninguna consulta nueva en esta sesión. No existe un
conector/pool productivo autenticado disponible. No se buscaron claves ni se usó
service_role. Las capturas y confirmaciones previas del propietario se conservan
como antecedentes, no como verificación actual del backend instalado.

**VERIFICADO EN CÓDIGO:** main exacto y capturas versionadas, con SHA/ruta/líneas en
`tests/linea-stage2e/evidence/code-sources.json`. SQL REVIEW y migraciones presentes
en Git no prueban instalación. El complemento previo de sesión fue reconstruido
según el propietario, no es el export original. Se reutilizan los siete cuerpos
PDT/autorización y ese complemento; no se solicitan otra vez.

**INFERIDO:** interpretación posible que no habilita operaciones.
**NO DISPONIBLE:** contrato/cobertura/semántica actual no acreditada.

## Matriz de fuentes

| Fuente / relación | Evidencia | Clasificación | Uso permitido y límite |
|---|---|---|---|
| Producción/línea canónica | 001_core_schema.sql PK key_produccion; normalizador forma id\|línea | VERIFICADO EN CÓDIGO | No unir PANEL/FRAME por nombre. Catálogo instalado actual pendiente |
| Total producción | `Cant.`→cantidad en production-importer.js | VERIFICADO EN CÓDIGO | Referencia de entrada, no acredita Ensamble ni saldo disponible |
| Cantidades oficiales | `Ens.`→ensamblado, `Emp.`→empacado | VERIFICADO EN CÓDIGO | Campos separados; base bruta/neta y periodo de acumulación NO DISPONIBLES |
| Saldos oficiales | `Saldo Ens.`/`Saldo Emp.`→saldo_ensamble/saldo_empaque | VERIFICADO EN CÓDIGO | No derivar ejecución como cantidad−saldo ni sobrescribirlos desde el motor |
| Importación diaria | app preview(token,línea,datos); apply(token,línea,nombre_archivo,datos) devuelve id_carga_diaria | VERIFICADO EN CÓDIGO | Llamada/preview no prueba corte aplicado, locks ni inclusión de movimientos |
| Cuerpos preview/apply | No localizados en SQL de main exacto | NO DISPONIBLE | No crear un lector productivo usando supuestos de su implementación |
| Historial diario | Propietario confirmó id_carga_diaria/identidad/saldos/fecha | NO DISPONIBLE para estado instalado actual | Falta definición exacta/tipos/FKs y relación con ejecución local |
| Lotes de carga | DDL/carga semanal versionados | VERIFICADO EN CÓDIGO | Un ID de carga no demuestra qué eventos contiene |
| Consulta Ensamble y hoja Empaque | Ambas llaman sgp_consultar_ensamble; SQL devuelve p.* + joins | VERIFICADO EN CÓDIGO | Contexto de consulta, no ledger de ejecución Empaque independiente |
| Ejecución de planificador legacy | planner-operations-v326.js llama registrar(asignación,cantidad,observación), muestra ejecutado | VERIFICADO EN CÓDIGO | Incremento vs acumulado, etapa y reflejo en Export NO DISPONIBLES; no importar como eventos automáticamente |
| Motor nuevo B2 | UUID/delta por producción, etapa, fecha y turno, cierres/CAS | VERIFICADO EN CÓDIGO / AISLAMIENTO | Propuesta, no instalación productiva; conservar ledger y snapshots anteriores |
| Mecanizado | Estado/ejecución/historial PROCESADO y programación | VERIFICADO EN CÓDIGO | No convertirlo en Ensamble ni usar carga operativa como ejecución física |
| Entregas Picking6/8 | Capturas guardadas crean entrega, faltantes y PDT | VERIFICADO EN CÓDIGO (captura previa) | La6 no aporta fecha/turno ni todos los campos de reserva/acabado de8; no tratarlas como equivalentes |
| ventanas_afectadas | Auditoría UI y validar_recepcion actualizan entero en faltantes/PDT; diferencias insertan entero | VERIFICADO EN CÓDIGO (captura previa) | Cantidad por registro; no suma de ventanas distintas ni validación consolidada de producción |
| Faltante↔PDT histórico | Coincidencias de producción/pieza/reserva, sin FK inequívoca demostrada | INFERIDO; cobertura NO DISPONIBLE | No reconstruir asociaciones ni omitir filas sin key |
| Reserva compartida | Uso de sgp_produccion_reservas_v, reserva_principal/reserva_pendiente | VERIFICADO EN CÓDIGO | Vista instalada y reparto por reserva/parte NO DISPONIBLES. MULTI-RESERVA no implica compartida |
| Parte↔producción | Contexto de programación/prioridades | INFERIDO / NO DISPONIBLE | No inventar parte desde reserva, nombre u ordinal |
| PDT v2/multiorigen | Controlador y propuestas de fuentes/detalles/líneas/asignaciones | VERIFICADO EN CÓDIGO | No demostrar instalación por REVIEW; piezas no son ventanas; conservar LEGACY |
| Complementarias/NC | Capturas y contratos versionados separan entrega, validación, reposición y cierre | VERIFICADO EN CÓDIGO | VALIDADA/AUDITADA_DIFERENCIA/NC cerrada no reducen solas una cantidad consolidada |
| Consolidación D2 | SQL03, estado/huella/validación append-only, adaptador | VERIFICADO EN CÓDIGO / AISLAMIENTO | Productor real, cobertura, base cuantitativa y ámbitos pendientes |

## Contrato de lectura preparado

`linea-real-source-contracts.js` conserva campos realmente versionados y valores
observados, sin inferir repartos, etapa, acumulados o cortes. Null/negativos/datos
no enteros no se convierten en cero. Los enteros por PDT permanecen separados,
sin sumar supuestos solapamientos ni generar ventanas físicas. El resultado es
SIN_CONCILIAR/available=null; no se registra un lector C2 ni un endpoint.

La disponibilidad futura requiere conjuntamente: identidad canónica comprobada,
fuentes completas (incluidos históricos/keyless/compartidas), base bruta/neta,
validación consolidada vigente, corte aplicado con inclusión explícita y ámbitos
servidor. Ni ACL/SECURITY DEFINER ni flags enviados por un llamador reemplazan
un certificado/productor servidor real; esta etapa no implementa tal autoridad.

## Contrato de escritura conservado

Se reutiliza D2, sin reimplementarla: estimación separada de cantidad validada,
usuario/rol reales, fecha/día/turno, motivo, revisión CAS, UUID y snapshot/huella.
Corrección añade revisión, nunca sobrescribe historial. Líder Picking, líder
Ensamble y coordinador requieren correspondencia real de cargo/rol/ámbito; no se
amplían permisos por nombre de cargo ni por equivalencia RECEPCION→LIDER.

Los PDT superpuestos no se suman; la cantidad consolidada validada es la referencia.
Ensamble apto excluye afectadas sin solucionar. Base bruta histórica se distingue
de eligibleAssembled; base neta no se descuenta otra vez. Empaque puede consumir
parcialmente las ensambladas elegibles menos lo ya empacado en todos los turnos.
Pendientes Empaque son independientes. Cambios de PDT/entrega/fuente invalidan y
requieren revisión; cantidades de piezas o NC cerradas no acreditan disponibilidad.
Correcciones posteriores no reescriben snapshots históricos de cierre.

## Export: ampliación mínima propuesta, no conector productivo

Se reutiliza el ACK privado existente de2D, sin tocar importador ni saldos. El
SQL REVIEW de2E añade un manifiesto inmutable por producción/carga: lista explícita
UUID/eventHash/disposición INCLUDED|EXCLUDED/sourceRef. El sellado bajo lock de
producción exige ACK para cada evento existente; no infiere inclusión por fecha,
igualdad de cantidades, saldo o cercanía del ID. Reintento exacto es idempotente;
metadatos distintos para la misma carga se rechazan. Cortes sucesivos enumeran sus
eventos; eventos nuevos no modifican el recibo anterior. UUIDs son de EVENTOS,
no identificadores físicos de ventanas.

history_ref/cut_hash/writer_contract_ref son campos NUEVOS PROPUESTOS del recibo,
no columnas atribuidas al historial real. Identificadores externos permanecen
opacos hasta conocer sus tipos. Una cadena no vacía, un hash o un sellado no
certifican origen/semántica. `linea-export-manifest-reader.js` usa READ ONLY y la
sesión/ámbitos de ambas etapas; solo devuelve PENDIENTE_CERTIFICACION_EXPORT/null
(o SIN_CONCILIAR si falta recibo). No hay pool/ruta productiva ni lector C2 instalado.

Antes de ser evidencia operativa, el importador autorizado debe acreditar la
inclusión/exclusión de cada evento y ligar historial/corte/ACK/manifiesto atómicamente
bajo el protocolo compartido. Ese vínculo NO está implementado ni demostrado en
las fuentes actuales. Si el sistema externo no lo registra, hará falta una captura
operativa explícita revisada; no se rellena con estimaciones o timestamps.

## Pendientes exactos de información real

La consulta `MISSING_CONTRACTS_READONLY.sql` prepara SOLO catálogos/cuerpos faltantes,
sin filas operativas, contraseñas o tokens. Se probó en QA READ ONLY, no en Supabase.
Faltan: cuerpos actuales preview/apply/historial, semántica bruta/neta/acumulada,
relación con ejecuciones legacy, cobertura key/reserva/parte, permisos efectivos
y coordinación de todos los escritores. Los candidatos por texto en funciones
no son un inventario exhaustivo de SQL dinámico/servicios externos.

No solicitar otra vez los siete cuerpos anteriores ni IDs físicos de ventanas.
El siguiente paso es revisar este paquete y contrastar únicamente esas fuentes
faltantes antes de certificar integración. No se instala ni publica nada.

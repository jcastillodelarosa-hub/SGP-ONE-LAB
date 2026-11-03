# Power BI XLSX v1 — integración del PR #183

02/11/2026, America/Bogota. Continúa **47a06af** en el mismo Draft y rama.
**IMPLEMENTADO EN RAMA / VERIFICADO EN AISLAMIENTO**. No aplicado en Supabase,
activado, fusionado ni desplegado. Sustituye el bloqueo documental por falta de
archivos y por granularidad: el encargo actual aprueba comparar **producción +
línea + etapa + fecha operativa + turno**, sumando los últimos avances de las
asignaciones LP de ese alcance. Las partes de Mecanizado no intervienen.

## Hallazgos de los originales

[Evidencia sin nombres de clientes/producciones](../../tests/lp01-powerbi/evidence/real-files-inspection.json).
Ambos originales fueron leídos localmente y preservados en una prueba aislada;
no se incorporan sus datos al repositorio público. Las fixtures versionadas son
copias anonimizadas de su estructura, con iguales tipos, cantidades y períodos.

| Dato | Ensamble | Empaque |
|---|---:|---:|
| Hoja | Export | Export |
| Filas de detalle | 33 | 37 |
| Cant. Procesada total | 186 | 186 |
| Turno 1: filas / ventanas | 15 / 95 | 13 / 90 |
| Turno 2: filas / ventanas | 18 / 91 | 24 / 96 |
| Línea nativa → SGP | PANELES 2 → PANELES_2 | PANELES 2 → PANELES_2 |
| dia_trabajo | 2026-10-31 | 2026-10-31 |
| Repeticiones exactas / producción-período repetida | 0 / 0 | 0 / 0 |
| Filas cero / negativas | 0 / 0 | 0 / 0 |
| Total / fórmulas | Una fila Total / ninguna fórmula | Una fila Total / ninguna fórmula |

Encabezados Ensamble: `Año  prog`, `Semana`, `Tipo Orden`, `Proyecto`, `Produccion`,
`Sistema`, `Cant. Procesada`, `Linea PDA`, `dia_trabajo`, `turno_trabajo_extra`.
Empaque cambia el primero a `Año Prog` y añade `Estación` antes de la fecha; en
las 37 filas vale `Empaque`. Encabezados, textos y fechas son celdas de texto;
año, semana y cantidad son numéricos enteros. Los XML originales no llevan
referencias r en filas/celdas; el lector admite esta representación y referencias
explícitas, así como inline strings y shared strings.

Hay una fila `Total` que suma ambos turnos y un pie `Filtros aplicados` con línea
y día/mes. Se valida contra los detalles, **no se suma al detalle**. El 186 global
no se asigna a cada turno, producción o asignación. Las semanas 42/44/45 son de
programación: no se recalcula la fecha operativa a partir de ellas. El significado
de ventanas de `Cant. Procesada` procede de la regla funcional del encargo, nunca
de asumir que las piezas o la descripción de Sistema equivalen a ventanas.

## Adaptador versionado y conciliación

`LP-PBI-XLSX-1`, compartido en `src/domain/powerbi/` por navegador y servidor:

1. Lee ZIP/OOXML con límites: 2 MiB de archivo, 16 MiB expandidos, 64 entradas,
   20.000 filas y 32 columnas. Verifica tamaños/CRC y estructura; rechaza archivos
   cifrados, fórmulas, DTD/entidades, relaciones externas, contenido activo y filas
   ocultas, en vez de ejecutar instrucciones o fórmulas del documento.
2. Reconoce los dos esquemas reales de hoja Export. No depende del nombre del
   archivo para decidir la etapa. Valida total y coherencia del pie de filtros.
3. Conserva `dia_trabajo` como fecha operativa y extrae el turno explícito de los
   dos rótulos observados: `1. 07:00 am - 07:00 pm` y `2. 07:00 pm - 07:00 am`.
   No desplaza el día del turno 2 ni usa la fecha de carga/descarga.
4. Selecciona solo línea/fecha/turno solicitados; conserva el original con ambos
   turnos y la procedencia de filas. Agrega contribuciones de dimensiones distintas
   por producción. Una repetición exacta, o mismas dimensiones con otra cantidad,
   se rechaza por ambigüedad: no se suma ni se descarta silenciosamente.
5. Resuelve `Produccion` contra `sgp_producciones.produccion` y línea, con trim sin
   fuzzy matching. Debe existir un único key canónico. No usa reserva, prefijos de
   texto, P1 ni prioridad para inventar una relación; cualquier ambigüedad bloquea.
6. Para cada key, suma los últimos `ejecutado` de todas sus filas LP vigentes de
   etapa/fecha/turno/línea. Conserva UUID raíz y revisión de cada asignación. No
   crea otra división ni modifica la programación, prioridades, fechas o cantidades.
7. Muestra Power BI, acumulado LP y diferencia por producción. Exige motivo por
   diferencia o incumplimiento de SALE, más comentario general. El motor vuelve a
   calcular el acumulado bajo bloqueo al cerrar, incluso si cambió tras cargar el
   archivo. Una ausencia no se convierte en cero; tampoco se ignora una producción
   del archivo que carezca de asignación LP en el período.

## Persistencia, autorización y versiones

- El navegador realiza la vista previa; envía **bytes originales y contexto** al
  servicio. No envía cantidades normalizadas como evidencia confiable.
- `src/server/lp-powerbi-handler.js` vuelve a leer el XLSX y calcula SHA256. Es el
  mismo handler probado localmente; `supabase/functions/lp-powerbi/index.ts` lo
  adapta a Edge Functions. Comprueba la sesión antes de descomprimir y usa la RPC protegida; nunca escribe directamente tablas.
- Propuesta [06_powerbi_xlsx_REVIEW.sql](../sql-proposals/lp01-operacion/06_powerbi_xlsx_REVIEW.sql):
  `sgp_lp_operacion_importar_xlsx` tiene EXECUTE únicamente para el servidor
  (`service_role`). **Esa credencial técnica no autoriza una operación SGP**: la
  función exige token SGP válido, rol admitido, ámbito completo de turno, revisión,
  modo habilitado e identidad/cobertura coherente. Tokens inválidos, Recepción y
  Consulta siguen denegados. La credencial permanece en servidor; no se añade al
  cliente, se imprime ni se ha leído/configurado una credencial productiva aquí.
- Guarda bytea original, nombre, SHA256 verificado por SQL, versión, filas fuente y
  grupos por key. Inserta auditoría idempotente; UUID ligado a usuario/contenido.
  El historial compartido guarda la huella del documento normalizado, no sus filas
  de otros turnos; la procedencia completa permanece en el archivo protegido.
  Reintentar después de perder la respuesta no duplica importación ni auditoría.
- `CERRAR` reutiliza el motor existente. Snapshot por producción con totales LP,
  Power BI, diferencia, saldo oficial consultado, asignaciones/revisiones y motivo.
  Reapertura del coordinador conserva versiones anteriores y el mismo original.
- `sgp_lp_operacion_archivo` permite recuperar el original al cargador con ámbito
  vigente de su turno; otro coordinador/administrador necesita ámbito sobre todas
  las producciones del archivo completo, incluidos los otros turnos. Evita entregar
  datos fuera de ámbito que vienen en el mismo XLSX. Los informes conservan CSV
  para Excel; las diferencias numéricas negativas no se convierten en fórmulas.
- El formato CSV QA queda solo como compatibilidad aislada/histórica. En modo
  `LP-PBI-XLSX-1` su RPC de importación lo rechaza; no hay fallback al contrato QA.
- Los archivos y cierres siguen inmutables. Ninguna importación/cierre actualiza
  saldos Export ni reemplaza la cantidad declarada por el líder con Power BI.

## Hallazgos pendientes, limitados a su caso

- **No hay marcas horarias de ejecución**: no puede certificarse cómo la fuente
  generó `dia_trabajo` tras medianoche. V1 conserva la etiqueta recibida; una
  variante de rótulos horarios distinta necesita otra muestra/perfil, no una
  conversión por reloj inferida. El mismo límite aplica a horarios dominicales
  diferentes que no aparecen en estos archivos.
- **No hay anulaciones ni negativos**: no se infiere que -N sea un movimiento a
  restar. Se rechaza y se documenta hasta conocer su contrato. No bloquea los
  archivos positivos válidos de las muestras.
- **No hay filas cero**: no prueba cobertura de órdenes sin producción. Se exige
  fila explícita para cada producción del turno, incluidas arrastradas. Si no la
  trae la fuente, ese cierre queda bloqueado; no se fabrica cero. Esto se probó
  al abrir turno 2 con órdenes arrastradas no informadas en el archivo.
- No hay subtotales intermedios ni duplicados en los originales. Se probó su
  rechazo y la consolidación de contribuciones distintas con fixtures sintéticas.
- FRAMES_2 solo está contemplado por equivalencia explícita `FRAMES 2`; falta
  muestra real de esa variante. Otros encabezados, filtros multi-día, celdas de
  fecha serial/formatos distintos, hojas adicionales y XLSM no se dan por soportados.
- **Correspondencia real contra SGP no ejecutada:** la revisión automática rechazó
  enviar a Supabase la lista de nombres obtenida de los archivos, por payload
  potencialmente sensible. No se reintentó ni se consultó por otra ruta para
  sortearlo. El parser y preservación de los originales se probaron localmente
  contra catálogo/asignaciones sintéticos en un contenedor sin red. Eso no
  certifica que los nombres reales tengan correspondencia unívoca en producción.
- Actualización Encargo4 (2026-11-03): SALE persistida, siguiente turno, drenaje
  y scopes temporales ya están preparados y probados aisladamente; no son brechas
  de implementación pendientes. PDT/Export siguen bloqueados en fuente, y ámbitos,
  runtime e instalación reales requieren autorización. Prevalece el
  [estado operativo vigente](ESTADO_OPERATIVO_ACTUAL.md).

## Pruebas y evidencia

- `node tests/lp01-powerbi.test.mjs`: 9 pruebas del lector/adaptador, duplicados,
  cobertura, cantidades, consolidación, ZIP/XML no ejecutable y reporte agrupado.
- `node tests/lp01-operation.test.mjs`: 6 pruebas afectadas de exportación/contrato
  histórico. No se repitieron manualmente las otras 105 de la batería anterior.
- `python tests/lp01-powerbi/postgres.py`: permisos reales de función y sesión
  capturada, scopes, ambigüedad, original/hash, idempotencia, últimas cantidades,
  comparación por producción, reapertura/versiones y cobertura sin cero implícito.
- `python tests/lp01-powerbi/browser.py`: Chromium PC1440/móvil390 → handler común
  → RPC PostgreSQL real; cuatro asignaciones, 27 frente a 28, motivo, cierre,
  original descargado idéntico y respuesta perdida tras commit sin duplicar.
  Origen ajeno, payload normalizado del cliente y sesión inválida rechazados.
- `python tests/lp01-powerbi/real-files-isolated.py <ensamble> <empaque>`: verificación
  **local opcional** de los dos originales con catálogo/asignaciones sintéticos,
  original recuperado byte a byte y cierres T1 por 95/90 respectivamente. No envía
  archivos/nombres a Supabase ni los agrega al repositorio.
- Se ejecuta la regresión SQL histórica de c5178d8 porque cambió CERRAR y la tabla
  de archivos, no por una auditoría general. CI conserva sus checks obligatorios;
  una ejecución general automática no se presenta como nueva prueba productiva.

[Resultados, hashes y capturas](../../tests/lp01-powerbi/evidence/). La aceptación
usa servicios/SQL reales aislados, sin stubs de persistencia. Las fuentes operativas
son sintéticas y las capturas/fixtures están anonimizadas. No se probó despliegue
Edge/gateway, usuarios/ámbitos reales, dispositivos físicos o funcionamiento en planta.

## Evidencia integrada posterior — Encargo 4

[Recorrido, matriz de brechas y límites](../../tests/lp01-cierres-integrados/README.md):
handler compartido y SQL01/06/08 reales aislados, ambas etapas, dos originales
preservados, diferencias justificadas, reapertura/versiones e inmutabilidad,
SIN ACTIVIDAD sin BI y próximo turno configurado. Catálogo/cuentas/LP sintéticos;
no acredita correspondencia en planta ni runtime Edge. No se modifica el adaptador
ni SQL. Las instrucciones históricas siguientes no sustituyen los prechecks08 ni
la revisión/autorización de instalación vigente.

## Preparación de instalación — no ejecutar

No cambia la prohibición de SQL productivo, habilitación, fusión, publish o Firebase.

1. Revisar 01 actualizado y 06, cuerpos/huellas/roles y política de archivos. 01
   sigue siendo instalación fresca: si el esquema apareciera instalado, abortar y
   preparar una actualización específica, sin ALTER por inferencia ni borrar historia.
2. Solo con autorización futura: 01 → 06 → comprobaciones SELECT de 03. Mantener
   `escrituras=false`, `formato_bi_aprobado=false`; `adaptador_bi` identifica v1.
   04/05 de Vidrio son independientes, no se reaplican por implementar Power BI.
3. Despliegue del servicio requiere autorización separada y origen(s) permitidos en
   `SGP_LP_ALLOWED_ORIGINS`. `supabase/config.toml` usa autenticación SGP propia
   (`verify_jwt=false` de gateway), no acceso sin sesión: SQL revalida el token y
   ámbitos en cada importación. Nunca configurar la credencial de servidor en web.
   El inventario leído no contiene Edge Functions actualmente; ninguna se desplegó.
4. Resolver ámbitos/correspondencia de datos reales y demás bloqueos, verificar con
   pruebas productivas expresamente autorizadas y entonces decidir activación y
   publicación. No basta cambiar flags ni reutilizar la aprobación de reglas como
   permiso de producción.
5. Recuperación: contener nuevas admisiones y revisar comandos en vuelo, conservar
   archivos/cierres/auditoría y corregir hacia adelante. No DROP/DELETE/TRUNCATE ni
   reset de presupuestos. Los SQL nuevos no contienen DML de borrado ni UPDATE sin
   WHERE. El plan anterior conserva su límite de contención concurrente pendiente.

# Encargo 4 — cierre integrado y Power BI

Base GitHub/checkout `9dce260`, mismo Draft #183. Se reutilizan cierre normal,
SIN ACTIVIDAD, reapertura y adaptador LP-PBI-XLSX-1 ya implementados. **No se
modifica código de aplicación, SQL01–08/08R, permisos o RLS.** Se completa evidencia
de integración bajo los controles temporales08, sin repetir auditorías de fuentes.

## Brechas acotadas y resultado

| Brecha al iniciar | Evidencia nueva / estado |
|---|---|
| XLSX y cierre probados antes de08; pruebas08 de archivo/importación principalmente negativas, sin todo el recorrido del handler | Handler compartido real → RPC06/08 → PostgreSQL17.11 sin red: importación por etapa, motivo, cierre, reapertura y otra versión. VERIFICADO AISLADAMENTE |
| Harness anterior arma universo compartido y recorta órdenes tras ABRIR para preparar la cobertura de cada archivo | Nuevo harness prepara catálogo/LP sintéticos antes de operar, uno por etapa. No elimina órdenes tras ABRIR ni modifica asignaciones para hacer pasar un cierre. Prueba cobertura incompatible sin fabricar ceros |
| Falta evidencia conjunta de SIN ACTIVIDAD y cierre XLSX con el mismo motor08 instalado | Modo XLSX, cierre vacío genuino sin archivo, confirmación/motivo, responsable, dos versiones tras reapertura y apertura del turno operativo siguiente. VERIFICADO AISLADAMENTE |
| Dos originales reales disponibles, sin catálogo/asignaciones reales autorizados para contrastarlos | Originales leídos solo localmente, handler real, catálogo/LP/cantidades sintéticos. Hash y bytes recuperados coinciden. **No acredita correspondencia con SGP productivo** |
| Cierre posterior con arrastre y conjunto de filas/órdenes que no coincide | Se mantiene bloqueado. El XLSX contiene producciones sin asignación en ese turno o faltan filas de órdenes arrastradas del universo sintético. No se altera Programación ni el archivo para completar cobertura |

No se encontró incompatibilidad funcional que justifique reimplementar cierres o
cambiar SQL. Las limitaciones de fuente, usuarios reales y despliegue permanecen
como tales; CI verde o fixtures no acreditan operación en planta.

## Prueba focalizada reproducible

`python tests/lp01-cierres-integrados/isolated.py`

CI usa exclusivamente las dos fixtures anonimizadas existentes. En local, la misma
prueba permite los dos originales aportados:

`python tests/lp01-cierres-integrados/isolated.py /ruta/privada/ensamble.xlsx /ruta/privada/empaque.xlsx`

Se exigen sus huellas ya conservadas en [inspección anterior](../lp01-powerbi/evidence/real-files-inspection.json).
No se incorporan originales ni nombres/filas a GitHub/CI. Los modelos viajan solo
por pipes locales y SQL de un PostgreSQL nuevo `--network none`; el bridge IPC no
simula sesión, parser, persistencia ni cierres. Usa `createPowerBIHandler`, el
adaptador vigente, la RPC servidor con rol técnico sintético y las sesiones SGP
capturadas. El handler recibe bytes/contexto y vuelve a parsear/hash; no confía en
un documento normalizado del navegador. No se generan credenciales ni configura
un runtime productivo. Errores locales se notifican genéricamente para no volcar
rutas, cuerpos SQL o nombres de los archivos reales.

El catálogo de prueba usa los nombres del archivo exclusivamente dentro del
contenedor local y claves QA. Los scopes, responsables, asignaciones y cantidades
LP son **fixtures sintéticos**, no registros observados ni acceso aplicado.
Cada producción del períodoT1 tiene cuatro asignaciones90+90+90+18 existentes
antes de ABRIR, con decisiones SALE explícitas del coordinador. El objetivo es
probar agrupación/cierre, no acreditar que una producción real tiene288 ventanas.
Se usan bases separadas por etapa para no mezclar universos de archivo distintos;
no se declara probada su conciliación conjunta contra el catálogo productivo.

Por cada etapa y cada juego de archivos se verifica:

- Turno con órdenes, aunque ejecución sea cero, rechaza SIN ACTIVIDAD; cierre
  normal sin archivo sigue denegado.
- Consulta/Recepción/sesión inválida, origen no permitido, documento normalizado
  aportado por cliente y archivo de otra etapa se rechazan antes de importar.
- Original se importa por handler→SQL08, SHA256 y bytes preservados. Reintento
  exacto y recibo dejan una sola auditoría/importación. Ámbito revocado impide
  tanto lectura del original como una nueva importación.
- Cuatro avances LP se suman una vez por producción. Primera diferencia1 sin
  motivo se rechaza; con motivo crea cierre. La otra etapa permanece abierta.
- Solo coordinador reabre con motivo. Líder no corrige/importa en revisión.
  Corrección autorizada y recierre conservan la primera versión y el mismo XLSX;
  segunda versión sin diferencias. UPDATE de archivos/cierres/auditoría se rechaza.
- Turno siguiente con cobertura incompatible rechaza la carga; no rellena ceros,
  no ignora órdenes y no puede utilizar SIN ACTIVIDAD para omitirlas.
- Línea FRAMES_2 realmente vacía en el alcance de prueba, ambas etapas: no exige
  archivo aun en modo XLSX; confirmación/motivo estrictos, identidad/hora/tipo,
  reintento exacto, reapertura del coordinador y nueva versión SIN ACTIVIDAD.
  El siguiente turno de domingo abre según HORARIOS_TURNOS. No se prueba con ello
  una variante XLSX real FRAMES_2 ni una nueva regla de domingo en Power BI.
- Export y las asignaciones completas (identidades, cantidades, prioridades,
  fechas) coinciden antes y después. No se usa ni acredita liberación PDT o
  inclusión de eventos LP en Export.

[Fixtures](evidence/fixtures.json) · [Originales locales](evidence/originals.json) ·
[Huellas y regresiones](evidence/verification.json).

| Original | Detalle | Total del archivo | T1 conciliado | Primera diferencia | Versiones normales / vacías |
|---|---:|---:|---:|---:|---:|
| Ensamble |33 filas|186|95|1|2 /2|
| Empaque |37 filas|186|90|1|2 /2|

Los totales186 se reutilizan del parser/inspección anterior; no se imputan como
T1 ni se suman de nuevo. Las versiones son recuentos de snapshots, no sus números
de revisión. T2 mantiene su fecha operativa; no se certifica la convención física
de registros tras medianoche, ausente en las muestras originales.

Regresiones directas:9 adaptador +1 reporte SIN ACTIVIDAD +6 Operación, todas PASS.
Sin cambio de UI: se reutilizan PC1440/móvil390 de
[Power BI](../lp01-powerbi/evidence/browser.json) y
[SIN ACTIVIDAD](../lp01-sin-actividad/evidence/browser.json).
Las carreras/contención ya verificadas en3B y continuidad se conservan, no se repite
su batería completa. CI existente incluye la nueva prueba con fixtures; nunca
recibe los originales. Solo se publican resúmenes sin identidades de origen.

## Brechas que siguen pendientes

1. Matriz/catálogo/ámbitos reales aprobados y correspondencia unívoca de las
   producciones del XLSX con SGP. No se reintenta la consulta sensible rechazada
   ni se consulta por otra ruta. La prueba sintética no resuelve esa dependencia.
2. Cobertura real del siguiente turno: Programación y archivo deben describir
   el universo correspondiente, incluidos pendientes y ceros explícitos cuando
   proceda. Una orden ausente no es cero. No se solicita otra vez el formato
   ya recibido; solo evidencia del caso/convención no cubierto si se necesita.
3. Variantes aún no observadas: FRAMES_2 real, anulaciones/negativos, ceros,
   subtotales intermedios, otros rótulos/fechas y criterio de medianoche. Se
   preserva rechazo/pendiente por caso, sin inferencias ni bloquear elT1 válido.
4. Runtime Edge/gateway/orígenes/sesión real, autocommit/constraints diferidas,
   instalación y activación de escrituras requieren revisión/autorización
   separadas. El handler Node local no certifica despliegue Edge ni dispositivos.
5. PDT y Export siguen BLOQUEADOS EN FUENTE exclusivamente en sus contratos;
   el cierre BI no crea ventanas liberadas ni evidencia de inclusión Export.

Siguiente acción exacta: revisar este cierre técnico con su matriz de brechas y
recibir por canal privado autorizado la matriz/catálogo/períodos reales. Preparar
su diff con el importador3C sin aplicar accesos. Para un cierreT2 real, acreditar
primero el universo LP y la cobertura del archivo de ese turno, manteniendo
pendiente solo ese caso. Sin SQL productivo, permisos, fusión o despliegue.

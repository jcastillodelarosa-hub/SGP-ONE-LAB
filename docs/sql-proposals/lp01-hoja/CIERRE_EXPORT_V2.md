# Realizado y cierre por producción

## Entrega disponible y segura

`src/domain/lp01-closure-export.js` añade dos funciones puras, sin llamadas de red
ni escrituras y sin modificar el parser/adaptador LP-PBI-XLSX-1.

`closureExportRealized(data, context)` consume la respuesta autenticada
LP-OPERACION-1. Solo devuelve Realizado si el turno está CERRADO, hay un último
cierre único cuya versión coincide con la revisión del turno, coincide el contexto
y las filas contienen `power_bi` entero no negativo con archivo XLSX/SHA256.
Devuelve cantidad por key y procedencia de cierre/versión/archivo. Un cierre viejo
tras reapertura, datos ambiguos o ausencia queda sin Realizado actual. SIN ACTIVIDAD
es un cierre vacío explícito, no una cantidad0 inventada para cada producción.
Esta es lectura de cierres existentes; no cambia el contrato de sus escrituras.

`previewExportClosure(parsed, {catalog,orders,stage,line,date,shift})` proyecta un
archivo parseado con el adaptador vigente contra catálogo autorizado LP-HOJA-1:

- Cada producción reportada queda PRESENT con cantidad explícita y filas fuente.
- Las órdenes del turno que faltan quedan ABSENT, cantidad null y preserve=true.
- Cero se acepta exclusivamente si aparece explícito en el Export.
- Varias asignaciones de la misma key producen una fila de cierre por producción;
  no se reparte la cantidad entre UUID, no se suma ejecutado manual y no se toca saldo.
- Una fila del archivo fuera del catálogo o con nombre ambiguo se rechaza.
- Una key autorizada reportada pero no incorporada requiere incorporación explícita.
- Una nueva importación reemplaza la proyección; no se suma a la carga anterior.
- Original/SHA y filas de origen siguen identificados; la salida lleva
  PREVIEW_ONLY y canApply=false. No es un comando ni evidencia confiable de cliente.

Diez tests focales Node aprobados cubren esas condiciones y el rechazo vigente de
filas exactamente duplicadas. Los módulos de parser v1 son copias inalteradas de
main75b05b8 solo para reproducción local, NO son cambios para integrar.

## Por qué no activar todavía el nuevo cierre

El importador productivo `sgp_lp_operacion_importar_xlsx` rechaza cualquier orden
faltante (`ARCHIVO_BI_INCOMPLETO_AUSENCIA_NO_ES_CERO`) y filas sin asignación vigente.
El comando CERRAR compara Power BI con `ejecutado` digitado y exige motivos por
esa diferencia. No basta renombrar la etiqueta ni enviar ejecutado0.

Además, ABRIR y los presupuestos/continuidad usan `ejecutado` por UUID de asignación
para cantidad restante y arrastre. El Export acredita total por producción, no la
contribución de cada raíz. Repartirlo de forma automática fabricaría evidencia.

## Delta posterior mínimo, no activado

1. Versionar la autoridad `EXPORT_PRODUCTION_V2` explícitamente. El servidor debe
   informar `closeAuthority` solamente después de instalar/probar el flujo completo.
2. Reusar el servicio de XLSX ya autorizado y su sesión SGP; volver a parsear los
   bytes originales en servidor. Conservar hash/original, filas presentes, ausentes
   y la revisión del universo de órdenes. No confiar en totales del navegador.
3. Validar la proyección por producción dentro de la transacción de importación.
   Una corrección/reimportación es una nueva evidencia/version, nunca una suma.
4. CERRAR guarda Realizado a nivel key/etapa/fecha/turno como autoridad del Export,
   con coverage y motivos para ausencias/incumplimientos, preservando versiones
   anteriores y registros manuales históricos identificados como históricos.
5. Adaptar continuidad/ABRIR/presupuestos para consumir esa autoridad a nivel
   producción sin duplicar ejecución ni inventar distribución a raíces. Hasta
   resolver la relación de cantidades por asignación, no habilitar el cierre V2.
6. Mantener RLS, perfiles, scopes, CAS, recibos y revocación. No requiere otorgar
   EJECUTAR/ABRIR al líder, crear credencial ni ampliar ACL para leer el Realizado.

Pendiente: implementación SQL de importación/cierre/continuidad, regresiones con
variación de corte Export y reimportación, integración PC/móvil y aprobación de
aplicación productiva. La UI debe mantener cierre Ensamble bloqueado si no recibe
`closeAuthority='EXPORT_PRODUCTION_V2'`. No publicar como módulo operativo completo.

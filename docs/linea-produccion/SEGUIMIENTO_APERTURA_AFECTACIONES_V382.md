# Seguimiento: apertura, historial y afectaciones por orden

Estado: revisión de contratos en código y preparación local de LAB v382.
No SQL aplicado, consulta de filas productivas, nueva RPC ni permisos modificados.

## Reglas recuperadas (evidencia del hilo principal)

- [19/Rama 19](https://chatgpt.com/c/6ae73c0a-4824-83e9-9e4b-877b8e5fdaaf?messageId=557b8918-7655-42d1-b009-4fe9cee059dc): abierta es comenzada y no terminada; antigüedad desde primer avance sin reiniciar por reprogramación/turno. También permanece abierta por afectación de aluminio, vidrio o novedad. Orden por semana original y antigüedad.
- [21](https://chatgpt.com/c/6aeb536b-7c64-83e8-abb9-220605e54797?messageId=4db6b855-7613-4fb7-bd7f-6472b1b21f42): seleccionar orden abre panel lateral para ver afectadas/disponibles. Afectaciones se arrastran y se modifican. Seguimiento de coordinador/administrador.
- Confirmación 2/11: cantidades de ventanas por causa, sin identificación individual; coordinador valida el consolidado. Conservar identidad y fechas/turnos originales, historial y arrastre sin duplicar. No sumar causas solapadas.

## Fuente de primer avance

`sgp_lp_operacion.auditoria` conserva comando, `payload.quantity`, estado `antes`,
fecha/turno operativos y `creado_en` del evento confirmado. Un evento `EJECUTAR`
con cantidad positiva puede acreditar un avance LP. Para establecer el primero
hay que comprobar cobertura histórica y procedencia: el primer evento encontrado
no acredita el primer avance real si la orden ya estaba empezada antes de LP.
`antes.ejecutado > 0` en el primer evento disponible evidencia historia previa.
Una corrección posterior a cero no debe borrar silenciosamente la evidencia;
no hay todavía contrato de invalidación/reconstrucción histórica de esa fecha.

La RPC global actual solo proyecta `payload.observation`: no expone cantidades,
estado anterior, completitud del historial ni evidencia de primer avance.
`antiguedad_fecha` es programación de la raíz, `origen_fecha` es arrastre y
`ultima_vez_export` es carga: ninguna debe presentarse como apertura.
La fecha de primera afectación tampoco sustituye primer avance; para una orden
bloqueada sin avance hay estado de afectación, pero no fecha de inicio acreditada.

Actualización 05/11: Johan confirmó también EMPAQUE: primer movimiento acreditado
de su proceso. Ambas etapas conservan su fecha al cambiar turno. Sin evidencia
del primer avance, fecha no disponible; no reconstruirla con programación.

Propuesta para revisión de contrato: devolver evidencia de inicio por producción,
línea y etapa con fecha/turno operativos, timestamp, evento/origen y calidad
(acreditado, primer registro LP con cobertura desconocida, sin evidencia).
No fabricar un timestamp global en frontend ni modificar registros anteriores.
La regla para reinicios reales/reapertura y avances corregidos debe conservar
trazabilidad; no confundir reapertura de turno con reinicio de antigüedad de orden.

## Divergencia de clasificación

Hoy el lector SQL y `globalTrackingData` exigen ABIERTA cuando el saldo Export es
positivo. Esto incluye órdenes no empezadas; no satisface la regla recuperada.
Cambiar solo frontend rompería el contrato validado o inventaría información.
La revisión debe cambiar juntos proyección, validación y pruebas de clasificación,
con casos sin avance, bloqueadas sin avance, parcialmente avanzadas, saldo ausente,
terminadas con afectaciones y arrastre; no excluir silenciosamente pendientes.

## Afectaciones: límite actual y opciones

El comando actual actualiza una fila por etapa/línea/fecha/turno/producción/parte.
Al abrir un turno copia las afectaciones y reinicia validación; varias partes pueden
tener valores distintos. Esas copias no son una autoridad global única por orden.
Elegir la copia más reciente entre partes, sumar causas o copiar un nuevo reporte
a todos los turnos crearía pérdidas, doble conteo o reescritura histórica.

Reglas adicionales recuperadas el 05/11: líder como fuente principal del reporte;
coordinador también agrega/corrige y valida consolidado. Cada afectación es un
registro individual por causa agrupado por producción, con etapa de origen e
historial compartido. No equivale a una identidad por producción con cuatro
cantidades. Esta precisión sustituye la propuesta agregada anterior de esta nota.
No se requieren identificadores individuales de ventanas.

Diseño pendiente de revisión: identidad estable de cada reporte, causa, producción,
etapa, cantidad de ventanas, autor y fechas/turnos originales; eventos de corrección,
solución parcial y confirmación física con cantidad y observación en panel lateral.
El arrastre referencia el mismo reporte, sin crear otro por turno ni otra etapa.
El Picking conserva su identidad y vínculo de origen; no reingresar su reporte
como nuevo bloqueo al mostrarlo en Ensamble/Empaque. Solución en origen y recepción
física son eventos distintos; ninguna suma automática determina disponibles.
El coordinador valida el consolidado de ventanas distintas, con causas solapables.
Conservar permisos vigentes hasta revisar el contrato; la fuente principal líder
requiere acceso operativo por su etapa, no conceder Seguimiento global a todos.

Compatibilidad obligatoria: lectura/autorización por sesión y ámbito, CAS e
idempotencia, auditoría común con etapa identificada, integración con operación y
cierres actuales, conservación de snapshots históricos y recepción de reportes
sin parte artificial. Reconciliar copias previas con evidencia o decisión auditada
del coordinador; no migrarlas sumando ni sobrescribirlas automáticamente.
Esta opción todavía no tiene SQL, migración ni formulario de escritura preparado.
Mantener el formulario actual por turno es compatible temporalmente, pero NO
presentarlo como solución al registro global por orden solicitado.

## PDT aluminio: reutilización concreta y límites

Inspección de código/propuestas versionadas, no certificación de cuerpos instalados:

| Requisito | Contrato actual y diferencia |
|---|---|
| Reportar aluminio como Picking con origen de etapa | `src/domain/pdt-registration.js` admite PICKING/ENSAMBLE/EMPAQUE; `src/services/pdt-registration.js` llama `sgp_pdt_registro_fuentes_v4` y `sgp_pdt_registrar_v4`. Reutilizar identidad canónica y lote idempotente; fijar origen desde contexto autorizado, sin selector que permita falsear etapa. |
| Registro individual e historial | V4 conserva UUID PDT, piezas verificadas, producción/reserva, origen/fecha/usuario mediante `sgp_pdt_registro_metadatos_v4`. Son piezas PANEL de aluminio, no ventanas LP. Su UUID puede vincularse al reporte, sin convertir cantidades de piezas en ventanas. |
| Variantes de captura | `src/services/pdt-manual.js` usa catálogo/fuentes y `sgp_pdt_manual_registrar_v1`, devuelve `id_reporte`. Flujo manual distinto de V4; verificar capacidades de destino antes de escoger ruta. V4 exige NC en Ensamble/Empaque; `manualReportPayload` no la exige. No imponer ni eliminar esa diferencia sin comprobar contrato efectivo. |
| Soluciones parciales y entrega | `pdt/manual/03_manual_operations_REVIEW.sql` define `sgp_aluminio_pendiente_registrar_avance_v1`; `pdt/multiorigin/02_canonical_lifecycle_REVIEW.sql` define `sgp_pdt_entrega_registrar_v2`, con detalle/entrega/cantidad/clave, validación de identidad y límite al procesado neto. Esto registra material, no confirma ventanas disponibles en una etapa LP. |
| Confirmación física LP y liberación | `src/server/lp01-pdt-origin.js` devuelve `canEmitReceipt:false`, crédito cero: falta enlace autoritativo raíz/etapa, versiones y unión de ventanas antes/después. `lp01-operacion/07_pdt_asociacion_REVIEW.sql` es propuesta privada, sin endpoint navegador ni emisor de evidencias implementado. No es un formulario utilizable para cumplir la regla recuperada. |
| Afectaciones de otras causas | AFECTAR LP sigue objeto agregado por parte/turno. Falta contrato individual común para vidrio/novedad y para vincular aluminio, con eventos físicos, correcciones, arrastre e historial compartido. |

Los paths SQL de la tabla son relativos a `docs/sql-proposals/`. No habilitar
escritura llamando helpers privados ni ampliar roles de PDT para simular recepción.
La entrega PDT usa roles existentes de Picking/coordinación; eso no acredita quién
puede confirmar físicamente ventanas en LP. Revisar esa autorización efectiva al
preparar el contrato, conservando el coordinador como validador del consolidado.

Paquete técnico por coordinar: lectura de reportes individuales e historia con
vínculos PDT; comandos idempotentes por reporte con revisión para conflictos;
confirmación física parcial auditada separada de solución; consolidación validada;
proyección de apertura de Ensamble con procedencia/cobertura. Después, panel lateral
para líder en su etapa y coordinador, pruebas de arrastre sin duplicación, causas
solapadas, correcciones concurrentes, reintento, solución sin recepción y permisos.
No reconciliar automáticamente copias históricas ni inventar reportes faltantes.

## Implementación local permitida

En Historial del panel lateral se añaden días, turnos, asignación y último total LP
registrado, tomados exclusivamente de `operationTargets`. Se conservan separados
por contexto; no se suman snapshots ni se anuncian cierres/Power BI verificados.
Cero es cero, desconocido es Sin dato, vacío no inventa fecha; selección de contexto
acota el historial. Esto no modifica avance, SALE, afectaciones ni apertura.

Pruebas locales: 472 JS PASS; navegador 1440/390 PASS con transporte sintético,
filas de historial visibles; release LAB v382 PASS. Sin certificación productiva.
Siguiente: revisar propuesta del contrato con el hilo principal antes de preparar
RPC/migración de lectura/escritura o cambiar clasificación/fecha de apertura.

## Incremento aislado posterior · 05/11

Contrato ejecutable, panel de una etapa y propuesta de almacenamiento preparados:
[alcance exacto y pendientes](../sql-proposals/lp01-afectaciones/README.md).
477 JS PASS y panel PC/móvil PASS con datos sintéticos. No hay RPC instalada ni
integración productiva. Se mantiene LAB v382 como misma entrega aún sin publicar.

## RPC preparadas y probadas en PostgreSQL aislado · 05/11

La barrera de entorno se resolvió con Docker PostgreSQL17.11 sin red. RPC nuevas,
transporte y panel se prueban con sesión/matriz reales capturadas y datos sintéticos.
Lectura compartida filtrada por permisos; movimientos proyectados de auditoría;
apertura de ambas etapas exige evidencia privada desde origen. NC_AL exige vínculo
PDT único: selector de fabricación/longitud compartido con Picking, guardado bloqueado
hasta adaptador atómico; no ampliar roles PDT (supervisores LP aún no figuran en V4).
Sin grants API ni gates habilitados por instalación. Conciliación de legacy y permiso
físico por certificar. Estado técnico actualizado en el README del paquete SQL.

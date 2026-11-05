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

Opción recomendada para diseño backend: una identidad canónica de afectación por
producción y etapa con cantidades por causa, revisión, motivo, autor, fechas
originales y eventos de modificación; arrastre referencia esa misma identidad.
Un consolidado de ventanas distintas validado por coordinador debe respetar
max(causas) ≤ consolidado ≤ suma(causas), además del saldo elegible. Administrador
puede registrar según permisos vigentes; no ampliar VALIDAR fuera del coordinador.
Sin consolidación acreditada, disponibles no se infieren restando suma de causas.

Compatibilidad obligatoria: lectura/autorización por sesión y ámbito, CAS e
idempotencia, auditoría común con etapa identificada, integración con operación y
cierres actuales, conservación de snapshots históricos y recepción de reportes
sin parte artificial. Reconciliar copias previas con evidencia o decisión auditada
del coordinador; no migrarlas sumando ni sobrescribirlas automáticamente.
Esta opción todavía no tiene SQL, migración ni formulario de escritura preparado.
Mantener el formulario actual por turno es compatible temporalmente, pero NO
presentarlo como solución al registro global por orden solicitado.

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

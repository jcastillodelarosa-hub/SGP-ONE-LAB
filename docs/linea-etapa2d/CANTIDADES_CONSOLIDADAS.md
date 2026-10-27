# Etapa 2D — cantidades consolidadas aprobadas

## Contrato vigente de este ajuste

Este documento sustituye el requisito de identificadores individuales como bloqueo
para operar 2D. El complemento por unidades queda opcional/aislado. No se migran
históricos, no se reconstruyen asociaciones ni se modifica Picking operativo.
PR único #127, dependiente de #124; base de ajuste 979421354f8115126fff823975e67bef646f3c7c.
Main observado ae76b3729184ff802d7adc83d8867662230d438c, incluido PR125, sin merge/rebase.

Se registra una validación consolidada por producción y etapa. Dos PDT con tres
ventanas afectadas cada uno NO implican seis distintas. La estimación conserva
su evidencia de composición y piezas, pero solo la decisión humana autorizada
fija la cantidad operativa. Ningún ID físico se inventa ni se exige en esta vía.

## Estados, trazabilidad y permisos

- SIN_EVIDENCIA: no existe captura suficiente o estimación.
- ESTIMACION: cantidad estimada, nunca acredita disponibilidad.
- VALIDACION_VIGENTE: cantidad validada vinculada a la huella servidor actual.
- REVISION_PENDIENTE: PDT, entrega, detalles, fuente, Export o permisos cambiaron;
  no se devuelve disponibilidad hasta nueva validación y conciliación.

`sgp_linea_d2q.validaciones` es append-only: estimación, cantidad, usuario/rol real,
fecha servidor, día/turno, motivo, revisión CAS, UUID idempotente, huella y snapshot
íntegro de evidencia. La corrección crea otra revisión; no modifica la anterior.
`historial_fuentes` conserva versiones de la captura servidor. NC cerrada,
PROCESADO, cambio de estado, piezas positivas, AUDITADA_DIFERENCIA o VALIDADA
cambian la huella; ninguno reduce automáticamente el bloqueo.

La validación consulta `sgp_sesion_actual`, sin equivalencia RECEPCION→LIDER.
COORDINADOR requiere ámbito servidor producción/etapa. Líder Picking/Ensamble
requiere además grant explícito `validationRole=PICKING|ENSAMBLE`. El rol genérico
LIDER solo es suficiente con ese grant, nunca por nombre del usuario. CONSULTA,
RECEPCION y demás roles se rechazan. Los permisos de ejecución existentes de
2A/2B no se amplían por este permiso de validación. El turno debe existir y estar
ABIERTO; EN_REVISION requiere coordinador; CERRADO rechaza. No hay escritura
anónima, grants de tabla al navegador ni pool/endpoint productivo registrado.

## Disponibilidad y descuento único

Export sigue siendo la única fuente de saldos oficiales. Se conserva su corte y
la clasificación explícita INCLUDED/EXCLUDED de eventos locales de 2C. No se
modifica Export ni se deduce inclusión por fecha/cantidad.

La captura servidor necesita declarar, con evidencia, cómo se contabiliza Ensamble:

| Base comprobada | Disponibilidad máxima de Empaque |
|---|---|
| GROSS_REQUIRES_DEDUCTION: el acumulado histórico contiene las afectadas | ensamblado acumulado − ya empacado − cantidad consolidada validada de Ensamble |
| NET_EXCLUDES_BLOCKED: el acumulado ya excluye las afectadas | ensamblado acumulado − ya empacado; verificar ensamblado ≤ total producción − afectadas |
| Base desconocida | Bloqueo; no inferir qué unidades están incluidas |

Así, 20 brutas − 3 afectadas = 17 elegibles. Si ya están registradas 17 netas y
cinco empacadas, quedan 12, NO nueve. `eligibleAssembled` distingue la cantidad
apta de un acumulado bruto histórico: una afectada no se acredita como ensamblada
apta. Nunca se descuenta simultáneamente por unidades y por cantidad consolidada.
Los pendientes de Empaque mantienen validación e historial separados y no se
restan otra vez como pendientes de Ensamble. Se permiten consumos parciales desde
turnos diferentes dentro de la disponibilidad global. Correcciones descendentes
no pueden dejar Empaque sin respaldo. La validación no puede superar producción,
saldo elegible ni la coherencia de la base cuantitativa disponible.

## Implementación aislada y compatibilidad

SQL REVIEW `03_consolidated_quantities_REVIEW.sql`, fuera de migraciones:
- Tablas privadas nuevas de fuentes, validaciones e historial.
- Funciones fuente/estado/validar/impacto y guard de ejecución sobre eventos NUEVOS B2.
- Wrappers de `sgp_linea_b2.disponible/snapshot`, conservando los cuerpos originales
  como fallback privado exacto para las producciones no adheridas.
- Se conserva C2 sin alterar su cuerpo ni sus lectores productivos: solo QA registra
  el lector de cantidades que entrega `items=[]` y la evidencia consolidada aparte.
- Dominio 2A reconoce `consolidatedImpact`; el adaptador B2 conserva sus transacciones,
  idempotencia, turno explícito y revisión. Ninguna importación desde frontend.

Todo uso de fuentes consolidadas necesita un productor servidor revisado que
certifique identidad producción/línea/reservas/parte, total de producción, base de
Ensamble y cobertura completa de PDT por etapa. El inventario incluye pendientes
cerrados previamente cubiertos; no se borra el bloqueo porque cambie su estado.
Las capturas QA son sintéticas y NO prueban que este productor esté instalado.

## Concurrencia y cierres

Orden de bloqueos: UUID solicitud → producción → turno. Las validaciones de una
producción comparten lock con consumos B2 y CAS por etapa. Los escritores de
Picking/PDT/Export DEBEN tomar el lock de producción antes de mutar/notificar.
La huella detecta cambios no notificados al leer, pero por sí sola NO elimina una
carrera concurrente con un escritor que ignore el protocolo. Esa instalación
sigue pendiente y no se habilita runtime productivo.

La validación de un turno cerrado se rechaza; revisión de turno sigue el protocolo
vigente de reapertura. Una validación futura desde turno abierto cambia únicamente
el estado actual, nunca snapshots de cierres ni sus hashes. Los informes anteriores
siguen leyéndose desde el snapshot inmutable del cierre, no recalculándose con PDT actual.

## Pendiente de evidencia real, no de identidades individuales

No son necesarios IDs físicos para el nuevo contrato. Sí faltan productores y
cobertura reales revisados, evidencia de base bruta/neta, ámbitos de validación,
coordinación de TODOS los escritores, clasificación Export por evento y pool mínimo.
Sin esos elementos, se conserva SIN_CONCILIAR; no se afirma integración productiva.
PR125 no se sobrescribe: sus cambios de fecha/turno Picking quedan en main; este
ajuste no inserta entregas ni toca ese guard. Compatibilidad final de despliegue
requiere revisar juntos el stack y la definición instalada, no este QA sintético.

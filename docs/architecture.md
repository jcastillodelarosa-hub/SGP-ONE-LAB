# SGP ONE — Arquitectura objetivo

## Identidad del negocio

La jerarquía funcional es:

`SGP ONE → Línea de producción → Sublínea física → Proceso`

La identidad de una producción es `ID + ID_LINEA`. La sublínea y el proceso son asignaciones operativas y no forman parte de la identidad permanente.

## Ejes separados

### Disponibilidad logística de la reserva de aluminio

`PENDIENTE_ABASTECIMIENTO → PENDIENTE_BODEGA → ALUMINIO_ENTREGADO`

Este eje describe disponibilidad logística de la reserva. No representa progreso de mecanizado.

### Proceso productivo

`CORTE → MECANIZADO → PROCESADO → PICKING`

- PROCESADO = mecanizado terminado.
- PICKING = material entregado a la línea de producción.
- El patinador reporta qué sale hacia Picking y qué piezas quedan pendientes.
- La línea confirma independientemente lo recibido.

## Paneles 2 y Frames 2 — alcance del módulo de aluminio

**El Maestro de Piezas de aluminio, su clasificación PANEL / FRAME / COVER / REFUERZO / MUNTIN y el Control de Mecanizado que usa esta clasificación aplican exclusivamente a las líneas `PANELES_2` y `FRAMES_2`.**

No se debe extender esta clasificación automáticamente a `PANELES`, `FRAMES` ni a ninguna otra línea de SGP ONE.

Las reservas de aluminio de este módulo son compartidas conceptualmente entre `PANELES_2` y `FRAMES_2`. El estado logístico de una reserva se modela una sola vez y se consume desde las producciones relacionadas.

El origen `Línea Prog.` del archivo compartido no determina el destino productivo.

## Seguimiento Aluminio

Clave física: `ID|RESERVA`.

Relación hacia programación/control: por `ID`.

Al relacionar este módulo con Producciones, sus consumidores válidos son exclusivamente `PANELES_2` y `FRAMES_2`.

Campos principales:

- ID
- RESERVA
- AÑO
- SEMANA
- PROYECTO
- PRODUCCION
- SISTEMA
- ESTADO_RESERVA
- ESTADO_RESERVA_FUENTE
- PESO_RESERVA
- CANT_VENT
- PORCENTAJE_VIDRIO
- VENT_CANT_VIDRIO

`Último Estado` queda fuera del modelo.

`Cant. Vent` representa Paneles/ventanas y no debe interpretarse como cantidad de Frames.

## Cargas

Las cargas semanales se agrupan por lote. Las actualizaciones diarias se agrupan por sesión.

Una fuente no seleccionada en actualización diaria no se modifica.

Las desapariciones solo se calculan dentro del alcance SALDOS efectivamente cargado y validado.

## Política de migración

Apps Script permanece operativo mientras se construye la nueva plataforma. Los módulos se migran y validan en paralelo antes de retirar el equivalente anterior.

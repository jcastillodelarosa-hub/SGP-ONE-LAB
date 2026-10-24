# Migración propuesta: programación independiente del estado operativo

Estado: IMPLEMENTACIÓN PARCIAL EN RAMA, NO APLICADA EN SUPABASE, NO PUBLICADA.

## Reglas aprobadas
- Una unidad elegible no programada tiene `programada = NO`.
- Al asignar programación vigente pasa a `programada = SI`, sin modificar su avance operativo.
- En registros históricos con estado no nulo: inicializar `programada = SI` conforme a la regla aprobada, **sin reactivar programaciones canceladas**.
- Solo `PROGRAMADA` se transforma en `SIN INICIAR` como estado operativo; CORTE, MECANIZADO, PROCESADO y otros estados se preservan.
- PICKING es evento de entrega física con validación y faltantes independientes; REPROGRAMADO es evento de programación. No borrar ni reescribir historiales.
- Mantener identidad ID|ID_LINEA, relación por id_programacion, reservas compartidas/múltiples, programación parcial y cantidades sin duplicar.
- Planificador: arriba no programadas; abajo programadas; usar las consultas y reglas vigentes para determinar la unidad programable.

## Pendiente antes de aplicar
1. Revisar definiciones completas y contratos de `sgp_mecanizado_programar`, `sgp_mecanizado_guardar_estado_orden`, `sgp_mecanizado_pendientes_turno`, reprogramaciones y Picking.
2. Identificar tabla propietaria de la bandera y relación con unidades no programadas; evitar que una fila inexistente de programación impida representar NO.
3. Preparar migración idempotente y reversible con conteos pre/post, sin alterar CANCELADA ni estados históricos.
4. Actualizar RPC y frontend conjuntamente: defaults, validación de estados, filtros, estilos y presentación de ambas secciones.
5. Probar programar, reprogramar, desprogramar, programación parcial, arrastre, reservas compartidas, Picking PANEL y permisos.
6. Solicitar autorización explícita para aplicar SQL y publicar.

Los cambios actuales en `app.js` y `src/config/domain.js` son preparatorios y **no deben fusionarse** hasta completar backend y pruebas.

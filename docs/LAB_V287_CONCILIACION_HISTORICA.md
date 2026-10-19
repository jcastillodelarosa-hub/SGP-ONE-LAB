# LAB v287 — Conciliación histórica excepcional (propuesta)

Estado: PROPUESTO. No aplicar sin validar el contrato de datos y la compatibilidad con Producción, arrastre y Picking.

## Casos confirmados por operación

- Reserva 8689919: 35 ventanas completas; registro histórico de 29, diferencia de cobertura de 6.
- Reserva 8690338: 120 ventanas completas; registros históricos de 46 y 65, diferencia de cobertura de 9.
- La confirmación operativa NO identifica por sí misma las órdenes ni sus turnos históricos.

## Restricciones obligatorias

1. No incrementar `cantidad_programada` de registros originales ni crear programaciones ficticias.
2. No marcar como PROCESADO, ENTREGADO ni generar picking por la conciliación.
3. Mantener `id_programacion`, fecha, turno, parte y estados originales.
4. Almacenar confirmación operativa con autor, motivo, fecha y evidencia en un registro de auditoría separado, protegido por roles.
5. Las consultas de cobertura podrán mostrar `CONFIRMADA_OPERACION` sin afirmar cobertura individual verificada.
6. Las RPC de Producción, arrastre y Picking no deben tratar confirmaciones como órdenes programadas o ejecutadas.
7. Resolver explícitamente la diferencia entre las prioridades históricas 2.1/2.2 y las prioridades mostradas actualmente antes de aplicar cualquier corrección.
8. Añadir pruebas de permisos, reservas compartidas, sumas por parte, regresión de arrastre y picking PANEL.

## Control de versión

La implementación funcional final deberá actualizar la versión visible desde LAB v286 a LAB v287, en el mismo conjunto de cambios. Este documento por sí solo no constituye publicación ni cambio funcional.

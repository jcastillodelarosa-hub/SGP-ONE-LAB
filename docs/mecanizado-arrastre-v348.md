# Arrastre por orden

Estado: EN DESARROLLO EN RAMA, sin cambios productivos.

- Mover solo ordenes no procesadas.
- Conservar la informacion original de cada reserva y orden.
- Mantener las procesadas visibles en el turno de culminacion.
- Mostrar referencia historica en el turno original.
- No duplicar cantidades ni perder trazabilidad.

Publicar solo tras pruebas de regresion y verificacion de RPC.

## Alcance prospectivo aprobado

- La fecha de activación se registra **una sola vez al aplicar la migración** en
  `sgp_mecanizado_arrastre_activacion`; no se reconstruyen eventos anteriores.
- La consulta conserva procesadas únicamente cuando el evento de culminación
  ocurrió desde la activación y dentro del turno consultado.
- Se contemplan los horarios distintos del domingo (T1 hasta 18:00 y T2 hasta
  05:00 del lunes). Las pruebas de horario deben confirmar las reglas vigentes.
- La identidad de arrastre utiliza reserva y `key_produccion`, conservando
  `id_programacion_origen` y la información original.
- No aplicar la migración mientras falte comprobar el historial visual del
  turno de origen, los conteos por orden, y un caso funcional de varios turnos.

## Validaciones pendientes para liberar

1. En una reserva mixta, las procesadas permanecen donde terminaron y solo
   continúan las pendientes.
2. Recargar T1 y T2: la referencia histórica no suma ventanas al turno original.
3. Una procesada en T2 no debe reaparecer en T1 ni trasladarse a T1 siguiente.
4. Misma producción con distintos sistemas no debe mezclar identidades.
5. Estados por orden, roles autorizados/no autorizados, límites de horario y
   reversión deben probarse sobre un entorno aislado.

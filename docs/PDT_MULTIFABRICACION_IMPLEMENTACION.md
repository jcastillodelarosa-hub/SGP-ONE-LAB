# PDT aluminio — Contrato funcional y plan de implementación (BORRADOR)
Fecha: 2026-10-24. Proyecto SGP_ONE; no afecta SGP_ONE_GOOGLE.
Estado: PREPARADO EN RAMA, NO APLICADO EN SUPABASE, NO PUBLICADO.

## Aprobaciones expresas del usuario
1. Validador puede corregir cantidad original y asignarla a múltiples fabricaciones; conservar reporte inicial y motivo/historial.
2. Líder registra avances parciales por fabricación y cantidad; saldo por fabricación.
3. Mecanizado completo no cierra PDT: cierre tras confirmación de entrega en Picking.
4. REPO OK se deriva de NC finalizada y significa *posible solución*, no disponibilidad física ni entrega.
5. NC múltiples: mostrar 2/3 finalizadas y seguimiento parcial.
6. Alertas en Producción y Pendientes con responsable y tiempo transcurrido.
7. Patinador debe poder enlazar múltiples NC al reportar; Recepción debe corregir fabricación y cantidades al validar entrega.
8. AUTORIZACIÓN: solo rama, PR y pruebas no destructivas; NO modificar Supabase, NO merge main, NO desplegar.

## Evidencia de auditoría (lectura)
- app.js llama sgp_aluminio_pendiente_editar_v2, sgp_aluminio_pendiente_validar y sgp_aluminio_pendiente_estado; las dos primeras admiten solo una fabricación y ninguna cantidad desglosada.
- sgp_aluminio_pendiente_estado acepta manualmente REPO_OK; debe conservar compatibilidad histórica, pero retirarse de selector tras disponer de derivación fiable.
- sgp_aluminio_pendientes.nc es texto CSV; sgp_aluminio_pendientes_listar compara el valor completo con un único consecutivo. Esto no resuelve varias NC.
- Caso real reserva 8558585, PDT 9 piezas, fabricación E17-1; tres NC 1006163, 1006164 y 1006165 están en estado Consultada al momento de la lectura. NO modificar el caso real como prueba.
- sgp_aluminio_pendientes_historial ya permite datos_anteriores/datos_nuevos jsonb: aprovecharlo para correcciones auditadas.

## Modelo previsto
- Cabecera sgp_aluminio_pendientes conserva id_pendiente, reporte original y referencias de producción/reserva.
- sgp_aluminio_pendiente_detalles: un renglón por pieza/fabricación/longitud/acabado, cantidad validada.
- sgp_aluminio_pendiente_movimientos: AVANCE y REVERSO, cantidad positiva, usuario, turno, fecha operativa, observación e idempotency_key.
- sgp_aluminio_pendiente_ncs: una fila por NC vinculada; preservar texto histórico durante transición.
- Saldo detalle = cantidad_validada - avances efectivos (avances menos reversos); saldo cabecera = suma de saldos detalle.
- No derivar fabricación desde reserva compartida ni confundir varias reservas de una producción con reserva compartida.
- Picking PANEL y separación de órdenes por sistema permanecen intactos.

## RPC propuestas (NO implementadas ni aplicadas)
- sgp_aluminio_pendiente_validar_detalles_v1(token, id, detalles jsonb, observacion): bloquear PDT; validar sesión/rol; cantidad corregida > 0, suma exacta, detalle contra piezas PANEL y relación reserva/acabado; guardar cabecera y detalle en una transacción; historial original/corregido; rechazar si ya hubo avances.
- sgp_aluminio_pendiente_registrar_avance_v1(token, id, id_detalle, cantidad, turno, fecha_operativa, idempotency_key, observacion): validar rol, PDT VALIDADO, cantidad <= saldo, bloqueo y atomicidad; respuesta saldo antes/después.
- sgp_aluminio_pendiente_revertir_avance_v1(token, id_movimiento, idempotency_key, motivo): permiso reforzado, reversión única, sin borrar eventos.
- sgp_aluminio_pendiente_nc_vincular_v1(token, id, ncs text[]): normalizar y validar NC múltiples, impedir duplicados, historial.
- sgp_aluminio_pendientes_listar_v2(token, solo_abiertos): devolver detalles/saldos, todas las NC y resumen finalizadas/total, timestamp de alerta y días transcurridos.
- Cierre de PDT debe requerir evidencia de entrega Picking; verificar RPC real antes de implementar.
- Mantener RPC existentes operativas durante transición; prohibido reemplazarlas hasta demostrar equivalencia.

## Semántica de REPO OK
- Aviso NO etapa editable: 0/3, 2/3, 3/3 NC finalizadas.
- Cuando todas finalizadas, resaltar REPO OK como *posible solución*; con 2/3 mostrar parcial.
- No asumir que NC finalizada prueba material disponible ni que autoriza cierre.
- Las NC se relacionan por consecutivo individual, no por comparar CSV completo.
- Seguimiento desde fecha de última transición relevante de NC a Finalizada, por NC; distinguir primera solución parcial y solución total.

## Flujo UI
1. Patinador reporta cantidad inicial y añade chips NC con validación individual; permitir reportar sin NC según regla existente.
2. Recepción/validador revisa filas de piezas con campo cantidad por fabricación, modifica total, deja motivo y confirma; no limitar a radio.
3. Líder ve total/solucionado/saldo y reporta avance de una o varias fabricaciones; siguiente turno ve autor, fecha, turno y movimientos.
4. Producción y Pendientes muestran resumen NC y aviso REPO OK derivado, con edad y filtros.
5. Picking confirma entrega y cierra PDT, sin confundir procesado con entregado.

## Seguridad y dependencias por verificar antes de activar
- RPC SECURITY DEFINER con search_path fijado, sgp_validar_sesion_rol y permisos EXECUTE mínimos.
- No habilitar grants de tabla directos para anon/authenticated.
- Transacciones con bloqueo FOR UPDATE; concurrencia y reintentos idempotentes.
- Integridad id_detalle/id_pendiente en movimientos debe verificarse en RPC, además de FK.
- Decidir mecanismo de migración histórica y conciliación de pendientes validados; nunca inventar desglose.
- Validar estados reales NC, funciones de importación, Picking/entrega y control de turnos.
- Revisar manejo de reservas múltiples, compartidas y piezas PANEL; no introducir service_role en navegador.

## Pruebas de aceptación requeridas
- 9 -> 5 E17 + 4 E17-1; saldo inicial 9.
- Corrección de cantidad 9 -> 8 con motivo e historial.
- Avance 2 E17 por Brajhan T1 -> saldo E17=3, E17-1=4, total 7; T2 visualiza evento.
- Reintento de la misma operación no duplica movimiento.
- Rechazar avance > saldo, negativos, fabricación ajena, roles no autorizados y avance sin validación.
- Reverso autorizado restaura saldo una sola vez.
- 2/3 NC Finalizada muestra parcial; 3/3 muestra REPO OK, sin cerrar PDT.
- NC CSV históricas migran a vínculos sin perder ninguna; NC desconocidas quedan marcadas.
- Al saldo cero, PROCESADO no cierra hasta confirmación Picking.
- Modal PC/móvil con scroll y botones accesibles; pruebas de regresión de Producción/Picking/NC.
- Diferenciar pruebas de SQL estáticas de pruebas de integración en base: estas últimas no autorizadas todavía.

## Hitos
A. Contratos SQL y pruebas unitarias de cálculo de saldo y estados NC.
B. RPC en migración versionada (no aplicada) y pruebas de contrato.
C. Frontend con adaptación gradual y fallback seguro mientras backend no esté disponible.
D. Revisión del PR y autorización separada para aplicar migración.
E. Pruebas de integración controladas, autorización separada para merge y publicación.

## Pendientes de implementación
Este commit prepara únicamente el esquema aditivo y este contrato. **No equivale a tener las RPC ni la UI listas.** No ejecutar migración borrador: faltan revisión de permisos y estrategia de transición.

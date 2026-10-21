# Picking — contrato de reporte histórico v1 (PROPUESTO)

Proyecto: SGP_ONE / SGP-ONE-LAB. Rama de preparación, sin cambios de Supabase ni despliegue.

## Fuentes verificadas (solo lectura)
- public.sgp_picking_entregas: id_entrega, id_programacion, produccion, completa, estado, observacion, usuario_entrega, fecha_entrega (timestamp), fecha_operativa (date), turno_entrega, usuario_validacion, fecha_validacion.
- public.sgp_mecanizado_programacion: id_programacion, reserva, prioridad_semanal (parte), sistema, acabado, cantidad_programada. **La cantidad_programada NO es cantidad entregada por evento.**
- public.sgp_picking_faltantes: id_entrega, id_pieza, perfil, marca, fabricacion, longitud, cantidad, observacion, nc, reserva_pendiente, acabado_pendiente, ventanas_afectadas.
- public.sgp_picking_auditoria_diferencias: diferencias de auditoría asociadas a entrega.
- public.sgp_aluminio_pendientes: situación actual de pendientes, no sustituye faltantes históricos.
- public.sgp_producciones: producción y cantidad por sistema/linea; validar asociación por key_produccion, reserva y sistema, evitando JOIN multiplicativo.

Auditoría del 21-10-2026: 163 eventos, 144 pares (id_programacion, produccion), 152 completos, 11 parciales, 24 filas de faltantes; fecha_operativa/turno_entrega presentes en todos. 156/163 programaciones no tienen nombre de producción: **usar e.produccion**, no p.produccion. 8 eventos con fecha UTC distinta de fecha_operativa. Una entrega tiene fecha_validacion.

## RPC propuesta, NO aplicada
Nombre: public.sgp_picking_reporte_entregas_v1(p_token text,p_fecha_inicio date,p_fecha_fin date,p_turno text DEFAULT NULL,p_sistema text DEFAULT NULL,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0) RETURNS jsonb.

Seguridad: SECURITY DEFINER SET search_path='public'; invocar public.sgp_validar_sesion_rol con roles aprobados por negocio (como mínimo ADMINISTRADOR, COORDINADOR, PICKING, SUPERVISOR DE PICKING; revisar necesidad LIDER LINEA). Prohibir acceso a roles sin permiso de reporte. Límites 1..500 y rango máximo de 31 días, validación estricta de fechas y turno, sin interpolación SQL. No exponer token ni service_role. Permisos EXECUTE a definir y probar antes de aplicar.

Respuesta: {ok:true,filters:{fecha_inicio,fecha_fin,turno,sistema},summary:{movimientos,producciones_unicas,completas,parciales,faltantes_registrados,filas_faltantes},por_sistema:[{sistema,movimientos,producciones_unicas,completas,parciales,faltantes_registrados}],total_rows,limit,offset,rows:[{id_entrega,id_programacion,reserva,parte,produccion,sistema,acabado,fecha_operativa,turno_entrega,fecha_entrega,usuario_entrega,completa,estado,fecha_validacion,usuario_validacion,faltantes:[{id_faltante,perfil,marca,fabricacion,longitud,cantidad,nc,reserva_pendiente,acabado_pendiente,ventanas_afectadas}]}]}.

Criterios: filtrar siempre fecha_operativa; conservar eventos duplicados y distinguir resumen DISTINCT (id_programacion, produccion, sistema). El detalle de pendientes históricos viene de sgp_picking_faltantes, no del estado actual; mostrar estado actual solo con vínculo validado. No inferir ventanas efectivamente entregadas desde cantidad_programada ni sumar ventanas_afectadas como unidades entregadas. Filtrar piezas PANEL mediante fuente y regla ya aprobadas si se amplía detalle por piezas; faltantes de perfil no son inventario completo.

## Interfaz prevista (no habilitar sin RPC)
Tercera pestaña Picking «Reporte de entregas»; filtro de fecha, turno y sistema; tarjetas de eventos, producciones distintas, completos, parciales y faltantes; resumen por sistema, detalle de eventos y faltantes históricos. Excel .xlsx con hojas Resumen, Entregas, Faltantes y Auditoría; PDF con filtros, fecha/hora de generación y paginación. Exportar exactamente datos de la consulta, no solo página visible, con límite explícito y aviso de parcialidad si no se han descargado todas las páginas. Nunca usar números simulados en operación.

## Aceptación
1. Un mismo evento aparece una vez por id_entrega, con sus faltantes sin multiplicar cabeceras.
2. Una producción con tres entregas produce tres movimientos y una producción única para el mismo sistema/programación.
3. Filtrado nocturno usa fecha_operativa, no fecha UTC ni turno de programación.
4. Producciones con mismo nombre pero distinto sistema permanecen separadas.
5. Reserva compartida vs multirreserva no se colapsan.
6. Validación de roles permitidos, prohibidos, sesión expirada y rango/limit inválidos.
7. Los totales PDF/Excel coinciden con resumen y detalle, aun con paginación.
8. No se modifica sgp_picking_entrega_orden, sgp_picking_validar_recepcion, RLS, tablas ni datos.

## Orden de ejecución pendiente de autorización
A. Validar join por sistema/producción y claves de producción; confirmar permisos de roles.
B. Preparar migración versionada (no aplicar); revisión SQL y pruebas negativas.
C. Solicitar autorización **independiente** para aplicar RPC en Supabase.
D. Integrar interfaz y exportadores en rama, ejecutar CI; solicitar autorización de merge/deploy por separado.

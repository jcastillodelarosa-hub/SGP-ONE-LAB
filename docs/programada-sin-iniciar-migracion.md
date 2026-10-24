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


## Auditoría de escritura y validación previa a publicación (2026-10-24)
- RPC `sgp_mecanizado_guardar_estado_orden` actual: valida roles, pero admite cualquier `p_estado`; su reemplazo debe validar explícitamente los estados operativos antes de actualizar y registrar historial.
- RPC `sgp_mecanizado_programar` con prioridad semanal: inserta programación sin la futura bandera; adaptar su inserción para `programada = true` y preservar la comprobación de composición canónica, la identidad `key_produccion` y las cantidades.
- Conservar la sobrecarga de `sgp_mecanizado_programar` sin prioridad semanal y revisar todos los llamadores antes de migrar.
- Los filtros de cobertura actuales consultan `estado_orden = 'PROGRAMADA'` como indicador de cobertura, **no como estado operativo**. No reemplazarlos indiscriminadamente por `SIN INICIAR`.
- La tabla `sgp_mecanizado_programacion` también tiene `estado = 'CANCELADA'`; no perder el marcador de cancelación al normalizar estados.
- El script SQL STAGED existente **no es ejecutable como release integral**: falta adaptación y pruebas de RPC, compatibilidad con cancelaciones, rollback y reconciliación. No aplicar ni desplegar hasta superar los gates.
- Frontend: guarda de escritura operativa agregada en `app.js` en rama. Aún falta revisar el guardado masivo de estados, reportes, arrastre y valores predeterminados.

## Gate de aceptación
1. Probar migración en transacción de ensayo o entorno aislado, con backup, y comparar conteos por estado/identidad antes y después.
2. Confirmar que 64 PROGRAMADA de programación, 3 CANCELADA y los estados de ejecución existentes se conservan según reglas aprobadas (conteos de referencia sujetos a cambios en tiempo real).
3. Probar autorización válida e inválida de RPC, sin cambiar roles ni RLS.
4. Probar programación parcial y compartida, arrastre y Picking PANEL.
5. Ejecutar suite de CI, revisión de sintaxis y prueba manual de PC/móvil.
6. Solo después fusionar, aplicar migración coordinada y publicar con verificación real.

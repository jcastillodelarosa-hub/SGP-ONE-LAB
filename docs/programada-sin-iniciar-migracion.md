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


## Resultado de revisión integral posterior (2026-10-24)

**Aclaración temporal:** los párrafos iniciales describen hallazgos antes de las correcciones sucesivas. El SQL `STAGED` actual ya contempla los CHECK de ejecución general y por orden, estados predeterminados `SIN INICIAR`, triggers de `programada`, reemplazo de RPC de escritura y respaldo de arrastre/Picking con comprobaciones de contrato. Continúa **sin ejecución real** sobre una base de ensayo.

**CI validada:** GitHub Actions 40103946305 (195/195 pruebas, diez de v348), 40103946303 (sintaxis JS). El paquete de release pasa su verificación automática; las pruebas son estáticas/de código, **no validan integración con PostgreSQL vivo**.

**Preflight vivo de Supabase (solo lectura):** 64 `PROGRAMADA` y 3 `CANCELADA` en programación; 2 `PROGRAMADA`, 2 `CORTE`, 128 `PROCESADO`, 5 `REPROGRAMADO` en ejecución por orden; 6 `CORTE`, 2 `MECANIZADO`, 41 `PROCESADO` en ejecución general. La segunda tabla tiene CHECK que rechaza `SIN INICIAR` hoy, subsanado en el SQL preparado, no en la base real.

**Gate NO superado:** ensayo SQL en rama Supabase (requiere consentimiento explícito del coste que indique Supabase) o entorno de pruebas equivalente; pruebas de roles, cancelación/reprogramación/arrastre/Picking con datos de ensayo; plan de reversión; después migración coordinada y despliegue/aceptación PC y móvil. No interpretar 195/195 como publicación ni aceptación funcional.

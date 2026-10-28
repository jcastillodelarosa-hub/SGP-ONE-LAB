# PDT manual unificado — Issue #140, Fase 1

Estado: **implementado en rama; SQL REVIEW no aplicado ni publicado**. Base `main` `55a309729bb3166cce98e24eb7e840169f4b7890`. No se archivan los 101 PDT históricos. PR #139 se mantiene independiente; ninguna de sus migraciones se incluye aquí.

## Contratos y relaciones

`sgp_pdt_manual.reportes` es una cabecera transaccional por operación, con clave de idempotencia y campos indexados `anio`, `semana`, `linea`, `key_produccion`, `produccion`, `reserva`, `sistema`, `acabado`, `origen`, `usuario`, `fecha`. El año y la semana provienen de la vista de programación de reservas; no se aceptan como autoridad desde el navegador. Si la vista real no ofrece año explícito ni fecha programada, el catálogo omite esas filas y el alta falla cerrada. Confirmar el campo exacto en el preflight de instalación.

`sgp_pdt_manual.detalles` contiene una fila por combinación de referencia PANEL, fabricación, marca, longitud y acabado. Cada fila tiene FK a `sgp_aluminio_pendientes`, creado como V2 `POR_VALIDAR` con cantidad original, NC opcional y observación. `sgp_pdt_manual.fuentes` registra todas las identidades `id_pieza` elegibles y su snapshot; no asigna cantidad a una fuente individual. La cantidad consolidada está solo en el detalle y el PDT. Las funciones públicas usan sesión y rol real, contexto de producción/reserva resuelto en servidor, el maestro PANEL y la relación de reserva compartida existente. El alta manual se limita a ADMINISTRADOR/COORDINADOR y, para ENSAMBLE/EMPAQUE, LIDER LINEA; el diálogo Picking existente conserva PATINADOR y su contrato V4. No se alteran RPC V4, Picking, NC ni RLS. Una NC escrita debe existir y enlazarse sin cambiar su estado; la RPC de consulta exacta muestra número, estado y reserva de solución si existe.

Índices: PK y clave de idempotencia únicos en reportes; índices de consultas por semana/producción; UNIQUE de combinación en detalles; PK `(id_detalle,id_pieza)` en fuentes. No se crean índices sobre tablas históricas.

## Alcance y limitación de Fase 1

El botón `+ Nuevo PDT` se agrega al listado actual. Permite filtrar por año/semana, sistema, acabado y producción/reserva; elegir referencias PANEL, filas de fabricación/marca/longitud, cantidad, NC opcional y observaciones por detalle y generales. El diálogo de Picking conserva su guardado existente y cambia solo la selección visual a tabla; su RPC y cantidades no cambian.

La comparación original/validado y la adaptación de avances y cierre de registros manuales agrupados corresponden a Fases 2 y 3. **No se afirma que un PDT manual agrupado pueda validarse o cerrarse con los contratos actuales.** Antes de instalar SQL productivo debe acordarse la visibilidad operativa de estos registros `POR_VALIDAR` y cerrar esa integración o bloquear su exposición a un flujo de validación incompatible. El formulario muestra error si las RPC nuevas no están instaladas; nunca escribe por una ruta LEGACY de respaldo.

## Evidencia y preflight

Node: pruebas de agrupación, reservas, referencias, cantidades, NC y no-fallback. PostgreSQL 17.11 aislado, fixture sintética y transacción revertida: instalación de 01, cabecera, dos detalles, dos fuentes de una combinación, 7 unidades sin multiplicación, reintento, rol denegado, FRAME rechazado, enlace y lectura NC. Visual local PC 1440×900 y móvil 390×844 con RPC sintéticas; capturas en `tests/pdt-manual/`. Esto no prueba Supabase productivo.

Antes de aplicar: backup restaurado, confirmar columnas de año/semana en `sgp_produccion_reservas_v`, firmas de `sgp_pdt_contexto_internal_v3` y `sgp_pdt_origenes_internal_v3`, triggers de identidad y contrato, grants de sesión real, FKs/columnas de historial y NC, pruebas de instalación y rollback en restauración compatible. Si algo difiere, detener la instalación. La migración está fuera de `supabase/migrations` y no se ejecuta automáticamente.

## Reversión

Si no se registraron reportes, ejecutar `ROLLBACK_REVIEW.sql` en una transacción: elimina solo funciones/tablas nuevas. Si existen reportes, el rollback aborta. Conservar los PDT, historiales y escrituras posteriores; conciliar sus FK y un plan de reversión puntual, nunca restaurar una copia completa encima de operaciones nuevas. No aplicar ni revertir en producción sin autorización separada.

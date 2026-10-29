# PDT manual unificado — Issue #140, Fases 1 y 2

Estado: **implementado en rama; SQL REVIEW no aplicado ni publicado**. Base `main` `55a309729bb3166cce98e24eb7e840169f4b7890`. No se archivan los 101 PDT históricos. PR #139 se mantiene independiente; ninguna de sus migraciones se incluye aquí.

## Contratos y relaciones

`sgp_pdt_manual.reportes` es una cabecera transaccional por operación, con clave de idempotencia y campos indexados `anio`, `semana`, `linea`, `key_produccion`, `produccion`, `reserva`, `sistema`, `acabado`, `origen`, `usuario`, `fecha`. El año y la semana provienen de la vista de programación de reservas; no se aceptan como autoridad desde el navegador. Si la vista real no ofrece año explícito ni fecha programada, el catálogo omite esas filas y el alta falla cerrada. Confirmar el campo exacto en el preflight de instalación.

`sgp_pdt_manual.detalles` contiene una fila por combinación de referencia PANEL, fabricación, marca, longitud y acabado. Cada fila tiene FK a `sgp_aluminio_pendientes`, creado como V2 `POR_VALIDAR` con cantidad original, NC opcional y observación. `sgp_pdt_manual.fuentes` registra todas las identidades `id_pieza` elegibles y su snapshot; no asigna cantidad a una fuente individual. La cantidad consolidada está solo en el detalle y el PDT. Las funciones públicas usan sesión y rol real, contexto de producción/reserva resuelto en servidor, el maestro PANEL y la relación de reserva compartida existente. El alta manual se limita a ADMINISTRADOR/COORDINADOR y, para ENSAMBLE/EMPAQUE, LIDER LINEA; el diálogo Picking existente conserva PATINADOR y su contrato V4. No se alteran RPC V4, Picking, NC ni RLS. Una NC escrita debe existir y enlazarse sin cambiar su estado; la RPC de consulta exacta muestra número, estado y reserva de solución si existe.

Índices: PK y clave de idempotencia únicos en reportes; índices de consultas por semana/producción; UNIQUE de combinación en detalles; PK `(id_detalle,id_pieza)` en fuentes. No se crean índices sobre tablas históricas.

## Alcance y limitación de Fase 1

El botón `+ Nuevo PDT` se agrega al listado actual. Permite filtrar por año/semana, sistema, acabado y producción/reserva; elegir referencias PANEL, filas de fabricación/marca/longitud, cantidad, NC opcional y observaciones por detalle y generales. El diálogo de Picking conserva su guardado existente y cambia solo la selección visual a tabla; su RPC y cantidades no cambian.

La Fase 2 añade `02_manual_validation_REVIEW.sql`: el reporte y las fuentes originales se vuelven inmutables, la consulta entrega solo fuentes PANEL verificadas de la misma producción/reserva/referencia/acabado y la validación registra una distribución consolidada. Se comparan fabricación, marca, longitud, acabado y cantidad con el original; cualquier corrección requiere observación. La cantidad original en `sgp_aluminio_pendientes` no cambia. La distribución crea detalles V2 con `id_pieza=''` y conserva todas las identidades de origen en `sgp_pdt_manual.fuentes_validadas`, sin atribuir arbitrariamente unidades a cada pieza. El historial guarda original, validado, usuario y motivo. `POR_VALIDAR` es aceptado solo en esta ruta manual. Los demás PDT se despachan al cuerpo original capturado con guard de huella.

**La Fase 3 sigue pendiente**: el detalle manual validado no se conecta a avances, Picking ni cierre. Esas acciones se ocultan en su controlador, aunque la protección definitiva deberá establecerse también en las RPC antes de publicar. La consulta de NC existente se conserva. Ningún LEGACY ni V2 preexistente se migra.

El guard de Fase 2 exige `md5(prosrc)=51bed910a19ee368c2584e2b7ececc17` para `sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)`, basado en la definición exportada del contrato instalado. Si PR #139 u otra migración cambia ese cuerpo, detener la instalación y reconciliar el despacho con la definición vigente; no modificar solo la huella. La prueba aislada usa un pin temporal del cuerpo sintético, nunca altera el SQL REVIEW.

**Año programado pendiente de certificar con fuente real.** La Fase 1 busca `anio_programacion`, `anio_reserva` o `fecha_programacion` en `sgp_produccion_reservas_v` y falla cerrada si faltan; esta sesión no dispone de consulta autenticada a Supabase para confirmar cuál es oficial. Consulta mínima de catálogo antes de instalar:

```sql
SELECT attname, format_type(atttypid,atttypmod) AS tipo
FROM pg_attribute
WHERE attrelid='public.sgp_produccion_reservas_v'::regclass
  AND attnum>0 AND NOT attisdropped
  AND attname IN ('anio_programacion','anio_reserva','fecha_programacion','semana_reserva','semana_produccion')
ORDER BY attname;
```

El catálogo no prueba semántica de negocio: confirmar con el propietario qué campo gobierna el año oficial si hay más de uno.

## Evidencia y preflight

Node: pruebas de agrupación, reservas, referencias, cantidades, NC y no-fallback. PostgreSQL 17.11 aislado, fixture sintética y transacción revertida: instalación de 01, cabecera, dos detalles, dos fuentes de una combinación, 7 unidades sin multiplicación, reintento, rol denegado, FRAME rechazado, enlace y lectura NC. Visual local PC 1440×900 y móvil 390×844 con RPC sintéticas; capturas en `tests/pdt-manual/`. Esto no prueba Supabase productivo.

Antes de aplicar: backup restaurado, confirmar columnas de año/semana en `sgp_produccion_reservas_v`, firmas de `sgp_pdt_contexto_internal_v3` y `sgp_pdt_origenes_internal_v3`, triggers de identidad y contrato, grants de sesión real, FKs/columnas de historial y NC, pruebas de instalación y rollback en restauración compatible. Si algo difiere, detener la instalación. La migración está fuera de `supabase/migrations` y no se ejecuta automáticamente.

## Reversión

Si no se registraron reportes, ejecutar `ROLLBACK_REVIEW.sql` en una transacción: elimina solo funciones/tablas nuevas. Si existen reportes, el rollback aborta. Conservar los PDT, historiales y escrituras posteriores; conciliar sus FK y un plan de reversión puntual, nunca restaurar una copia completa encima de operaciones nuevas. No aplicar ni revertir en producción sin autorización separada.

Para revertir solo la Fase 2, `02_ROLLBACK_REVIEW.sql` restaura la función pública original desde `funcion_previa` y elimina los objetos de Fase 2; aborta si ya existe una validación manual. Con validaciones existentes se requiere reparación hacia delante y conciliación, no eliminar su historial o sus detalles.

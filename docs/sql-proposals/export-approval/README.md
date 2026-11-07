# Export diario: revisión selectiva

Estado: implementación en rama y prueba aislada PGlite; NO aplicado en Supabase.
Base de definiciones: lectura del backend SGP-ONE-LAB el 07/11/2026.

## Contrato frontend

- `sgp_export_preparar(p_token text,p_linea text,p_nombre_archivo text,p_datos jsonb)`
  persiste propuestas, **no actualiza producción**. Devuelve `{ok,lote_id,filas,sin_cambios,pendientes,recibidos}`.
- Cada fila: `{id,lote_id,key_produccion,produccion,tipo_cambio:[],anterior,propuesto,estado,linea,archivo,fecha}`.
  Tipos `CANTIDAD`, `SEMANA`, `NUEVA`, `AUSENTE`, `REAPARECE`, `ARCHIVADA`. Filas ARCHIVADA quedan BLOQUEADA con motivo, no se seleccionan/aplican ni bloquean las otras órdenes. Requieren flujo separado de revisión del archivo, sin reactivar por inferencia. Una orden puede tener varios.
- `sgp_export_revisiones_listar(p_token,p_lote_id uuid DEFAULT NULL)`:
  con ID devuelve el lote anterior; sin ID `{ok,revisiones:[{lote_id,filas,sin_cambios,pendientes,nombre_archivo}]}`.
- `sgp_export_aprobar(p_token,p_lote_id uuid,p_filas uuid[])`: aplica filas seleccionadas y filas sin cambios estructurales pendientes. Devuelve `{ok,id_carga_diaria,actualizados,aprobados,pendientes}`. Repetir aprobación ya aplicada no escribe.
- `sgp_export_ausentes_listar(p_token)`: `{ok,filas:[{key_produccion,produccion,id_linea,anio,semana_actual,cantidad,reserva_al,fecha}]}`.

Roles de todos los RPC: ADMINISTRADOR/COORDINADOR, mediante sesión SGP existente.
No hay permisos directos sobre staging. RLS habilitada, sin políticas públicas.

## Reglas implementadas

- Comparación por clave producción/línea. Identidad, año, semana y cantidad válidos obligatorios.
- Ausencia solo si otra fila del archivo cubre **mismo año, semana vigente y línea**. Presencia en otra semana se clasifica SEMANA, no AUSENTE. Archivos segmentados no invalidan semanas no incluidas.
- Nueva propuesta supera pendientes anteriores solo para la misma clave efectivamente comparada. Se conserva historial SUPERADA. Una carga de otra semana no elimina pendientes fuera de su ámbito.
- Mientras una diferencia espera decisión, permanece intacta la fila operacional completa. No mezcla saldo nuevo con cantidad vieja.
- Ausencia aprobada activa `excluida_export`, no borra ni cancela orden/asignaciones/pendientes. Retiene cantidad e historia para revisión separada.
- Reaparición propone REAPARECE y requiere aprobación para quitar exclusión.
- Cantidad y semana vigente solo cambian al aprobar. Semana base se conserva como origen de carga.
- Snapshot completo y bloqueo por línea impiden aplicar propuestas obsoletas; si otra operación modificó orden desde preparar, exige preparar de nuevo esa revisión. Transacción completa revierte en error.
- Conserva contrato Export aplicado: cargas tipo EXPORT, historia presente, ultima_carga_diaria, saldos inicializados y eventos de apertura/ensamble completo/orden completada.
- Conserva triggers existentes: cantidad menor que partes ya asignadas puede rechazarse con `TOTAL_INFERIOR_A_ASIGNADO`. No se desactiva esa protección ni se alteran partes.
- Carga de nueva orden usa lista explícita de campos fuente y metadata controlada por servidor. No crea piezas/accesorios inexistentes.
- RPC antiguo de aplicación se cierra para evitar aprobación global por navegador viejo. Previsualización antigua solo lectura sigue disponible.

## Lectores y exclusión de métricas

`02_active_readers_REVIEW.sql` modifica únicamente filtros en cinco definiciones observadas, con comparación exacta antes de reemplazar:

1. `sgp_consultar_programacion_semana`: total de órdenes, unidades y filas excluyen ausentes aprobadas. Conserva semana_base histórica.
2. `sgp_consultar_ensamble`: filas activas de Seguimiento/Ensamble/Empaque excluyen ausentes.
3. `sgp_resumen_saldos_portada`: saldos activos excluyen ausentes.
4. `sgp_linea_plan_consultar`: vista activa calendario excluye asignaciones de órdenes ausentes, sin borrar programación ni ejecuciones persistidas.
5. `sgp_recepcion_listar`: cantidad y selección de reservas excluyen ausentes; no permite fallback aluminio reintroducir reservas solo de órdenes excluidas.

No es cambio global de todas las pantallas históricas: detalle de mecanizado, piezas, vidrio e informes de movimientos mantienen sus registros. Funciones nuevas de hoja Ensamble desarrolladas paralelamente deben filtrar `NOT p.excluida_export` antes de totalizar; confirmar integración antes de publicar. Seguimiento actual usa semana_actual; carga semanal sigue usando semana_base. No confundir origen de carga con programación vigente.

## Instalación coordinada

Instalar 01 y 02 juntos en una única transacción externa (remover BEGIN/COMMIT internos al componer), después de sincronizar los lectores nuevos de Ensamble. No dejar el campo aplicado sin los filtros. El script 02 falla antes de modificar un lector cuya definición haya cambiado, para reconciliar solo ese cambio concurrente. Los snapshots `readers-baseline.sql` son evidencia/fixture, NO ejecutar como restauración productiva.

No se requiere backfill ni aprobación retroactiva: los registros previamente marcados `presente_ultimo_export=false` no se excluyen automáticamente. Solo una aprobación nueva activa la exclusión.

La primera revisión del caso Peppertree debe mostrar 8→64; no aplicar directamente una corrección fuera de este flujo.

## Prueba proporcional

`test.mjs` crea base PostgreSQL aislada con schema de producción del repositorio y dependencias mínimas. Usa sesiones simuladas solo en esa base; no autentica ni escribe en SGP real.

```sh
# Con @electric-sql/pglite disponible en resolución de Node:
node docs/sql-proposals/export-approval/test.mjs
# O indicando el módulo ya instalado en el workspace:
SGP_PGLITE_MODULE=/ruta/node_modules/@electric-sql/pglite/dist/index.js node docs/sql-proposals/export-approval/test.mjs
```

Cubre nueva orden, cantidad pendiente/aprobada, ausencia por alcance, aprobación selectiva, replay, reaparición, cargas parciales, traslado de semana sin falsa ausencia, rechazo atómico de snapshot antiguo, roles/acceso directo denegado, RPC viejo bloqueado y compilación de cinco parches exactos. `test-result.txt` registra salida. No acredita publicación ni recorrido visual productivo.

## Integración Ensamble v405

`03_lp_hoja_REVIEW.sql` se añade a la misma transacción de instalación de 01 y 02.
Está fijado al cuerpo instalado `sgp_lp_operacion_consultar` MD5
`2e4eeacbfc331f2c6dcde32ee96701d7`, leído el 07/11/2026. Proyecta
`oficial.excluida_export` y excluye aprobadas **simultáneamente** de `orders`
y `catalog.productions`, conservando integridad y permisos. No modifica `history`,
`reports`, asignaciones, helpers de horario, cierre ni apertura. Compatible con
el frontend v405 67eceee. `lp-hoja-baseline.sql` es solo fixture, NO restauración.
Prueba local: `SGP_PGLITE_MODULE=/ruta/.../index.js node docs/sql-proposals/export-approval/test-lp-hoja.mjs`.

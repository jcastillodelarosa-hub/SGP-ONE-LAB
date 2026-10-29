# PDT manual unificado — Issue #140, Fases 1–4

Estado: **implementado en rama; SQL REVIEW no aplicado ni publicado**. Base `main` `55a309729bb3166cce98e24eb7e840169f4b7890`. No se archivan los 101 PDT históricos. PR #139 se mantiene independiente; ninguna de sus migraciones se incluye aquí.

## Contratos y relaciones

`sgp_pdt_manual.reportes` es una cabecera transaccional por operación, con clave de idempotencia y campos indexados `anio`, `semana`, `linea`, `key_produccion`, `produccion`, `reserva`, `sistema`, `acabado`, `origen`, `usuario`, `fecha`. Año y semana del reporte son **originales e inmutables**. La relación de reserva procede de `sgp_produccion_reservas_v`; el período vigente procede de la misma fila `sgp_producciones` (`anio`, `COALESCE(semana_actual,semana_base)`). La vista no expone año. El navegador no es autoridad para el período.

`sgp_pdt_manual.detalles` contiene una fila por combinación de referencia PANEL, fabricación, marca, longitud y acabado. Cada fila tiene FK a `sgp_aluminio_pendientes`, creado como V2 `POR_VALIDAR` con cantidad original, NC opcional y observación. `sgp_pdt_manual.fuentes` registra todas las identidades `id_pieza` elegibles y su snapshot; no asigna cantidad a una fuente individual. La cantidad consolidada está solo en el detalle y el PDT. Las funciones públicas usan sesión y rol real, contexto de producción/reserva resuelto en servidor, el maestro PANEL y la relación de reserva compartida existente. El alta manual se limita a ADMINISTRADOR/COORDINADOR y, para ENSAMBLE/EMPAQUE, LIDER LINEA; el diálogo Picking existente conserva PATINADOR y su contrato V4. No se alteran RPC V4, Picking, NC ni RLS. Una NC escrita debe existir y enlazarse sin cambiar su estado; la RPC de consulta exacta muestra número, estado y reserva de solución si existe.

Índices: PK y clave de idempotencia únicos en reportes; índices de consultas por semana/producción; UNIQUE de combinación en detalles; PK `(id_detalle,id_pieza)` en fuentes. No se crean índices sobre tablas históricas.

## Alcance y limitación de Fase 1

El botón `+ Nuevo PDT` se agrega al listado actual. Permite filtrar por año/semana, sistema, acabado y producción/reserva; elegir referencias PANEL, filas de fabricación/marca/longitud, cantidad, NC opcional y observaciones por detalle y generales. El diálogo de Picking conserva su guardado existente y cambia solo la selección visual a tabla; su RPC y cantidades no cambian.

La Fase 2 añade `02_manual_validation_REVIEW.sql`: el reporte y las fuentes originales se vuelven inmutables, la consulta entrega solo fuentes PANEL verificadas de la misma producción/reserva/referencia/acabado y la validación registra una distribución consolidada. Se comparan fabricación, marca, longitud, acabado y cantidad con el original; cualquier corrección requiere observación. La cantidad original en `sgp_aluminio_pendientes` no cambia. La distribución crea detalles V2 con `id_pieza=''` y conserva todas las identidades de origen en `sgp_pdt_manual.fuentes_validadas`, sin atribuir arbitrariamente unidades a cada pieza. El historial guarda original, validado, usuario y motivo. `POR_VALIDAR` es aceptado solo en esta ruta manual. Los demás PDT se despachan al cuerpo original capturado con guard de huella.

La Fase 3 está preparada en `03_manual_operations_REVIEW.sql`. El listado manual abierto lee la cabecera indexada sin reconstruirla desde piezas y se une al listado V2 existente de Producción → Mecanizado → PDT abiertos. No hay tablero nuevo. La ventana V2 existente muestra reserva, semana, referencia PANEL, original, NC, observación y saldos. Los indicadores **Validado** y **Repo OK** del listado conservan su lógica. El controlador utiliza las RPC existentes de avance, reverso y etapa con guard adicional para registros manuales; la cantidad neta y el saldo se calculan por `id_detalle` con el mecanismo actual. Se rechazan etapas y avances manuales antes de validar y avances fuera de CORTE/MECANIZADO.

La entrega manual se registra contra una entrega real `sgp_picking_entregas` y una programación de la misma producción, reserva (incluida reserva compartida), sistema y acabado. Una línea representa cantidad consolidada de un detalle, sin `id_pieza` físico ficticio. Requiere avance neto suficiente; solo se valida si la entrega de Picking está `VALIDADA`. `AUDITADA_DIFERENCIA` no acredita. Asignación y cierre se basan en cantidad validada, avance neto y líneas asignadas, con claves de idempotencia y bloqueo del PDT. Los escritores existentes de Picking y Programación reciben guardas limitadas a líneas manuales validadas para impedir cambios de identidad o estado que invaliden la acreditación. NC cerrada y saldo cero de Mecanizado no cierran automáticamente. LEGACY/V2 ajenos delegan a las funciones capturadas sin cambiar su contrato. `03_ROLLBACK_REVIEW.sql` revierte solo Fase 3 antes de cualquier entrega o cierre manual; después exige conciliación y corrección hacia delante.

**No se ha certificado el cuerpo productivo vigente de todas las funciones afectadas por Fase 3.** El SQL captura y delega los cuerpos presentes de `sgp_pdt_cierre_acreditado`, `sgp_pdt_comprometido`, `sgp_pdt_estado_v2`, `sgp_pdt_cerrar_v2` y `sgp_aluminio_pendiente_registrar_avance_v1`. Antes de instalar, comparar sus firmas, propietario, `search_path`, hashes y efectos con un respaldo restaurado actualizado y con PR #139; cualquier diferencia no comprendida bloquea instalación. Las pruebas sintéticas no equivalen a esta certificación productiva.

El guard de Fase 2 exige `md5(prosrc)=51bed910a19ee368c2584e2b7ececc17` para `sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)`, basado en la definición exportada del contrato instalado. Si PR #139 u otra migración cambia ese cuerpo, detener la instalación y reconciliar el despacho con la definición vigente; no modificar solo la huella. La prueba aislada usa un pin temporal del cuerpo sintético, nunca altera el SQL REVIEW.

**Fase 4 — programación vigente.** ChatGPT confirmó en Supabase que `sgp_producciones` contiene `anio`, `semana_base` y `semana_actual`; la vista de reservas expone `semana_produccion=COALESCE(semana_actual,semana_base)`, sin año. Por ello se corrigió `01_manual_phase1_REVIEW.sql` para leer año y semana desde la misma producción, y `03_manual_operations_REVIEW.sql` para devolver el período original y el vigente sin alterar cantidades ni historial. `04_programacion_vigente_REVIEW.sql` observa únicamente cambios de período en producciones con PDT manual, registra antes/después en una tabla privada y en el historial PDT, sin actualizar el reporte. Actualizaciones repetidas del mismo período no crean eventos. La reversión 04 retira el observador y **conserva** el historial; no vuelve a la fuente de año equivocada.

**Bloqueo exacto para reprogramaciones entre años:** no está versionado ni disponible en esta sesión el cuerpo productivo del escritor que actualiza `sgp_producciones.anio` junto a `semana_actual`. La prueba aislada 2026→2027 demuestra el contrato solo cuando ambos campos se actualizan correctamente; no certifica que el escritor productivo lo haga. Antes de instalar 01/03/04 o declarar Fase 4 lista para producción, verificar mediante lectura ese escritor y sus triggers. Consulta de metadatos/definiciones, sin datos operativos:

```sql
SELECT p.oid::regprocedure AS firma, md5(p.prosrc) AS huella,
       pg_get_functiondef(p.oid) AS definicion
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosrc ILIKE '%sgp_producciones%'
  AND (p.prosrc ILIKE '%semana_actual%' OR p.prosrc ILIKE '%anio%')
ORDER BY firma::text;
SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS definicion
FROM pg_trigger t
WHERE t.tgrelid='public.sgp_producciones'::regclass AND NOT t.tgisinternal
ORDER BY t.tgname;
```

El `md5(prosrc)` del validador instalado `sgp_aluminio_pendiente_validar_detalles_v1` fue confirmado como `51bed910a19ee368c2584e2b7ececc17`, igual al guard de Fase 2. **PR #139 sigue Draft** y propone sustituir ese despachador y el acreditador de cierre; si se instala antes, el guard 02 debe detener la instalación. Conciliar los cuerpos y la secuencia en un esquema restaurado; no aceptar una huella nueva sin comparar la función.

## Evidencia y preflight

Node: pruebas de agrupación, reservas, referencias, cantidades, NC y no-fallback. PostgreSQL 17.11 aislado, fixture sintética y transacción revertida: instalación de 01, cabecera, dos detalles, dos fuentes de una combinación, 7 unidades sin multiplicación, reintento, rol denegado, FRAME rechazado, enlace y lectura NC. Visual local PC 1440×900 y móvil 390×844 con RPC sintéticas; capturas en `tests/pdt-manual/`. Esto no prueba Supabase productivo.

Antes de aplicar: backup restaurado, confirmar el escritor del año al reprogramar, firmas de `sgp_pdt_contexto_internal_v3` y `sgp_pdt_origenes_internal_v3`, triggers de identidad y contrato, grants de sesión real, FKs/columnas de historial y NC, pruebas de instalación y rollback en restauración compatible. Si algo difiere, detener la instalación. Los SQL REVIEW están fuera de `supabase/migrations` y no se ejecutan automáticamente.

## Reversión

Si no se registraron reportes, ejecutar `ROLLBACK_REVIEW.sql` en una transacción: elimina solo funciones/tablas nuevas. Si existen reportes, el rollback aborta. Conservar los PDT, historiales y escrituras posteriores; conciliar sus FK y un plan de reversión puntual, nunca restaurar una copia completa encima de operaciones nuevas. No aplicar ni revertir en producción sin autorización separada.

Para revertir solo la Fase 2, `02_ROLLBACK_REVIEW.sql` restaura la función pública original desde `funcion_previa` y elimina los objetos de Fase 2; aborta si ya existe una validación manual. Con validaciones existentes se requiere reparación hacia delante y conciliación, no eliminar su historial o sus detalles.

Fase 3: `tests/pdt-manual/operations-isolated.sql` ejecuta alta, validación, etapas, avances parciales, saldos, permisos, entrega, diferencia auditada, validación, asignación, idempotencia, bloqueo de cambios en fuentes y cierre en PostgreSQL 17.11 aislado, con `ROLLBACK`. La instalación y reversión de 03 se probaron en esa base. `tests/pdt-manual/browser-phase3.py` recorre la ventana real con RPC sintéticas en 1366×900 y 390×844; capturas `phase3-1366.png` y `phase3-390.png`. Ninguna prueba registra datos productivos ni demuestra que Supabase ya tenga estas RPC.

Fase 4: `tests/pdt-manual/programming-isolated.sql` prueba 2026 semana 41→42→43 y 2026→2027 semana 1 con actualización explícita de `anio`, dos reservas compartidas, original inmutable, una auditoría por transición, NC/cantidad intactas y ausencia de eventos sobre LEGACY/V2. La instalación, reversión y reinstalación del observador 04 pasaron en la base PostgreSQL 17.11 aislada. No se ha demostrado todavía la semántica del escritor productivo entre años.

# Reporte histórico de Recepción Picking v1

**APLICADO EN SUPABASE con autorización del propietario el 2026-11-11; catálogo y rechazo sin sesión verificados. Prueba positiva con sesión de usuario pendiente.** Base main `53b4054`, rama `feat/picking-reception-reports-v441`. No modifica entregas, auditoría, pendientes, saldos, RLS ni permisos de tablas. No despliegue, commit ni push desde este trabajo.

## Fuentes confirmadas y límites

Consulta de catálogo y agregados de solo lectura por conector Supabase, proyecto SGP-ONE-LAB, 2026-11-11:

- No existe `public.sgp_picking_auditoria`. La fuente demostrada es `sgp_picking_audit.eventos`, con `fecha_recepcion`, `turno_recepcion`, `ejecutado_en`, `payload` y `respuesta`.
- `sgp_picking_audit.decisiones.nuevo.faltante` conserva datos al decidir. `ELIMINAR` se excluye; `ACEPTAR` y `MODIFICAR` usan snapshot posterior a decisión. Las diferencias nuevas provienen del payload confirmado del evento, no de pendientes actuales.
- En esta consulta había 1 evento ledger y 46 entregas con usuario/fecha de validación y estado VALIDADA/AUDITADA_DIFERENCIA sin ledger. Son cifras de cobertura global a esa fecha, no de un rango consultado. No prueban fecha operativa ni turno de recepción, por eso las 46 NO se incluyen como filas.
- Claves observadas de payload: decisiones, diferencias, observacion, turno, fecha, version. No hay cantidad explícita de ventanas **recibidas**. La cantidad entregada en otro ledger y la programada NO la sustituyen. V1 devuelve `null`, incluso si recepción está VALIDADA o no tiene pendientes.
- Los identificadores y nombres de producción, reserva, sistema, entregador y nombres completos se consultan en sus catálogos actuales, no hay snapshot histórico completo de estos metadatos. Cada fila advierte `IDENTIDAD_Y_NOMBRES_CATALOGO_ACTUAL`. `usuario_recepcion` sí está en el evento auditado.
- La función actual de entregas valida `sgp_validar_sesion_rol` con ADMINISTRADOR, COORDINADOR, PICKING y SUPERVISOR DE PICKING. ACL observada: postgres, service_role, anon, authenticated; sin PUBLIC. Se conserva exactamente esa lista, sin añadir RECEPCION/LIDER por conveniencia. No se cambia el helper de sesión ni su semántica vigente.

Referencias reproducibles del repositorio: `../picking-audit/01-review.sql`, `../picking-audit/02-review-contracts.sql`. `00-preflight-readonly.sql` permite revisar catálogo y cobertura de nuevo sin leer credenciales. No se realizó auditoría general de producción.

## Contrato exacto

`public.sgp_picking_reporte_recepciones_v1(p_token text,p_fecha_inicio date,p_fecha_fin date,p_turno text DEFAULT NULL,p_sistema text DEFAULT NULL,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0) RETURNS jsonb`.

- `ok:true`, `contract_version:1`.
- `filters`: fecha_inicio, fecha_fin, turno, sistema, base_fecha=`FECHA_OPERATIVA_RECEPCION`.
- `rows`: id_recepcion (id_entrega textual), id_entrega, id_programacion, key_produccion (nullable, disponible para partes), produccion, reserva, sistema, fecha_recepcion (operativa), turno_recepcion, registrado_en (timestamptz real), usuario_entrega, nombre_entrego, usuario_recepcion, nombre_recibio, completa_al_recibir, estado_al_recibir, pendientes_al_recibir, cantidad_ventanas_recibidas, fuente_ventanas, observacion, fuente_recepcion=`LEDGER_AUDITORIA`, warnings.
- `pendientes_al_recibir`: array de snapshots explícitos; `null` si falta integridad mínima del snapshot. Elementos: origen, id_faltante/id_pendiente cuando consta, id_pieza, perfil, fabricacion, marca, longitud, cantidad, reserva, acabado, ventanas_afectadas, observacion. No expone documentos enteros ni datos ajenos al reporte.
- `completa_al_recibir`: true si snapshot íntegro sin pendientes; false si tiene pendientes; null si no consta. Es completitud por pendientes al recibir, no `entrega.completa` ni cantidad física de ventanas.
- `estado_al_recibir`: resultado que dejó la escritura confirmada, AUDITADA_DIFERENCIA si registró diferencias, VALIDADA en caso contrario; null si payload no demuestra esa clasificación. No lee estado actual de entrega para este campo. VALIDADA puede conservar pendientes aceptados.
- `cantidad_ventanas_recibidas`/`fuente_ventanas`: null en esta versión. Nunca mostrar null como cero ni usar programadas, entregadas o ventanas afectadas como sustituto. No sumar ventanas_afectadas porque varias piezas pueden afectar la misma ventana.
- `summary`: recepciones, producciones_unicas, completas, con_pendientes, pendientes_no_constan, filas_pendientes, ventanas_recibidas (null), ventanas_no_constan.
- `por_sistema`: sistema, recepciones, producciones_unicas, completas, con_pendientes, ventanas_recibidas (null), ventanas_no_constan.
- `coverage`: recepciones_sin_fecha_operativa y alcance=`GLOBAL_NO_FILTRADO`. Es conteo informativo de legacy excluido, no un KPI del rango o sistema actual. UI debe etiquetarlo explícitamente así.
- `warnings`: LEGACY_SIN_FECHA_OPERATIVA_EXCLUIDO, VENTANAS_RECIBIDAS_NO_CONSTAN, IDENTIDAD_Y_NOMBRES_CATALOGO_ACTUAL. Por fila añade PENDIENTES_HISTORICOS_NO_CONSTAN cuando corresponde.
- `total_rows`, `limit`, `offset`. Resúmenes agregan todo el rango, no la página. Orden estable: fecha operativa, turno, registrado_en, id_recepcion.

Admisión de filas requiere evento ledger con respuesta ok e id_entrega coincidente. Filtros usan fecha/turno operativos del evento, nunca fecha de entrega ni fecha de validación. Límites: 31 días inclusivos, 1..500 filas, offset >= 0; solo TURNO 1/2 o null. El timestamp real permanece separado y sin convertirlo en fecha operativa. Distinct de producción usa key_produccion para partes o par id_programacion/produccion y sistema; no colapsa nombres iguales de sistemas distintos.

## Revisión y aplicación posterior

1. Revisar preflight en el proyecto correcto, helpers y fuentes vigentes. Instalación bloquea si cambia ACL/validación base de entregas o ya existe la nueva RPC. Revisión humana debe contrastar también semántica de auditoría y permisos antes de autorizar.
2. Obtener autorización separada para aplicar `install-review.sql`. Usa CREATE, no reemplaza funciones existentes; una transacción, search_path vacío, dueño postgres y ACL igual al reporte actual. No instala triggers ni muta datos operativos.
3. Verificar ejecución con sesiones válidas, expiradas y roles permitidos/prohibidos reales; resultados de consulta y acceso directo denegado a ledger. El test local usa stub de autorización, NO acredita sesiones reales.
4. Solo después coordinar activación/publicación frontend autorizada. Mientras no exista RPC, interfaz debe informar indisponibilidad, nunca consultar tablas públicas como fallback.
5. Reversión autorizada: `rollback-review.sql` elimina exclusivamente la nueva función si su cuerpo sigue siendo el revisado. No usar CASCADE ni revertir cambios ajenos.

## Pruebas

`tests/picking-reception-report/sql-synthetic.mjs` ejecuta SQL real en PGlite aislado con datos sintéticos. Requiere paquete `@electric-sql/pglite` disponible o `PGLITE_MODULE` apuntando a su módulo instalado. No usa red ni credenciales. `sql-results.json`: 31 comprobaciones PASS al preparar v441, incluidas fechas nocturnas, legado excluido, snapshots, diferencias, eliminados, nombres, nulls, paginación, filtros, límites, rol anon sin acceso directo y reversión. Helper de autorización es un stub que comprueba la lista exacta, no valida implementación real de sesiones. No hay prueba end-to-end productiva ni instalación productiva.


## Interfaz candidata v441

- `Reportes` sustituye el título `Reporte de entregas`, conservando Entrega de órdenes y Recepción / Auditoría.
- Subpestañas accesibles Entregas y Recepción. Entregas conserva sus exportaciones PDF/imagen; la búsqueda por orden/reserva actualiza detalle y resúmenes sobre todas las páginas leídas.
- Recepción usa semana ISO de **fecha operativa de recepción**, fechas libres hasta 31 días, turno, sistema, estado y búsqueda. Cambiar filtros del servidor borra resultados anteriores. Respuestas obsoletas, sesión cambiada, contrato incorrecto y duplicados no se presentan como datos válidos.
- Fecha operativa y registro real (hora Colombia) se muestran separadas. Responsable entregador/receptor y estado histórico no se infieren de saldo o programación.
- Pendientes en desplegable nativo y resumen fecha/turno. Órdenes deduplicadas por clave canónica/sistema. Ventanas sin fuente permanecen Sin dato. CSV exporta filas filtradas con ambos responsables y guardia contra fórmulas.
- No hay fallback a entregas cuando la RPC no existe: aviso de consulta no habilitada.

Pruebas frontend: 1000 Node PASS/10 omitidas, 17 DOM sintéticas PASS, sintaxis y release PASS. `tests/picking-reception-report/browser.py` preparado para PC1746/móvil390; no ejecutado. El entorno compartido ya documentó Chromium bloqueado por socket EPERM, por lo que no se repitió ni buscó evasión. Falta inspección visual y pruebas reales de exportación en navegador. No usar DOM como aceptación visual o productiva.

## Aplicación autorizada 2026-11-11

Se aplicó `picking_reception_report_v1` por `apply_migration` en SGP-ONE-LAB, resultado success:true. Preflight confirmó que la RPC no existía. MD5 del cuerpo instalado `e6627795b806b60cfda8cfd0b734c7e7` coincide con el archivo revisado. Owner postgres, SECURITY DEFINER, STABLE, search_path vacío; ACL postgres/anon/authenticated/service_role sin PUBLIC. Los hashes de sgp_validar_sesion_rol, reporte de entregas y escritura de auditoría permanecen intactos. anon/authenticated siguen sin USAGE del esquema privado ni SELECT de eventos. La RPC con token null rechaza PERMISO_DENEGADO.

No se leyeron credenciales, no se crearon sesiones de prueba, no se mutaron datos operativos. La prueba positiva debe hacerse mediante la sesión normal de un usuario autorizado; los 31 checks sintéticos no sustituyen esa comprobación. Evidencia sin secretos: `tests/picking-reception-report/supabase-install-evidence.json`. No se hizo commit/push/despliegue en este paso backend.

# Picking PDT: Entrega → Recepción (propuesta, no aplicada)

Base examinada: main 90e526c / LAB v473. SQL aislado, no migración publicada.

## Contrato y compatibilidad
- Reutiliza `sgp_pdt_picking_simple.entregas`; no fabrica entregas de órdenes.
- Para PDT sin entregas previas, `completo(uuid)` exige cantidades procesadas = entregadas = recibidas en cada detalle. El writer antiguo tampoco cierra por solo entregar.
- Recepción separada mediante ledger inmutable para clientes, cantidad delta positiva, actor y fecha del servidor. Cierre en misma transacción al recibir el total validado de todos los detalles. Una recepción parcial conserva el saldo; observación permite documentar diferencia sin crear otra NC automáticamente.
- El corte histórico se guarda como metadata de IDs existentes, sin actualizar órdenes/PDT/entregas históricas. El nuevo API impide mutarlos y muestra `HISTORICO_POR_CONCILIAR`; mantienen su ruta anterior. No se asume recibido ni se reabre un cierre.
- Contrato V2 únicamente; no convierte LEGACY ni agrega auditoría doble.

## API
`sgp_pdt_picking_cola_v1(p_token,p_modo='delivery',p_estado='open',p_semana=null,p_busqueda=null,p_cursor=null,p_limite=100)` → `ok,contract_version:1,rows,has_more,next_cursor,capabilities`. Máximo100, cursor UUID estable por detalle; estado open/closed/all explícito. Filtros globales servidor y orden visual solo de filas cargadas. Historial cerrado no se consulta en el polling.
`sgp_pdt_picking_avisos_v1(p_token,p_cursor=null,p_limite=50)` → notifications máximo50, unread_count total exacto, has_more,next_cursor,capabilities. Polling fuera de Picking usa solo este RPC ligero; no carga órdenes, filas ni historiales.
Fila por detalle: id, id_pendiente, contrato, semana, produccion, reserva, perfil, nc, fabricacion, longitud, acabado, id_pieza, procesado, entregado, recibido, disponible_entrega, saldo_recepcion, estado, can_deliver, can_receive, movimientos.
`sgp_pdt_picking_movimiento_v1(p_token,p_id_detalle,p_accion,p_cantidad,p_idempotency_key,p_observacion)` con ENTREGAR/RECIBIR. Respuesta `ok,duplicado,finalizado` y ID de entrega/recepción.
`sgp_pdt_picking_aviso_leer_v1(p_token,p_id)` marca lectura por usuario. Leer no mueve cantidades ni cierra.
`sgp_pdt_picking_simple_estado_v1` agrega `requiere_recepcion` para UI antigua.

## Seguridad y concurrencia
Autentica mediante helper existente de rol real; además exige acceso efectivo `picking` o subventana pertinente vía `sgp_mis_accesos`; administrador conserva excepción vigente. Entregar: Administrador/Coordinador/Picking/Supervisor Picking. Recibir: anteriores + Recepción/Líder Línea/Líder. No amplía Patinador a entregar PDT.
RLS activa, tablas/esquema privados sin grants cliente; API SECURITY DEFINER con search_path vacío y EXECUTE explícito. Nombres de `sgp_usuarios.nombre`, nunca login como sustituto visual.
Lock advisory UUID dominio431 compartido con writer previo, bloqueo padre y detalles; clave/payload/actor vinculados, saldo comprobado bajo lock. Triggers anteriores impiden mezclar ledgers legacy/manual tras nueva entrega y reversos por debajo de entregado. Funciones de cierre antiguas exigen cobertura del ledger antiguo y no pueden atribuirse las entregas nuevas.
Alertas usan ID único de movimiento AVANCE confirmado, no INICIAR ni REPO_OK. Se insertan dentro de misma transacción y no se duplican. Solo se muestran si sigue pendiente y hay saldo efectivamente entregable. No inventa eventos para procesados históricos anteriores a instalar: esos aparecen en tabla, no como aviso “nuevo”.

## Validación
- PGlite: instalación, entrega total sin cierre, recepción parcial, cierre completo, replay, rechazo sobrecantidad, roles, acceso de ventana, claves reutilizadas entre acciones/compatibilidad vieja, no mutar órdenes, lectura idempotente, ACL y rollback sin uso PASS.
- PostgreSQL17.11 local aislado loopback: las mismas aserciones + tres carreras reales (misma UUID, UUID distintas sobre mismo saldo, recepción vs reverso) PASS. Servidor detenido.
- Solo lectura Supabase: columnas usadas, definición de roles/sesión/accesos y hashes de completo/writer coinciden. No se ejecutó DDL/DML alojado.
- Ensayo adicional: instalación sobre copia restaurada completa y comprobación con sesión real, funciones reales de autenticación/accesos y rol técnico anon PASS; transacción de usuario sintético revertida y servidor detenido. La restauración previa omitió ACL/propietarios originales; se recuperaron después por lectura y reprodujeron selectivamente los de entrypoints/helpers y objetos dependientes en la copia. La comparación normalizada de grantor/grantee/privilegio/grant-option y propietario pasa para todas las funciones del alcance. Sesiones reales sintéticas bajo anon y authenticated comprueban denegación y lectura. Esto no certifica privilegios ajenos a ese alcance ni aceptación productiva. Pendiente ensayo UI integrado y autorización despliegue. Pruebas sintéticas no equivalen a aceptación en planta.

## Despliegue y recuperación
1. Confirmar snapshot reciente recuperable y ejecutar preflight; si hashes cambian, detener y reconciliar. Revisar columnas/ACL y cantidad de históricos.
2. Probar primero en copia aislada. Publicar frontend compatible y SQL en ventana de bajo movimiento coordinada. SQL transaccional, lock_timeout3s; si está ocupado aborta sin cambio, no insistir automáticamente.
3. SQL toma lock breve del ledger de entregas para corte histórico estable. No actualiza registros existentes. Releer estado y verificar roles/lectura sin crear movimientos productivos ficticios.
4. Validar en planta una entrega/recepción real autorizada, parcial y luego completa.
5. Antes de uso: rollback-unused restaura funciones exactas y retira objetos. Tras cualquier evento: rollback se niega; usar contain para revocar nuevas escrituras y writer simple compatible, preservar datos/guardas y reparar hacia delante. Nunca restaurar completo anterior tras recepciones: podría volver a cerrar por entrega sola.

Supabase docs/changelog consultados 2026-11-18; sin cambio de versión CLI/SDK. Propuesta almacenada en docs; crear migración con CLI solo tras autorizar promoción.

Comandos desde raíz de checkout:
- `PGLITE_MODULE=/ruta/node_modules/@electric-sql/pglite/dist/index.js node tests/picking-pdt-flow/run.mjs` (PGlite0.3.14 local).
- En cluster PostgreSQL17 aislado, vacío y loopback55443: `PSQL_BIN=/ruta/psql python tests/picking-pdt-flow/run-postgres.py` (no acepta URL productiva).
- `git diff --check`.

Preflight hashes comprobados: `sgp_pdt_picking_simple.completo(uuid)` = `4fc8306277b30a407d19a655d55770eb`; `sgp_pdt_picking_simple_v1(text,uuid,integer,uuid,text)` = `611b5077bff1f1248801569e29cca9b6`; `sgp_pdt_picking_simple.saldos(uuid)` = `b63f654811fad378e70bd09463e84896`; `sgp_pdt_validar_rol_real(text,text[])` = `30a705f967c3b726b5440e07753f32b1`.

Si se ejecutó contain antes de rollback-unused, se conservan intencionalmente los grants revocados del writer simple: restaurar función no reactiva acceso. Rehabilitación posterior requiere comparar/restaurar ACL exactas bajo autorización, nunca GRANT indiscriminado.

## Cierre del bypass de clientes anteriores
Once entrypoints públicos previos de entrega, recepción, asignación, anulación y cierre reciben guarda efectiva de subventana antes de tocar filas. Se conserva íntegro el cuerpo y sus checks originales de rol/cobertura. Hash por firma bloquea drift; copia exacta pg_get_functiondef, proacl y owner; CREATE OR REPLACE verifica que OID/ACL/owner no cambien. Cierre usa acceso de recepción; entregar/anular acceso entrega. No concede roles nuevos.
Pruebas: writer simple con rol válido sin ventana y solo recepción DENY sin mutación; entrega habilitada PASS; los otros diez entrypoints rechazan revocación antes de usar IDs. Rollback restaura y compara exactamente definiciones, ACL y propietario de todos los modificados. Si ACL cambió (incl containment), rollback rechaza y conserva contención; no reabre grants silenciosamente.
Fixture incluye fabricacion/longitud/acabado/id_pieza y aserciones de payload no nulo. Paginación sintética105 filas comprueba100+5 sin solapamiento, límite inválido rechazado, avisos50 con contador global exacto y cursor explícito.

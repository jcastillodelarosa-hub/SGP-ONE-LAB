# Auditoría por áreas — candidata, NO APLICADA

Paneles 2 requiere VERTICALES y ZOCALERO (top/bottom). Cada área confirma explícitamente SIN_FALTANTES o CON_FALTANTES, con usuario real de sesión, fecha operativa, turno y timestamp real. No se inventan revisiones para históricos. Las 134 regularizaciones administrativas del 16/11 quedan intactas.

## Contratos

- `sgp_picking_auditoria_areas_contexto(token,id_entrega)` conserva snapshot/fuentes del lector vigente, añade `linea`, `areas:[{id,nombre,revision}]`, `revisados_ids` y versión de snapshot+revisiones. Disponible también para detalle histórico; lectura no crea revisiones.
- `sgp_picking_auditoria_area_guardar` recibe los nueve argumentos legacy y `p_area,p_resultado`. Sólo se envían decisiones de faltantes que pertenecen al área; las otras se omiten. Cada faltante debe decidirse exactamente una vez entre ambas áreas. Guardar primera área crea PDT y aplica decisiones inmediatamente; no valida entrega. Al confirmar última área debe existir cobertura completa, y se genera UN único evento/orden de recepción con payload consolidado y desglose por área. Nunca se duplican ventanas/órdenes en reportes.
- Configuración privada por línea: lector `sgp_picking_auditoria_areas_configuracion(token)` y escritor `sgp_picking_auditoria_areas_configurar(token,linea,areas)` exclusivos ADMINISTRADOR. Array 1..8 `{id,nombre}`. Resto de líneas sin configuración usa GENERAL/Recepción, sin imponer doble. Al iniciar primera revisión se congela esquema para esa entrega; cambiar configuración aplica a siguientes auditorías.
- Los faltantes aceptados/modificados y diferencias implican CON_FALTANTES; SIN_FALTANTES permite decisiones ELIMINAR justificadas y sin diferencias. No confundir completa al entregar con completa al recibir.

## Seguridad e integridad

Mismos roles y helper real que auditoría vigente. Esquema/tabla privados con RLS sin grants al navegador. RPC SECURITY DEFINER con search_path vacío y EXECUTE explícito; sin PUBLIC. Writer interno copia validaciones vigentes de PDT, cantidades, vínculos, NC/dependencias y duplicados. Sin acceso directo nuevo a tablas. Una entrega bloqueada primero serializa revisiones y reintentos; identidad de solicitud ligada a payload/actor. Versión protege contra snapshot obsoleto. Cada decisión conserva su autor individual; evento consolidado usa último confirmador y adjunta ambas revisiones.

Trigger bloquea cierre anticipado desde otras rutas legacy. Writer legacy preserva reintento histórico antes de exigir áreas para nuevas Paneles. Otras líneas mantienen auditoría única. Línea se resuelve por prioridad/reserva/producción y parte explícita, nunca por un LIMIT 1; ambigüedad bloquea esa entrega.

## Instalación coordinada

1. Confirmar main/versión/CI del frontend; no aplicar con días/horas de antelación porque impide cierre antiguo de Paneles.
2. Respaldo restaurable vigente de tablas afectadas y definiciones; refrescar tras regularización administrativa, no usar snapshot anterior.
3. `install-review.sql` generado por `build.mjs`, una transacción, hashes exactos de writer/lector anteriores, sin reintentos inciertos.
4. Verificar catálogo, ACL y rechazo de token inválido. Publicar frontend autorizado y verificar semana 47. No prueba sintética constituye recepción real.
5. `rollback-unused.sql` sólo si no hay lotes/revisiones/cambios config, con huellas de funciones. Tras uso requiere corrección hacia adelante conservando todo el ledger. No CASCADE ni borrado de auditorías.

## Evidencia y límites

Preflight SELECT 16/11: 239 entregas pendientes resuelven línea PANELES_2 unívoca sin filtro activa; 13 tienen producción activa, resto históricas/inactivas. Cola operativa existente conserva su filtro vigente; no se reactiva historia.

Prueba `PGLITE_MODULE=... node tests/picking-audit-areas/sql-synthetic.mjs`: SQL real PGlite y writer vigente copiado; auth y adaptador PDT sintéticos. Incluye cierre doble, replay, actores, decisiones únicas, PDT inmediato, rollback transaccional, permiso, bloqueo legacy, configuración congelada y ambigüedad. NO valida sesiones reales ni PostgreSQL multisesión ni publicación. Revisión independiente de código y ejecución PGlite aprobada. CI PostgreSQL17 multisesión preparado, pendiente de ejecución; autenticación sigue sintética.

## NC opcional durante recepción

`sgp_picking_auditoria_nc_consultar(p_token,p_referencia)` usa los roles de auditoría y retorna `{ok:true,nc:{consecutivo,numero,estado,reserva_solucion,activo}}` o `nc:null` si no existe. Se añade lector propio porque el lector manual sólo permite administrador/coordinador/líder línea. No cambia roles ni RPC manual.

`p_diferencias[].nc` y `p_decisiones[].nc` son opcionales. Omitir/null/vacío conserva recepción sin NC. Cada referencia **nueva** no vacía se valida servidor por consecutivo o código exacto (máximo120 caracteres, sin control); inexistente/ambigua revierte toda esa revisión. No se cambia estado de NC ni se exige que esté abierta. Diferencias siguen delegado al registrador multiorigen instalado, incluida su lógica `ncs`.

En ACEPTAR o MODIFICAR, una NC nueva se agrega a `sgp_aluminio_pendiente_ncs` con autor/snapshot, sin borrar enlaces; texto primario sólo se llena si estaba vacío. Históricos sin referencia resoluble se preservan cuando no se solicita NC nueva. MODIFICAR conserva las protecciones anteriores: no corrige piezas/cantidades de un PDT con NC/dependencias previas; ACEPTAR permite agregar NC a PDT activo. ELIMINAR con NC nueva falla, nunca se ignora silenciosamente. La decisión guarda antes/después de todos los enlaces. Replay no duplica vínculo. No se modifica regularización histórica.

Pruebas NC añaden cuatro grupos: lector/roles/rechazos; anexar preservando históricos/replay; diferencias con NC y vacías; corrección segura + NC y rechazo de eliminación con NC. El enlace de diferencias se prueba con adaptador sintético; lectura de definición real confirma contrato multiorigen y PK `(id_pendiente,consecutivo)`. No SQL aplicado ni prueba de sesión real por este cambio.

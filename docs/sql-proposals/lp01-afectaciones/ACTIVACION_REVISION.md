# LAB v382 — revisión y plan de activación, 05/11/2026

Preparación posterior: [NC opcional en ambas etapas](NC_OPCIONAL.md), transición
compartida explícita06 pendiente de coordinación; no aplicada.

Actualización: [cadena vigente probada y alcance de pins](CADENA_PDT_VALIDADA.md).
La diferencia de wrapper/fuentes quedó resuelta en aislamiento; activación pendiente.

Actualización posterior autorizada: [contraste SQL productivo de solo lectura](CONTRASTE_PRODUCTIVO.md).
Sus hallazgos sustituyen las incógnitas de metadatos siguientes; el HOLD continúa por
diferencias reales del contrato PDT, no por ausencia de autorización para leer.

**HOLD para escrituras y publicación.** Candidato revisado:
`ee2f8de4fbf8773939b56f18c589d77907715f3f`. La revisión inicial del mismo agente fue complementada por el agente independiente
`review_reconciliation`; revisó el diff y las pruebas sin editar ni acceder a producción.
No constituye aprobación formal de PR. La corrección posterior está identificada por
las huellas del manifest y `revocation-result.json`.

## Evidencia actual, sin datos de órdenes

- GitHub remoto confirma main `5003c61277c80ea247d442a21cd1da03441b495b` (PR193).
- `Supabase list_projects`: SGP-ONE-LAB `ocvxbwzqxbrfndkvjmfx`, ACTIVE_HEALTHY,
  PostgreSQL `17.11.0.003`. Coincide con la versión mayor/menor de la prueba aislada.
- `list_tables`, metadatos únicamente: existen `public.sgp_aluminio_pendientes`,
  `public.sgp_picking_entregas`, `public.sgp_producciones`, `sgp_pdt_multiorigen`
  y `sgp_lp_operacion`. Están los campos de fabricación, longitud, origen,
  cantidad, contrato y key, y las FK detalles→pendiente/evento/entrega usadas por
  el adaptador. No aparecieron tablas `sgp_lp_afectaciones`.
- `list_migrations`: aparecen V4 multiorigen, multi-NC/deferred, LP183 roles/temporal
  y LP191 Seguimiento. Última entrada observada `20261104211455`,
  `lp191_seguimiento_global_enable_anon`. El registro NO prueba cuerpos/ACL vigentes.
- RLS habilitada en las tres tablas públicas y tablas LP observadas. Deshabilitada
  en `sgp_pdt_multiorigen.{funciones_previas,eventos,detalles}`. Esto requiere
  comprobar USAGE/ACL y esquemas expuestos; **no acredita por sí solo exposición
  pública**. No modificar RLS ni permisos automáticamente.

No se ejecutó SQL (incluido SELECT), no se usaron sesiones de usuarios, no se leyeron
filas productivas ni se hicieron probes de escritura. El mandato «no ejecutes SQL»
impide acreditar aquí hashes actuales, grants efectivos y casos Picking reales.
Los conteos de catálogo no se emplean como prueba de integridad ni de no duplicación.

## Revisión de seguridad y funcionalidad

| Hallazgo | Evidencia y efecto | Condición para levantar bloqueo |
|---|---|---|
| RESUELTO EN AISLAMIENTO: permiso de conciliación vencido tras esperas | `04_conciliacion_REVIEW.sql`, RPC conciliar: actor se consulta antes de locks; tras esperar se comprueban huellas, pero no sesión/permisos. La prueba reprodujo caducidad temporal durante espera, NO revocación directa: esta última ya se serializaba por locks de sesión nativos. Corregidas escritura, recibo y lectura legado. | PASS baseline/fixed con contratos reales y datos sintéticos; actor/rol/usuario/línea revalidados tras esperas. Queda verificar contratos instalados antes de activar. |
| Cobertura Picking exige todos los originales, incluso resueltos/heredados | `05`, `picking_cubierto`: no filtra estado ni evidencia física. Conservador: bloquea consolidado aunque algunos pendientes ya no sean aplicables. | Regla explícita y evidencia de disponibilidad por etapa; no filtrar estados para conceder crédito automáticamente. |
| Fuente única no equivale a alcance entre etapas | PK `(contrato,fuente_id)` evita volver a crear el mismo vínculo; si está asociado en Ensamble, no puede duplicarse en Empaque. | Definir aplicación compartida con confirmación física por etapa. Mientras tanto, lectura/historial y consolidación desconocida. |
| LEGACY/manual sin ledger V4 | Consulta por key puede mostrarlos; adopción exige contrato V2 más ledger V4 e id_entrega. | Adaptador con evidencia propia; nunca crear un nuevo PDT para eludirlo. |
| Fuentes sin key exacta no se recuperan por nombre | Lector filtra key; metadatos permiten nulos históricos. | Medir únicamente agregados de integridad y reconciliar identidad acreditada; no unir por producción ambigua. |
| CI nueva aún no incorpora estas suites SQL/navegador | Job affectations añadido localmente al workflow LP; permisos contents:read, sin secretos; PostgreSQL network none. | Ejecutar CI sobre SHA final cuando se publique la rama autorizada. Pruebas locales previas no equivalen a CI. |

Controles positivos revisados: funciones nuevas con search_path vacío y REVOKE;
esquema privado sin USAGE API, tablas nuevas con RLS; sesión y autorización servidor;
corrección por revisión CAS; UUID/recibo + locks; PK de fuente; transacción PDT+LP;
no sumas de causas, no conversión piezas→ventanas; físico separado de solución;
cobertura histórica explícita. No se amplían permisos de supervisores. Los hashes
instalados y permisos efectivos de dependencias siguen pendientes de contraste.

## Plan exacto, no ejecutado

1. Corrección y revisión independiente completadas localmente. Prueba reproducible
   carga SQL04 de git77f3f8c y registra SHA256; fixed PASS en tres rutas. CI incorporada,
   pendiente de ejecución remota. Mantener versión382: misma entrega sin publicar.
2. Obtener evidencia de solo lectura expresamente permitida sobre producción:
   hashes/cuerpo/owner/search_path/SECURITY DEFINER de sesion, verificar_temporal,
   operaciones_rol, admitir, saldo, puede_operar, permisos_en_periodo, actor PDT,
   validar_rol_real, fuente/identidad, registrar exterior e interior; ACL de schema,
   tablas, funciones y rol API, membresías e inventario de esquemas expuestos.
   No usar tokens reales para probar operaciones que puedan tener efectos laterales.
   Pins obligatorios: rol `69274f528a2fed8001da535856649036`, registrar exterior
   `8c501e21c8a6986f584ec96a3da955e6`, interior `2c9da616eb830fd6db20973e9bec4155`.
   Cualquier diferencia exige revisar contrato y repetir pruebas; nunca sustituir pins
   por el hash observado solo para pasar el gate.
3. Picking real: informe AGREGADO, sin IDs, nombres, producción ni notas. Contar por
   contrato/origen: key nula/huérfana, V2 sin detalle/evento/entrega, origen discordante,
   detalle duplicado, fuente ya asociada, estados sin confirmación física acreditada.
   Comparar cardinalidad antes/después de JOIN para detectar multiplicación. Separar
   V4, LEGACY y manual; no extrapolar fixtures a datos reales. Aprobar alcance apto
   por evidencia; el resto continúa visible sin adopción/crédito automático.
4. Respaldo verificable y ensayo de recuperación, inventario de funciones/ACL y
   evidencia de instalación parcial ausente. Revisar propietario y default privileges.
5. Ejecutar **solo bajo autorización posterior** los cinco archivos del manifest,
   en orden01→05. Cada archivo tiene su propia transacción; no envolverlos en otra
   transacción ni afirmar atomicidad del paquete completo. Establecer lock_timeout
   y statement_timeout a nivel de sesión en todo el lote. ON_ERROR_STOP, detenerse
   al primer error y comprobar estado; NO reintentar ciegamente CREATE/ALTER.
   Sin backfill, sin grants, flags writes/physical/pdt_links/atomic_pdt=false.
6. Verificar objetos, huellas finales, ACL, RLS, flags y ausencia de cambios en datos
   originales. Preparar un script de activación separado revisado: grants mínimos de
   EXECUTE por firma API, nunca tablas privadas ni grant general; no activar todavía
   escritura. El lector v2 es la entrada UI; v1 no requiere grant externo.
7. Lectura controlada: roles permitidos ven solo orden/etapa autorizada y Picking
   original, no vínculos de otras etapas; revocación limpia panel; inicio desconocido
   sigue No disponible. Probar PC/móvil y expiración sin datos expuestos en evidencia.
8. Activar únicamente capacidades cuyo caso real quedó acreditado, mediante script
   separado con precondiciones y valores anteriores; no abrir turnos ni asignaciones.
   Pruebas de escritura en aislamiento primero: UUID repetido/cambiado, carreras,
   misma fuente, rollback tardío, permisos revocados, cierre concurrente, NC y longitud,
   cantidades solapadas y físico parcial. No usar órdenes reales como fixtures.
9. Publicación coordinada: CI exacta, backend readiness actualizado al nuevo contrato,
   inventario/bytes/huellas protegidas, baseline Hosting actual por GET, recuperación,
   HOLD de transición de política. La evidencia backend de v381 no cubre estas RPC.
   Confirmar badge382 y SHA final tras publicación, cuando sea autorizada.

El manifest fija los bytes revisados; si se corrige SQL, regenerarlo y repetir las
pruebas afectadas antes de convertir las propuestas en migraciones de entrega.
No existe todavía script de activación aprobado; no ejecutar el manifest como release.

## Recuperación y entregabilidad

Fallo parcial de instalación: contener, identificar exactamente archivos confirmados,
conservar flags apagados; corregir hacia delante o retirar solo objetos nuevos vacíos
con plan revisado. Tras eventos: contener escrituras y preservar auditoría, no DROP,
ni restauración que borre producción. Revertir frontend por sí solo no revierte BD.

Entregable ahora: código local, demo sintética, menú/filtros y panel, SQL revisable,
manifest y esta evaluación. Lectura productiva del nuevo panel requiere instalación/
ACL revisadas y verificación pendiente. Escrituras NO listas para activación por los
bloqueos anteriores. No hay denegación ni resultado de ejecución incierto: las consultas
SQL de validación no se intentaron por restricción explícita del encargo.

## Alcance de la corrección posterior

`revocation-baseline.json` demuestra escritura/recibo/lector con permiso temporal
vencido; `revocation-result.json` demuestra denegación AMBITO_DENEGADO sin escritura
ni divulgación tras espera. La revocación explícita UPDATE no atraviesa el SHARE
nativo: se serializa y el siguiente reintento es rechazado. Se corrige la hipótesis
inicial que la describía como carrera reproducida. No se modificaron dependencias.

Limitación distinta conservada: `sgp_sesion_actual` usa now() transaccional para
caducidad de sesión. Revalidar actor no cambia ese contrato a reloj real; no se afirma
resolver expiración de sesión dentro de una transacción. Requiere revisión específica
del contrato compartido si se exige dicha semántica. No ampliar permisos para eludirlo.

La autorización de continuar implementación no se usó para aplicar SQL productivo:
el manifiesto actualizado y las precondiciones se entregan al coordinador antes de
cualquier mutación. Sin vía permitida de consulta SQL productiva, hashes/ACL/integridad
de filas reales siguen sin certificar; los metadatos ya obtenidos no los sustituyen.

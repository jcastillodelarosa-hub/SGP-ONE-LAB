# Picking PDT simple · candidata LAB v431

Estado: **IMPLEMENTADO EN RAMA / VERIFICADO EN POSTGRESQL EMBEBIDO**.
No aplicado en Supabase, sin datos reales modificados. Base frontend main `f4818ab` (v430).
Proyecto autorizado: `ocvxbwzqxbrfndkvjmfx`. Consultas productivas de solo lectura contrastaron columnas,
triggers y cierre el 10/11/2026. No hay eventos de Picking de orden ficticios ni auditorías automáticas.

## Resultado funcional

Confirmar cantidad realmente entregada requiere una sola operación. Parciales permanecen
`PENDIENTE`; cuando **todos** los detalles tienen procesado y entregado igual al validado,
la misma transacción guarda cierre, deja `RESUELTO` / `PICKING` y fecha/usuario de cierre.
El listado que filtra abiertos deja de incluirlo; el historial se conserva.
Sirve a PDT manual y V2 con detalles ya validados. No convierte LEGACY ni modifica
cantidades originales, identidad, fuentes, reservas, NC ni la auditoría de órdenes.
La validación inicial de identidad/detalles y el procesamiento real siguen siendo requisitos.
La aprobación eliminó solamente el paso adicional de validación/asignación de entrega.

## Contrato frontend exacto

- `sgp_pdt_picking_simple_estado_v1(p_token text, p_id uuid)` devuelve
  `{ok:true, contract_version:1, modo:string, finalizado:boolean, detalles:[], entregas:[]}`.
- Cada detalle contiene `id_detalle`, `cantidad_validada`, `procesada`, `entregada`,
  `saldo_entrega` (validado menos entregado), `disponible_entrega` (menor de procesado/validado menos entregado).
- `entregas` contiene solo confirmaciones del ledger nuevo con `id_entrega`, `id_detalle`,
  `cantidad`, `creado_en`, `usuario`, `observacion`. Las anteriores siguen en su historial
  original; no se mezclan con los saldos del ledger nuevo.
- `sgp_pdt_picking_simple_v1(p_token text, p_id_detalle uuid, p_cantidad integer,
  p_idempotency_key uuid, p_observacion text DEFAULT NULL)` suma la cantidad de esta entrega
  (no es un acumulado). Devuelve `{ok:true, duplicado:boolean, finalizado:boolean, id_entrega:uuid}`.
- Conservar el UUID y payload si hay respuesta incierta, timeout o deadlock. Repetirlos devuelve
  el resultado de la operación original sin sumar otra vez, incluso después del cierre.
  Actor o payload distinto con la misma clave es conflicto. Refrescar el estado después del éxito.
- `modo=DIRECTO`: cantidades del ledger nuevo. `ANTERIOR_PENDIENTE`: existen entregas
  previas activas y no se ha acreditado cierre mediante el guard original; `detalles:[]`,
  `entregas:[]`. La UI conserva lector/controles históricos exclusivamente para este sentinel.
  `ANTERIOR_COMPLETA`: el guard original íntegro acredita el cierre y todas las cantidades;
  se muestran sus detalles completos sin inferir parciales. El guard exige un registro de cierre,
  por lo que un PDT aún abierto con cantidades antiguas completas normalmente sigue en
  ANTERIOR_PENDIENTE hasta usar el botón de cierre del flujo antiguo.
- La lectura no cambia datos. El cierre antiguo `sgp_pdt_cerrar_v2` sigue disponible;
  no introducir cantidad cero/ficticia. No hacer fallback de errores al escritor antiguo.

Roles de escritura idénticos a la entrega manual existente:
ADMINISTRADOR, COORDINADOR, PICKING, SUPERVISOR DE PICKING.
Lectura usa los roles de consulta PDT; sesión/rol real se verifican dentro de cada RPC.
No se amplían capacidades existentes. Los grants técnicos anon/authenticated/service_role
solo permiten invocar las RPC autenticadas por token de aplicación; tablas/helpers privados
sin acceso, RLS habilitado, search_path vacío y EXECUTE PUBLIC revocado.

## Integridad y convivencia

Ledger privado `sgp_pdt_picking_simple.entregas`, clave UUID única y lock advisory por clave.
Todas las cantidades se serializan por fila del PDT. Se bloquean sus detalles.
No se bloquea ni modifica ninguna entrega de orden desde esta ruta.
El cierre existente se conserva literalmente en helper privado y backup, con preflight MD5
`24e18c5a31ffd2b7f313078ac42721c5`; cualquier drift aborta toda la instalación.
Solo el cierre marcado `PICKING_SIMPLE_V1` se acredita por nuevos saldos. El trigger productivo
`sgp_pdt_guardar_contrato` permanece intacto y comprueba transición/cobertura.

La cobertura anterior no se suma al ledger nuevo: los predicados históricos de fuentes,
reserva, sistema y material varían por manual/V2/grouped/V4 y no se simplifican.
Toda línea anterior activa, incluso VALIDADA/asignada, bloquea la nueva escritura con
`PDT_SIMPLE_ENTREGAS_PREVIAS_POR_CONCILIAR`. El lector devuelve el modo histórico
correspondiente; su guard completo original sigue siendo autoridad. Las líneas ANULADA
no reservan cobertura ni bloquean el inicio de la ruta nueva.
Una vez usado el ledger, triggers adicionales impiden modificar/añadir/anular líneas y
asignaciones del flujo antiguo para ese PDT. El flujo simple queda como único escritor.
Un reverso de procesamiento sigue permitido mientras no deje procesado debajo de entregado.
Guards de inmutabilidad anteriores se conservan. La cantidad reportada original puede
ser distinta de la distribución validada; se conserva y el cierre usa todos los detalles.

Posibles errores: `PDT_SIMPLE_NO_APTO` (contrato, validación, estado o cierre),
`PDT_SIMPLE_SUPERA_PROCESADO_O_TOTAL`, `PDT_SIMPLE_CLAVE_REUTILIZADA`,
`PDT_SIMPLE_SALDOS_INCONSISTENTES`, `PDT_SIMPLE_REVERSO_AFECTA_ENTREGADO`,
`PDT_SIMPLE_USAR_CONFIRMACION_DE_CANTIDAD`.
No convertir estos fallos en fallback que registre en el flujo antiguo.

## Instalación, contención y reversión

1. Revisión independiente y CI PostgreSQL17 real con concurrencia antes de aplicar.
2. Ejecutar `install.sql` entero como una única migración autorizada. Es de una sola instalación;
   schema ya existente falla de forma segura, no sobrescribe un despliegue previo.
3. Verificar huellas, funciones, grants, triggers y respuesta de lectura. Nunca insertar fixtures
   en Supabase ni usar un PDT real para un ensayo de escritura.
4. Publicar frontend compatible y verificar lectura/listado sin inventar entregas.
5. Si hay incidencia, `contain.sql` revoca escritura y conserva lectura, ledger, historia,
   cierres y guards. No borra cantidades ya registradas ni reabre cerrados.
6. `rollback-unused.sql` restaura exactamente el cuerpo anterior y elimina únicamente lo
   añadido, **solo si el ledger y los cierres simples están vacíos**. Tras uso real se rechaza;
   correcciones de entregas requieren una tarea específica autorizada, no borrado/reverso oculto.

## Evidencia y límites

`tests/pdt-picking-simple/fixture.sql` reproduce tablas mínimas y el cuerpo del guard vivo;
los tokens sintéticos son nombres de roles. PGlite 0.3.14 ejecuta PL/pgSQL real y pasó
parciales manual/multidetalle, autocierre, replay tras cierre, rechazo de rol/cantidad/clave,
límites de procesado y total, reverso permitido/denegado, old writer, rechazo de mezcla aun con anterior VALIDADA,
reader histórico sin inferencia de cobertura parcial, permisos, contención y rollback sin uso con hash restaurado exacto.
No acredita todas las dependencias productivas ni sesiones simultáneas.

Runner rápido (instalar PGlite 0.3.14 en un directorio de pruebas, nunca en producción):
`PGLITE_MODULE=/ruta/node_modules/@electric-sql/pglite/dist/index.js node tests/pdt-picking-simple/run.mjs`.

Runner completo para CI: `python3 tests/pdt-picking-simple/run-postgres.py`.
Usa imagen oficial `postgres:17`, red deshabilitada y ninguna URL/credencial productiva;
crea y elimina contenedor propio. Ejecuta fixtures, migración, assertions y seis carreras
multi-sesión en ambos órdenes. No ejecutado localmente: Docker no está instalado.

La ruta simple no toma locks sobre órdenes: no introduce el ciclo PDT→orden/orden→PDT.
Los locks por PDT serializan confirmación con reversos y writers antiguos. Ante cualquier
fallo concurrente/timeout se conserva y reintenta la misma clave, sin aceptar silenciosamente
ni generar otra. No hay prueba productiva de escritura; publicación/aplicación se registran
por separado. El runner de CI multi-sesión sigue pendiente en este entorno sin Docker.

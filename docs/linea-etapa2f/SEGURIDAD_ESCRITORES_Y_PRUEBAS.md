# Etapa 2F — permisos, escritores y adaptación mínima

## SECURITY DEFINER: evaluación acotada, no diagnóstico por grants

Las cuatro RPC instaladas con EXECUTE para anon/authenticated NO quedan calificadas
como inseguras por esos metadatos. El modelo SGP puede validar su token, rol real y
ámbito dentro de la función, aunque el rol técnico de PostgreSQL sea anon.
Tampoco basta su existencia para certificarlas como seguras. No se recomienda
revocar esos grants, desactivar RLS ni cambiar funciones productivas en este PR.

| RPC | Controles observables en evidencia disponible | Evaluación pendiente |
|---|---|---|
| sgp_sesion_actual | Captura previa: token hash, sesión no revocada/no vencida, usuario activo, rol real | Contrastar huella vigente, propietario/search_path y privilegios; no consulta directa actual |
| sgp_picking_validar_recepcion | Captura: validador SGP, FOR UPDATE de entrega, auditoría faltantes/diferencias, VALIDADA/AUDITADA_DIFERENCIA | Vigencia de cuerpo y ámbito actual por producción/etapa; reglas de sesión legacy no se reutilizan ciegamente |
| sgp_previsualizar_export_diario | Instalada y metadata reportada, llamada versionada | Cuerpo vigente no recibido; verificar autenticación, ámbito y qué puede leer |
| sgp_aplicar_export_diario | Igual más respuesta id_carga_diaria en código | Cuerpo vigente no recibido; verificar autorización, atomicidad, escrituras y locks |

El cuerpo capturado de sgp_validar_sesion_rol tiene equivalencia RECEPCION→LIDER.
No se altera para legacy ni se traslada como autorización nueva a las operaciones
consolidadas. Una función SECURITY DEFINER debe evaluarse también en su contexto
de propietario, resolución de objetos y permisos reales; no se concluye vulnerabilidad
sin contrastar esos controles. No se inventa un cuerpo para las dos RPC Export.

## Matriz explícita de cargos y ámbitos, todavía sin binding productivo

| Cargo aprobado | Candidatos observados en código/capturas (NO equivalencias) | Condición necesaria |
|---|---|---|
| Líder de Picking | SUPERVISOR DE PICKING; LIDER LINEA/LIDER cuando un binding servidor lo acredite | Sesión real, pertenencia a cargo verificada, producción y etapa autorizadas, revisión/origen del binding |
| Líder de Ensamble | LIDER LINEA/LIDER en código de línea/multiorigen | Lo mismo; no acceso automático a todas las producciones ni a mecanizado |
| Coordinador | COORDINADOR | Matching del label no sustituye ámbito por key/etapa ni autorización de revisión/turno |

El catálogo de roles/usuarios y su correspondencia funcional actual no se adjuntaron.
Se conserva installedBinding=null. No se registra ni se concede permiso alguno.
D2 usa labels más un grant de validación específico; no se fuerza una sesión
SUPERVISOR/LIDER LINEA a convertirse en otro rol para eludir ese contrato.
READ ONLY de manifiestos requiere ámbitos de ambas etapas; ejecutar/corregir y
validar impacto son derechos distintos. Turno ausente/cerrado sigue rechazado;
reapertura autorizada/revisión/motivo conserva snapshots. UI/ventana no es un scope.

## Inventario acotado: candidatos conocidos vs escritores efectivos pendientes

| Escritor/familia | Evidencia | Qué se sabe / qué falta |
|---|---|---|
| Picking entrega6/8 | Capturas previas y código | Inserta entrega/faltante/PDT; fecha/reserva no equivalentes entre firmas; falta vigencia/protocolo instalado |
| Picking validar_recepcion | Instalación reportada + captura | Bloquea entrega primero; no prueba que tome producción B2 antes de mutar |
| Guard completa duplicada | Captura/versionado | Advisory por programación+producción, scope distinto al lock común B2 |
| PR125 fecha operativa | Main exacto | BEFORE INSERT fecha/turno Bogotá, no reemplaza lock de producción ni autorización |
| PDT crear/v4/validar/avanzar/revertir/estado/cierre | Capturas y propuestas/código | Deben cooperar si cambian fuente; no alterar LEGACY ni hacer un bloqueo global |
| Planificador registrar/mover/arrastrar | Llamadas versionadas | Semántica y transacciones instaladas pendientes, no leer como eventos nuevos automáticamente |
| Export apply | Instalación reportada; cuerpo pendiente | Escritor crítico de corte/saldo; falta vínculo evento/corte y orden de locks |
| Carga semanal | Código usa lock por año/semana y escribe producción/aluminio | Un lock por periodo no demuestra cooperación por producción |
| Directos/batch/externos | No inventariados completamente | No declarar lista efectiva completa sin esa evidencia |

## Adaptación mínima propuesta (NO aplicada)

1. Identificar las keys canónicas afectadas en servidor y autenticar/autorizar
   antes de mutar. No ampliar roles ni usar datos de identidad enviados por navegador.
2. Entrar al protocolo ANTES de los locks operativos: UUID idempotente → keys de
   producción ordenadas → turno. Revisar la derivación de key después del bloqueo;
   un cambio invalida la operación y exige retry/CAS, no continuar con otra identidad.
3. Invalidar fuente en la MISMA transacción antes de escribir; ejecutar reglas
   existentes, persistir revisión/auditoría y commit único. Error revierte todo.
4. Para Export, vincular carga/historial/saldos y decisión explícita INCLUDED/EXCLUDED
   de cada evento al ACK/manifiesto existente. No inventar inclusión temporal.
5. Para PDT/entregas, nueva fuente/revisión deja validación para revisión, no crédito
   automático. Nuevas keys sin cobertura/registro no se habilitan por defecto.
6. Cierre/reapertura respeta el protocolo vigente y snapshots inmutables. Cambios
   posteriores no recalculan reportes cerrados con fuentes actuales.

Un wrapper externo NO basta si la RPC antigua sigue pudiendo escribir sin el
protocolo. Un trigger tardío después de bloquear entrega tampoco demuestra ausencia
de inversión/deadlock. Por eso no se implementa un hook especulativo contra las
funciones actuales: falta su cuerpo/orden efectivo y todos sus puntos de entrada.
No hay nueva SQL de escritura en esta etapa. Cualquier instrumentación productiva
posterior requiere revisión y autorización separadas; nada se instala aquí.

## Pruebas y límites

434/434 Node,12 nuevas de revisión de evidencia; tres comprobaciones PostgreSQL17
READ ONLY en clon sintético aislado: claves/tipos sin valores, no repetir cuerpos,
rechazo real de escrituras y hashes de filas intactos. SQL de contraste no ejecutado
en Supabase. Tipos y claves QA son deliberadamente sintéticos, no DDL productivo.

Se verifican huellas de fuentes2D/2E y se reutilizan sus pruebas de cantidades,
parciales, compartidas, turnos, correcciones, cierres e inclusión Export. La
concurrencia REAL PostgreSQL9 y lector4 de2E siguen vigentes porque no cambió
ningún escritor/esquema/lector; no se repiten por documentación/revisión sin writes.
NO son prueba de cooperación de escritores PRODUCTIVOS. No se usa JS serial como
prueba de concurrencia real, ni muestras como certificación de dominio completo.

Evidencias en tests/linea-stage2f/evidence; código de revisión no se importa al
runtime y conserva authorizationDecision=null. No endpoints/pool/RPC/grants nuevos,
frontend, cambios de versión, Supabase/Firebase/Gateway/main ni otros repositorios.
Reversión del módulo de revisión es solo de código/artefactos en rama; no hay
migración productiva o datos que restaurar. Preservar recibos/ledger de padres.

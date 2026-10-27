> Ajuste vigente: [CANTIDADES_CONSOLIDADAS.md](CANTIDADES_CONSOLIDADAS.md). Las referencias siguientes a IDs físicos como condición obligatoria corresponden al diseño anterior/opcional. La vía aprobada usa cantidades consolidadas validadas, no requiere IDs ni reconstrucción histórica. Las observaciones de ausencia de esos IDs siguen siendo hechos de la captura, pero ya no son bloqueo de este nuevo contrato.

# Etapa 2D — trazabilidad Picking/PDT y cierre de contratos

## Estado y alcance

IMPLEMENTADO aislado: lector servidor y complemento aditivo de vínculos explícitos.
VERIFICADO EN AISLAMIENTO: ver evidence de esta etapa. PENDIENTE DE EVIDENCIA REAL:
identidades físicas, cobertura, asociación de nuevas diferencias, scopes actuales,
contratos instalados Export y coordinación de escritores. NO APLICADO / NO PUBLICADO.

Base124 111f0cb46921198f790b6cafc0336e0ca449136c; stack117→121→122→124→Draft2D.
Main observado b228ab2977ee29fa8c3db1db2ec2c2b594e3dc2d. No se modifica ni fusiona.
Frontend, Picking operativo, Mecanizado, vidrio, Firebase/Gateway, GOOGLE y LAC intactos.

## Matriz obligatoria de campos y relaciones (2D.1)

Existente en código/captura NO equivale a verificado actualmente en Supabase.
No hay conector Supabase autenticado en herramientas de esta sesión. No se leen
credenciales ni registros productivos. GitHub REST sí permite verificar ramas/PR.

| Campo / relación | Evidencia exacta disponible | Clasificación / límite |
|---|---|---|
| Entrega→programación/producción | Captura PDT_FUNCIONES_REALES.json, ambas sgp_picking_entrega_orden: insert sgp_picking_entregas(id_programacion,produccion,estado=PENDIENTE_VALIDACION) | EXISTENTE en captura previa; programación/orden no es unidad física |
| Faltante→entrega/pieza | Misma captura: insert sgp_picking_faltantes(id_entrega,id_pieza,cantidad,...) | EXISTENTE; cantidad son piezas, no ventanas |
| Ventanas afectadas capturadas en UI | app.js openPickingAudit, submitPickingAudit y editor de diferencias: input number y p_faltantes/p_diferencias | EXISTENTE: cantidad entera, no lista de ventanas |
| Persistencia del entero | Captura real sgp_picking_validar_recepcion: UPDATE faltantes y PDT, INSERT diferencias/PDT con ventanas_afectadas | EXISTENTE en cuerpo capturado; se ejecutó sin modificar en esquema mínimo compatible QA |
| Auditabilidad | Faltante auditado, usuario_auditoria, fecha_auditoria; entrega usuario_validacion/fecha_validacion | EXISTENTE en captura; no crea identidad individual ni vínculo inequívoco con PDT |
| Faltante→PDT histórico | Validador actualiza PDT por producción+id_pieza+estado+reserva; no inserta FK id_faltante en PDT | INFERIBLE por coincidencias, NO demostrado uno-a-uno. No se usa para reconstruir vínculos |
| Diferencia→PDT | Validador inserta por separado auditoria_diferencias y PDT | NO hay vínculo individual recuperable demostrado. Nombre/tipo de su PK actual sin contraste; no se inventa FK en complemento |
| Reserva compartida | Firma8 y validador usan sgp_produccion_reservas_v, reserva_principal, reserva_pendiente, acabado | EXISTENTE; firma6 capturada es menos rica. No asumir equivalencia de ambas ni cantidades por reserva |
| PDT→detalle | DRAFT24: sgp_aluminio_pendiente_detalles.id_detalle→id_pendiente | CONTRATO VERSIONADO; instalación actual no reconsultada |
| Detalle→pieza/fila fuente | sgp_pdt_fuentes(id_detalle,id_pieza,id_carga,fila_origen,snapshot) | CONTRATO VERSIONADO y tabla reportada. Fila/pieza NO es ventana |
| Línea positiva→detalle/entrega | 20261026_pdt_picking_B_REVIEW.sql, sgp_pdt_entrega_lineas: UUIDs, cantidad piezas, estado | CONTRATO VERSIONADO; no prueba equivalencia pieza→ventana |
| Asignación cuantitativa PDT | sgp_pdt_asignaciones(id_linea,id_detalle,cantidad) | Cuantifica piezas y evita doble consumo de piezas, NO ventanas |
| Validación con diferencias | Captura validador: entrega AUDITADA_DIFERENCIA cuando se agregan diferencias, VALIDADA en otro caso | EXISTENTE. Diferencias sirven como evidencia de bloqueo; no acreditan reposición física |
| Complementaria→resolución | SQL B exige línea VALIDADA y entrega VALIDADA; cierre usa cantidades/asignaciones | CONTRATO VERSIONADO de piezas. Hace falta constatación explícita de unidades físicas liberadas |
| Identidad de ventanas afectadas | Ni input numérico ni firma/cuerpo capturados la contienen | AUSENTE en evidencia disponible. No se afirma inexistencia absoluta en toda la base |
| Etapa de impacto de Picking legacy | origen PICKING/PICKING_AUDITORIA no demuestra ENSAMBLE/EMPAQUE | AUSENTE sin clasificación explícita supervisada; no migrar históricos |
| Unidad física→reserva/parte/producción | Sin registro individual contrastado | PENDIENTE: requiere fuente real persistente y estable, no id_pieza/ordinal |

La captura completa de funciones es scripts/pdt-compatibility/evidence/PDT_FUNCIONES_REALES.json.
Sus huellas ejecutadas y el resultado de las pruebas están en tests/linea-stage2d/evidence.
No se cambiaron las siete funciones capturadas ni el validador de Picking operativo.

## Complemento mínimo explícito (2D.2)

Nuevo schema privado sgp_linea_d2, SQL REVIEW fuera de migraciones automáticas:
- unidades: IDs suministrados por una fuente física contrastada, producción,
  reserva, parte, estados y referencia/versión. SIN generador de IDs ni carga automática.
- cobertura: inventario completo de PDT relevantes por key e identidad canónica.
  Debe cubrir también legacy sin key y reservas compartidas mediante fuente revisada;
  ese productor NO existe/verificado aquí. Sin cobertura certificada, bloquear.
- vinculos: asociación explícita aprobada PDT→faltante→entrega→unidades, etapa,
  CAS, UUID idempotente, snapshot fuente, huella, actor y motivo; append-only.
- liberaciones: constatación física POR unidad y PDT con referencia/versión,
  línea complementaria validada y huella. La produce una fuente física confiable;
  no hay API pública que transforme cantidad de piezas en este registro.
- historial_fuente: antes/después de fuentes complementarias, actor DB y fecha.

`asociar` es solo privada, sin integración frontend: exige rol real coordinador/
administrador y scope actual etapa/producción leído desde el servidor2C. Es un
permiso RESTRICTIVO PROPUESTO para revisión, no ampliación de permisos de planta.
La selección humana futura necesita interfaz/flujo aprobado aparte. Preserva legacy.

Comprueba key, producción, entrega, pieza PANEL, reserva específica, relación con
reserva principal y parte de la unidad. La reserva del material puede ser
distinta de la reserva de la unidad en una reserva compartida: ambas deben estar
en la cobertura contrastada de la misma producción/parte y la selección es explícita,
no un reparto automático de cantidades por reserva. Exige cantidad de IDs igual al entero
auditado para ese faltante; no crea esa lista a partir del entero. Reasignar etapa
requiere revisión separada. Relaciones de nuevas diferencias quedan BLOQUEADAS:
no se implementa un enlace especulativo sin identidad persistida real.

No se poblaron históricos ni IDs productivos. Las referencias QA-U1…QA-U20 son
fixtures ilustrativos y NUNCA se presentan como identidades de planta.

## Disponibilidad y complementarias (2D.3)

`impacto(key)` produce el contrato PDT2C desde referencias explícitas. Sin vínculo,
con cobertura incompleta o huella obsoleta, falla; el boundary Node devuelve
SIN_CONCILIAR, available=null e invalida evidencia dentro del mismo lock/savepoint.
No hay endpoint/runtime nuevo ni reader productivo registrado automáticamente.

Se reutilizan sin cambiar el resolvedor121, motor122 y bridge124. Unión de IDs
bloqueados: dos pendientes sobre una ventana descuentan una vez. Empaque tiene
su etapa independiente. Ejemplo QA20 ensambladas / tres afectadas / cero empacadas
produce17. Un avance de Empaque descuenta lo realmente consumido en todos los turnos,
sumando locales no incluidos explícitamente; no modifica saldos oficiales.

Estado NC o RESUELTO no elimina automáticamente un vínculo físico registrado.
Una línea VALIDADA sin constatación por unidad tampoco lo elimina. Liberación
requiere línea+entrega VALIDADA, detalle del mismo PDT/pieza, reserva/producción
válidas y prueba física por unidad. AUDITADA_DIFERENCIA/ANULADA o fuente cambiada
invalida y bloquea: nunca acredita una reposición. Otro PDT sobre la misma unidad
sigue bloqueándola aunque el primero se resuelva.

## Export: contratos contrastables y propuesta delimitada (2D.4)

| Contrato | Evidencia vigente disponible | Resultado |
|---|---|---|
| sgp_previsualizar_export_diario | app.js p_token,p_linea,p_datos | Llamada verificada, cuerpo instalado NO disponible |
| sgp_aplicar_export_diario | app.js token/línea/nombre/datos y respuesta id_carga_diaria | No demuestra ledger de inclusión local |
| sgp_export_diario_historial | Propietario confirmó carga/identidad/saldos/fecha | No DDL/cuerpo instalado ni semántica completa saldo→ensamblado |
| Evento local2B | UUID/key/etapa/delta/turno/revisión inmutables | Identidad reutilizable para ACK, no envío acreditado al Export |
| Vínculo corte→evento | No localizado en evidencia disponible | PENDIENTE DE EVIDENCIA REAL; no se declara que no exista en toda producción |

No inferir inclusión por fecha/cantidad ni interpretar automáticamente un saldo
pendiente como cantidad efectivamente ensamblada. El lector real debe contrastar
significado de cada columna, total/base y correcciones. Se reutiliza la consulta
catalog-only2C ya preparada: no se ejecutó productivamente ni se repite el hallazgo
de SECURITY DEFINER/grants como evidencia de autorización funcional.

`02_export_ack_REVIEW.sql` es una propuesta aditiva DELIMITADA: acuse por corte,
key y UUID local, INCLUDED/EXCLUDED, revisión/huella y referencia oficial. No instala
ni reemplaza sgp_aplicar_export_diario. Futuro importador: lock keys ordenadas,
comprobar fuente/corte inmutable y todos los eventos existentes, escribir el ACK
con el corte en una misma transacción, invalidar2C antes de cambiar fuente. Corrección
requiere nuevo corte/revisión; no reescribir ACK sellado ni saldos desde motor local.
Sin ese enlace verificable, mantener SIN_CONCILIAR. Esta propuesta no cierra por
sí sola la integración productiva ni reconstruye importaciones históricas.

## Seguridad, concurrencia, contención y reversión (2D.5)

Esquema privado, RLS en todas las tablas y sin grants navegador. No service_role,
ningún secreto/credencial en archivos nuevos. Sesión capturada real, sin ampliar
RECEPCION→LIDER. UUID→producción→turno; fuentes complementarias deben tomar lock
producción primero y actualizar versión/cobertura. Triggers solo en tablas NUEVAS.

No hay hook en tablas Picking/Export productivas. El lector reevalúa snapshots y
bloquea si cambian, pero eso NO demuestra coordinación de escritores instalados.
Esa parte sigue BLOQUEADA hasta revisar orden de locks y todos los productores.
No se promete que polling sustituya esa coordinación. El pool mínimo productivo y
los permisos actuales tampoco se dan por verificados por usar propietario QA.

Contener por keys gestionadas con el mecanismo persistente2C; conservar unidades,
links, historial y cortes. No retirar el reader dejando evidencia cacheada activa.
Rollback vacío verifica huellas y rechaza evidencia operativa. Con actividad:
contener, preservar/exportar evidencia segura, reparar hacia delante. No restaurar
un backup sobre nuevas operaciones ni borrar vínculos para eludir controles.
Instalación y reversión productivas NO autorizadas ni ejecutadas.

## Reproducción y siguiente paso

Contenedor QA existente PostgreSQL17.11, network none/sin puertos, datos sintéticos.

```
python tests/linea-stage2d/run-postgres.py
node tests/linea-stage2d/adapter-postgres.mjs
python tests/linea-stage2d/recovery-postgres.py
npm test
npm run verify:release
```

La regresión SQL2C/B2 se ejecuta en DB nueva y se archiva bajo2D sin cambiar sus
evidencias base. La captura real del validador se prueba en esquema mínimo compatible,
NO clon productivo. Concurrencia: conexiones psql distintas, no simulación serial JS.
No cambios visuales: no repetir capturas PC/móvil. Detalle de resultados en evidence.
Siguiente paso único: revisión ChatGPT del Draft2D y de las fuentes físicas/Export
faltantes. Sin frontend, aplicación SQL, merge, publicación ni nueva etapa automática.

## Resultado medido de esta ejecución

396/396 Node; verify:release LABv362/sintaxis PASS. PostgreSQL17.11: 12
comprobaciones funcionales D2, tres del adaptador sobre sesiones persistentes,
seis de instalación/ACK/contención/reversión. Regresión baseC2 18/B2 16 PASS.
Las correcciones de fixtures se repitieron en clones nuevos de la base aislada
ya probada (--reuse-base); no se reconstruyeron registros productivos.
Orden de revisión SQL: metadatos/fuentes y dependencias → 01_unit_links_REVIEW.sql
→ 02_export_ack_REVIEW.sql (propuesta) → tests. Rollback está fijado a ese conjunto
vacío. Con datos o reader en uso, contener primero y revisar dependencias; no DROP.

## Cambio concurrente de main detectado al entregar

Main avanzó de b228ab2977ee29fa8c3db1db2ec2c2b594e3dc2d a ae76b3729184ff802d7adc83d8867662230d438c
por PR125 (Issue123, fecha operativa Picking). Comparación GitHub: solo app.js y
supabase/migrations/20261027090000_picking_fecha_turno_guard_123.sql. La migración
versionada agrega BEFORE INSERT sobre entregas y no reemplaza validar_recepcion.
Su instalación productiva no se comprobó. El complemento D2 no inserta entregas
operativas y no elude el guard. El esquema QA mínimo de esta entrega no reproduce
ese trigger concurrente: NO se declara compatibilidad productiva completa.
Se conserva base124 autorizada sin rebase/merge, protegiendo estos cambios de main
para la revisión futura de la cadena. No se alteró main ni se repitieron pruebas
de código por esta actualización exclusivamente documental.

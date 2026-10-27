# Recuperación Etapa 2D — 2026-10-27T20:48:28.183259+00:00

Repositorio SGP-ONE-LAB; rama feat/linea-stage2d-picking-unit-evidence; único PR127
OPEN/DRAFT sobre feat/linea-stage2c-source-bridges. SHA funcional y evidencias
recuperados de GitHub: 2fc09ea50fa6acb58733f25def7edd466b1acbc6. Main remoto sigue
ae76b3729184ff802d7adc83d8867662230d438c, incluido PR125, sin tocarlo.

## Completado, no repetir

Motor aislado de cantidades consolidadas, sin requisito de IDs físicos;
estimación/validación/revisión separadas; trazabilidad inmutable, permisos reales
más ámbito, CAS, UUID idempotente, invalidación de fuentes y descuento único
bruto/neto; Empaque parcial y preservación de cierres. SQL REVIEW fuera de migraciones.
Los cuatro SHA256 de fuentes en consolidated-summary.json coinciden exactamente.
Se reutilizan pruebas aprobadas:407/407 Node,14 PG17,4 adaptador y3 recuperación.
No se reejecutaron pruebas ni se declaró nueva validación de Supabase o planta.
CI de sintaxis del SHA funcional: éxito, run40544798563.

## Estado recuperado y límites del entorno

Worktree limpio recuperado en /workspace/sgp-linea-stage2d; los directorios /tmp
anteriores no estaban disponibles. Se conservó el worktree principal con sus
cambios preexistentes. No se descartaron ni sobrescribieron archivos del usuario.
Los commits de2D y sus evidencias sí están persistidos en GitHub.
El trabajo no versionado de2E en el /tmp anterior no aparece en el sistema de
archivos actual. No se afirma recuperado ni se mezcla con este PR. Su rama Git
local conserva el SHA2fc09ea, sin commit técnico de2E. El encargo vigente pide2D;
no se continúa automáticamente2E ni se crea otro PR.

## Pendiente y bloqueo real

- Productor/cobertura de fuentes reales y evidencia de contabilidad bruta/neta.
- Relación verificable de cortes Export con inclusión/exclusión de eventos locales.
- Ámbitos efectivos y correspondencia de cargos autorizados con roles instalados;
  no ampliar permisos por equivalencia de nombres.
- Colaboración de todos los escritores en el protocolo de locks/revisiones.
- Pool y compatibilidad de instalación con main/guard125; no hay acceso Supabase
  autenticado disponible para certificarlo en esta recuperación.

La Directiva Maestra SGP v3.1 solicitada no se localizó entre instrucciones,
documentos/adjuntos disponibles ni código del repositorio consultado. Se aplican
AGENTS.md y las restricciones explícitas del usuario; NO se declara aplicada una
Directiva cuyo texto no se pudo leer. Hace falta su texto o enlace exacto.

IMPLEMENTADO EN RAMA / VERIFICADO EN AISLAMIENTO (evidencia previa intacta) /
PENDIENTE DE EVIDENCIA REAL / NO APLICADO / NO PUBLICADO.
Checkpoint documental, sin cambios funcionales, ejecución de SQL, fusión o despliegue.
Siguiente paso único: revisión de ChatGPT del mismo PR127 y aportar la Directiva
v3.1 y las fuentes reales pendientes antes de continuar integración. No reiniciar
etapas anteriores ni habilitar producción por contar con pruebas aisladas.

---

# Etapa 2D — ajuste funcional por cantidades consolidadas (2026-10-27T16:47:50.736010+00:00)

PR único Draft #127; rama feat/linea-stage2d-picking-unit-evidence, base de ajuste
979421354f8115126fff823975e67bef646f3c7c; dependiente de #124, SHA111f0cb46921198f790b6cafc0336e0ca449136c.
Main observado ae76b3729184ff802d7adc83d8867662230d438c incluido PR125, sin modificación.
IMPLEMENTADO EN RAMA / VERIFICADO EN AISLAMIENTO. NO APLICADO / NO PUBLICADO.

Se elimina el requisito de ID físico para la nueva vía: cantidad consolidada por
producción/etapa, estimación separada de validación humana vigente, CAS/idempotencia,
rol real Picking/Ensamble/coordinador más ámbito servidor y turno explícito.
Se conserva el complemento por unidad como opcional; no se mezclan descuentos.
Captura bruta/neta servidor evita restar dos veces; sin evidencia de base o cobertura
se bloquea. NC/VALIDADA/piezas/estado no acreditan cantidades automáticamente.
Cambios de PDT/Picking/Export/permisos invalidan; nueva validación registra historial
inmutable y no reescribe cierres anteriores. No conversión piezas→ventanas.

Pruebas:407/407 Node (11 nuevas), PG17.11 real:14 comprobaciones, adaptador4,
contención/reversión3; sesiones concurrentes reales para CAS, dos turnos, source writer
vs consumo y reintento UUID. verify:release LABv362 y sintaxis PASS; sin cambiar versión.
Regresiones previas2B16/2C18/D2 y capturas originales conservadas; nuevos tests usan
clon de la base D2 ya verificada y hash de funciones públicas/auth sin cambios.
Evidencia: tests/linea-stage2d/evidence/consolidated-*.json.

PENDIENTE DE EVIDENCIA REAL: productor servidor de captura/contabilidad/cobertura,
clasificación explícita de eventos Export, ámbitos efectivos y locks de TODOS los
escritores instalados, pool mínimo y compatibilidad final con main. No faltan IDs
individuales para el nuevo contrato. No hay conector/pool productivo instalado.
SQL REVIEW03 y scripts de contención/reversión, fuera de migraciones automáticas.
No frontend/Picking/Mecanizado/Export/vidrio/Gateway/Firebase/otros repositorios.
Siguiente paso único: revisión de ChatGPT del mismo PR127 y de los límites de fuentes
antes de cualquier instalación; no comenzar otra etapa, aplicar, fusionar o desplegar.
El SHA final se obtiene en Git/PR tras guardar este checkpoint.

---

## Antecedente sustituido en requisito de identidad individual

# Etapa2D.1 — inicio recuperable
Base124 111f0cb46921198f790b6cafc0336e0ca449136c. Rama
feat/linea-stage2d-picking-unit-evidence. Main observado
b228ab2977ee29fa8c3db1db2ec2c2b594e3dc2d;124 OPEN/DRAFT sin avance.

Hallazgo dirigido: app.js openPickingAudit/submitPickingAudit solicita y envía
ventanas_afectadas NUMÉRICO, no selección de identidades. Captura real previa
PDT_FUNCIONES_REALES.json, sgp_picking_validar_recepcion, persiste ese entero en
faltantes/PDT/diferencias. Es evidencia de cantidad agregada, NO identidad de ventana.
No acceso autenticado Supabase en esta sesión; no se consultan secretos ni se
presenta la captura previa como estado productivo actual. Contratos Export instalados
no disponibles: se mantiene bloqueo de inclusión explícita de2C.

Siguiente: matriz trazable de campos, adaptador de impacto que falle ante agregados,
complemento mínimo aditivo aislado sin asignar unidades automáticamente y pruebas
reales PostgreSQL, regresiones, checkpoint y un Draft dependiente124. No productivo,
frontend, Picking operativo, legacy, Gateway, fusión ni publicación.

## Etapa2D.2–2D.5 — cierre aislado 2026-10-27T10:06:59.319338-05:00

IMPLEMENTADO: esquema privado aditivo de unidades/vínculos versionados con
snapshot real de filas, asignación explícita autenticada, prueba física por
unidad, lector C2, propuesta ACK inmutable y reversión sin borrar evidencia.
SQL REVIEW fuera de migraciones automáticas; ningún lector productivo registrado.

VERIFICADO AISLADO: 396/396 Node; PG17.11 12 comprobaciones D2, tres adaptador
y seis seguridad/ACK/reversión. Regresión baseC2 18/B2 16. Ajustes dirigidos D2
reutilizan clones de la base ya probada, sin repetir la auditoría de origen.
Caso20-3=17; solapamientos, etapas independientes, entrega complementaria sin
autocrédito, reservas compartidas, CAS/idempotencia/concurrencia y cambios de
fuente. Captura del validador y autorización legacy sin modificaciones.

PENDIENTE EVIDENCIA REAL: productor de IDs físicos/cobertura, vínculo de diferencias
nuevas con PDT, cuerpos/semántica/ACK Export, ámbitos/pool y locks de escritores
instalados. No se deducen ventanas desde piezas ni nombres. Leer matriz completa
en TRAZABILIDAD_Y_EXPORT.md. NO APLICADO / NO PUBLICADO.
Siguiente paso exacto: revisión ChatGPT del único Draft dependiente124. Sin nueva
etapa, frontend, SQL productivo, merge o despliegue automático. SHA final en PR.

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

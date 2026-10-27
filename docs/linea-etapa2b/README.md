# Etapa 2B — adaptador aislado PostgreSQL 17

## Estado y dependencia

IMPLEMENTADO EN RAMA y VERIFICADO AISLADO; NO APLICADO en Supabase, NO PUBLICADO.
Stack: PR117 (dominio) → PR121 (`2164227ae23fefc923ad81fcef74da47ba549ba0`)
→ esta rama `feat/linea-stage2b-postgres-adapter`. PR Draft contra la rama de121:
no representa integración con main. Último main observado: b228ab2977ee29fa8c3db1db2ec2c2b594e3dc2d.
La versión de aplicación permanece LAB v362; no cambia runtime ni interfaz.

## Fuentes y límites comprobados (2B.1)

| Fuente | Evidencia disponible | Uso / límite |
|---|---|---|
| Planificación | Propietario: seis RPC SECURITY DEFINER; cinco grants anon/authenticated, arrastrar sin ellos | No se alteran ni se reutiliza su autorización implícita; cuerpos instalados completos no disponibles |
| Export | Frontend versionado llama sgp_previsualizar_export_diario / sgp_aplicar_export_diario | No demuestra qué movimiento local incluye cada corte |
| sgp_export_diario_historial | Propietario: id_carga_diaria, saldos por etapa, identidad y fecha | No inferir inclusión por fecha/igualdad numérica; falta puente con eventos locales |
| sgp_lotes_carga | DDL versionado: id_lote_carga, fecha_hora, usuario, tipo_carga, id_unidad_carga, anio, semana_base, estado, archivos, fecha_aplicacion, detalle | Una carga no demuestra por sí sola inclusión de ejecución |
| PDT fuentes / líneas | Referencias de piezas conocidas | No existe equivalencia comprobada pieza→unidad. Ninguna conversión automática |
| Sesión | Cuerpo capturado sgp_sesion_actual(text), scripts/pdt-compatibility/evidence/PDT_COMPLEMENTO_REAL.json | Ejecutado en PG17 aislado con sesiones hash sintéticas; no prueba permisos productivos actuales |
| Roles / ámbitos | Dominio117, resolvedor121 y fixtures explícitos | Scopes etapa/producción deben provenir de fuente servidor revisada antes de instalación |

No se repitieron consultas productivas. No hay conexión Supabase autenticada en esta
sesión. El feed privado normalizado es un contrato probado con datos sintéticos,
NO un conector productivo de Export/PDT terminado. Falta recuperar/contrastar cuerpos
instalados de importación y resolver una relación verificable de inclusión/impacto.

## Persistencia y API (2B.2)

`docs/sql-proposals/linea-etapa2b/01_motor_REVIEW.sql` crea exclusivamente objetos
nuevos. No está en migraciones automáticas. Esquema sgp_linea_b2 sin USAGE navegador,
RLS y sin grants generales de tablas. RPC públicas nuevas SECURITY DEFINER con
search_path vacío y autorización real, sin alterar equivalencia legacy de roles.

- `sgp_linea_disponible_b2(token,key)`: autoriza Empaque/producción y devuelve
  disponibilidad READY, UNKNOWN o DISCREPANCY. UNKNOWN jamás se convierte en cero.
- `sgp_linea_motor_b2(token,cmd jsonb)`: ABRIR, SALE, EJECUTAR, CERRAR, REABRIR,
  ARRASTRAR, CONCILIAR, INFORME. Payload con lista cerrada de campos. UUID global
  idempotente enlazado a usuario y payload; reuso diferente se rechaza.
- `revision`: de turno para abrir/cerrar/reabrir; de orden para Sale/ejecución/arrastre;
  de producción para conciliación. Conflictos fallan sin escrituras parciales.
- Sale no acredita Ensamble. EJECUTAR es acumulado por producción/etapa/fecha/turno,
  guarda delta auditable y requiere motivo en descenso. Saldos Export nunca se escriben.
- Cierre conserva snapshot inmutable. Reapertura coordinada justificada deja turno
  EN_REVISION; una corrección no sobrescribe reportes anteriores.
- Arrastre es propuesta única por origen; corrección de origen refresca revisión,
  sin generar Sale ni validar automáticamente el destino. Destino cerrado se rechaza.
- CONCILIAR solo activa un corte privado previamente probado. No recibe cantidades
  oficiales, banderas de prueba ni mapas desde navegador. Exige ámbitos de ambas etapas.

Tablas privadas: producciones, permisos, turnos, ordenes, eventos, auditoria,
solicitudes, cierres, arrastres y adaptador_solicitudes. Fuentes normalizadas privadas:
cortes, incluidos, unidades y bloqueos. Cortes, inclusiones activadas, eventos,
solicitudes, reportes y auditoría tienen protecciones de inmutabilidad.
`config.escrituras` permite contención sin borrar evidencia ni bloquear informes.

Disponibilidad: corte ensamblado/empacado + deltas no incluidos explícitamente;
restar unión de unidades ENSAMBLE afectadas, no piezas. Pendientes EMPAQUE son
independientes. Ante falta de prueba, mapa, completitud o discrepancia se bloquea
incremento. Cambio PDT invalida prueba/revisión hasta conciliación confiable.
Identidad es key de producción verificada: no mezclar reservas/partes por nombre.
Las relaciones productivas reserva/parte deben verificarse en el futuro puente.

Roles: sesión real válida y ámbito explícito son obligatorios incluso bajo
SECURITY DEFINER. Consulta no escribe; coordinador/administrador controla apertura,
Sale, reapertura y conciliación; operaciones de etapa respetan ámbito. No se
hereda RECEPCION→LIDER. Cierre e informes comprueban todas las producciones incluidas.

## Adaptador y concurrencia

`src/server/linea-postgres-repository.js` implementa el contrato del resolvedor121
sin modificarlo. Pool PG inyectado exclusivamente en servidor; no integra runtime.
Transacción BEGIN/COMMIT/ROLLBACK; compara disponibilidad y revisión JS/SQL después
de la RPC nativa y revierte si divergen. Driver psql de pruebas no es driver productivo.

Orden: UUID advisory lock → fila producción → turno. Cierre toma turno y no espera
producción después: serializa ejecución/cierre sin invertir ese orden. Cada consumo
de distintos turnos comparte bloqueo de producción. CAS protege corte y revisiones.
La ingesta futura de Export/PDT deberá participar en este protocolo; no está probado
que los escritores legacy instalados lo hagan. Eso bloquea instalación productiva.

## Evidencia reproducible (2B.3)

Requisitos locales: Docker existente `sgp-pdt-qa-91`, PostgreSQL17, network none,
sin puertos publicados, Node y Python. Cada corrida crea DB QA nueva sintética.

```
python tests/linea-stage2b/run-postgres.py
node tests/linea-stage2b/adapter-postgres.mjs
npm test
npm run verify:release
```

Ver `tests/linea-stage2b/evidence/postgres.json` (16 comprobaciones), adapter.json
(cinco comprobaciones) y regression.json. Carreras reales con sesiones psql distintas:
consumo entre turnos, cierre/ejecución, arrastre/corrección, cambio de cortes,
corrección Ensamble/consumo, reintentos nativos simultáneos; además reintentos del
adaptador desde clientes persistentes separados. No son pruebas seriales JS.
Autenticación capturada se ejecuta realmente, pero datos, scopes y evidencia son
sintéticos. Regresión de funciones productivas no inventariadas NO demostrada;
se comprueba dominio117, resolvedor121 y ausencia de modificaciones protegidas.

## Matriz de riesgos y siguiente paso

| Riesgo | Control actual | Pendiente antes de Etapa siguiente / producción |
|---|---|---|
| Doble contabilización Export/local | Inclusión explícita inmutable y CAS de corte | Puente real de inclusión, fuentes/cuerpos instalados y protocolo de ingesta |
| Piezas confundidas con ventanas | UNKNOWN por defecto; mapa servidor obligatorio | Evidencia cuantitativa productiva por unidad, sin convertir PDT automáticamente |
| Permisos instalados demasiado amplios | RPC nuevas validan sesión real y scope; RLS privado | Contrastar ámbito real, permisos del pool mínimo y catálogo productivo |
| Corrección empacada sin respaldo | Rechazo transaccional | Conciliación individual cuando el descenso afecta unidades mapeadas; no adivinar IDs |
| Turnos concurrentes/cierre/cortes | Locks reales + CAS + ledger UUID | Incluir futuros escritores reales en el mismo protocolo |
| Stack no integrado | Draft sobre121, no merge | Revisar117/121 y delta con main vigente antes de integrar |

## Instalación, contención y reversión

Solo se instaló en DB QA PostgreSQL17. Inyección de fallo demostró rollback completo
de instalación. `ROLLBACK_REVIEW.sql` verifica huellas de RPC y ausencia de datos,
elimina solo objetos nuevos vacíos y rehúsa borrar un motor con evidencia. Probado
con esquema vacío y rechazo cuando hay datos. No restaura un backup sobre actividad.

Con actividad usar primero `CONTENER_REVIEW.sql` bajo autorización separada:
pausa nuevas escrituras de este motor, conserva informes/evidencia y legacy intacto.
Esperar transacciones activas, registrar revisiones/cortes, exportar evidencia segura
y reparar hacia delante; no DROP ni pérdida de operaciones posteriores. Rehabilitar
solo tras conciliación/revisión explícita. Estas propuestas NO se ejecutaron fuera
QA. Instalación productiva requiere fuente real, permisos, respaldo/restauración y
ventana autorizada; no está autorizada en este encargo.

Siguiente paso exacto: revisar este Draft y sus bloqueos de fuente con ChatGPT.
No conectar frontend ni instalar RPC productivas ni iniciar otra etapa automáticamente.

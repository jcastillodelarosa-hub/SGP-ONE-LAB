# Etapa 2A — resolvedor cuantitativo servidor, aislado

Base main: 06b1794b6d83574742f152b2873821830b41cf15 (LABv362/PR116 fusionado).
Dependencia exacta: PR117 OPEN/DRAFT, b923b2496d63de28fb562803a21474028ad88f97.
Rama feat/linea-stage2a-packing-resolver, creada desde esa referencia validada.
PR apilado contra feat/linea-stage1-operational-contracts: el diff de revisión
contiene SOLO Etapa2A. No fusionar el padre ni retargetear sin revisión.
Main avanzó al final a b228ab2977ee29fa8c3db1db2ec2c2b594e3dc2d (#118/#120),
solo app.js; el diff de este stack no lo toca. La regresión ejecutada es sobre
la base117 validada. Preservar los hotfixes recientes cuando se actualice la base.

## Implementación y frontera

src/server/packing-resolver.js implementa una referencia servidor mediante
repositorio inyectado. No es endpoint HTTP, función instalada Supabase ni módulo
integrado en frontend. No modifica Etapa1, contratos PDT, RPC legacy, importadores,
Mecanizado/Picking, reportes/descargas de vidrio, grafo, interfaces o saldos Export.
No usar evaluateServerSnapshot con JSON del navegador: es función interna de
cálculo para snapshots obtenidos por repositorio servidor confiable.
No hay adaptador productivo implementado. No se inicia Etapa2B.

## Matriz de fuentes y evidencia

| Hecho | Fuente existente / enlace | Evidencia exigida al adaptador | Estado actual |
|---|---|---|---|
| Identidad producción | sgp_producciones, key_produccion ID+línea | clave exacta y unidad de producción, sin consolidar PANEL/FRAME | código repo / contexto existente; sin lectura productiva propia |
| Ensamblado/empacado oficiales | Export diario, Ens./Emp., saldos e importador | corte inmutable con cantidades explícitas, unidad, ID/fecha y validación del dato original | falta contrato de lotes/cortes instalado |
| Ejecuciones locales | sgp_linea_plan_asignaciones/ejecuciones y motor propuesto117 | evento canónico único, etapa, delta de acumulado y correcciones, todos los turnos de la producción | existencia confirmada por propietario; cuerpos/metadatos de RPC pendientes |
| Inclusión en Export | corte + conciliación por IDs de movimiento | inclusión completa probada, no coincidencia numérica o fecha supuesta | contrato propuesto; sin adaptador real |
| Reserva/parte/orden | sgp_produccion_reservas_v, detalles/programación y relaciones existentes | tuple producción/reserva/parte verificable si el evento declara esa referencia | reutilización prevista; no repartir por reserva |
| Bloqueos Ensamble | PDT existentes, origen/estado/contrato LEGACY-V2 y asociación de etapa | conjunto de unidades concretas afectadas, revisión vigente y relación de producción | relación PDT-pieza disponible, NO equivale a relación PDT-ventana instalada |
| PDT Empaque | registro multiorigen116 | mantener evento y resolución independientes; no usar cantidad de piezas como unidades | contratos preservados, no se reescriben |
| Sesión/rol/etapa/ámbito | sesión SGP, rol REAL y relaciones autorizadas | sesión vigente, alcance de producción y etapa, privilegio por operación | adapter sintético de pruebas; autorización productiva no contrastada |

La presencia de SECURITY DEFINER no prueba autorización. Se reutiliza el inventario
Etapa1 y su PREFLIGHT_READONLY.sql preparado, sin repetir auditoría general ni
pedir tokens/credenciales. No hay herramienta Supabase autenticada disponible en
esta sesión. No se declara verificado el catálogo o datos de planta.

## Contrato servidor

Factory: createPackingResolver(repository).

- resolve(sessionId,production): calcula leyendo dentro de una transacción.
- consume(sessionId,{id,production,revision,quantity,date,shift,observation?}):
  registra una cantidad ADICIONAL elegible, no sustituye por sí solo el acumulado117.
- correctAssembly(sessionId,{id,production,revision,total,date,shift,observation}):
  corrección descendente de total ensamblado respaldada por autorización servidor.

Solo campos permitidos. No se aceptan actor, snapshot, verified, available,
unitIds ni supply del navegador. sessionId es un identificador para buscar sesión,
no una identidad confiable por sí mismo. Actor/roles/ámbito provienen de tx.session.
El repositorio de producción deberá comprobar expiración/revocación en cada llamada.

Resolver: CONSULTA/LIDER/LIDER LINEA/COORDINADOR/ADMINISTRADOR, con etapa EMPAQUE y
producción explícitamente autorizadas. Consumir excluye CONSULTA. Corregir Ensamble
exige COORDINADOR/ADMINISTRADOR con etapa ENSAMBLE y mismo ámbito; no hereda
RECEPCION->LIDER. Estos permisos son PROPUESTOS para el servicio nuevo, no evidencia
de permisos concedidos hoy. Turno cerrado rechaza hasta reapertura autorizada;
EN_REVISION exige coordinador y motivo. No se implementa otra máquina de cierres.

El contrato consume es primitivo interno para Etapa2B: el futuro comando acumulado
Etapa1 deberá calcular delta respecto del valor previo DENTRO de la misma transacción.
No llamarlo desde UI para transformar acumulados en deltas en el navegador.

Repositorio requerido: transaction(production,work), tx.session, tx.snapshot,
tx.request(id), tx.commit(expectedRevision,event,request). Debe garantizar snapshot
coherente, rollback, unicidad global de UUID, actor/solicitud vinculados e igualdad
normalizada para reintentos. Campos actor/snapshot/completitud de la fixture nunca
constituyen verificación criptográfica ni datos de producción.

## Snapshot cuantitativo requerido

production, revision, unit=UNIDAD_PRODUCCION; complete de production/cut/events/pdts/turns.
cut: id, unit, assembled, packed, inclusionComplete, includedEventIds.
events: id, production, unit, stage, delta entero con signo, referencias reserve/part
cuando corresponda. No asumir que cantidad de una RPC instalada es delta: confirmar
si es acumulado/incremento y producir eventos canónicos sin duplicar revisiones.
pdts: ID, production, origin, active, y para bloqueo mappingRevision/affectedUnitIds.
relations: relaciones canónicas; no cadenas de nombre como clave global.
unitMap cuando hay bloqueos: production, unit, revision, assembledIds, packedIds.
turns: estados actuales de cierres/revisión por etapa/fecha/turno. Ausencia de
lectura completa bloquea; no se interpreta como turno abierto.

La unidad de Export/eventos debe coincidir. No derivar ensambladas de Sale,
porcentaje vidrio, cantidad de piezas o defaults cero por dato ausente. La
materialización actual puede tener defaults: el adaptador debe validar presencia,
semántica y procedencia del corte, no solo aceptar un número almacenado.

## Cálculo y respuestas

A = ensamblado del corte + deltas ENSAMBLE NO incluidos en ese corte.
P = empacado del corte + deltas EMPAQUE NO incluidos, de TODOS los turnos.
Con cero bloqueos verificados: disponible=A-P.

Con bloqueos: se exige registro de unidades cuya cardinalidad coincida con A/P,
P subconjunto de A y revisión coincidente. Se toma unión de unidades bloqueadas,
no suma de cantidades PDT: dos pendientes sobre una unidad bloquean UNA unidad.
Disponible = unidades ensambladas menos empacadas menos unión bloqueada.
Unidades bloqueadas ya empacadas o cantidades incompatibles -> DISCREPANCY.
Un PDT activo legacy/Picking/Producción requiere impacto de etapa explícito del
servidor (NONE/BLOCKS); sin él -> UNKNOWN. No se clasifican históricos por defecto.
Un PDT de Empaque conserva su estado independiente; no se resuelve ni se convierte
al consumir. Sin relación pieza-unidad probada -> UNKNOWN, nunca conversión inventada.

READY: available>=0, assembled,packed,blocked, revision,cutId y unidad.
UNKNOWN: available=null y reason; no evidencia suficiente, no consumo.
DISCREPANCY: available=null y reason; contradicción de cantidades/identidad.
La discrepancia de este resolvedor bloquea consumo; no contradice la proyección
negativa conservada por reconcileExport de117, que sigue intacta y auditable.
Errores de autorización no entregan snapshots. Fallos inesperados de transacción
se sanitizan como SERVER_TRANSACTION_FAILED, sin diagnósticos privados.

Corrección descendente se rechaza si A posterior<P ya consumido. Si hay unidades
bloqueadas, una corrección solo de conteo no decide qué unidad física desensamblar:
requiere conciliación de unidades y por ahora se bloquea. Corte, ejecución y PDT
no se reescriben ni se resuelven automáticamente desde el resolvedor.

## Seguridad, revisiones y concurrencia

Toda modificación del conjunto de fuentes debe incrementar la revisión de
producción y participar en el mismo protocolo de consistencia: consumo, corrección,
importación Export, estado/impacto PDT y cambios de inclusión. No basta bloquear
una fila nueva si una RPC legacy o importador cambia otras fuentes sin ese lock.
Etapa2B debe demostrar coordinación con esos escritores, snapshots/aislamiento,
locks de fuentes y prevención de phantoms o invalidar/releer antes de commit.
No cambiar silenciosamente contratos legacy para simular esa garantía.

El repositorio deberá bloquear agregado producción (compartido por todos los turnos)
y luego recursos de turno/orden en orden determinista; validar revisión, evidencia,
UUID y cantidad; escribir evento/delta, consumo de unidades, nueva revisión y
respuesta idempotente en UNA transacción. CAS evita lost updates. Reintento exacto
retorna misma respuesta sin nueva ejecución; cambio de solicitud/actor con UUID
anterior rechaza. Autorización se evalúa también antes de devolver un reintento.

Memory repository serializa Promise concorrentes: verifica el contrato del servicio,
NO concurrencia PostgreSQL. lock-harness.sql y postgres-concurrency.py prueban
por separado con sesiones REALES PG17 locks/CAS/idempotencia del agregado.
El arnés no implementa el resolvedor completo, ni auth/RLS reales, ni los vínculos
PDT/Export de producción. No es migración ni RPC candidata para instalar.

## Matriz de pruebas y reproducción

| Caso solicitado | Evidencia |
|---|---|
| Empaque parcial elegible | consumo neto y lectura posterior |
| Pendiente Ensamble | unión de unidades; identidad y revisión; desconocido si falta relación |
| Pendiente Empaque independiente | estado no modificado ni usado como equivalencia de ensamblado |
| Dos turnos mismos recursos | Promise en fixture + sesiones PG reales para estrategia de lock/CAS |
| Corrección Ensamble descendente | rechazo atómico sin soporte para empacado; carrera PG con consumo |
| Reintentos | una escritura; UUID distinto contenido rechazado; carrera PG duplicada |
| Corte ya incluye ejecución | eventos de ambas etapas incluidos se excluyen del delta local |
| Incompleta/negativa | UNKNOWN/DISCREPANCY sin disponibilidad cero ficticia |
| Reservas/partes mezcladas | clave exacta y tuple; referencia ajena rechazada |
| Regresión | suite completa117 y hashes de rutas protegidas, sin modificación |

node --test tests/linea-stage2a.test.mjs
npm test
npm run verify:release
python tests/linea-stage2a/postgres-concurrency.py

El último requiere contenedor local PG17 sgp-pdt-qa-91 sin red/puertos; crea una
base QA nueva con datos ficticios. No conecta ni exporta Supabase. Evidencia JSON
en tests/linea-stage2a/evidence. No hay pruebas visuales nuevas porque no hay UI.

## Pendientes Etapa2B (NO INICIADA)

1. Revisar este PR dependiente y117; recuperar metadatos instalados ya preparados.
2. Diseñar/validar adaptador servidor real, autorización actual y unidad de medida.
3. Acordar fuente de corte/inclusión e identidad de unidades afectadas por PDT;
   si la información real no existe, continuar devolviendo UNKNOWN, no inventarla.
4. Implementar protocolo transaccional con todos los escritores relevantes y
   demostrar concurrencia completa del resolvedor/RPC en entorno autorizado.
5. Adaptar acumulados/cierres de117 solo después de comprobar estos contratos.
6. UI, migraciones/RPC productivas, fusión y Firebase requieren autorización
   posterior; nada de ello se ejecuta en Etapa2A.

PROPUESTO: contratos de repositorio/locks PostgreSQL y adaptador productivo.
IMPLEMENTADO: referencia servidor aislada y pruebas. VERIFICADO: solo evidencia
local descrita. NO APLICADO en Supabase / NO PUBLICADO / NO FUSIONADO.

## Corrección PR121 — turno explícito obligatorio

consume y correctAssembly exigen un turno existente para etapa+fecha operativa+
turno dentro del snapshot de la producción autorizada. complete.turns=true y una
lista vacía NO autorizan una mutación. Ausencia -> SHIFT_NOT_FOUND, sin evento,
consumo o cambio de revisión. No hay default ABIERTO ni creación implícita.
La autorización de sesión/rol/etapa/producción sigue siendo del servidor.

CERRADO exige reapertura autorizada. EN_REVISION conserva coordinador/administrador
+ motivo. ABIERTO válido conserva CAS, límites cuantitativos e idempotencia.
Un reintento exacto no escribe y devuelve su respuesta histórica solo si su turno
sigue explícitamente disponible y válido; no vuelve a aplicar consumo ni revisión.
El cálculo resolve es agregado por producción: READY no implica autorización para
un turno solicitado; esa comprobación adicional pertenece a cada mutación.

Fixtures positivos ahora declaran sus turnos abiertos, incluida la fecha nocturna;
no se debilitan controles para hacer pasar pruebas anteriores. Nuevos casos:
turno ausente, fecha/turno/etapa distintos, cerrado, revisión, abierto autorizado y
reintento cuyo turno desapareció. Sin cambios a SQL/PG, interfaces ni Etapa2B.

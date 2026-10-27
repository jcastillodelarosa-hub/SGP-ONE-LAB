# PR121 — checkpoint correctivo: turno explícito

Fecha Colombia: 2026-10-27T07:02:56.597510-05:00.
Rama feat/linea-stage2a-packing-resolver; mismo PR121 Draft apilado sobre117.
HEAD previo ce9d01d2dacbd2a4de805806e9b06867d569f3f4; SHA final en PR.

Consumo y corrección exigen turno explícito etapa/fecha/turno del snapshot servidor.
Ausencia (incluso lista completa vacía) -> SHIFT_NOT_FOUND sin cambios. No default
ABIERTO ni creación implícita. CERRADO exige reapertura; EN_REVISION mantiene rol
coordinador/motivo; ABIERTO mantiene CAS/seguridad/idempotencia. Reintento exacto
consulta existencia del turno, no registra otro consumo ni avanza revisión.

VERIFICADO AISLADO: 383/383 Node; 32 pruebas resolvedor (cinco nuevas), sintaxis,
verify:release LABv362 y diff. Hashes de rutas protegidas sin cambios. Fixtures
positivos declaran turnos abiertos y fecha nocturna explícitos. Evidencia domain.json.
Se reutiliza evidencia de arnés PG sin modificaciones; no se repite batería SQL.
No Supabase/frontend/legacy/vidrio/Gateway/otros repositorios. No fusión/publicación.
Etapa2B NO iniciada; adaptador productivo y fuentes reales siguen pendientes.

Siguiente paso único: revisión de ChatGPT del mismo PR121; no integrar runtime ni
iniciar Etapa2B sin autorización nueva.

---

# Etapa2A — checkpoint final de revisión

Fecha Colombia: 2026-10-27T06:49:49.071705-05:00.
Rama independiente feat/linea-stage2a-packing-resolver.
Base exacta PR117 OPEN/DRAFT b923b2496d63de28fb562803a21474028ad88f97.
Main revisado 06b1794b6d83574742f152b2873821830b41cf15 / LABv362.
PR de Etapa2A debe apuntar a la rama de117 (stack), no duplicar su implementación.
Primer checkpoint recuperable: commit b9a1a5c; SHA final en el PR de esta etapa.

IMPLEMENTADO AISLADO: src/server/packing-resolver.js; repositorio servidor como
frontera de sesión/rol/etapa/ámbito, fuentes coherentes por producción, conciliación
Export/local, cantidades por unidad de producción, unión de unidades bloqueadas
PDT y consumo/revisiones/idempotencia. Sin prueba cuantitativa devuelve UNKNOWN;
contradicciones DISCREPANCY, available=null; nunca piezas->ventanas. PDT de Empaque
independiente; legacy activo sin impacto de etapa demostrado bloquea disponibilidad.
No se aceptan snapshots/actor/flags/evidencia/unidades del navegador.
Corrección descendente no deja empacado sin respaldo; mapas activos requieren
conciliación de unidades antes de corregir. Turno cerrado exige reapertura117.

VERIFICADO LOCALMENTE: 378/378 Node (27 nuevas), sintaxis y verify:release;
protected_sha256 preserva Etapa1/runtime/vidrio/Mecanizado/PDT/Export. Tres escenarios
con sesiones REALES PG17.11 aisladas sin red/puertos prueban lock/CAS/idempotencia
como mecanismo; no equivalen a verificar el resolvedor completo en PostgreSQL.
Evidencias tests/linea-stage2a/evidence. No cambio visual, no repetir capturas.

PROPUESTO/PENDIENTE: adapter Supabase y RPC/transacciones productivas, semántica de
cantidades legacy, cuerpos/ACL actuales, inclusión de eventos en corte Export e
identidad de unidades afectadas. No hay acceso Supabase autenticado en esta sesión.
PRODUCCIÓN NO VERIFICADA; NO APLICADO, NO PUBLICADO, NO FUSIONADO. Sin UI, migraciones,
contratos legacy modificados, Gateway/GOOGLE/LAC ni Etapa2B.

La CI de Tests filtra base main; el PR apilado puede ejecutar solo Sintaxis. Las
pruebas Node completas se ejecutaron localmente; no cambiar workflows por ello.
Siguiente paso exacto: revisión de ChatGPT de este PR dependiente y117, y contrastar
las fuentes/revisiones/unidades reales antes de autorizar Etapa2B. No iniciarla.

Comprobación remota final: main avanzó a b228ab2977ee29fa8c3db1db2ec2c2b594e3dc2d
con #118/#120, cambios solo en app.js. Esta rama sigue basada en el SHA validado
b923b24 de117; su diff apilado NO modifica app.js. No se reescribe117 ni se mezclan
hotfixes ajenos. La regresión local corresponde al stack validado, no a ese main
más reciente; preservar esos hotfixes al revisar/retargetear después del padre.

---

# Etapa2A — checkpoint intermedio

Base main 06b1794b6d83574742f152b2873821830b41cf15.
Dependencia exacta PR117 Draft OPEN, b923b2496d63de28fb562803a21474028ad88f97.
Rama independiente feat/linea-stage2a-packing-resolver creada desde ese commit.
No repetir ni reescribir Etapa1; PR nuevo debe apuntar a su rama (stack).

Implementado aislado: src/server/packing-resolver.js, contrato de repositorio
servidor, resolvedor cuantitativo por producción, corte/inclusión, eventos de
ambas etapas, unidad física/bloqueos, sesión/rol/etapa/scope y mutación con CAS
idempotente. Adapter real Supabase NO implementado; nada conectado al runtime.
Memory repository es fixture transaccional, NO evidencia de concurrencia PG.

Pendiente en esta ejecución: harness SQL aislado para estrategia de locks,
documentación completa/matriz de fuentes, regresiones y checkpoint final.
Sin migraciones/RPC productivas, UI, PDT/legacy, vidrio, Gateway ni servicios.
No iniciar Etapa2B. Si se interrumpe: continuar solo esos pendientes, no integrar.

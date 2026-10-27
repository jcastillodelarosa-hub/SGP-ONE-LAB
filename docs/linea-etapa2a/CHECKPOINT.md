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

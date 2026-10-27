# Etapa1 — checkpoint de continuidad

Fecha Colombia: 2026-10-27T05:36:59.251556-05:00.
Repositorio SGP-ONE-LAB; rama feat/linea-stage1-operational-contracts.
Base main 06b1794b6d83574742f152b2873821830b41cf15, LAB v362; PR116 FUSIONADO según GitHub.
No confundir los checkpoints anteriores que dicen PR116 Draft con el estado actual.

Objetivo autorizado: arquitectura implementable, dominio aislado, pruebas y SQL
propuesto de Ensamble/Empaque. No UI, backend productivo, migraciones, publicación
ni inicio de Etapa2. No cambios GOOGLE/LAC.

Entregas: docs/linea-etapa1/CONTRATOS_Y_MODELO.md y PREFLIGHT_READONLY.sql;
src/domain/linea-stage1.js sin importación runtime; tests/linea-stage1.test.mjs;
esqueleto aditivo privado y reversión en docs/sql-proposals/linea-etapa1.
Sale por etapa, acumulado sustituible, correcciones auditadas, cierres/snapshots,
arrastres previos a cierre no aditivos, conciliación explícita con Export y
bloqueos PDT independientes. No convertir piezas PDT en ventanas.

Pruebas: 348/348 Node (20 nuevas), verify:release v362;
PG17.11 aislado sin red/puertos: instalación fallida atómica, 7 tablas RLS,
sin acceso navegador, etapas independientes y reversión vacía/con datos.
Los hashes de rutas protegidas demuestran que no se cambia app/reportes/grafo,
Mecanizado/PDT/Export. Evidencia tests/linea-stage1/evidence.

PROPUESTO: esquema y contratos RPC futuros. IMPLEMENTADO: referencia de dominio
y pruebas sintéticas. VERIFICADO: solo pruebas locales descritas; no autenticación
productiva ni carreras PostgreSQL entre RPC. NO APLICADO ni PUBLICADO.
Bloqueos: firmas/cuerpos/permisos instalados de planificación aún no accesibles;
ID/corte de Export e inclusión de eventos por conciliar; resolvedor cuantitativo
de unidades elegibles para Empaque. El esquema esqueleto NO es instalable como
motor completo: faltan RPC/locks/guards/FK y revisión del modelo existente.

Siguiente paso exacto: revisión del único PR Draft de Etapa1 y contraste de los
metadatos instalados con PREFLIGHT_READONLY.sql (solo si no se dispone ya de ese
resultado). No aplicar SQL ni continuar Etapa2 sin autorización nueva.

# PR117 — checkpoint de revisión correctiva

Fecha Colombia: 2026-10-27T06:22:23.938373-05:00.
Rama feat/linea-stage1-operational-contracts; mismo PR117 Draft.
HEAD previo revisado 4f8348c819923563376bca4488104f8496a2b8c4; SHA final en PR.

Correcciones IMPLEMENTADAS en dominio aislado:
1. CERRADO rechaza toda ejecución incluso del coordinador. REOPEN autorizado con
motivo deja EN_REVISION y conserva snapshot. Corrección exige coordinador/motivo;
CLOSE posterior del líder valida razones y crea otro snapshot sin borrar informes.
2. Conciliación conserva proyección negativa + DISCREPANCIA_SALDO. No excepción,
recorte a cero o alteración del Export. Sin mapeo: SIN_CONCILIAR/proyección NULL.
3. Resolvedor cuantitativo de Empaque NO IMPLEMENTADO. Flags de evidencia son
sintéticos/trusted input de prueba, nunca prueba del navegador. Runtime prohibido.

VERIFICADO LOCALMENTE: 351/351 Node, 23 pruebas de dominio, verify:release LABv362,
sintaxis/diff y hashes de rutas protegidas. Evidencia domain.json actualizada.
DDL aislado anterior sin cambios: no se repite su batería; sin cambio visual.
No RPC/migraciones/Supabase/UI/reportes de vidrio/Gateway/producción ni Etapa2.
NO APLICADO, NO PUBLICADO, NO FUSIONADO.

Siguiente paso exacto: revisión final de ChatGPT del mismo PR117. No iniciar
Etapa2 ni conectar dominio al runtime sin nueva autorización y resolvedor servidor.

---

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

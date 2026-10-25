# SGP_ONE — CHECKPOINT OPERATIVO (Continuity v2.1)

Fecha de conciliación: 2026-10-22 (fecha documental; comprobar fecha/hora de GitHub al recuperar)
Repositorio: `jcastillodelarosa-hub/SGP-ONE-LAB`
Rama oficial: `main`

## Cómo recuperar sin confundir el commit con el contenido
El SHA del commit que escribe este archivo se genera **después** de guardar. No exigir que el checkpoint contenga su propio SHA. Verificar el HEAD real, historial del archivo, SHA de contenido y PR relevantes desde GitHub. El último HEAD comprobado **antes** de esta conciliación es `e1b78f914f0f9b9889de15fd04e9b8325a1b65e9`; NO asumir que siga siendo HEAD.

## Hitos fusionados comprobados (código en main; no implica despliegue)
- PR #44 — Planificador Ensamble LAB v327; commit `6d72f7232cfc6217d7def47500ea2e1007a73ebc`.
- PR #47 — mejoras visuales Planificador/Ensamble/Empaque LAB v327; commit `3b9eadee45e0fe46933c3f5829ff2ece790cceb0`.
- PR #48 — reserva principal en prioridades; commit `0a00d0a847015d0a6f7870a1c33a6f6800754a09`.
- PR #49 — selección y programación desde explorador v328; commit `e6863b72e22c4133362179377bd5c0612fd298ed`.
- PR #50 — conexión Planificador–Programación de Línea v329; commit `114a003c721c915d044a1bbc3a1c5a473501b322`.
- PR #51 — protocolo documental Continuity v2; commit `bd1d603aec481d2909d87c0a5d83f4a0f9a2df1f`.
- Commit `e1b78f914f0f9b9889de15fd04e9b8325a1b65e9` — primera conciliación del checkpoint tras PR #51.

## Versiones y estados, sin inferencias
- `index.html` en main referencia `styles.css?v=327` y `production-line-visual-v327.css?v=1`. Estas son **versiones de recursos visuales**, no un indicador exhaustivo de todas las funcionalidades.
- Funcionalidades v328 y v329: **FUSIONADAS EN MAIN** según PR #49 y #50. No afirmar que la aplicación completa esté publicada o validada en producción.
- `SGP_ONE_MASTER_CONTEXT.md` conserva snapshot de 2026-10-19 (LAB v281/backend v282); es **histórico**, no estado ejecutivo actual.
- `SGP_ONE_ESTADO_ACTUAL.md` es historial con entradas de distintas fechas; sus menciones de trabajos pendientes deben cotejarse con PR posteriores.
- Supabase: el historial documenta RPC `sgp_linea_plan_explorador_v327` aplicada; **no se consultó Supabase vivo en esta conciliación**.
- Firebase Hosting: **despliegue actual no comprobado**.
- PC/móvil: **aceptación funcional del Planificador v327/v328/v329 no comprobada**.

## PR abiertos observados
#46 hotfix v327; #34 CI Firebase; #22 reprogramación/vidrio; #14 cantidad móvil; #6 documentación Skills; #1 Picking/programación. No fusionar sin comparar con main; una rama antigua puede contener cambios ya integrados por otros PR.

## Prueba de continuidad
- Recuperación desde conversación nueva: **SUPERADA** en lectura de documentos, Skills, HEAD y PR; el usuario reportó resultado global **PARCIAL** por desactualización del checkpoint.
- Conciliación documental v2.1: esta edición corrige hitos y criterio de SHA. Verificar el commit de escritura y relectura de main tras guardar.
- Automatización de checkpoints: **NO autónoma**. En cada hito autorizado, escribir, verificar y reportar el commit; si no hay permiso de escritura, entregar texto en chat.

## Alcance de esta operación
Autorizado: conciliación documental del checkpoint y referencias ejecutivas obsoletas. Prohibido: modificar lógica de aplicación, Supabase, Firebase, SGP_ONE_GOOGLE, desplegar o fusionar PR.

## Hito documental posterior — Design Engineering (2026-10-22)
- Skill original SGP `.agents/skills/design-engineering/SKILL.md` creada en main, inspirada en fuentes públicas de Emil Kowalski; **no equivale a instalar una skill oficial en ChatGPT**.
- Orchestrator actualizado para consultar esta skill en solicitudes de interfaz, tablas, animaciones y móvil, tras recuperación de continuidad.
- Estado: **DOCUMENTACIÓN EN MAIN**; no se modificó HTML/CSS/JS operativo, Supabase, Firebase ni SGP_ONE_GOOGLE. No se han ejecutado pruebas funcionales de la aplicación por este cambio.
- Comprobar contenido y SHA del archivo en GitHub en el siguiente chat antes de aplicar recomendaciones.

## Siguiente paso único
Realizar una **prueba de recuperación de solo lectura** desde otro chat: comprobar que Orchestrator encuentra y consulta Design Engineering para una solicitud de diseño SGP; verificar GitHub main y no cambiar código.

---

## 2026-10-24 — Cierre de implementación SGP_ONE LAB v348

- **Proyecto:** SGP_ONE (SGP-ONE-LAB), distinto e independiente de SGP_ONE_GOOGLE.
- **Base verificada:** main merge e6247b761ec14a7efc80951aa767a565daad83fe; PR #82 fusionado por squash. UI index.html LAB v348.
- **Objetivo:** estado de programación SÍ/NO independiente de estado operativo; estados SIN INICIAR, CORTE, MECANIZADO, PROCESADO; Continuar programación parcial; preservar reprogramaciones, reservas compartidas y Picking.
- **Backend:** migración lab_v348_programada_independiente versión Supabase 20261024154023 APLICADA. Previamente se ensayaron migración y reversión en transacción con ROLLBACK. Script de reversión: docs/programada-sin-iniciar-v348-rollback.sql.
- **Evidencia posmigración:** 68 programaciones: 65 SIN INICIAR y 3 CANCELADA; indicador programada 65 true y 3 false sin inconsistencias. Ejecución por orden 11 SIN INICIAR, 2 CORTE, 128 PROCESADO, 5 REPROGRAMADO. Ejecución general 8 CORTE, 2 MECANIZADO, 41 PROCESADO. Historial por orden 283 registros, conservado.
- **Tests:** CI main e6247b7: SGP ONE Tests run 40108179487 SUCCESS (195/195), JavaScript syntax check 40108179523 SUCCESS, verificación paquete release LAB v348. Prueba SQL con sesión falsa rechazada sin escribir historial.
- **Firebase:** workflow Deploy SGP ONE to Firebase Hosting 40108179480 SUCCESS; paso Firebase Hosting SUCCESS, canal live, proyecto sgp-one-lab, versión Hosting bba8e9e940aefd72, URL publicada https://sgp-one-lab.web.app/.
- **Límites:** no se pudo abrir el sitio publicado mediante la herramienta de navegación externa; no se dispone de sesión real de planta. Los flujos autenticados, pruebas visuales PC/móvil y acceso desde red de planta NO están funcionalmente verificados; despliegue exitoso no equivale a esa aceptación.
- **Estado preciso:** IMPLEMENTADO, FUSIONADO MAIN, APLICADO EN SUPABASE y PUBLICADO FIREBASE; PRUEBAS AUTOMATIZADAS Y ENSAYOS SQL SATISFACTORIOS; ACEPTACIÓN OPERATIVA PC/MÓVIL/PLANTA PENDIENTE.
- **Próximo paso único:** validar en navegador autenticado que una reserva parcial muestra Continuar, que una nueva programación aparece como SIN INICIAR y que las etapas, arrastre y Picking preservan las reglas existentes; registrar evidencias sin alterar SGP_ONE_GOOGLE.


## Handoff PDT aluminio 2026-10-24
- PR #91, rama feat/pdt-multifabricacion-avances-nc, baseline main d07894f6.
- Alcance: multi NC, correccion de cantidad y fabricaciones, movimientos parciales, avisos REPO OK derivados.
- Autorizado: rama, PR y pruebas no destructivas. Sin cambios Supabase, fusion ni publicacion.
- Estado: reglas y borrador SQL documentados; RPC e interfaz pendientes.
- Siguiente paso: contratos RPC versionados y pruebas sin aplicar SQL.


## Continuidad PDT 2026-10-24 — avance PR #91
- Rama feat/pdt-multifabricacion-avances-nc; cambios en app.js: REPO_OK ya no seleccionable manualmente; conserva visualizacion de valores historicos. Entrada NC multiples explicita; busqueda individual existente no se presenta como verificacion multiple.
- Funciones puras de saldos, estado NC y cierre por Picking con pruebas escritas, aun no ejecutadas.
- No se han creado ni aplicado RPC; migracion SQL sigue en borrador. Sin cambios a Supabase, main ni Firebase.
- Riesgo: frontend de validacion multifabricacion y avances no conectado a backend; no declarar implementacion completa.
- Proximo paso: completar contrato RPC seguro, integrar UI y ejecutar pruebas; pedir autorizacion separada antes de aplicar SQL.


## 2026-10-24 — Autorización ampliada y bloqueo técnico PR #91
- Usuario autorizó cambios necesarios; no confundir autorización con pruebas superadas.
- Supabase producción inspeccionada solo con SELECT; proyecto ocvxbwzqxbrfndkvjmfx. Se comprobó que sgp_aluminio_pendiente_validar permite ADMINISTRADOR/COORDINADOR/LIDER LINEA/SUPERVISOR DE PICKING, pero no RECEPCION. sgp_validar_sesion_rol tiene equivalencia RECEPCION solo cuando se solicita LIDER, no cuando se solicita LIDER LINEA.
- Archivo supabase/migrations/20261024_pdt_rpc_contracts_REVIEW.sql preparado con RPC de validación multifabricación y avance parcial; **NO APLICAR**: la RPC propuesta delega en el validador antiguo, que rechaza RECEPCION. Debe extraerse comprobación equivalente a función interna segura, sin ampliar permisos involuntarios.
- Otros pendientes de revisión: fecha operativa/turnos, NC múltiples, reversión de movimientos, cierre Picking, RLS/grants, migración histórica, pruebas de SQL y de navegador.
- Estado: PROTOTIPO DE CONTRATOS EN RAMA; NO APTO PARA DESPLIEGUE. No hubo migración, merge ni Firebase deploy.

## Handoff local PR #91 — fases PDT A/B (2026-10-25)

- Rama local `feat/pdt-multifabricacion-avances-nc`, HEAD sin cambio
  `4f486b8e90a40c4f0f4daaa2e16b0aa158e09f49`. Cambios SIN COMMIT NI PUSH.
- Contrato LEGACY/V2 explícito, UUID/snapshot de detalle, avances/reversos/NC,
  adaptador y modal por capacidades; SQL fuera de migraciones automáticas.
- Fase A mantiene cierre v2 deshabilitado y preserva cierre legacy; fase B separada
  incorpora registro positivo, validación, asignación y cierre cuantitativo.
- Evidencia: tests JS, PostgreSQL 17 sin red con fixtures sintéticas y controlador
  Chromium PC/móvil con RPC simuladas; resultados y comandos en
  `docs/sql-proposals/pdt/README.md`.
- NO equivale a restauración de Supabase, prueba de sesiones SGP reales,
  aplicación productiva, integración a main o despliegue Firebase.
- Próximo paso: revisión de diff y contraste de firmas/esquema reales antes de
  autorizar transferencia o aplicación. Preservar protección Hosting de PR #92.

## Consolidación autorizada PR #91 — 2026-10-25

- Propietario autorizó commits, push exclusivamente a la rama existente y actualizar
  el PR #91; no autorizó merge, SQL productivo ni Firebase.
- Base local anterior a consolidación: `4f486b8e90a40c4f0f4daaa2e16b0aa158e09f49`;
  main remoto comprobado `db70f601cc01a470a6a3908cae19caac59dfe34b`.
- Revalidación: 222 pruebas JS; 35 aserciones SQL sintéticas; seis escenarios
  concurrentes; controlador Chromium PC/móvil; release y sintaxis aprobados.
- Revisión de workflows: push a esta rama no publica Firebase; solo CI del PR.
  Pages has_pages=false. No cambios a firebase.json ni workflows.
- Revisados archivos nuevos y diff: sin credenciales privadas detectadas; fixtures
  usan roles/tokens sintéticos. SQL REVIEW fuera de migraciones automáticas.
- Estado de entrega: IMPLEMENTADO EN RAMA; comprobar SHA final con Git/GitHub.
  No APLICADO EN SUPABASE, no PUBLICADO ni VERIFICADO EN PRODUCCIÓN.
- Siguiente paso: revisión técnica de PR #91 y contraste con definiciones reales,
  antes de solicitar cualquier aprobación de aplicación, integración o publicación.

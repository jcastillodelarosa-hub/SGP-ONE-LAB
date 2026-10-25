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

## Preparación local: rol real PDT v2 — 2026-10-25

- HEAD sigue d90d850f2a8ee7d1a111a71073e93a63f04fbac1, cambios SIN COMMIT/PUSH.
- Avances/reversos/etapas requieren rol exacto de sgp_sesion_actual; helper legacy
  y equivalencia Recepción→Líder permanecen intactos. No modifica permisos legacy.
- SQL aislado sintético: 37 aserciones base, 26 regresiones, seis concurrencias.
- Conservada corrección AUDITADA_DIFERENCIA; únicamente VALIDADA acredita entrega.
- Contrato real de sesión y cuerpos completos de funciones aún requieren contraste;
  no hay prueba de autenticación productiva. No SQL productivo, merge ni despliegue.
- Siguiente paso: revisar este diff y contrastar el resultado del preflight real;
  no autorizar instalación por resultados de mocks.

## Cierre autónomo de preparación PDT — 2026-10-25

- Cambios locales preservados; HEAD d90d850f2a8ee7d1a111a71073e93a63f04fbac1.
- Informe único: docs/sql-proposals/pdt/FINAL_READINESS.md.
- 222 JS, 63 SQL sintéticos, seis concurrencias, 12 unitarias de herramientas;
  instalación atómica/fallo inducido, navegador PC/móvil y recuperación de fixture aprobados.
- Dump/restauración comprobada SOLO en fixture sintética, no respaldo de Supabase.
- Bloqueos: falta JSON/cuerpos productivos completos, réplica compatible y prueba
  de autenticación/recuperación productiva. No inventar definiciones 6/8 ni triggers.
- Próximo paso único: propietario ejecuta preflight SQL actualizado y aporta JSON.
- Sin commits/push nuevos, SQL productivo, merge ni Firebase; no tocar otros repositorios.

## Contraste con complemento confirmado — 2026-10-25

- Resultado PARCIAL. Local PostgreSQL 17.11 coincide con versión comunicada.
- Fixture de sgp_sesion_actual incorpora valida/usuario/nombre/rol; 63 SQL y seis
  concurrencias se mantienen, con rollback/instalación AB probados nuevamente.
- Confirmación del propietario: 3 triggers, 19 columnas, 5 extensiones y 7 firmas
  con MD5. No hay artefacto de sus cuerpos/valores en adjuntos ni comentarios PR.
- Siguiente paso único: hacer accesible el export existente, sin repetir SQL.
- FINAL_READINESS.md actualizado; cambios conservados sin commit/push ni producción.

## Evidencia real recibida e integrada — 2026-10-25

- Los dos archivos reales están en scripts/pdt-compatibility/evidence/ sin modificar.
- Siete MD5 coinciden tras CRLF→LF; cuatro del complemento reconstruido coinciden
  directamente. Se mantiene expresamente su procedencia reconstruida.
- 19 columnas y tres triggers reales reproducidos en PostgreSQL 17.11.
- Pruebas con autenticación real por hash: 63 base + 21 adicionales, seis concurrencias;
  fallo transaccional revierte DDL y las 11 definiciones. Dos entregas intactas.
- Bloqueo anterior de archivos RESUELTO. Incompatibilidad confirmada: defaults
  solapados hacen ambigua la llamada legacy de seis argumentos antes/después del PR.
- Retirar defaults requiere DROP/CREATE; intento CREATE OR REPLACE rechazado en QA
  y retirado del SQL propuesto. No se introdujo DROP ni cambio unilateral legacy.
- FINAL_READINESS.md actualizado: PARCIAL para integración final, no producción.
- Siguiente paso único: revisión/aprobación de solución delimitada a sobrecarga 6/8.
- HEAD sigue d90d850f2a8ee7d1a111a71073e93a63f04fbac1; sin commit/push, merge o despliegue.

## Consolidación final autorizada PR #91 — 2026-10-25

- Estado vigente: IMPLEMENTADO EN RAMA; reemplaza los bloqueos históricos anteriores.
- Main observado db70f601cc01a470a6a3908cae19caac59dfe34b; rama existente
  feat/pdt-multifabricacion-avances-nc. El commit de esta entrada consolida el trabajo
  pendiente sobre d90d850f2a8ee7d1a111a71073e93a63f04fbac1, con commit/push autorizados.
- Fuentes reales conservadas y 11/11 MD5 contrastados; complemento reconstruido.
- Compatibilidad 6/8 resuelta en aislamiento con traslado del original a esquema
  privado, entrada pública sin defaults solapados y recuperación sin DROP.
- 222 JS, 63 + 24 SQL, seis concurrencias, 12 Python, seis HTTP y PC/móvil aprobados;
  instalación atómica, rollback inducido y dump/restore/reinstalación QA comprobados.
- Informe y evidencia: docs/sql-proposals/pdt/FINAL_READINESS.md y
  scripts/pdt-compatibility/validation-report.json.
- No Supabase productivo, merge, Firebase, main, GOOGLE ni LAC modificados.
- Límites: dependencias DDL parcialmente reconstruidas; consumidores externos y
  catálogo íntegro/RLS productivos no verificados; no backup productivo recuperable.
- Próximo paso único: revisión PR #91 y autorización separada de réplica restaurada
  para aceptación final. No repetir consultas ya aportadas ni asumir publicación.

## Metodología y demostración PDT v2 — 2026-10-25

- Regla vigente: necesidad → implementación → demostración → correcciones → cierre.
  AGENTS.md y las diez Skills priorizan evidencia reutilizable y pruebas proporcionales.
- Trabajo en feat/pdt-multifabricacion-avances-nc, PR #91; base local 51d77d9a8666f2ede30afc6ca054d5b97bdc516b.
- Demo local: `python tests/pdt-demo/start.py`, abrir http://localhost:8765 en el
  mismo PC. PostgreSQL/PostgREST QA con datos ficticios, controlador y RPC reales.
  No usar este localhost como enlace público del entorno de Codex.
- Recorridos: 5+4, avance parcial/reverso, NC múltiples; entrega positiva,
  validación, acreditación y cierre de PDT dentro de orden parcial.
- Recorrido nuevo de demo APROBADO en Chromium PC/móvil con RPC QA reales:
  distribución, avance/reverso, NC, cierre prematuro rechazado y cierre con evidencia
  dentro de orden parcial. Rutas internas y Origin externo rechazados.
  Pruebas anteriores reutilizadas: SQL/operación no modificados.
  Evidencia: tests/pdt-demo/demo-smoke-report.json y screenshots/.
- Bloqueo externo: GitHub API 401 Bad credentials y Git HTTPS sin credenciales
  en esta sesión. No afirmar que PR/remote fueron actualizados sin comprobarlo.
- No SQL productivo, merge, publicación, main, GOOGLE ni LAC modificados.
- Próximo paso: abrir la demo local; restablecer la integración GitHub para
  transferir el commit de esta entrega al PR existente, sin otro PR ni despliegue.

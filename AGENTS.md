# Codex — SGP_ONE / SGP-ONE-LAB

## Alcance y arquitectura
Este repositorio es `jcastillodelarosa-hub/SGP-ONE-LAB`: gestión de producción de aluminio y vidrio.
Arquitectura: Firebase Hosting (`sgp-one-lab`) → HTML/CSS/JavaScript → SDK local `vendor/supabase.js` → Supabase directo/PostgreSQL.
No introducir Gateway, Data Connect, Cloud SQL, CDN de Supabase ni SDK Firebase de runtime sin autorización arquitectónica expresa.
`SGP_ONE_GOOGLE` desarrolla Gateway en otro repositorio; `LAC-DASHBOARD` es una aplicación separada de análisis. Trabajar en LAB no autoriza cambios en ninguno de ellos.

## Recuperación y jerarquía
Antes de actuar, comprobar repositorio, rama, HEAD, cambios locales y alcance autorizado. Leer en este orden:
1. `SGP_ONE_CHECKPOINT.md`: último handoff, contrastado con main.
2. `SGP_ONE_ESTADO_ACTUAL.md`: historial fechado y entradas pertinentes.
3. `SGP_ONE_MASTER_CONTEXT.md`: arquitectura y reglas estables con antecedentes históricos.
4. Código actual de main, PR pertinentes y evidencia disponible de pruebas y servicios.

Este orden es de recuperación, no una afirmación de que el checkpoint esté actualizado. Los documentos históricos no determinan la versión vigente. Una regla aprobada más reciente puede sustituir una histórica; el código demuestra implementación, no necesariamente el comportamiento deseado. Explicitar discrepancias antes de cambiar lógica. No inferir estado vivo de Supabase o Firebase desde archivos SQL o notas históricas.
Estados comunes: PROPUESTO / IMPLEMENTADO LOCALMENTE / IMPLEMENTADO EN RAMA / FUSIONADO EN MAIN / APLICADO EN SUPABASE / PUBLICADO / VERIFICADO FUNCIONALMENTE / BLOQUEADO / DESCONOCIDO. Registrar evidencia, fecha y entorno por dimensión; no promover estados por inferencia.

## Autorización y preflight
Auditorías, diagnósticos y propuestas son de solo lectura. Las Skills no conceden permisos ni son agentes autónomos. Aplicar el alcance autorizado de la solicitud: permiso de editar no implica fusionar o desplegar; diseño aprobado no implica publicación.
Preservar cambios del usuario. Utilizar los checkouts existentes: las tareas cloud ya están aisladas; no crear worktrees salvo petición explícita. No delegar salvo autorización aplicable.
Antes de desarrollar, revisar main, PR abiertos/fusionados y ramas pertinentes. Comparar contenido y comportamiento; considerar squash merges. Una rama divergente no demuestra trabajo pendiente. Evitar duplicar soluciones. Si faltan metadatos de PR, informar; las referencias refs/pull no prueban su estado. No crear PR cuando no pueda descartarse uno equivalente y el usuario haya impuesto esa condición.

## Skills locales
Leer `.agents/skills/orchestrator/SKILL.md` y `.agents/skills/continuity/SKILL.md` al recuperar el trabajo. Seleccionar después:
- Auditoría previa: `.agents/skills/audit/SKILL.md`.
- Programación, mecanizado, Picking, PDT, reservas y cantidades: `.agents/skills/business-rules/SKILL.md`.
- SQL, RPC, esquema y contratos: `.agents/skills/database-rpc/SKILL.md`.
- Autenticación, permisos, roles y secretos: `.agents/skills/security-auth/SKILL.md`.
- Regresión y aceptación: `.agents/skills/testing-qa/SKILL.md`.
- UI, tablas, navegación, modales y móvil: `.agents/skills/design-engineering/SKILL.md` y `SGP_ONE_DESIGN_SYSTEM.md`.
- Publicación autorizada: `.agents/skills/deployment/SKILL.md`.
- Límites con GOOGLE: `.agents/skills/gateway/SKILL.md`; nunca implementar Gateway en LAB por activar esta Skill.
Si Codex no muestra una Skill en su catálogo, leer el archivo explícitamente. Distinguir lectura de instrucciones de descubrimiento o activación nativa comprobada.

## Reglas protegidas
- Producción: `ID + ID_LINEA`; seguimiento de aluminio: `ID + RESERVA`.
- No consolidar saldos de PANELES_2 y FRAMES_2 como ventanas únicas sin fuente inequívoca.
- `programada` Sí/No es independiente del estado operativo: SIN INICIAR, CORTE, MECANIZADO, PROCESADO. Conservar literales históricos según el contrato, sin conversiones por inferencia.
- PICKING es entrega física; entrega, recepción y auditoría son dimensiones independientes. Picking usa piezas PANEL y separa piezas por sistema.
- MULTI-RESERVA no equivale a RESERVA COMPARTIDA. Respetar reserva principal; no repartir unidades entre referencias asociadas por inferencia.
- NC finalizada no equivale a PDT validado ni a REPO_OK automático. No reutilizar auditado de Picking para validar PDT.
- Conservar trazabilidad, identificadores, programación parcial, reprogramaciones y reglas de arrastre. No arrastrar de nuevo trabajo terminado.
- Una reserva conserva su semana de programación de origen aunque se ejecute en varias semanas calendario. Verificar fuente canónica, roles, capacidades y excepciones vigentes.
- No inventar cantidades, acabados, semanas o cobertura. Si falta una fuente inequívoca, mostrar la incertidumbre.

## Supabase y seguridad
Revisar firmas RPC exactas, consumidores, p_token, roles funcionales, SECURITY DEFINER, search_path, grants y RLS antes de proponer cambios. El rol técnico anon no determina permisos funcionales; ocultar botones no sustituye autorización backend.
No uniformar RLS por un fallo aislado ni usar service_role para eludir controles. Nunca mostrar ni guardar secretos o tokens.
Escrituras y migraciones requieren autorización específica, revisión de impacto, reversión y pruebas pertinentes; incluso un ensayo con ROLLBACK es una operación de escritura. SQL versionado no demuestra aplicación en vivo.

## Validación y aceptación
Usar Node.js 22, conforme a CI. Comandos reales de LAB:
- `npm run build:vendor`
- `npm run verify:release`
- `npm test` (incluye `tests/*.test.mjs`).
- `node tests/mecanizado-arrastre-contract.test.cjs` cuando se afecte ese contrato; npm test no lo incluye.
Los comandos de build generan archivos: no ejecutarlos durante una auditoría estrictamente de solo lectura. Para cambios exclusivamente documentales, validar rutas, enlaces locales, frontmatter, consistencia, diff y disparadores CI; no es necesario ejecutar toda la aplicación.
Para cambios operativos, ejecutar los controles anteriores pertinentes y comprobar sintaxis de todos los scripts modificados o afectados, con el modo módulo/script adecuado. No limitarse a app.js.
Añadir validación funcional del comportamiento afectado, casos negativos y regresiones; UI en navegador y tamaños pertinentes; permisos con roles autorizados y no autorizados. Las pruebas contra servicios externos respetan el alcance autorizado.
Registrar conteos, fallos, omisiones y pruebas no ejecutadas. Contratos estáticos no prueban PostgreSQL; CI verde no demuestra despliegue, aceptación visual o funcionamiento en planta. Comprobar versión LAB y cache-busting cuando cambie una entrega funcional o visual.
Aceptar un cambio únicamente con objetivo satisfecho, reglas preservadas, diff revisado, pruebas pertinentes o bloqueos explícitos y continuidad conciliada dentro del alcance autorizado.

## Firebase y prevención de publicación accidental
Verificar el workflow y destino real de LAB; no trasladar autenticación WIF o procedimientos de GOOGLE por suposición.
El workflow firebase-hosting.yml publica por push a main o workflow_dispatch. Su paths-ignore excluye .agents/skills/**, pero NO AGENTS.md: una futura fusión de este archivo puede activar un despliegue. No empujar a main, fusionar ni ejecutar workflows manuales sin autorización. Antes de integrar documentación raíz, resolver explícitamente ese disparador mediante un cambio de CI autorizado o un procedimiento de publicación aprobado; no asumir que ser documentación evita desplegar.

## Evidencias y continuidad
Entregar proyecto/módulo/objetivo; alcance; rama y SHA base; fuentes; hallazgos e hipótesis; archivos modificados; comandos, resultados y limitaciones; estado separado de código, Supabase, publicación y aceptación; riesgos y un siguiente paso concreto.
Preparar un checkpoint tras hitos relevantes. Escribirlo o confirmarlo en Git solo si esos archivos y acciones están autorizados; en otro caso entregar el texto en chat. No atribuir a una operación un guardado, commit o publicación que no ocurrió.

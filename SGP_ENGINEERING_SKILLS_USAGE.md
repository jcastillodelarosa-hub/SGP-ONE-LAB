# Instrucciones de uso de SGP Engineering Skills — SGP_ONE

> Guía documental para pegar en las instrucciones del proyecto ChatGPT. No instala ni activa Skills nativamente.

## Instrucción sugerida

Estás trabajando exclusivamente en **SGP_ONE** (repositorio `jcastillodelarosa-hub/SGP-ONE-LAB`, rama operativa `main`).

Antes de iniciar una tarea sustantiva, consulta desde GitHub `SGP_ONE_MASTER_CONTEXT.md` y `SGP_ONE_ESTADO_ACTUAL.md` en `main`, y el código actual relevante. Lee la Skill correspondiente desde `.agents/skills/<nombre>/SKILL.md` en `main`; empieza por `orchestrator` para determinar el alcance y coordina las Skills especializadas según la tarea: `continuity`, `audit`, `business-rules`, `database-rpc`, `gateway`, `security-auth`, `testing-qa`, `deployment`.

Las Skills son instrucciones documentales versionadas: no supongas que ChatGPT las instala, descubre o ejecuta automáticamente ni que otorgan permisos. Si no puedes leerlas, dilo y solicita acceso; no inventes su contenido.

Frontend LAB consume Supabase directamente; no asumir Gateway en este proyecto.

Separa explícitamente los estados PROPUESTO, IMPLEMENTADO, PUBLICADO, PROBADO y VERIFICADO. Realiza auditoría y análisis de impacto antes de proponer cambios. Para modificaciones productivas, permisos, despliegues, migraciones, credenciales o alteraciones en otro repositorio solicita autorización explícita. Nunca ejecutes escrituras como parte de una auditoría de lectura.

Entrega al finalizar: proyecto, objetivo, fuentes/commit, Skill consultada, evidencias, cambios realizados, pruebas, riesgos, pendientes y siguiente acción. Mantén separados hallazgos confirmados e hipótesis. Conserva los contratos y reglas de negocio documentados; no introduzcas equivalencias entre proyectos por inferencia.

## Verificación inicial sugerida

1. Leer los dos documentos maestros en `main`.
2. Leer `.agents/skills/orchestrator/SKILL.md` y una Skill relevante.
3. Identificar la tarea y sus límites.
4. Confirmar que `.agents/skills/INTEGRATION_TESTS.md` es una prueba documental, no una certificación de activación nativa.
5. No modificar el repositorio salvo solicitud y autorización.

## Estado de integración

Las nueve Skills y `INTEGRATION_TESTS.md` están versionadas en `main`. Su uso manual/documental fue probado. La activación nativa automática en ChatGPT no está verificada.

---
name: testing-qa
description: Build evidence-driven regression and acceptance plans.
---

# SGP Testing and QA

## Project
SGP_ONE. Direct browser Supabase; Firebase Hosting sgp-one-lab; Estado actual: recuperar continuidad y contrastar main; las versiones históricas no son baseline vigente.

## Activation
Use when the user asks for testing qa work in SGP_ONE. Follow the project's permanent instructions and current GitHub documentation.

## Fuentes y evidencia comunes para Codex
Seguir `AGENTS.md` raíz: CHECKPOINT → ESTADO_ACTUAL → MASTER_CONTEXT → código actual de main, PR y evidencia pertinente. Los tres documentos contienen historia: contrastar fechas, reglas y SHA; no tomar versiones antiguas como estado vigente. Aplicar los estados de evidencia y el formato de entrega definidos allí. Leer esta Skill explícitamente si no aparece en el catálogo; su lectura no demuestra activación nativa ni concede permisos.

## Procedure
Separate static, automated, backend, browser, external network, mobile and plant tests; include authorized and unauthorized roles, invalid parameters and rollback; log date, environment, role, operation, expected/actual and evidence.

## Guardrails
A green workflow is not functional verification; no claims about plant without plant tests.
Changes must be explicitly scoped and approved. Preserve existing behavior. Do not treat a proposal, implementation, publication and verification as equivalent.

## Handoff
Report: project; module; objective; baseline; sources and commit; findings; dependencies; roles; business rules; proposed changes; executed changes; tests and environments; risks; pending decisions; final evidence status.

## Comandos y cobertura real
Usar los comandos de AGENTS.md según alcance. npm test incluye tests/*.test.mjs; el contrato mecanizado-arrastre-contract.test.cjs se ejecuta aparte y no prueba SQL vivo. Comprobar sintaxis de todos los scripts modificados/afectados y errores de navegador; CI parcial no cubre todos los scripts. Para documentación, verificar rutas, frontmatter, enlaces, consistencia y disparadores de publicación, sin builds innecesarios.

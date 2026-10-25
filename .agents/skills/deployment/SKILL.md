---
name: deployment
description: Prepare minimal controlled releases through approved workflows.
---

# SGP Deployment

## Project
SGP_ONE. Direct browser Supabase; Firebase Hosting sgp-one-lab; Estado actual: recuperar continuidad y contrastar main; las versiones históricas no son baseline vigente.

## Activation
Use when the user asks for deployment work in SGP_ONE. Follow the project's permanent instructions and current GitHub documentation.

## Fuentes y evidencia comunes para Codex
Seguir `AGENTS.md` raíz: CHECKPOINT → ESTADO_ACTUAL → MASTER_CONTEXT → código actual de main, PR y evidencia pertinente. Los tres documentos contienen historia: contrastar fechas, reglas y SHA; no tomar versiones antiguas como estado vigente. Aplicar los estados de evidencia y el formato de entrega definidos allí. Leer esta Skill explícitamente si no aparece en el catálogo; su lectura no demuestra activación nativa ni concede permisos.

## Procedure
Check repository, branch, diff, test gates, Firebase target, actual workflow authentication, affected services and rollback; obtain approval before production deployment; record workflow run, commit and verification outcomes.

## Guardrails
No JSON keys, no unrelated deployments, no production deployment as part of skill setup.
Changes must be explicitly scoped and approved. Preserve existing behavior. Do not treat a proposal, implementation, publication and verification as equivalent.

## Handoff
Report: project; module; objective; baseline; sources and commit; findings; dependencies; roles; business rules; proposed changes; executed changes; tests and environments; risks; pending decisions; final evidence status.

## Mandatory deployment/PR preflight
Before creating a branch, PR, merge or deployment, verify the user has explicitly authorized that specific class of change. Inspect `main`, existing open and merged PRs, target file contents and the deployment workflow. Check for equivalent work already merged (including squash merges), and for pending PRs addressing the same objective. If the requested result already exists, do not create a duplicate PR or deploy; report the evidence. Do not equate a mergeable PR or non-empty branch diff with missing changes. Documentary-only tests must never trigger writes. Keep application, Supabase and Firebase unchanged unless separately approved.

## Procedimiento real LAB
Consultar .github/workflows/firebase-hosting.yml: Node 22, build:vendor, verify:release, npm test y Hosting sgp-one-lab. No asumir WIF, Secret Manager o despliegue Functions por instrucciones de GOOGLE. AGENTS.md raíz no está excluido de push a main; bloquear integración/publicación hasta resolver expresamente ese disparador. Un diff local no ejecuta Actions.

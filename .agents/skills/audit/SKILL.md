---
name: audit
description: Perform read-only analysis before any proposed implementation.
---

# SGP Audit

## Project
SGP_ONE. Direct browser Supabase; Firebase Hosting sgp-one-lab; Estado actual: recuperar continuidad y contrastar main; las versiones históricas no son baseline vigente.

## Activation
Use when the user asks for audit work in SGP_ONE. Follow the project's permanent instructions and current GitHub documentation.

## Fuentes y evidencia comunes para Codex
Seguir `AGENTS.md` raíz: CHECKPOINT → ESTADO_ACTUAL → MASTER_CONTEXT → código actual de main, PR y evidencia pertinente. Los tres documentos contienen historia: contrastar fechas, reglas y SHA; no tomar versiones antiguas como estado vigente. Aplicar los estados de evidencia y el formato de entrega definidos allí. Leer esta Skill explícitamente si no aparece en el catálogo; su lectura no demuestra activación nativa ni concede permisos.

## Procedure
Inspect current main and relevant code paths, imports, RPC calls, role checks, storage and workflows; map dependencies and regression risks; report evidence and unknowns; propose minimal change set.

## Guardrails
No writes, schema changes, deployments or live destructive probes during audit.
Changes must be explicitly scoped and approved. Preserve existing behavior. Do not treat a proposal, implementation, publication and verification as equivalent.

## Handoff
Report: project; module; objective; baseline; sources and commit; findings; dependencies; roles; business rules; proposed changes; executed changes; tests and environments; risks; pending decisions; final evidence status.

## Mandatory read-only and duplication controls
An audit, continuity check, diagnostic or documentary test is read-only by default. Inspect `main` code, current files, relevant historical merged PRs and open PRs before concluding that an implementation is missing. Compare actual file contents and behavior; do not infer absence from a divergent feature branch, non-empty branch diff or an apparently mergeable PR, especially after squash merges. Record evidence, commit/ref, proven findings versus hypotheses, and any remaining delta. No write action is authorized by the audit itself.

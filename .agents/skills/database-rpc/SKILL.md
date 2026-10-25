---
name: database-rpc
description: Review Supabase RPC and data dependencies safely.
---

# SGP Database and RPC

## Project
SGP_ONE. Direct browser Supabase; Firebase Hosting sgp-one-lab; Estado actual: recuperar continuidad y contrastar main; las versiones históricas no son baseline vigente.

## Activation
Use when the user asks for database rpc work in SGP_ONE. Follow the project's permanent instructions and current GitHub documentation.

## Fuentes y evidencia comunes para Codex
Seguir `AGENTS.md` raíz: CHECKPOINT → ESTADO_ACTUAL → MASTER_CONTEXT → código actual de main, PR y evidencia pertinente. Los tres documentos contienen historia: contrastar fechas, reglas y SHA; no tomar versiones antiguas como estado vigente. Aplicar los estados de evidencia y el formato de entrega definidos allí. Leer esta Skill explícitamente si no aparece en el catálogo; su lectura no demuestra activación nativa ni concede permisos.

## Procedure
Read exact RPC signatures, SECURITY DEFINER, search_path, EXECUTE grants, p_token checks, roles, RLS state and calling frontend; specify migrations, rollback and positive/negative tests; require explicit approval before writes.

## Guardrails
Do not change Supabase from SGP_ONE_GOOGLE; never globally alter RLS for isolated errors.
Changes must be explicitly scoped and approved. Preserve existing behavior. Do not treat a proposal, implementation, publication and verification as equivalent.

## Handoff
Report: project; module; objective; baseline; sources and commit; findings; dependencies; roles; business rules; proposed changes; executed changes; tests and environments; risks; pending decisions; final evidence status.

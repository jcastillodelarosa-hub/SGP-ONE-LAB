---
name: database-rpc
description: Review Supabase RPC and data dependencies safely.
---

# SGP Database and RPC

## Project
SGP_ONE. Direct browser Supabase; Firebase Hosting sgp-one-lab; LAB v281 and backend hotfix v282 browser verification pending.

## Activation
Use when the user asks for database rpc work in SGP_ONE. Follow the project's permanent instructions and current GitHub documentation.

## Required sources
1. `SGP_ONE_MASTER_CONTEXT.md` on `main`.
2. `SGP_ONE_ESTADO_ACTUAL.md` on `main`.
3. Current relevant source files on `main` and live read-only evidence when necessary.
4. Other project's documentation only for integration boundaries.

## Procedure
Read exact RPC signatures, SECURITY DEFINER, search_path, EXECUTE grants, p_token checks, roles, RLS state and calling frontend; specify migrations, rollback and positive/negative tests; require explicit approval before writes.

## Guardrails
Do not change Supabase from SGP_ONE_GOOGLE; never globally alter RLS for isolated errors.
Changes must be explicitly scoped and approved. Preserve existing behavior. Do not treat a proposal, implementation, publication and verification as equivalent.

## Handoff
Report: project; module; objective; baseline; sources and commit; findings; dependencies; roles; business rules; proposed changes; executed changes; tests and environments; risks; pending decisions; final evidence status.

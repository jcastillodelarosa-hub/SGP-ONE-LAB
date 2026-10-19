---
name: deployment
description: Prepare minimal controlled releases through approved workflows.
---

# SGP Deployment

## Project
SGP_ONE. Direct browser Supabase; Firebase Hosting sgp-one-lab; LAB v281 and backend hotfix v282 browser verification pending.

## Activation
Use when the user asks for deployment work in SGP_ONE. Follow the project's permanent instructions and current GitHub documentation.

## Required sources
1. `SGP_ONE_MASTER_CONTEXT.md` on `main`.
2. `SGP_ONE_ESTADO_ACTUAL.md` on `main`.
3. Current relevant source files on `main` and live read-only evidence when necessary.
4. Other project's documentation only for integration boundaries.

## Procedure
Check repository, branch, diff, test gates, Firebase target, GitHub Actions WIF, Secret Manager, affected Functions and rollback; obtain approval before production deployment; record workflow run, commit and verification outcomes.

## Guardrails
No JSON keys, no unrelated deployments, no production deployment as part of skill setup.
Changes must be explicitly scoped and approved. Preserve existing behavior. Do not treat a proposal, implementation, publication and verification as equivalent.

## Handoff
Report: project; module; objective; baseline; sources and commit; findings; dependencies; roles; business rules; proposed changes; executed changes; tests and environments; risks; pending decisions; final evidence status.

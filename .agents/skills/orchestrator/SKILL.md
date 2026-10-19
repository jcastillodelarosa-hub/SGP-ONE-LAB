---
name: orchestrator
description: Coordinate a request, choose project scope and order specialized skills.
---

# SGP Orchestrator

## Project
SGP_ONE. Direct browser Supabase; Firebase Hosting sgp-one-lab; LAB v281 and backend hotfix v282 browser verification pending.

## Activation
Use when the user asks for orchestrator work in SGP_ONE. Follow the project's permanent instructions and current GitHub documentation.

## Required sources
1. `SGP_ONE_MASTER_CONTEXT.md` on `main`.
2. `SGP_ONE_ESTADO_ACTUAL.md` on `main`.
3. Current relevant source files on `main` and live read-only evidence when necessary.
4. Other project's documentation only for integration boundaries.

## Procedure
Read both project boundaries; determine whether task is analysis, change, deployment or test; activate audit before implementation; demand explicit approval for production-impacting operations; hand off structured evidence.

## Guardrails
Never assume a skill grants tool permissions; never alter other repository or Supabase without independent approval.
Changes must be explicitly scoped and approved. Preserve existing behavior. Do not treat a proposal, implementation, publication and verification as equivalent.

## Handoff
Report: project; module; objective; baseline; sources and commit; findings; dependencies; roles; business rules; proposed changes; executed changes; tests and environments; risks; pending decisions; final evidence status.

## Mandatory preflight — before any action
Classify the user request first: read-only review, diagnostic, documentation, proposal, or authorized implementation. A request to test continuity, audit, inspect, explain or diagnose is READ-ONLY; never create branches, commits, pull requests, database writes or deployments unless the user separately and explicitly authorizes those actions. Before proposing or performing implementation, inspect current `main` source and documentation, existing merged and open PRs, and the actual state of the requested feature. Confirm a genuine unmet delta and check that another branch or PR is not already doing the work. A branch comparison or mergeability status alone does not prove that work is missing: squash merges may cause divergence even when identical files exist on `main`. If the goal is already met, report it and stop; do not create a duplicate PR. Prior approval never replaces this preflight.

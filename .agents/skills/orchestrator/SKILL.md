---
name: orchestrator
description: Coordinate a request, choose project scope and order specialized skills.
---

# SGP Orchestrator

## Project
SGP_ONE. Direct browser Supabase; Firebase Hosting sgp-one-lab; Version and release status must be discovered from current main and verified evidence; never rely on hard-coded version labels.

## Activation
Use when the user asks for orchestrator work in SGP_ONE. Follow the project's permanent instructions and current GitHub documentation.

## Fuentes y evidencia comunes para Codex
Seguir `AGENTS.md` raíz: CHECKPOINT → ESTADO_ACTUAL → MASTER_CONTEXT → código actual de main, PR y evidencia pertinente. Los tres documentos contienen historia: contrastar fechas, reglas y SHA; no tomar versiones antiguas como estado vigente. Aplicar los estados de evidencia y el formato de entrega definidos allí. Leer esta Skill explícitamente si no aparece en el catálogo; su lectura no demuestra activación nativa ni concede permisos.

## Design engineering routing
For any UI/UX, mobile, table, navigation, modal or animation work, after mandatory continuity recovery read `SGP_ONE_DESIGN_SYSTEM.md` and `.agents/skills/design-engineering/SKILL.md` from current main before proposing or implementing changes. Apply the GLOBAL visual standard across all modules and new work, not separate module themes. Audit existing components and PRs first; check the current Design Center implementation and authorization scope; file existence alone does not prove functional acceptance. This is an SGP-specific adaptation inspired by Emil Kowalski's public design skills, not an automatically installed ChatGPT skill. Respect read-only scope and require explicit authorization before source changes.

## Procedure
Read both project boundaries; determine whether task is analysis, change, deployment or test; activate audit before implementation; demand explicit approval for production-impacting operations; hand off structured evidence.

## Guardrails
Never assume a skill grants tool permissions; never alter other repository or Supabase without independent approval.
Changes must be explicitly scoped and approved. Preserve existing behavior. Do not treat a proposal, implementation, publication and verification as equivalent.

## Handoff
After each authorized milestone invoke continuity checkpoint protocol. Report: project; module; objective; baseline; sources and commit; findings; dependencies; roles; business rules; proposed changes; executed changes; tests and environments; risks; pending decisions; final evidence status.

## Mandatory preflight — before any action
Classify the user request first: read-only review, diagnostic, documentation, proposal, or authorized implementation. A request to test continuity, audit, inspect, explain or diagnose is READ-ONLY; never create branches, commits, pull requests, database writes or deployments unless the user separately and explicitly authorizes those actions. Before proposing or performing implementation, inspect current `main` source and documentation, existing merged and open PRs, and the actual state of the requested feature. Confirm a genuine unmet delta and check that another branch or PR is not already doing the work. A branch comparison or mergeability status alone does not prove that work is missing: squash merges may cause divergence even when identical files exist on `main`. If the goal is already met, report it and stop; do not create a duplicate PR. Prior approval never replaces this preflight.

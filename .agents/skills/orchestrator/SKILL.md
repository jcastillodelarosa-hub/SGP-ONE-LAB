---
name: orchestrator
description: Coordinate a request, choose project scope and order specialized skills.
---

# SGP Orchestrator

## Método principal
Necesidad funcional → implementación → demostración visible → correcciones → cierre.
Aplicar AGENTS.md: evidencia previa reutilizable, revisión dirigida y pruebas
proporcionales al cambio; no auditoría general ni batería completa por defecto.
CRÍTICO bloquea la operación afectada; IMPORTANTE se corrige en el encargo;
MENOR se documenta sin detener la demo. Resolver ajustes técnicos autorizados sin
pedir confirmaciones repetidas; mantener seguridad y permisos de producción.
El handoff se consolida en la entrega, no tras cada corrección menor.

## Project
SGP_ONE. Direct browser Supabase; Firebase Hosting sgp-one-lab; Version and release status must be discovered from current main and verified evidence; never rely on hard-coded version labels.

## Activation
Use when the user asks for orchestrator work in SGP_ONE. Follow the project's permanent instructions and current GitHub documentation.

## Required sources — recuperar al inicio y reutilizar mientras sean vigentes
1. `SGP_ONE_MASTER_CONTEXT.md` on `main` and `SGP_ONE_CHECKPOINT.md` (reconcile with actual main).
2. `SGP_ONE_ESTADO_ACTUAL.md` on `main`.
3. Current relevant source files on `main` and live read-only evidence when necessary.
4. Other project's documentation only for integration boundaries.

## Design engineering routing
For any UI/UX, mobile, table, navigation, modal or animation work, after mandatory continuity recovery read `SGP_ONE_DESIGN_SYSTEM.md` and `.agents/skills/design-engineering/SKILL.md` from current main before proposing or implementing changes. Apply the GLOBAL visual standard across all modules and new work, not separate module themes. Reuse known components and PR evidence; check only the relevant delta; the Configuración Design Center remains a proposal until separately authorized and verified. This is an SGP-specific adaptation inspired by Emil Kowalski's public design skills, not an automatically installed ChatGPT skill. Respect read-only scope and require explicit authorization before source changes.

## Procedure
Read both project boundaries; determine whether task is analysis, change, deployment or test; perform only the targeted checks needed for the changed behavior; use audit when requested or justified by concrete risk; demand explicit approval for production-impacting operations; hand off structured evidence.

## Guardrails
Never assume a skill grants tool permissions; never alter other repository or Supabase without independent approval.
Changes must be explicitly scoped and approved. Preserve existing behavior. Do not treat a proposal, implementation, publication and verification as equivalent.

## Handoff
At delivery or a durable milestone update continuity; reuse the existing recovery during minor corrections. Report: project; module; objective; baseline; sources and commit; findings; dependencies; roles; business rules; proposed changes; executed changes; tests and environments; risks; pending decisions; final evidence status.

## Targeted preflight — once per task, refresh only relevant changes
Classify the user request first: read-only review, diagnostic, documentation, proposal, or authorized implementation. A request to test continuity, audit, inspect, explain or diagnose is READ-ONLY; never create branches, commits, pull requests, database writes or deployments unless the user separately and explicitly authorizes those actions. Once per task, and only for the affected scope, inspect current `main` source and documentation, existing merged and open PRs, and the actual state of the requested feature. Confirm a genuine unmet delta and check that another branch or PR is not already doing the work. A branch comparison or mergeability status alone does not prove that work is missing: squash merges may cause divergence even when identical files exist on `main`. If the goal is already met, report it and stop; do not create a duplicate PR. Existing verified preflight may be reused; refresh only facts affected by changes or concurrency. Never repeat a general audit by default.

---
name: continuity
description: Preserve verified SGP state with checkpoint-based handoffs across chats.
---

# SGP Continuity v2 — checkpoint protocol

## Fuentes y evidencia comunes para Codex
Seguir `AGENTS.md` raíz: CHECKPOINT → ESTADO_ACTUAL → MASTER_CONTEXT → código actual de main, PR y evidencia pertinente. Los tres documentos contienen historia: contrastar fechas, reglas y SHA; no tomar versiones antiguas como estado vigente. Aplicar los estados de evidencia y el formato de entrega definidos allí. Leer esta Skill explícitamente si no aparece en el catálogo; su lectura no demuestra activación nativa ni concede permisos.

## Scope and authority
Applies to SGP_ONE in jcastillodelarosa-hub/SGP-ONE-LAB. This skill is an instruction, not an autonomous background process. It never grants write authorization. Read-only requests remain read-only. Follow orchestrator preflight and never alter SGP_ONE_GOOGLE, Supabase, Firebase or production without separately scoped authorization.

## Mandatory startup recovery
1. Read SGP_ONE_CHECKPOINT.md, then SGP_ONE_ESTADO_ACTUAL.md, then SGP_ONE_MASTER_CONTEXT.md, following AGENTS.md.
2. Identify historical entries and stale or missing handoff evidence explicitly.
3. Inspect current main HEAD, relevant source files, merged/open PRs, workflows and deployments as appropriate; compare checkpoint commit with actual main and never assume the checkpoint is current.
4. Resolve discrepancies explicitly. Code and verified live evidence outrank stale version labels. Do not treat a passing CI run as proof of deployment or functional acceptance.
5. Before proposing work, confirm no existing PR or merged implementation already satisfies the goal.

## Checkpoints during work
At the start of each authorized implementation, record the objective, baseline, scope and expected next action in the handoff; after each meaningful milestone (commit, PR, merge, migration, deploy, test or blocker), prepare an updated checkpoint immediately, rather than waiting for the conversation to end. When checkpoint edits are within the authorized files, update it; create a commit only when that action is authorized and verify its SHA. When they are not authorized, provide a copyable checkpoint in chat and clearly state GitHub is not updated. Never claim automatic saving if a write did not succeed.

## State labels
Use the Spanish state labels in AGENTS.md, including IMPLEMENTADO LOCALMENTE and BLOQUEADO. Record date, source and environment independently for each dimension.

## Checkpoint minimum schema
- UTC timestamp and project/repository/branch
- main commit SHA observed and working branch/commit or PR
- objective, authorized scope and prohibited changes
- latest confirmed action, evidence and test outcome
- implemented versus deployed versus verified status
- active risks/blockers and unresolved decisions
- exactly one actionable next step
- source links and any known discrepancy with current main

## Interruption recovery
On a new chat, read checkpoint, independently inspect main and PR state, resume from the last CONFIRMED step only, and avoid replaying irreversible operations. If checkpoint is missing, stale, conflicting, or a write was interrupted, report uncertainty and reconcile first. GitHub commits are durable; an uncommitted chat action is not.

## Document roles
MASTER_CONTEXT: stable architecture and business rules, not a version dashboard.
ESTADO_ACTUAL: append-only dated milestones/history, avoid contradictory executive current-state claims.
CHECKPOINT: compact, frequently updated operational handoff; must be compared with main before use.

## Handoff response
Report baseline, changed files, commit/PR, checks, publication, verification, blockers and next step. Never equate PR creation with approval to merge.

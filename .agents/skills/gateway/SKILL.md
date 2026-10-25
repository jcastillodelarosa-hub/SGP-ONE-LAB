---
name: gateway
description: Design and review explicit Firebase Gateway contracts.
---

# SGP Gateway

## Project
SGP_ONE. Direct browser Supabase; Firebase Hosting sgp-one-lab; Current release status must be checked from live repository and evidence; do not rely on historical version numbers.

## Activation
Use when the user asks for gateway work in SGP_ONE. Follow the project's permanent instructions and current GitHub documentation.

## Fuentes y evidencia comunes para Codex
Seguir `AGENTS.md` raíz: CHECKPOINT → ESTADO_ACTUAL → MASTER_CONTEXT → código actual de main, PR y evidencia pertinente. Los tres documentos contienen historia: contrastar fechas, reglas y SHA; no tomar versiones antiguas como estado vigente. Aplicar los estados de evidencia y el formato de entrega definidos allí. Leer esta Skill explícitamente si no aparece en el catálogo; su lectura no demuestra activación nativa ni concede permisos.

## Procedure
Preserve Hosting same-origin /api/gw/* → Functions v2 → existing Supabase; GW v1–v3 verified historically, GW v4 published and testing; whitelist operation/parameters; preserve GW v3 __session; verify each network independently.

## Guardrails
No generic RPC proxy, no service_role, no migration, no productive writes without audit.
Changes must be explicitly scoped and approved. Preserve existing behavior. Do not treat a proposal, implementation, publication and verification as equivalent.

## Handoff
Report: project; module; objective; baseline; sources and commit; findings; dependencies; roles; business rules; proposed changes; executed changes; tests and environments; risks; pending decisions; final evidence status.

## Límite obligatorio de proyecto
En LAB esta Skill solo audita fronteras con SGP_ONE_GOOGLE. Los contratos /api/gw/*, Functions y cookies __session pertenecen a GOOGLE, no a la arquitectura operativa LAB. Cualquier implementación allí requiere alcance independiente; activar esta Skill no autoriza modificar otro repositorio.

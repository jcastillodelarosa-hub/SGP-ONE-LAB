---
name: business-rules
description: Protect SGP production semantics and data relationships.
---

# SGP Business Rules

## Método principal
Necesidad funcional → implementación → demostración visible → correcciones → cierre.
Aplicar AGENTS.md: evidencia previa reutilizable, revisión dirigida y pruebas
proporcionales al cambio; no auditoría general ni batería completa por defecto.
CRÍTICO bloquea la operación afectada; IMPORTANTE se corrige en el encargo;
MENOR se documenta sin detener la demo. Resolver ajustes técnicos autorizados sin
pedir confirmaciones repetidas; mantener seguridad y permisos de producción.
El handoff se consolida en la entrega, no tras cada corrección menor.

## Project
SGP_ONE. Direct browser Supabase; Firebase Hosting sgp-one-lab; LAB v281 and backend hotfix v282 browser verification pending.

## Activation
Use when the user asks for business rules work in SGP_ONE. Follow the project's permanent instructions and current GitHub documentation.

## Required sources — recuperar al inicio y reutilizar mientras sean vigentes
1. `SGP_ONE_MASTER_CONTEXT.md` on `main`.
2. `SGP_ONE_ESTADO_ACTUAL.md` on `main`.
3. Current relevant source files on `main` and live read-only evidence when necessary.
4. Other project's documentation only for integration boundaries.

## Procedure
Preserve CORTE→MECANIZADO→PROCESADO→PICKING; Picking PANEL only and isolate same-named orders by system; distinguish MULTI-RESERVA from RESERVA COMPARTIDA; never infer per-reservation quantities or finishes; keep NC, PDT validation and physical status separate.

## Guardrails
SGP_ONE remains functional authority; do not silently redefine states.
Changes must be explicitly scoped and approved. Preserve existing behavior. Do not treat a proposal, implementation, publication and verification as equivalent.

## Handoff
Report: project; module; objective; baseline; sources and commit; findings; dependencies; roles; business rules; proposed changes; executed changes; tests and environments; risks; pending decisions; final evidence status.

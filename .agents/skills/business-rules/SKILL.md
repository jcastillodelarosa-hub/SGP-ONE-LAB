---
name: business-rules
description: Protect SGP production semantics and data relationships.
---

# SGP Business Rules

## Project
SGP_ONE. Direct browser Supabase; Firebase Hosting sgp-one-lab; Estado actual: recuperar continuidad y contrastar main; las versiones históricas no son baseline vigente.

## Activation
Use when the user asks for business rules work in SGP_ONE. Follow the project's permanent instructions and current GitHub documentation.

## Fuentes y evidencia comunes para Codex
Seguir `AGENTS.md` raíz: CHECKPOINT → ESTADO_ACTUAL → MASTER_CONTEXT → código actual de main, PR y evidencia pertinente. Los tres documentos contienen historia: contrastar fechas, reglas y SHA; no tomar versiones antiguas como estado vigente. Aplicar los estados de evidencia y el formato de entrega definidos allí. Leer esta Skill explícitamente si no aparece en el catálogo; su lectura no demuestra activación nativa ni concede permisos.

## Procedure
Preserve the current separation of programming flag, operational states and physical delivery defined in AGENTS.md; Picking PANEL only and isolate same-named orders by system; distinguish MULTI-RESERVA from RESERVA COMPARTIDA; never infer per-reservation quantities or finishes; keep NC, PDT validation and physical status separate.

## Guardrails
SGP_ONE remains functional authority; do not silently redefine states.
Changes must be explicitly scoped and approved. Preserve existing behavior. Do not treat a proposal, implementation, publication and verification as equivalent.

## Handoff
Report: project; module; objective; baseline; sources and commit; findings; dependencies; roles; business rules; proposed changes; executed changes; tests and environments; risks; pending decisions; final evidence status.

## Contratos vigentes que sustituyen referencias históricas
Separar programada Sí/No de SIN INICIAR, CORTE, MECANIZADO y PROCESADO; Picking es entrega física independiente. Preservar los literales históricos según contrato, sin convertirlos por inferencia. Respetar la primera reserva como propietaria de unidades en prioridades; no distribuir entre reservas asociadas. Distinguir semana de programación de la reserva y semanas calendario de ejecución, evitando doble conteo. Conciliar estas reglas con main antes de aplicar el flujo histórico indicado arriba.

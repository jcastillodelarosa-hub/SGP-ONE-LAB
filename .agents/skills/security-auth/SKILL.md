---
name: security-auth
description: Audit session handling, permissions and secrets.
---

# SGP Security and Auth

## Project
SGP_ONE. Direct browser Supabase; Firebase Hosting sgp-one-lab; Estado actual: recuperar continuidad y contrastar main; las versiones históricas no son baseline vigente.

## Activation
Use when the user asks for security auth work in SGP_ONE. Follow the project's permanent instructions and current GitHub documentation.

## Fuentes y evidencia comunes para Codex
Seguir `AGENTS.md` raíz: CHECKPOINT → ESTADO_ACTUAL → MASTER_CONTEXT → código actual de main, PR y evidencia pertinente. Los tres documentos contienen historia: contrastar fechas, reglas y SHA; no tomar versiones antiguas como estado vigente. Aplicar los estados de evidencia y el formato de entrega definidos allí. Leer esta Skill explícitamente si no aparece en el catálogo; su lectura no demuestra activación nativa ni concede permisos.

## Procedure
Check SGP role authorization in RPC, technical database grants separately, CSRF/Origin, input validation, least privilege and secret handling; for Gateway preserve __session HttpOnly Secure SameSite=Strict Path=/api/gw and sgp_login/sgp_sesion_actual/sgp_logout.

## Guardrails
Never print keys/tokens or expose server-side SGP token to JavaScript.
Changes must be explicitly scoped and approved. Preserve existing behavior. Do not treat a proposal, implementation, publication and verification as equivalent.

## Handoff
Report: project; module; objective; baseline; sources and commit; findings; dependencies; roles; business rules; proposed changes; executed changes; tests and environments; risks; pending decisions; final evidence status.

## Separación de autenticación
LAB consume Supabase directo con autorización funcional SGP en RPC. __session, CSRF/Origin de Gateway y tokens retenidos en servidor corresponden a GOOGLE; no imponer ese transporte a LAB sin decisión arquitectónica autorizada.

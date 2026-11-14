# Retail Edge probe — review only

## Existing environment observed (read-only)
OPT-SANDBOX is ACTIVE_HEALTHY in the same region as LAB, separate from LAB. It has three active JWT-protected functions: opt-sandbox-health-v1, opt-import-light-sandbox-v1 and opt-import-light-bounded-sandbox-v1. Retrieval of the last function's source returned UNAVAILABLE/ProtocolError; its safety is not established and it was not invoked. LAB opt-import remains version6. No function was deployed or modified during preparation.

## Concrete proposed operation
Deploy a NEW function `opt-retail-probe-review` only to OPT-SANDBOX from the reviewed source in this commit, with verify_jwt=true and an independent random256-bit secret in OPT_PROBE_SECRET. Do not embed that secret in code, a client, command output, URL or public repository. Use a private HTTP runner, never frontend links; no CORS allowlist is provided by this probe. The HTTPS route exists externally, but requires both gateway JWT and the independent secret. This is not a private-network claim.

Entry point: supabase/functions/opt-retail-probe-review/index.ts. Its adapter src/server/opt-import-probe.js has no DB client, no service-role credential read, no storage and no remote RPC implementation. Runtime fetch is prohibited. Request is capped at16MiB. It substitutes synthetic authentication and receives a read-only context snapshot, which is explicitly not proof of authorization. It calls the real PDF/index/manifest validation path and terminates before the writer. Responses contain only counts/status/warning codes and elapsed wall time, never documents, identities or snapshot. Logs must not contain request bodies or secrets. Startup dependency downloads are not runtime document network calls.

Authorize transmission of the two previously verified original PDFs, the complete original index, and minimal read-only snapshots to this sandbox for ephemeral processing. Do not upload them to source bundles, Storage, tables or public artifacts. No retry against production opt-import or uncertain documents.

## Acceptance sequence
1. Verify function identity, code hash, JWT flag and secret configuration. Wrong secret / absent JWT must reject before PDF parsing. Malformed/oversized input must reject. Do not proceed if protection cannot be verified.
2. Synthetic exact, compatible, outside-envelope and invalid-context requests. Compatible produces warning; incompatible never reaches write boundary. No real DB call exists.
3. Three sequential runs per original plus separate warm reuse checks, with fresh request identifiers held privately. Return VALIDATED_STOPPED_BEFORE_WRITE, writes0, expected quantities/warning status. Cold worker status may only be claimed from lifecycle evidence, not merely a fresh HTTP request.
4. Inspect platform CPU/memory/shutdown logs for the new function only. Wall time is not CPU. Compare observed resource limits and retain headroom; do not accept solely because requests returned200. If platform metrics are unavailable, report hosted CPU margin unproven.
5. Verify original hashes/length-preservation evidence from local reconciliation and compare counts/statuses. This probe proves validation execution, not SQL latency, persistence, production session authorization or physical cuts. SQL persistence/scope testing remains the separate local PostgreSQL suite.

## Rollback / cleanup
The probe does not alter LAB or existing sandbox functions, so there is no data rollback. Remove only the newly created function and OPT_PROBE_SECRET after measurement. If deletion is unavailable, first replace only this probe with a deny-all403 handler, verify denial, then remove it through the authorized management path. No project pause/reset, existing-secret deletion, migration or document cleanup. Record deployment version/hash, calls and cleanup result. If cleanup capability is unavailable before deployment, resolve it before proceeding.

## Existing importer impact
Production bootstrap still omits retailV3; default false remains. The probe is not imported by the application bootstrap. Candidate production activation would separately require enabling Retail v3 and allowing its two exact private RPC names; this probe approval does not authorize that change. Legacy Retail and individual routes remain on v1; Proyecto remains on v2. Rounding acceptance changes only opt-in exact Retail v3, preserving original cuts and explicit originalPrecisionVerified=false. The CPU worksheet reader is a separate shared candidate affecting all XLSX origins; original index equivalence, integrity limits and legacy Deno XLSX tests cover that path. Painted-border zero remainder recovery is shared PDF extraction, not a default-zero fallback. Frames remains documentary-only, without a registrable assignment.

## Authorization text for this package
Authorize creating and invoking only the temporary opt-retail-probe-review function in existing OPT-SANDBOX, setting/removing its dedicated secret, privately processing the two verified originals plus index/read-only snapshots without database or storage writes, reading its execution metrics, and deleting/denying the probe after testing. This does not authorize LAB deployment, SQL migrations, imports or retries of uncertain documents.

## Local evidence
Two adapter tests pass (access, byte limit, sanitized response, compatible warning and out-of-envelope rejection). Deno typecheck passes. Existing Deno real PDF/CSV/XLSX handler regression passes, including a full3MiB index. Both original probes complete locally with writes0. Earlier287 OPT tests and SQL/browser Retail/Proyecto evidence remain valid; this additive harness does not change importer code. Local Deno measurements do not establish hosted Edge headroom.

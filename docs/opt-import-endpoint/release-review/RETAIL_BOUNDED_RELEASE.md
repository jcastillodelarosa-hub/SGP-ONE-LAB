# Retail bounded operation — preparation only

Johan approved retaining the broad guard with bounded waits and clear feedback. This replaces the earlier pending choice of lock strategy; it does not authorize deployment. No global, role or existing v6 function settings change.

## Limits and failure semantics
Only sgp_opt_importar_retail_validado_v3 declares statement_timeout=1s and lock_timeout=250ms. The existing context-table SHARE NOWAIT guard remains: an active context writer causes immediate OPT_CONTEXTO_OCUPADO. Other lock acquisitions, including consecutive advisory locks, are bounded to 250ms. The 1s SQL limit is about nine times the largest prior 109ms focal local execution; 250ms permits short import-lock overlap without queuing indefinitely. These are chosen operational limits, not inferred hosted guarantees.

PostgREST must hoist the function statement_timeout into transaction settings BEFORE executing the RPC. A SET inside a PL/pgSQL body alone cannot reliably arm a timer for the already-running SQL statement. No global config change is proposed. Verify the hosted version and existing db-hoisted-tx-settings include statement_timeout before activation. If absent or unverifiable, keep Retail routing legacy/paused; do not weaken or silently omit the limit.

The timeout limits SQL execution, not HTTP pool acquisition, network latency, rollback work or OS scheduling. Normal PostgREST RPC autocommit releases locks on rollback/commit; do not call this RPC inside a long-lived manual transaction. It is not a guarantee that every unrelated writer responds in exactly one second.

Only an explicit PostgreSQL error response 57014 or 55P03 from the Retail writer becomes OPT_RETAIL_TIEMPO_AGOTADO, definitive=true. It confirms failure of that transaction. A thrown transport error, missing receipt, gateway/Edge timeout or client deadline remains uncertain. A prior uncertain journal entry remains uncertain even if a later attempt is definitively rejected. No automatic retry, endpoint fallback or journal clearing is added. Original measures and cut permissions are unchanged.

UI: “La operación Retail superó el tiempo permitido. Espera a que termine la actividad de programación y vuelve a iniciar la carga manualmente.” Existing “No guardado en este intento” applies only to confirmed rejection. For an uncertain earlier attempt, the message instead requires checking its state before sending again.

## Verification
Local PostgreSQL17.11 plus real PostgREST12.2.12, sharing a network-none namespace. The actual candidate RPC/receiver and private original payload run with a synthetic actor. A test-only 2s delay at geometry insertion occurs AFTER manifest writes. Actual HTTP result: SQLSTATE57014 at1076ms, approvals/documents/pieces/plans/cuts all zero; a new session immediately acquires conflicting table locks. Removing the delay yields HTTP200 at136ms, 1 document/255 pieces/1 geometry record/0 cuts. Holding the consecutive advisory lock yields SQLSTATE55P03 at335ms HTTP elapsed, unchanged counts. Another session still reads statement_timeout=0 and lock_timeout=0. HTTP timing includes overhead; it is not the configured SQL timeout itself. Temporary companion/container/image removed; pre-existing postgres image retained.

Script: scripts/test-opt-retail-timeouts-local.py. Evidence: tests/opt-digital/retail-timeout-result.json. Focused handler, client journal, message, routing and upload DOM checks cover definitive vs uncertain and absence of automatic retry. Previously valid CPU, scope, rounding and concurrency evidence is reused.

## Prepared release sequence — not executed
1. Confirm current LAB main/version, schema/function ownership/ACL/dependencies, candidate source fingerprint and release artifact. Assign the next unused visible LAB version; coordinate independent labels/Resumen work before final version stamping. Current checkout's v454 is baseline, not a new published release.
2. Verify hosted PostgREST's function statement-timeout hoisting and service-role-only RPC access. Apply only the two proposed Retail functions after explicit authorization. Existing v1/v2, v6 and registration permissions remain untouched. Check proconfig for 1s/250ms. No source documents or data are part of the public code package.
3. Publish ONLY the separate opt-retail-import-v3 endpoint after authorization. Preserve opt-import v6. Resolve deletion capability or explicitly approve a deny-all replacement before creating the endpoint. Validate session/access, origin/mode rejection and gateway configuration using synthetic requests; do not use uncertain originals.
4. Frontend routing is now implemented in src/modules/opt-digital.js and its helper is in the positive artifact list. The historical route-separate-retail.patch is already applied; do not apply it again. Default optRetailMode=legacy preserves existing routes. After checks and authorization, candidate routes RETAIL+INDICE only to the new endpoint. Proyecto/individual remain v6. Unknown mode or paused prevents Retail index submission. There is no fallback.
5. Verify visible version/commit and the deployed artifact after separately authorized publication. Reconcile uncertain originals by exact identity, read-only, without automatic reimport.

Rollback: set optRetailMode=paused first, settle in-flight/uncertain outcomes, preserve journals and append-only records. Keep v6 available for existing non-Retail routes. Do not route uncertain candidate requests to v6. Restore legacy for future requests only after reconciliation and approval. No destructive SQL rollback or document deletion.

Remaining prepublication requirements: hosted timeout-hoisting/config verification; final unused version/merged artifact and source/bundle verification; endpoint cleanup path; explicit SQL/Edge/UI deployment authorization. No Resumen changes included in this work.

Reference: https://docs.postgrest.org/en/v12/references/configuration.html#db-hoisted-tx-settings .

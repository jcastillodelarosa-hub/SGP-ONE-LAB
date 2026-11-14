# Decision candidate: separate Retail endpoint, v6 unchanged

This supersedes the earlier proposal to replace opt-import. The exact v6 source is still unknown. Do not deploy the old activation patch; it has been removed. Nothing here has been deployed or applied to production.

## Proposed boundary
Create only opt-retail-import-v3, using the review entrypoint under supabase/functions/opt-retail-import-v3-review. Keep opt-import v6, its SQL v1/v2 and existing readers unchanged. The new function accepts only RETAIL+INDICE and has only session/access plus two Retail RPC names in its allowlist. Gateway JWT and SGP actor checks both remain. It uses existing platform server credentials, never browser service-role keys. No new secret or password is required by this design.

Build/source provenance is generated from the listed reviewed sources and lockfile by scripts/build-opt-retail-source-id.mjs; the compiled nonsecret constant identifies this NEW implementation. It is not v6's extractor hash. Review the source manifest, regenerate after source changes, bundle the dedicated entrypoint with its locked dependencies and record the actual bundle hash separately. No probe/private files included.

After private SQL and new-function checks pass, the reviewed UI patch route-separate-retail.patch routes only RETAIL+INDICE when optRetailMode=candidate. Default legacy keeps existing routing; Proyecto and every INDIVIDUAL request always use v6. paused (or unknown mode) blocks Retail index locally. No automatic endpoint fallback exists. The patch is NOT applied to the current UI. Include the selector in the positive artifact list only when publishing that UI patch.

## Geometry compatibility without claiming v6 parity
The new retailDocumentPlans serializer preserves the trusted extraction's original stock/remainder/disposition/settings and matches every cut to validated manifest provenance: pattern/page/row/bar/column/slot/unit. It rejects mismatches and never invents geometry. It constructs OPT-DOCUMENT-PLANS-1 for the already-installed persist_document_plans receiver.

The v3 writer requires geometry/provenance and calls that receiver in the same transaction as the manifest. v1/v2 are untouched. Local SQL tests install the observed receiver and document-reader definitions with synthetic tables/data. They verify physical-piece coverage, exact lengths, idempotent replay, changed-geometry rejection and atomic rollback when a cut is missing. The existing client service successfully validates the returned AVAILABLE scheme. Foreign-week/reference segments keep documentary context but have IDs/project labels removed; registration remains scoped. These results prove this contract's tested compatibility, not equivalence to every behavior of the missing v6 bundle.

Originals produce59/57 plans covering255/200 documentary cuts with unchanged manifest hashes and printed lengths. These are private offline tests, not imports. Hash in profiler is explicitly synthetic. One complete local Deno run measured1505.506ms CPU and another2310.656ms; machine concurrency differed. Do not use either as hosted Edge acceptance. Earlier six-worker Edge results preceded this serializer and cannot certify the new complete path. Re-run isolated Edge with the final bundle and include SQL/lock-duration measurements before deployment approval.

## SQL and operational scope
Install only the two new v3 functions after dependency/owner/ACL checks. Reuse existing geometry extension; do not run its fixture SQL against production. No RLS/table/browser grant changes. The candidate SHARE/NOWAIT table guard closes tested inserts but blocks unrelated DML briefly. It remains a design tradeoff requiring measured review. No new trigger protocol is proposed in this release. See V6_RECOVERY_AND_LOCK_OPTIONS.md for precise alternatives.

## Rollback / uncertain-request handling
First set Retail routing to paused and stop new batches; keep Proyecto/individual running on v6. Observe in-flight calls and reconcile exact PDF hash/source/index/manifest/geometry before any attempt. Never move an uncertain request to v6 as fallback. Existing local idempotency journals must be reviewed/resolved before changing the route; do not erase them to force a retry. A committed candidate document is read as existing data, not reimported through v6.

Once no request is uncertain/in-flight, restore legacy routing for future approved requests if desired. Existing v6 needs no redeployment or unknown rollback archive. Keep candidate SQL/data append-only; remove unused new functions only after dependencies settle. Cleanup of the new Edge endpoint needs an authorized deletion channel, or an explicitly approved deny-all replacement; current connector cannot delete Edge functions, so resolve cleanup before creation. Do not imply removal is available merely because deployment is available.

## Decision and gates
This separate route avoids the missing-v6 replacement/rollback blocker and limits parsing behavior changes to Retail index. It does not remove the need for independent review, final build verification, fresh metadata/ACL checks, bounded SQL contention evaluation, full-path CPU testing, protected cleanup capability and explicit SQL/new-function/UI publication authorization. It does not grant Frames registration or authorize reimporting uncertain documents. Labels remain independent.

Current operational update: Johan approved bounded broad protection. See RETAIL_BOUNDED_RELEASE.md for implemented limits, actual PostgREST timeout proof and remaining activation gates. Historical lock-choice blockers below are superseded, not deployment authorization. UI route patch is now applied with legacy default.

# Decision candidate: separate Retail endpoint, v6 unchanged

This supersedes the earlier proposal to replace opt-import. The exact v6 source is still unknown. Do not deploy the old activation patch; it has been removed. Nothing here has been deployed or applied to production.

## Proposed boundary
Create only opt-retail-import-v3, using the review entrypoint under supabase/functions/opt-retail-import-v3-review. Keep opt-import v6, its SQL v1/v2 and existing readers unchanged. The new function accepts only RETAIL+INDICE and has only session/access plus two Retail RPC names in its allowlist. Gateway JWT and SGP actor checks both remain. It uses existing platform server credentials, never browser service-role keys. No new secret or password is required by this design.

Build/source provenance is generated from the listed reviewed sources and lockfile by scripts/build-opt-retail-source-id.mjs; the compiled nonsecret constant identifies this NEW implementation. It is not v6's extractor hash. Review the source manifest, regenerate after source changes, bundle the dedicated entrypoint with its locked dependencies and record the actual bundle hash separately. No probe/private files included.

After private SQL and new-function checks pass, the reviewed UI patch route-separate-retail.patch routes only RETAIL+INDICE when optRetailMode=candidate. Default legacy keeps existing routing; Proyecto and every INDIVIDUAL request always use v6. paused (or unknown mode) blocks Retail index locally. No automatic endpoint fallback exists. The patch is NOT applied to the current UI. Include the selector in the positive artifact list only when publishing that UI patch.

## Geometry compatibility without claiming v6 parity
The new retailDocumentPlans serializer preserves the trusted extraction's original stock/remainder/disposition/settings and matches every cut to validated manifest provenance: pattern/page/row/bar/column/slot/unit. It rejects mismatches and never invents geometry. It constructs OPT-DOCUMENT-PLANS-1 for the already-installed persist_document_plans receiver.

The v3 writer requires geometry/provenance and calls that receiver in the same transaction as the manifest. v1/v2 are untouched. Local SQL tests install the observed receiver and document-reader definitions with synthetic tables/data. They verify physical-piece coverage, exact lengths, idempotent replay, changed-geometry rejection and atomic rollback when a cut is missing. The existing client service successfully validates the returned AVAILABLE scheme. Foreign-week/reference segments keep documentary context but have IDs/project labels removed; registration remains scoped. These results prove this contract's tested compatibility, not equivalence to every behavior of the missing v6 bundle.

Originals produce 59/57 plans covering 255/200 documentary cuts with unchanged manifest hashes and printed lengths. These are private offline tests, not imports. The profiler source hash is explicitly synthetic.

The final local isolated Edge path now includes the new serializer and real PostgREST request/receipt JSON codec, with synthetic RPC responses and no network. Six fresh user workers (module cache enabled) on official edge-runtime v1.70.5 completed at 718/674/600 and 557/646/601 ms CPU under the enforced 2000 ms limit. A controlled baseline restoring only the pre-optimization index normalizer measured 1028/982/977 and 870/904/935 ms; median reductions are 31.4% and 33.5%. The original index result hash remains identical across all 7692 entries. This supersedes the earlier uncontrolled 2310.656 ms run as local evidence; it is not hosted acceptance.

Separate PostgreSQL 17.11 execution of both private original payloads and the observed geometry receiver completed initial imports in 109.124/59.935 ms and idempotent replays in 39.859–69.579 ms. No cuts were recorded. Whole-statement timing bounds the internal lock duration for these autocommit fixtures only. Production table sizes, contention, network and hosted scheduling were not reproduced. See tests/opt-digital/retail-complete-performance-result.json and the profiling scripts.

## SQL and operational scope
Install only the two new v3 functions after dependency/owner/ACL checks. Reuse existing geometry extension; do not run its fixture SQL against production. No RLS/table/browser grant changes. The candidate SHARE/NOWAIT table guard closes tested inserts but blocks unrelated DML briefly. It remains a design tradeoff requiring measured review. No new trigger protocol is proposed in this release. See V6_RECOVERY_AND_LOCK_OPTIONS.md for precise alternatives.

## Rollback / uncertain-request handling
First set Retail routing to paused and stop new batches; keep Proyecto/individual running on v6. Observe in-flight calls and reconcile exact PDF hash/source/index/manifest/geometry before any attempt. Never move an uncertain request to v6 as fallback. Existing local idempotency journals must be reviewed/resolved before changing the route; do not erase them to force a retry. A committed candidate document is read as existing data, not reimported through v6.

Once no request is uncertain/in-flight, restore legacy routing for future approved requests if desired. Existing v6 needs no redeployment or unknown rollback archive. Keep candidate SQL/data append-only; remove unused new functions only after dependencies settle. Cleanup of the new Edge endpoint needs an authorized deletion channel, or an explicitly approved deny-all replacement; current connector cannot delete Edge functions, so resolve cleanup before creation. Do not imply removal is available merely because deployment is available.

## Decision and gates
This separate route avoids the missing-v6 replacement/rollback blocker and limits parsing behavior changes to Retail index. It does not remove the need for independent review, final build verification, fresh metadata/ACL checks, bounded SQL contention evaluation, full-path CPU testing, protected cleanup capability and explicit SQL/new-function/UI publication authorization. It does not grant Frames registration or authorize reimporting uncertain documents. Labels remain independent.

## Current operational decision — publication still blocked
The two-session test explicitly includes a programming insert for an unrelated reservation: it is blocked by the candidate table guard until the import transaction commits. This is an unavoidable property of the current four-table SHARE lock, not a scope authorization defect. The measured local duration is short, but does not establish acceptable production contention. Existing v1/v2 remain untouched and their guarantees are not upgraded by v3.

Do not activate or publish this candidate yet. Resolve the operational lock choice: accept a measured bounded global guard under representative load, or separately design mandatory per-key guards for every context writer. Do not weaken the guard only in Retail. If retaining table locks, bound the transaction operationally and test timeout/rollback under representative concurrent programming load before approval. No new production resources, retries or data changes were performed during these tests.

Focused lock follow-up completed: see V6_RECOVERY_AND_LOCK_OPTIONS.md. Observed-cardinality and 10x tests quantify unrelated waits; no universal writer protocol exists to safely narrow Retail alone. Guard unchanged, activation still blocked on the explicit operational decision.

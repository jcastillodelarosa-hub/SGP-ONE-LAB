# Current decision: complete Project data for legitimate document readers

Johan explicitly authorized: «Que la puedan ver todos y que se pueda ordenar y filtrar por la refwrncia». This resolves the former visibility decision: all users already admitted to a document through the existing actor/scope/assignment predicate can see its complete verified Project data, including other order references. It does not grant document access, anonymous sessions, or cut registration. No row-to-order inference is used.

The prior investigation below is historical evidence. Its omission recommendation and pending owner decision are superseded. `project_data_document_reader_REVIEW.sql` is the current preparation: the SAME existing summary RPC strips unverified inline Project data from either legacy source and adds only private metadata joined by document/PDF/manifest and metadata digest. No alternate granted reader bypass is introduced. The provisional deny-all adapter was removed from the unapplied proposal.

Apply only after separate deployment authorization: private store proposal, then exact-fingerprint reader replacement. The older inline guard is a historical transition/containment artifact, not an additional installation step. Unknown live definition aborts. Existing ACL, actor, scope and document admission are retained. Tests cover both approved readers, null/invalid sessions, unrelated scope/document, metadata integrity and unchanged operational hashes. No production change occurred.

---

## Historical investigation (superseded decision)

# Bounded visibility investigation and direct-reader guard

Preparation only. No production function, permission, data, Retail runtime or existing summary values changed. v456 remains provisional in the independent UI patch. This note supersedes any assumption that the new ungranted adapter alone prevents inline disclosure.

## Existing authorization and relationships
- install_REVIEW.sql: actor validates the SGP session, configured role and Mecanizado access; validate_scope restricts the supported line/year/week/mode. in_scope checks actual production line/base-week/year, active/excluded state. Registration adds assert_units/bound checks against exact piece assignment and current programming. Documentary metadata does not change any of these checks.
- document_read_REVIEW.sql / document_matrix_link_REVIEW.sql: one matching assignment permits the document to appear in documentary references. It can show the other profiles and documentary quantities of that document. This is not authorization for every order label inside it.
- sgp_opt_esquema_documental_v2 explicitly nulls foreign piece IDs and blanks their project text, while retaining geometry and lengths. This establishes the existing distinction between document geometry access and order/reference visibility. It contradicts assuming that document access implies full Project data access.
- documents/pieces/assignments link a document to physical units and each optional assigned production/reservation/program. Neither table stores a complete Project data source-item-to-all-named-orders relation. Unassigned or foreign-week/line units remain possible by design.
- individual-reconciliation.js has exact printed-reference documentary coverage and supports repeated source-row groups. Its sourceRowId/sourceGroups describe reconciliation, not an SGP read entitlement. Some matching is string-based; it must not become a visibility rule. documentary_source_groups persists quantity/page/cell provenance, not a complete immutable authorization relationship for every line named by a reference. Retail selectors bind exact source labels for import purposes; they do not create general disclosure permission and cannot be assumed complete for historical documents.

Conclusion: no complete, reliable document–all-orders disclosure contract was established in the current reviewed model. Do not infer it from text, quantities, all currently assigned pieces, or one authorized reservation. No positive detail-disclosure path is enabled by this change.

## Confirmed older-reader bypass
Targeted read-only pg_get_functiondef/ACL inspection confirmed the deployed sgp_opt_resumen_documental_v1 is executable by anon/authenticated, still checks actor/scope and selects documents via in-scope assignments. It chooses summary from approvals.evidencia.documentary_summary or the existing document_summaries sidecar (the latter is tied to document/PDF/manifest/approval/evidence digest), then returns that entire summary object. Therefore IF projectData is introduced into either source, a direct call can return it without the new protected adapter. This finding is capability, not a claim that private reference data was already leaked. No user row contents were read.

The prepared UI version1 service calls this old RPC. Switching only one frontend to the new adapter is insufficient: a stale client/direct caller could still call the older granted endpoint. Public function text search for documentary_summary/projectData/document_summaries found this read endpoint and the two existing import writers; this is a targeted surface check, not an exhaustive audit of all dynamic SQL or administrative channels.

## Minimal safe integration prepared
project_data_inline_guard_REVIEW.sql is derived from the exact observed reader. Its only response change is e.summary - 'projectData', after choosing either source. Actor/scope predicates, status, summary tables, sidecar integrity join, owner, grants and configuration remain unchanged. It checks SHA256 of pg_get_functiondef before replacing the function; a changed unknown definition fails closed, and applying the already-guarded definition is idempotent. No GRANT/REVOKE is included. Baseline fixture SHA2564809da617dff4279be9729b6df88d4a7e9b5c6c103e03efdbaafc97145c61875; guarded6073f58c1c2500c20ceff653b16a5dbc4e054e8e86a8a05203b4f1140504e27c. The baseline fixture is test evidence, NOT an install/rollback instruction.

The clean-install document_summary_REVIEW.sql proposal also strips the field, preventing a future local installation from recreating this gap. The private store/read adapter continues to omit unapproved detail. Historical approval and sidecar bytes remain untouched.

Safe future order, only after explicit application authorization: verify unchanged live reader fingerprint/ACL → apply direct-reader guard → verify direct calls to the old endpoint omit inline AND historical-sidecar Project data while existing summary tables match → only then consider inserting metadata into the private store. Do not enable inline production or a disclosure reader before deciding its permissions. None of these operations was executed against LAB.

## Owner decision and recommendation
1. Preserve existing scoped order visibility (recommended): keep omission until an authoritative, complete relationship for each printed row and every named order can be supplied/reviewed. That relationship is currently missing; do not fabricate a new mapping from references or quantities. The existing profile/material summaries continue working.
2. Explicitly approve broader full-document reference visibility: define whether the same users with one in-scope assignment may see all Project data orders/locations in that document, including other lines/reservations/weeks and unassigned units. This is a real permission expansion relative to the scheme's redaction, not a UI adjustment. The owner must specify allowed roles/context and accept that disclosure before implementation. Cut registration remains independently restricted.

The smallest safe change now is closing the direct-reader bypass and retaining absence. The requested complete table cannot be enabled for real documents under the existing contract merely because the layout and extraction are correct.

## Focused verification
New synthetic SQL test reproduces leakage through both inline and historical-sidecar sources on the observed baseline, then verifies both removed on direct calls to the OLD endpoint. It compares the complete old response minus only projectData, and hashes all tables (including historical sidecar) before/after. ACL/owner/SECURITY DEFINER/search_path unchanged; valid old summaries and no-summary documents preserved; bad/null session, line, reservation, system and production-scope denied. Guard repeat accepted; unknown concurrent reader definition rejected. Actor/scope helpers are synthetic, not live policy acceptance.

Store compatibility test rerun only because its clean-install reader fixture changed; PASS. Previous extraction and PC/mobile QA were not repeated. No deployment, migration, PR, new role or grant, PDF import or operational write occurred.

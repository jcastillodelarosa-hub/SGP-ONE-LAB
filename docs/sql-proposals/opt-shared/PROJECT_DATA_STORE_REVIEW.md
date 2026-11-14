# Project data: private metadata and approved document reader

Prepared only. SQL branch is based on Retail 2b35890; no Retail runtime changes, production writes, deployment or reimports. UI v456 remains provisional on an independent branch based on ab102489.

## Authorization
Johan explicitly selected complete table visibility for every legitimate document reader. Existing `actor`, `validate_scope` and in-scope assignment/document admission remain unchanged. Complete references may include other orders; this is the specifically approved content policy, not an inferred line association or new permission to register cuts. No new role grants are required.

## Installation package (not executed)
1. Confirm live reader definition still matches an accepted fingerprint and preserve ACL/owner/configuration.
2. Apply `project_data_store_REVIEW.sql`: private append-only metadata, forced RLS, no application table grants; owner-maintenance recovery only.
3. Apply `project_data_document_reader_REVIEW.sql`: replace the existing RPC, preserving its authorization and grants. Unknown reader definitions abort; known repeated application is idempotent. Do not separately apply the historical inline guard.
4. Through a separately authorized owner-maintenance session, recover a reviewed metadata batch using exact PDF bytes/hash, manifest identity and extractor provenance. Browser and service_role cannot call recovery. Matching PDF hash alone does not prove accurate extraction. No pieces, assignments, cuts, approvals or historical summaries are rewritten.
5. Integrate UI and verify actual authorized/denied reads before publication. Metadata absence remains optional; existing summaries remain available. Private metadata cannot be exposed through unverified inline values.

Recovery accepts 1–20 entries atomically, checks PDF identity and validated rows, and rejects conflicting payload/extractor. Identical replay is idempotent. PDF bytes are not persisted. Append-only table rejects UPDATE/DELETE/TRUNCATE.

## Focused evidence
`test-project-data-store-pglite.mjs`: hash validation, idempotence, conflicting payload, complete batch rollback, immutability, ACL/RLS and operational table hashes PASS.
`test-project-data-document-reader-pglite.mjs`: two legitimate users receive complete references; null/bad session, scope and unrelated documents denied; PDF/manifest/digest mismatch omits metadata; unverified inline values never returned; old summaries, grants/configuration and operational hashes unchanged; accepted baseline/guard transition, idempotent install and unknown definition refusal PASS. Embedded PostgreSQL with synthetic actor/scope helpers: not live-policy certification.

UI tests separately PASS for full-reference filtering (case/accent/whitespace normalized), numeric-aware ascending/descending order, source order preservation, fractions, visible/total rows and pieces, empty results, DOM text safety and reservation changes. Browser QA at 1440×1000 and 390×844 passed with local synthetic data and external traffic blocked; screenshots inspected, controls wrap, six columns and horizontal scrolling retained. Original 114-row/502-piece extraction evidence was reused, not repeated.

## Integration and rollback
Keep UI and SQL patches separate. UI base ab102489; SQL base 2b35890. Retail remains 2b35890 and labels ad8addc untouched. Reconcile shared version/continuity files only in the eventual integration branch, retain provisional v456 subject to current release state, and regenerate final Retail source fingerprint if its source enumeration includes changed UI modules. Do not apply the complete UI patch over a previous version without checking duplicates.

Safe containment is the exact-definition inline guard adapted/reviewed against the new reader fingerprint, omitting Project data while retaining existing summaries; do not restore the old unrestricted inline reader blindly. Keep append-only metadata for audit and pause recovery. Prepare that exact rollback artifact during authorized migration packaging, before applying any SQL. No automatic fallback to import/v6 and no reimport is involved.

Remaining gates: integrated branch/version review, live fingerprint/ACL check, generated migration packaging and containment artifact, explicitly authorized/reviewed metadata batch, production read-only acceptance and publication authorization. Retail operational gates are independent and unchanged.

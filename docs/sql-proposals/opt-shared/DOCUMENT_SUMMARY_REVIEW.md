# Documentary summary contract (local proposal, not deployed)

`summaryApi.load(group)` accepts only an owned current catalogue group, returns
`{documents:[{id_documento,sha256,opt,scope:'DOCUMENTO',status,cutRows,materialRows,notices}]}`.
The RPC rechecks the actor, programming scope and an exact reservation/system
assignment before returning each associated document. No cut/event write exists.
The adapter checks document identity, exhaustive document membership, contract,
session and catalogue freshness. It never uses group totals to fill PDF values.

The server constructs `documentary_summary` only after the complete PDF has
passed the existing reconciliation. It copies the extractor's profile length
summary and final material requirements into private approval evidence. Both
private import-channel proposal files persist this additional evidence. They
must be migrated with CREATE OR REPLACE in an independently reviewed release;
these historical proposal files are not an executable deployment script.
The new read RPC is deliberately revoked from every application role pending
review of gateway access. Do not deploy only the UI and call the backend ready.

## Meaning and limits
- All rows are document scope, including single-reservation documents. A group
  selects the associated OPT, not an allocation of its printed totals.
- No other reservation IDs, production IDs or raw approval evidence are exposed.
- `sourceProfileSummaries` contains printed lengths, not printed counts of bars,
  pieces or plans. Those three fields are null, explicitly unavailable.
- `scrapPrinted` is the original waste **length**, not a percentage or operational
  scrap registration. Explicit `0"` is preserved.
- `sourceMaterialRows` is *Requerimientos de material* (stock), NOT final project
  detail and NOT reservation allocation. The current extractor drops location
  and observation; these remain null, never guessed from profile or stock code.
- Existing documents return NOT_PERSISTED with empty rows. No backfill or data
  change is done. Idempotent reimport is not promised to enrich old approvals.
  A separate trusted re-extraction/backfill design is still needed for them.
- No global totals are apportioned or deduplicated across reservations.

## Local verification
`node --test tests/opt-document-summary.test.mjs` (5 pass)
`node --test tests/opt-import-handler.test.mjs` (16 pass)
`OPT_PGLITE_MODULE=<installed official npm PGlite>/dist/index.js node docs/sql-proposals/opt-shared/test-document-summary-pglite.mjs`
(11 assertions; actual new SQL, synthetic tables; actor and programming scope are
mocked, not end-to-end production authorization verification.)

No production SQL, Edge deployment, remote publication or historical backfill.

## Follow-up: access and historical preparation (still local)
`document_summary_access_REVIEW.sql` conditionally mirrors the already-enabled
catalogue transport roles anon/authenticated, but changes no SGP user, read role,
access window, RLS policy or service-role grant. New summary RPC continues to call
existing actor(false), validate_scope and in_scope with exact reservation/system.
This is a proposed privilege change, not applied. Verify live existing ACLs before
release; do not broaden access if the catalogue ACL differs.

Empty extracted tables now yield PARTIAL (possibly both empty), with absent rows
and unchanged DOCUMENTO provenance. NOT_PERSISTED means there is no saved evidence;
AVAILABLE means both tables are present, not that every optional column exists.

### Nine historical documents: fail-closed owner-only backfill proposal
1. Obtain a private read snapshot of exactly the nine document IDs/SHA-256,
   approval IDs, manifest hashes and PostgreSQL hash of `evidencia::text`. Do not
   put this operational manifest or original PDFs in this public repository.
2. Obtain originals already authorized for this work. The current SQL schema
   checks PDF bytes at import but does **not** store them. No original means no
   backfill. Match full SHA-256 of bytes, never filename alone.
3. Run the trusted PDF extractor/version on each original; require no extraction
   issues and full documentary reconciliation. Compare existing physical-unit
   positions/reference/length manifest before accepting. Do not rebind to current
   production or recompute assignments. Store only allowlisted documentary summary
   fields using builder + validator; retain private per-document validation report.
4. Privately review the complete nine-entry expected snapshot and summary payload.
   `document_summary_backfill_REVIEW.sql` creates an owner-only SECURITY INVOKER
   helper with no app/service grants. It is **not a server validation boundary**;
   only the reviewed trusted pipeline may supply its payload. No API endpoint.
5. A separately authorized transaction calls it once. It locks in stable order,
   requires exactly nine unique IDs+SHA, matching approval and manifest, unchanged
   full evidence digest, no existing summary. Only adds documentary_summary to
   approvals; any mismatch aborts all nine. No reimport or piece/cut mutations.
6. Before commit compare full before/after hashes of documents/pieces/assignments/
   cuts/events and unchanged approval evidence excluding documentary_summary.
   Review no unknown references/length discrepancies, expose tables with DOCUMENTO
   scope, then verify UI after reload under existing user scope. Do not claim all
   nine enriched until this read-after-write succeeds.

This branch includes no nine-document payload and does not fetch, execute or
schedule any production update. The historical path is prepared, not completed.

### Printed-count extension coordinated with extractor
The summary builder now accepts nullable `bars`, `pieces`, `plans`,
`scrapPercentagePrinted`, `countsPage`, `countsSourceText` from the parser.
Non-null counts/percentage require printed page and text provenance. This does
not derive counts from expanded pieces or replace `scrapPrinted` (waste length).
The parser extension is a separate coordinated commit; without it these fields
remain null. Location and observation are copied when provided, otherwise null.

Additional synthetic tests cover PARTIAL and explicit zero counts/percentage,
and `test-summary-backfill-pglite.mjs` verifies all-nine exactness, duplicate and
stale rejection with atomic rollback, unchanged evidence outside new field,
replay denial and no application-role execute grants. No real SHA fixture.

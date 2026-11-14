# Project data detail — prepared locally, not published

Base main ab10248937e78e20b6b38c3da07ba9fc4a598b14; isolated branch feat/project-data-local. Candidate LAB v456 only; coordinate final version with Retail/labels before integration. Retail branch and backend remain unchanged.

## Verified source and implementation
Original PDF fetched through authenticated Drive and downloaded with the supported file tool. SHA256 3396a6b626dec2729faadbaf118a5ee7307509d2d157f573444a4a280d5b736c, 157295 bytes, 25 pages. Page 1 rendered and inspected; Project data is on pages 1–4. Local extraction recovered 114 consecutive items, 502 pieces, 29 profiles, including 54 multiline Code cells. All profile/code/length/reference values match independent pdfplumber extraction after whitespace normalization; quantities/items also verified. Real source and row payloads remain outside the repository/public patch.

A separate project-data-extraction reader recovers complete Code cells within painted boundaries. It does not change the operational geometric extractor, plans, cuts, Retail handler or reconciliation. The preview CLI consumes original PDF bytes and emits LOCAL_METADATA_PREVIEW_NOT_IMPORTED; it does not call any service.

The optional projectData contract is validated/forwarded by documentary summary service and rendered above existing profile/material summaries. The table preserves Ítem, Perfil, Código/acabado, exact Longitud, full Referencia, Cantidad. Absent metadata keeps existing tables and displays absence, never zero/inferred references. Session, scope, document hash and stale-request checks are preserved.

## Verification
- 279 OPT Node tests passed, including new extraction/contract/service tests.
- Existing reservation summary DOM and new Project data DOM tests passed.
- Real PDF preview: 114 rows / 502 pieces; independent column comparison: zero differences.
- verify:release passed after normal vendor build, candidate v456. This is not deployment readiness.
- Browser PC/mobile harness prepared but NOT RUN: Chromium fails creating its process-singleton socket (Operation not permitted), including admitted escalation. DOM is not layout verification. A private static HTML preview with real rows is available separately for owner inspection.

## Remaining gates
This is a prepared UI/data contract, not a working production source. Current hosted RPC does not expose projectData. No metadata recovery or SQL migration has been written/applied. A reviewed private metadata store/read path must be implemented and tested for identity, ACL, document-wide visibility, idempotency and operational-table invariance before activation. Original PDF hash match is necessary but not sufficient to approve extracted metadata; complete-source review remains mandatory. Current buildOptDocumentSummary only carries projectData when explicitly supplied by the separate verified metadata path; normal imports are unchanged. No reimport is needed or authorized.

## Exact proposed recovery design, not permission to run
Do NOT reuse backfill_document_summaries_reviewed: it is fixed to nine historical documents and only permits an absent whole summary. Do not update immutable approvals/evidence or import new pieces just to add detail.

Propose a private append-only sgp_opt_shared.project_data_metadata table, keyed by document ID plus original PDF SHA256, containing projectData JSON, extractor SHA256/version, metadata SHA256 and server-created timestamp/actor. Foreign-key document identity must be verified against sgp_opt_shared.documents. Repeated identical metadata is idempotent; different payload for the same document/hash is rejected and requires separate reviewed revision policy. No browser or service_role grants for recovery.

Propose owner-only SECURITY INVOKER recovery RPC with parameters document ID, ORIGINAL PDF bytea, expected document/manifest identity snapshot, validated projectData, extractor fingerprint. Recompute PDF SHA256 from bytes in SQL and compare the stored document; lock that document row, recheck snapshot, validate JSON/size/quantity/provenance invariants and insert only the private metadata record in one transaction. The owner must use the reviewed parser and compare the original table; a matching hash alone does not prove the supplied extraction correct. Never insert/update/delete documents, approvals, pieces, assignments or cuts. ACL must revoke PUBLIC/anon/authenticated/service_role EXECUTE. Plan a one-document dry-run report and separately authorized exact batch, never automatic recovery.

A dedicated read RPC or reviewed extension of the existing summary reader must retain actor, scope and exact assignment association checks before joining metadata. Because full Project data includes order/line text across the document, explicitly review full-document visibility against existing redaction rules; documentary visibility must not grant registration. Do not bypass a redacted scheme endpoint. Existing no-metadata documents must remain readable with their old summaries.

Required tests before any SQL proposal is activated: wrong PDF SHA/snapshot rejected; identical replay no duplicate; different metadata rejected; unauthorized caller denied; second-row batch failure rolls back first metadata insert; before/after hashes of operational tables unchanged; read scope/session checks; missing metadata backward compatibility. No SQL recovery function or migration was applied or claimed tested here. This design is preparatory and needs data-contract/ACL review plus explicit application authorization.

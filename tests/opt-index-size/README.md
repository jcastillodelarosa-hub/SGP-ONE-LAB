# OPT original index size correction

Authorized delivery LAB v446. Baseline main LAB v445 (63709ce4). Backend opt-import version 2 deployed ACTIVE first, with verify_jwt=true on 2026-11-12. Frontend publication is pending this PR's CI and merge.

The index's original bytes were rejected at 1 MiB in the local file control, import client and Edge handler, while the bounded XLSX parser already supported a larger file. All three boundaries now accept up to 3 MiB; HTTP JSON request maximum becomes 6 MiB to accommodate base64 for a 3 MiB index and 1 MiB PDF. Original bytes and their SHA are preserved. No client conversion, trimming or index claims become server authority.

PDF remains 1 MiB / 100 pages. ZIP expansion, CRC, passive content, sheet identity, row limits, authorization, idempotency, SQL contracts and cut registration are unchanged. No schema or operational data change.

## Checks

- Client: original index bytes and SHA round-trip at approximately 2.53 MiB and exactly 3 MiB; 3 MiB+1 rejection before read/send; PDF boundary remains 1 MiB.
- Server: real PDF parser + exact 3 MiB XLSX original + exact 1 MiB PDF, complete manifest and synthetic RPC; oversized originals/streamed requests reject before write.
- DOM: input larger than 1 MiB loads, processes and refreshes shared catalog through synthetic RPC.
- Deno: complete original XLSX (3 MiB) through real PDF runtime and synthetic RPC, no network.
- Local deployed-style bundle benchmark: maximum originals completed in ~343 ms, ~227 MB RSS; this is local evidence, not hosted Supabase resource certification. The 5 MiB prototype was discarded because its combined maximum approached the Edge memory budget.

## Delivery order

Update `opt-import` Edge code before exposing the larger index limit in frontend. Then verify a synthetic original through hosted endpoint and authenticated user acceptance. Urgent index correction takes v446; separate matrix-library PR259 must rebase and use the next version. No operational imports or cuts were written. Unauthenticated hosted POST remains 401. Authenticated original-file acceptance is still pending; local parsing alone does not certify it.

Real source workbooks and screenshots remain private outside the repository; they are not test fixtures and must not be uploaded to GitHub.

Exact user workbook (2,655,899 bytes) parsed unchanged locally: Optimizaciones, 299 rows/entries. Maestro repeats relations by finish; no source workbook is committed.

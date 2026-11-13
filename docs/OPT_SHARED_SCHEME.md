# Shared reference and documentary scheme repair

## Corrected flow

Select year, source week and line in Cortes por reserva, query, then choose reservation/system. Referencias y esquema displays only the active reference and its original documentary patterns. Reference navigation does not erase pending piece selections. Technical warnings and the per-piece audit table are collapsed; the separate Resumen tab retains its stacked documentary tables.

## Authority and persistence

The scheme reads an authenticated, scoped server contract, not the local PDF library. Patterns come from verified original extraction. Partial per-reservation piece lengths must never be used to invent stock, kerf, trims, remainder or disposition. The private append-only geometry extension preserves original document/approval/manifest/evidence linkage. Existing cuts, assignments and immutable approvals are not rewritten.

Only patterns containing an authorized reservation piece are returned. Other segments in those patterns remain for geometric context, with their labels and piece IDs removed. The client rejects an unredacted foreign label. Stock and remnant belong to the document pattern, not exclusively to the selected reservation. The diagram is explicitly not to scale.

Clicking an eligible segment only changes its existing authorized ledger checkbox. It does not write a cut. The normal confirmation, persistent idempotency journal and server-owned actor/shift/time remain mandatory. Recorded pieces are disabled and distinctly styled. Read-only actors cannot select them. Documentary IDs and `selectedReservation` never grant write permission.

## Verification

Synthetic unit coverage includes exact echo/scope/document/reference/hash checks, missing plans, redaction, duplicate IDs, invalidation and session changes. DOM coverage includes original lengths, reference navigation, collapsed details, multi-reference selection, exact registration command, cancellation, permission gating and late-response cleanup. Full suite at initial integration: 1269 passed, 10 skipped. Production release requires separate SQL/Edge/Hosting and real-original verification; passing synthetic tests alone is not a deployment claim.

No private PDF, extracted business rows, credentials or historical batch payload belongs in this repository.

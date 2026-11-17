# Accepted PDT impact correction (draft, not deployed)

## Confirmed scope
- Existing `DIFERENCIA` and `MODIFICAR` capture and persist impact already; do not replace them.
- Existing `ACEPTAR` can carry null from an older original PDT. The new capability asks for an explicit number only in that path.
- The live Paneles audit contract requires impact >=1 and <=part/order. This draft preserves it; it does not impose a new rule that zero impact is impossible across all lines.
- No inference from missing-piece quantity, no fallback 1, no historical data backfill.

## Activation
`impacto_paneles_version:1` is returned by the supported backend context only for Paneles. Frontend never imposes it on old contracts or other lines. Existing known impact remains unchanged when accepting. Server validates scope, lock/version, quantity bound and idempotency before writing.

## Already audited receipts
Keep their original audit and its historical report immutable. An additive correction has its own actor, server timestamp, reason, request ID and source `COMPLEMENTO_POSTERIOR`. Only existing administrator/coordinator roles may create it. Readers retain their existing report permissions. Write all missing impacts once transactionally; duplicate identical request returns original result, changed request cannot rewrite the complement.

When more than one pending profile exists, per-profile quantities do not identify distinct panels. Effective quantity is not calculated from their sum. A separately confirmed total of distinct panels is optional; without it the correction keeps effective unknown. The report now uses the explicit later consolidation for updated figures, labeled Actualizado. Original impact is available in a disclosure and CSV. Cards use the same selected source per unique order; current scheduled quantity minus consolidated distinct-panel impact, never sum of profiles. If current quantity has fallen below the recorded consolidation, effective stays unknown pending review. Original ledger is never overwritten.

## Draft UI
- `ACEPTAR`: required explicit missing impact, capability gated.
- Report: distinguish `Paneles sin registrar`, `Por calcular`, missing schedule and missing historical ledger.
- `Revisar impacto` opens one permission-checked context on demand, never N+1 reads.
- Modal keeps original audit untouched, accepts supplementary impact and reason, and freezes an uncertain request to prevent accidental duplicates.

## Verification and remaining gates
44 focused unit tests and two synthetic DOM flows pass. Backend proposals execute successfully in isolated PGlite, including unchanged contract triggers, original snapshot preservation, role/session denial, replay/changed replay, bounds and duplicate-ID cases. Concurrent multi-connection execution and authenticated browser validation remain release gates. No schema or operational writes are authorized by this draft itself.

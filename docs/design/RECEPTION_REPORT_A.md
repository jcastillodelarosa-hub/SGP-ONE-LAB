# Reception report A — implementation draft

Scope: Picking > Reportes > Recepciones. Not merged, deployed or applied to Supabase.

- Scheduled week is the first column. It is the order's current scheduling week, not its reception week or the minimum week of its reservation.
- Total, affected and effective quantities are visible per reception. The four cards reflect the filtered rows, counting an order once using its latest recorded reception snapshot.
- Current schedule quantities are not relabeled as historical received quantities. Existing receipt evidence remains unchanged.
- Exact production key wins. Otherwise an exact order/system/reservation association must identify exactly one production. Missing/ambiguous matches stay unknown, including orders absent from Picking queue. No dependence on that queue remains.
- Unknown quantities make the overall card `Sin dato`, never a partial sum shown as a complete total.
- Effective quantity uses affected windows, not missing-piece quantity. Repeated missing-record identities are counted once. Multiple distinct missing profiles can overlap in physical panels, so the calculation is explicitly `Estimado`, clamped at zero.
- Column menus use the existing SGP pattern: numeric-aware sort with nulls last, value search, select/deselect all, Apply/Cancel/Escape and return focus. All columns can filter/sort. Filters affect cards and CSV; empty selection yields no rows with an explicit clear-filters action.
- Both section reviewers are visible inline. Names are resolved server-side; raw user identifiers are not displayed as names. Historical records without section reviews are not attributed artificially.

## SQL proposal, not automatic migration

`docs/sql-proposals/picking-reception-quantities/area-names-review.sql` and
`report-enrichment-review.sql` extend existing functions only, with source-definition
checksum guards. Existing role validation and privileges are preserved. No operational
rows are written. Apply only after authorized backup/restore review; a changed source
requires rebasing the proposal. Frontend reports missing server support instead of
inventing quantities or weeks. Production application is separate from this PR.

## Verification

- 21 focused Node unit tests including existing receipt regression suite.
- Synthetic DOM: card totals, Cancel/focus, numeric sort, combined filtering, empty state, reload and stale-session response rejection.
- Synthetic PGlite: exact week/quantity, missing and ambiguous associations, partial-programming canonical key, two section names, historical receipt evidence, unchanged role list and no direct user-table access.
- No real names, orders, NCs or credentials are included in tests.
- UI version to be allocated at coordinated integration, not reserved in this draft.

Commands:
`node --test tests/picking-reception-report.test.mjs tests/picking-reception-quantities.test.mjs tests/picking-reception-columns.test.mjs`
`SGP_JSDOM_MODULE=/path/to/jsdom/lib/api.js node tests/picking-reception-quantities/dom.mjs`
`PGLITE_MODULE=/path/to/pglite/dist/index.js node tests/picking-reception-quantities/sql.mjs`

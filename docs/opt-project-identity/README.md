# PROYECTO indexed OPT import correction (review candidate)

Local candidate based on main f1897786f55df8c473a6b2d04d189ffaf3356d62. This PR does not apply SQL, import operational data, or publish the app.

## Changes
- Compare canonical OPT consecutive, not the complete descriptive PDF title; reject ambiguous titles and prefix collisions.
- Preserve PROYECTO reservation cells; reject multiple reservations in one cell instead of choosing the first.
- Server reconstructs original index and PDF. New private context binds exact OPT/index reservation/system and exact authoritative profile destinations. Legacy remains unchanged.
- Identical printed rows form a provenance-preserving group with exact aggregate quantity. Every group member must have the same resolved destination/scope.
- Metadata-backed wrapped header suffix trims only exterior whitespace, retaining content and geometric checks.
- `OPT-PRINTED-ROUNDING-1` allows mathematically compatible printed totals with visible warning; values and quantities remain unchanged. Incompatible or unsupported totals block. All other validation remains enforced.
- Warning persists across catalog/state reads. Private evidence retains original title, printed totals, diagnostic intervals, original row groups and authoritative historical profile classification.

## Rounding model
For a printed length q/32 inch, the closed nearest-rounding envelope is[(2q−1)/64,(2q+1)/64]. The sum of n operands has radius n/64. Intersect aggregate and printed-total intervals; additionally require existence of nonnegative S,C,R,W satisfying S=C+R+W. BigInt avoids floating tolerances.

`ROUNDING_COMPATIBLE` means existence under this explicit model, not exact equality or verified original precision. Diagnostic alone does not authorize import; the full manifest still enforces identity, quantities, sources, profile destinations, programming, access and scope. No cut is recorded by importing.

## Required production steps (NOT performed by PR/CI)
1. Review/apply private context+import proposals in docs/sql-proposals/opt-shared, then warning-read proposal; preserve existing roles/RLS and legacy APIs.
2. Deploy rebuilt opt-import Edge Function with same verified JWT/origin/auth protections.
3. Publish frontend modules/styles only through authorized release process, preserving prior matrix/index limits.
4. Verify authenticated import and re-opened warning using approved operational task; no such write is performed in this PR.
Rollback SQL proposals are provided. Backend additions should precede frontend use; do not imply app publication before verification.

## Tests and privacy
Only synthetic fixtures are committed. Original PDFs/workbooks, read-only operational snapshots, real payloads and private findings remain outside this repository. Unit, DOM, browser-isolated and PostgreSQL/WASM tests run without production credentials or external writes. SQL harness stubs preexisting actor/scope/base import to test proposed functions; it does not certify intersession concurrency or production E2E.

## LAB v448 release preparation (2026-11-13)
Version candidate increments v447 to v448, with matching HTML app/CSS cache bust and
build-release label. The final source SHA must be stamped by the existing workflow,
not a guessed release commit. Base main verified at f1897786f55df8c473a6b2d04d189ffaf3356d62.
All existing Hosting protected-file pins match; policy/workflow and gates unchanged.
SQL application and Edge deployment are tracked separately and must precede frontend publication.
No operational OPT import is authorized by this preparation.

Hosting workflow `firebase-hosting.yml`: main pushes with unchanged certified runtime
policy take the existing auto-publication route. Do not merge before backend readiness
and exact source checks are complete. Explicit `prepare` only seals an artifact;
`inspect` only reads live identity. Explicit `publish` requires full source SHA,
reviewed prepare run ID and ZIP SHA256, release reason, and freshly inspected
`expected_live_version`. The existing workflow admits only main and its designated
LP branch; this feature branch is not an admitted dispatch target. Never modify pins
or disable a gate to publish. Verify artifact and public HTML LAB v448 plus exact
`data-release-commit` and postcheck before marking PUBLISHED/VERIFIED.

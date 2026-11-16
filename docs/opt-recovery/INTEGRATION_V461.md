# OPT integration candidate v461 — local only

Date: 2026-11-16. Base: main `64706c945db11c5d1d36b799095271c98f841579`.
Recovery source: `9e957cd4a8e2636acd4233934d189854212d6fad` (`recovery/opt-v460-rebuild`).

The recovery branch was 6 commits ahead / 9 behind main. A local non-fast-forward
merge completed without conflicts. Alert code, `src/modules/lp01-operation.js`,
planner integration and `deployment/lp-hosting-policy.json` remain identical to
main. Main's alert entry points in index.html are retained. Version and cache
busts are now v461 because main already contains the v460 alert candidate.
No remote main change, Hosting publication, Edge deployment, migration, hosted
query or operational data mutation was performed in this integration.

Included recovery behavior: save controls before the cut layout; immutable
uncertainty journal; exact identity export; certificate lookup that fails closed;
explicit exact-file manual retry with stable attempt UUID. This candidate does
not certify historical imports 213/215 or prove Retail persistence.

## Verification on integrated candidate

- `npm test`: 1,349 cases; 1,339 passed, 10 skipped, 0 failed.
- `node --test tests/opt*.test.mjs`: 324 passed, 0 failed.
- DOM: import-upload-dom, shared-workflow-dom, approved-ui-dom passed with local
  fixtures. Covers repeated clicks, cancellation, late navigation, uncertain
  responses, identity matching and absence/error blocking.
- build:opt-vendor, build:vendor and verify:release passed for LAB v461.
- `git diff --check`: passed.
- Chromium PC/mobile rerun blocked before launch: sandbox `socket() failed:
  Operation not permitted`; escalation also failed. Neither browser test ran.
  Historical `validation.json` belongs to the recovery source, not this merge.
- SQL / Deno were not rerun: backend source is byte-identical to the previously
  validated recovery candidate. No hosted verification is claimed.

## Next step

Keep the independent PR270 alert deployment handoff unchanged. Before any OPT
release, confirm current main and live version, then run PC/mobile acceptance
for this exact integrated commit in a working browser executor. Coordinate the
separate Retail Edge candidate and verify outcome before enabling real retries.
Do not reapply installed migration `20261114221005`, rerun uncertain deployments,
clear pending journals, or import PDFs automatically. Preserve source branch.

# PR281 isolated CI fixture alignment

The two failing LP01 checks use the same source/fixture bytes on base b45b580 and
OPT head934a26b. The OPT diff changes neither component nor these tests.

- The summary browser check expected explanatory copy replaced by the approved
  compact UI. It now checks current copy and explicitly requires unknown combined
  totals to remain unknown; all keyboard, NC/physical independence, draft,
  concurrency and revocation assertions remain.
- The shared-order fixture stopped before the optional novelty-number migration.
  Current UI sends noveltyReference, rejected by that old writer. The isolated
  helper installs the current baseline writer followed by the actual migration,
  retaining dependency/ACL checks. The unassigned test now also checks a synthetic
  novelty number in persisted data and rendered output, with no turn/assignment
  creation and all prior balance/access/idempotency checks retained.

Only tests and this note change. No product code, endpoint, route, hosted SQL,
production data or deployment changes. Python syntax and whitespace checks pass.
Local Chromium cannot launch in this executor and Docker is unavailable; complete
browser/PostgreSQL acceptance must run in the existing isolated GitHub CI jobs.
Do not label the corrected checks passed until that exact commit finishes CI.

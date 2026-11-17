# Multi-code accessory alert candidate

Base main LAB v469, 4dd702ae. No version increment, hosted migration, real accessory rule or deployment in this candidate.

Coordinator searches the real catalog by description or code, then explicitly selects up to 100 codes. Selection persists while filtering. One message is saved atomically for the chosen codes. No code is guessed, preselected or seeded. New rules start inactive until explicitly enabled. Existing rule replacement requires acknowledgement; rules remain independent per code rather than a permanent named group.

ADMINISTRADOR and COORDINADOR can configure accessory alerts. Coordinator navigation exposes only the Alerts tab within Configuration; other users retain their existing navigation behavior. Original production reader authorization, private table privileges and rule matching are unchanged. The batch writer preserves exact catalog-code checks and optimistic revisions; any failure aborts all writes. Uncertain save outcomes lock editing until reload. Older session/mount responses cannot overwrite newer controls.

## Verified locally

- 7 service/markup regressions pass.
- 37 PGlite PostgreSQL checks pass, including coordinator/forbidden roles, exact codes, duplicates, 100-code bound, whole-batch rollback, revision conflicts and function-only rollback.
- 16 JSDOM configuration/production-renderer checks pass.
- Multi-selection DOM: description/code filters, selection and message persistence, explicit replacement, role/session revocation, uncertain saves and stale mounts pass.
- Existing window typography contract passes.
- Isolated test dependencies installed from committed lockfile. Browser PC/mobile test now covers coordinator saving two selected codes; visual execution remains pending in CI. Prior local Chromium failed due to socket policy and was not retried here.

Only synthetic fixtures are included. These tests do not certify a live plant session. Before release: compare live function definitions, review/apply the migration under authorization, complete browser/CI verification, coordinate version and publish through existing gates. Database migration must precede new UI. Rollback restores prior function permissions and removes batch RPC without deleting rule rows.

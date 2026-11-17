# Permission and serialized-conflict QA (isolated, synthetic)

Copy the two new test files under `tests/picking-impact-sql/` in the integration checkout. They use existing SQL proposals and `live-guards-test-only.sql`. No frontend or SQL proposal was edited here. No database connector writes, pushes or publication were performed.

## Passed role matrix

| Action | Allowed tested | Rejected tested |
|---|---|---|
| Accept missing panel impact | RECEPCION, LIDER LINEA, LIDER, PICKING, SUPERVISOR DE PICKING, ADMINISTRADOR, COORDINADOR | OPERARIO, ENSAMBLE, EMPAQUE, invalid |
| Read historical-complement context | PICKING, SUPERVISOR DE PICKING, ADMINISTRADOR, COORDINADOR | RECEPCION, LIDER, LIDER LINEA, OPERARIO, ENSAMBLE, invalid |
| Write complement | ADMINISTRADOR, COORDINADOR | PICKING, SUPERVISOR DE PICKING, RECEPCION, LIDER, LIDER LINEA, OPERARIO, ENSAMBLE, invalid |

Role names are exact installed application roles, not job titles. An employee whose actual application role is PICKING is covered by PICKING. This does not newly grant the literal role OPERARIO. Report context restrictions match the current report role list; audit permissions remain broader and unchanged.

The role/session adapter maps test tokens to synthetic role strings. These tests prove the SQL's allow-list branching and transactional behavior, not actual authentication sessions or organizational assignments.

## Serialized contention and stale-state checks

- Invalid audit impact leaves the missing value unmodified; retry succeeds; a second reviewer then gets `FALTANTE_YA_REVISADO` with one decision retained.
- Current partial-programming cap is enforced at the time of acceptance.
- Failed complement writes leave no ledger row; corrected same-request retry succeeds.
- Exact retry returns saved response. Another actor reusing the request is rejected. Another request targeting the completed receipt is rejected.
- Reloading context after another writer succeeds yields `can_complement=false`.
- Scheduled quantity reduced between context/read and save is re-read; out-of-bounds save fails with no ledger row.

PGlite runs these statements through one connection. This verifies serial outcomes, rollback recovery and uniqueness/idempotency guards. **It is not a two-session contention/lock stress test.** PostgreSQL multi-session staging QA remains a release check if required. The deployed statement-level locks and unique constraints are retained/proposed but are not claimed to have been load-tested here.

## Command

Set `PGLITE_MODULE` to the installed PGlite entry point and run:

```
node tests/picking-impact-sql/test-accept-permissions.mjs
node tests/picking-impact-sql/test-complement-permissions.mjs
```

Both completed PASS with the integrated proposals.

## Added real PostgreSQL CI harness (execution pending)

`tests/picking-impact-sql/postgres-concurrency.py` uses two real connections plus an observer against a fresh PostgreSQL 17 service. It waits until PostgreSQL reports the contender in `wait_event_type='Lock'`, then releases the first transaction. Cases: exact idempotency retry, different request against same receipt, first writer rollback followed by successful second writer. Each case checks one stored complement and an unchanged historical fixture.

Python compilation passed locally. No local PostgreSQL/docker is available, so **runtime success is not claimed until the separate CI job passes**. `CI_SERVICE_SNIPPET.yml` provides service/environment suggestions. The script refuses non-local hosts and any database name other than `sgp_impact_qa`, requires `SGP_SYNTHETIC_PG=1`, and fails if target fixtures already exist; it does not drop existing objects. Credentials and names are synthetic CI-only values.

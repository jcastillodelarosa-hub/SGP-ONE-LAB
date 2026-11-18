# Retail V4: reservation eligibility (isolated review)

Retail selects documents by exact reservation in the selected line/original week.
Documentary system is retained as evidence but does not restrict eligibility.
Proyecto preserves its existing reservation+system contract. Both client selection
and queued jobs share the same explicit-origin matcher.

V4 is a separate private server contract. It retains canonical SGP system in piece
assignments, exact document/production identity, profile destination, original week,
line, programming, permissions, idempotency and ambiguous-identity rejection.
Existing contracts and uncertain requests are not migrated or retried. V4 rejects
legacy recovery requests. No endpoint or SQL activation is included in this PR.

Local evidence: 130 unit/contract tests; PostgreSQL WASM integration including
rollback; 11 Deno tests using actual PDF runtime; Deno endpoint type-check.
Native concurrency and effective PostgREST timeout are pending the synthetic CI
job. WASM and simulated SQL error responses are not evidence of those properties.
The CI job uses disposable network-isolated PostgreSQL/PostgREST and synthetic
inputs, no production credentials. Hosted Edge/PostgREST configuration must still
be checked separately before an explicitly authorized release.

Deployment gates: independent review, native concurrency/timeout pass, fresh
fingerprint, endpoint runtime validation, versioned release and separate explicit
approval. Rollback proposal revokes only V4 execution, preserves all records, and
does not certify an uncertain in-flight request as rolled back.

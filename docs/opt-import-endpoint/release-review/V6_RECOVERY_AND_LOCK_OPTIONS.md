# Exact v6 recovery and context lock review

## Recovery result — exact Edge source still missing
Read-only recovery checked the local worktrees/temp artifacts; Git history for documentary_plans/persist_document_plans; public fix/opt-shared-scheme branch9e99f86 and its preceding commits; GitHub default-branch search; Library OPT filenames/content; the prior release conversation; and Storage artifact metadata filtered to OPT/bundle-like source archives. None yielded the deployed v6 serializer or bundle. The relevant GitHub run43412509691 has only opt-synthetic-browser, and its workflow uploads tests/opt-digital/evidence, not the Edge source. Backend geometry was intentionally separate from the sanitized public UI commit.

Supabase get_edge_function repeatedly returns UNAVAILABLE/ProtocolError for opt-import. There is no authenticated management CLI in this executor. These are missing source/access capabilities, not a rejected production deployment; no replacement was attempted. Next exact recovery channel is the original deployment executor/artifact or a functioning authorized function-source download. Do not substitute a newer repository build for v6 rollback.

The live definitions of v1, Proyecto v2 and persist_document_plans were recovered by read-only pg_get_functiondef and retained privately with SHA256ea145d99f7415a32dab30eb5e8fcc122715101580b734b6a9d38e6b83b1df171. This preserves the receiver contract but is not the Edge serializer. No original document bytes or real row IDs were needed for that snapshot.

## Integration gates once exact serializer arrives
1. Verify source archive against deployment metadata/bundle provenance. Preserve unmodified recovery copy and reproducible rollback instructions; do not conflate an eszip hash with a JavaScript-file hash.
2. Extract serializer and its dependency versions/build configuration. Compare against the current parser/core by semantic diff before merging CPU/Retail changes. Verify extractor_sha256 identifies the actual reviewed extractor/build, not an arbitrary source hash copied from old code.
3. Wire documentary_plans and extractor_sha256 into all handler paths that the current v1/v2 SQL requires. Add v3's call to persist_document_plans in the same transaction as import_manifest. Do not change append-only tables or rewrite historical approvals/assignments.
4. Test original geometry coverage, reference/page/pattern/bar/cut positions, exact lengths, cut ordering, remainder/disposition, replay equality and changed-geometry rollback. Test failure after manifest insertion rolls back document/approval/pieces and retains zero cuts. Exercise v1/v2/Retail, mixed weeks and Frame documentary pieces.
5. Re-profile the complete integrated path; earlier Edge probe stopped at writer boundary and did not include this missing serialization or persistence. Keep publication blocked until these gates pass.

## Lock impact
The candidate v3 SHARE table locks prevent INSERT/UPDATE/DELETE on profiles, productions, programming headers and details until transaction end, including absent/new matching rows. They also delay unrelated DML on those tables, across lines/weeks/reservations. Ordinary reads and concurrent SHARE holders are compatible. NOWAIT prevents the importer from queuing behind pre-existing DML, but DML arriving after an import can wait behind it. The lock covers the SQL writer transaction only, not PDF/index parsing; nevertheless geometry persistence will extend the critical section and must be measured after integration. The two-second pause in the concurrency regression is a deliberate synchronization barrier, not an observed production latency.

Do not claim the current mechanism is operationally free or that it hardens deployed v1/v2. It is a conservative v3-only proposal, not yet installed. Existing-row locks alone were experimentally insufficient for inserts. An advisory consecutive lock coordinates v1/v2/v3 imports but not independent programming/master writers.

## More precise alternatives
| Option | Closes post-read insertion window? | Dependencies / tradeoff |
|---|---|---|
| Existing row locks + revision reread | No | Reproduced phantom insert after final reread. |
| SERIALIZABLE transaction alone | Not this commit-order requirement | A concurrent insert may serialize after the import without a dangerous cycle; no guaranteed rejection merely because it commits first. It also needs caller isolation/retry handling. |
| Per-selector/profile guard rows + mandatory writer protocol | Yes, if every affected writer participates | Guard nonexistent identities too; lock old and new keys for updates/deletes; include bulk loads, programming header/detail changes, reservations and profile classification. Acquire sorted keys; use server-derived selectors. Smaller contention domain but requires inventory and modifications/triggers on all mutation paths, migration/backfill and new two-session tests. Not safe to introduce partially only in Retail. |
| Global revision guard maintained by triggers | Yes, with mandatory locking protocol | Less intrusive SQL syntax but still global serialization; not a narrower operational scope, and changes all writers. |
| Current SHARE tables + NOWAIT | Yes for tested context-table DML | No cooperation by other writers required, but broad contention. Retain only as reviewed fallback until exact v6 integration can be timed. |

Recommendation: do not relax the proven guard to row/advisory-only locking. For sustained/batch use, design the per-selector/profile protocol as a separately reviewed database change; until then either approve the measured short critical section of v3 after integration or keep activation blocked. No new triggers, roles, locks or policies were applied to production in this investigation.


## Focused operational follow-up after b918462
Status: LOCAL TESTED / NOT APPLIED / NOT PUBLICATION READY. v6 and the candidate SQL guard are unchanged.

Read-only catalog inspection found 1,386 productions, 178 programming headers, 448 details and 236 master profiles. Nine public function bodies contain direct context-table mutations. Their locks do not constitute one reservation protocol:
- Weekly loading uses week/global reprogramming advisory keys and existing-row locks.
- Export approval uses an EXPORT/line key and existing-row locks.
- Programming/parts paths use production-key namespace 742 (parts also 741); detail INSERT trigger also uses reservation/key. This partial cooperation cannot protect every absent selector.
- Legacy programming reconciliation and reorder have no explicit matching advisory lock.
- Profile administration locks the existing profile row; no mandatory guard for absent profiles or every classification mutation was found.
- Header guards do not provide a common reservation advisory protocol. Production partial guard uses 742 only for specified updates; it does not guard all new production identities.

This is a targeted static inventory, not proof that every dynamic/admin mutation path was enumerated. The concrete counterexamples suffice to reject a Retail-only per-reservation lock. The unchanged v1/v2 consecutive lock coordinates imports, not these context writers. Adding 742 to Retail would still miss new identities, header changes and master classification.

### Focal workload and observations
New script: scripts/profile-opt-retail-lock-load.py, using private inputs through the existing local setup helper. PostgreSQL 17.11, network disabled, no hosted resources. The unchanged writer and observed geometry receiver process the larger original payload (255 pieces / 59 plans); subsequent calls replay idempotently. Synthetic unrelated rows bring each context table to the observed cardinality, then 10x (13,860 / 1,780 / 4,480 / 2,360). Relevant primary/detail and production-ID indexes exist. ANALYZE statistics are refreshed before trials. Real production triggers, RLS, full row widths, other indexes, network and hardware are not replicated.

Three trials per related-header update, unrelated-header update and eight-writer burst (one related, seven unrelated), at each scale: 18 import calls total. Persistent psql sessions remove process-launch delay; no injected delay inside or after the measured import. UPDATE of the same state value exercises real DML locks without altering context/revision. This isolates contention; it does not benchmark the complete programming RPC. Eight simultaneous writers and 10x volume are sensitivity scenarios, not observed traffic rates. No throughput/p99 or saturation claim.

| Scale | Import statement elapsed | Related DML elapsed | Unrelated DML elapsed | Eight-writer DML elapsed |
|---|---:|---:|---:|---:|
| Observed row counts | 36.099–95.044 ms | 36.711–72.955 ms | 30.420–34.256 ms | 29.411–32.012 ms |
| 10x row counts | 79.169–108.806 ms | 70.892–75.475 ms | 70.727–73.333 ms | 73.800–99.840 ms |

Without import, unrelated DML elapsed 0.313–1.591 ms (six controls). These are SQL statement durations, not exact isolated lock-wait durations; pg_stat_activity confirmed Lock waits for related and burst cases and two of three unrelated cases at 10x. A missed short sample does not prove absence of a wait. Import statement elapsed is an upper bound on internal guard duration in these autocommit tests. Prior two-session insertion-race/atomicity tests remain valid and were not repeated.

Opposite ordering: a pre-existing unrelated DML transaction caused OPT_CONTEXTO_OCUPADO in 22.130 ms; document count stayed one, physical-piece count 255, cuts zero. A one-second barrier established this ordering only and is excluded from normal latency measurements. No deadlock or timeout occurred in the 18 natural trials. The local container was removed afterwards.

### Decision required
Do not weaken the guard based on the short local measurements. There is no verified common per-reservation contract to reuse. A narrow implementation requires separately reviewing and enforcing old/new sorted guard keys for every production, header/detail and profile mutation, including absent rows, moves and bulk writers; classification guards must protect all dependent reservations. Triggers or mandatory writer rewrites plus access-path coverage are prerequisites, not optional cooperation assumptions.

If retaining the current broad guard, the operational owner must accept cross-reservation waiting and explicit busy failures, choose maximum tolerated transaction/wait duration and workload limits, and verify timeout/rollback and representative scheduling load. NOWAIT bounds only acquisition; it does not cap the time a later writer waits once Retail owns the tables. Neither a client timeout nor these small local samples establishes that cap. Until that choice and enforcement are reviewed, activation remains blocked. No production changes are needed to keep the current v6 path working.

Evidence: tests/opt-digital/retail-lock-load-result.json and retail-lock-writer-inventory.json. PostgreSQL lock conflicts match the official documentation: https://www.postgresql.org/docs/17/explicit-locking.html .

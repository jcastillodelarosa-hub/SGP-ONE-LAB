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

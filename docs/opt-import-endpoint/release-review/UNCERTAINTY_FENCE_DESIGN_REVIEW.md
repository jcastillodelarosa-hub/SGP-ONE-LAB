# Global import uncertainty barrier: design only

No real hashes, original identities or consecutive numbers belong in this repository.
Load exact identities privately from preserved attempts, with independent reconciliation.
Two rows or a certificate string alone do not prove the registry covers both real attempts.
Hash PDF OR exact consecutive blocks substitutions of filename/origin/index/scope. The
index hash and original scope are retained for reconciliation, not used to weaken the OR.
No fuzzy identifiers, no clearing journals, no auto-release on age, no automatic retries.

Draft SQL stores registry privately, defaults CLOSED, checks expected active count and
uses transaction-held locks against concurrent administrative registry changes. Document
and source INSERT/UPDATE triggers reject guarded identities across every origin and
writer touching these tables. Missing registry/control and unavailable locks fail closed.
Closing rollback preserves registry and documents. Existing read/cut tables are unchanged.
Closed mode pauses all new document/source mutations, including Proyecto: this impact
must be explicitly scheduled/authorized, not silently introduced during Retail release.

Coverage gap: a writer can return an existing duplicate receipt without mutating either
protected table. Therefore triggers alone are NOT a complete request-entry fence. Before
activation inventory ALL deployed import entrypoints/RPCs/owner calls, add a reviewed
assert_import_fence(pdf_hash,consecutive) precheck before duplicate/recovery paths, and
verify no legacy route bypasses it. V4 must perform the same precheck before writes.
Do not alter unknown deployed definitions or recovery contracts speculatively.

No trigger can retroactively cancel a statement already executed in an unresolved
transaction. Finish/certify the earlier operation first; acquire bounded DDL locks before
install. A timeout during migration is not permission to retry blindly. Preserve evidence.

Tests: synthetic PGlite validates default closed, hash and consecutive blocks across
origins, update protection, role denial, count mismatch, closing rollback and retained
records. NOT native concurrency certification. Add multiconnection tests proving import
vs registry changes serialize, closure cannot race commits, unavailable locks do not write,
and duplicate RPCs cannot bypass prechecks before any release.

Independent prerequisites still open: explicit V4 router mode (no fallback); endpoint
JWT/CORS/config entry; new release version; hosted timeout/runtime checks; final fingerprint;
independent review and explicit production authorization. None was activated by this design.

## Coverage refinement and avoiding unnecessary Proyecto downtime

Proposed approval trigger now checks all original sources before persistence, and
assert_import_request computes SHA from original PDF bytes and checks source consecutive
and OPT source key. It must be called before any cached receipt/recovery return.
This proposal does NOT automatically rewrite existing deployed functions.
Normal writers inserting approval are covered by that trigger, including duplicate imports;
INSERT ... ON CONFLICT still fires BEFORE INSERT triggers. Cached recovery receipts
require the explicit precheck. Original recovery permits must not bypass unresolved
quarantine; release requires separately certified closure, not reusing an absence certificate.

Proyecto with unrelated identity is accepted once the registry is certified and complete.
Avoid a prolonged closed phase: prepare and verify the PRIVATE registry in staging, then
install the triggers and certified control atomically under bounded locks after old
operations have closed. Never commit a missing registry as an operational rollout. A
registry outage/mismatch deliberately closes imports because changed-origin retries must
not bypass protection; reads and cuts continue. This exceptional availability tradeoff and
brief DDL locking still require explicit authorization. No data population is in public SQL.

Native synthetic test added: shared read locks serialize against closure, registry writes
reject concurrent import NOWAIT, cached receipt precheck blocks matching identity even
when labelled Proyecto, unrelated Proyecto is allowed, repeatable-read isolation is rejected,
and rollback preserves registry. No native result claimed until CI succeeds.

## Request-entry integration proposal (offline generator)

`scripts/build-opt-fence-precheck-review.mjs` takes six independently reviewed private
`pg_get_functiondef` snapshots plus signatures and SHA256 checksums. It emits SQL only;
it neither connects to a database nor executes output. The complete allowlist is legacy
v1, Proyecto v2, Retail v3, proposed Retail v4, resolved-Retail v1 and owner import_manifest.
The five RPC calls are inserted immediately after actor authorization, including before
resolution locks and its cached receipt return. The core call follows the approval lookup
and required-approval check, before document duplicate handling. This closes both observed
receipt bypasses without changing documentary validation or resolution permit semantics.
The output checks the current definition digest before each CREATE OR REPLACE; a missing,
drifted or partially patched function aborts the transaction. ACLs/owners are not recreated.
Private output must not be committed. V4 must already exist in the same reviewed rollout;
its absence aborts rather than silently reducing coverage.

Compatibility: the new precheck obtains registry SHARE NOWAIT before resolution_gate and
before table writes. Existing resolution_guard remains installed and authoritative: its
permit cannot bypass unresolved quarantine. Absence certification acquires target-table
locks NOWAIT, so it fails instead of waiting in a table/advisory lock cycle. Registry
maintenance must also use NOWAIT/bounded locks, never call import or absence certification
while holding registry write locks. Closing the fence preserves resolution decisions,
permits, consumption and documentary data. Do not drop old guards or replay a receipt as
proof of closure. Reopening needs independent certified registry reconciliation.

These are source-fixture tests, not a claim that generated replacements have been applied
or exercised against production. Native coexistence testing with the complete installed
recovery schema, fresh read-only function fingerprints and independent review remain
required before any deployment. Prior native CI certified barrier primitives only.

# Atomic uncertainty fence: rollout review, not authorization

The synthetic harness installs a nine-row synthetic registry, trigger barrier and all-six
writer prechecks in one transaction. It sets certified control only after the exact count
and private ACL assertions. Injected failure before COMMIT must remove all new objects and
restore original writer definitions/owners/ACLs. Closing rollback retains registry, original
approvals and documentary data. This harness never accepts real identity exports.

## Evidence required before adapting the proposal to production

1. Preserve the original browser identity export privately, verify its contract, exact field
sets, identityText/requestHash, PDF/index hashes, names and scope. Reconcile every entry,
not just the original Retail subset. Hash self-consistency proves integrity, not execution
termination or database absence. A matching archived PDF is corroboration, not closure.
2. Obtain control-plane terminal evidence for EACH deployment incident: project/function,
UTC start/end, version or source fingerprint, operation/request IDs where available, and
provider confirmation no older operation remains queued/running or can complete later.
If IDs were never returned, give exact time window and source/version to provider and ask
for correlation. Do not infer closure from elapsed time, ACTIVE metadata, a new deployment,
an empty activity snapshot, connection loss, or lack of document rows.
3. For each import request, preserve original request identity and all receipts/errors/log
correlation. Need a definitive server commit receipt OR confirmed aborted/rolled-back
request with no delayed execution. Then reconcile document hash, origin+source key,
approvals, assignments, cuts/events and recovery consumption. Conflicting or partial state
requires manual reconciliation, not automatic deletion or reimport. The quarantine registry
can retain conservatively protected identities while outcome reconciliation continues;
it cannot retroactively cancel an old running statement.
4. Verify a current usable backup/recovery path: timestamp, coverage (database is not code
or Storage objects), retention, restore target/procedure and ability to test restoration
in an isolated environment. Do not restore production or purchase a plan. Existing code
bundles, old before-images and ACTIVE_HEALTHY are not evidence of a current database backup.
5. Fresh read-only inventory of all writers, overloads, owners, ACLs, trigger ordering,
function definitions and fingerprints. Stage V4 without a client route or unexpected
execution grant. The offline generator does not certify live inventory completeness.

## Proposed activation order, only after explicit approval

- Separately schedule short import-write locking; unaffected read/cut behavior must be
verified. Review security remediation independently; do not silently change public RLS or
other application permissions as part of this fence.
- Under bounded locks, one reviewed outer transaction installs registry/control/triggers,
loads independently validated PRIVATE identities, installs exact-fingerprint-guarded
prechecks, verifies ACLs and exact identity set, then sets the approved control certificate
and count. There must be no intermediate committed closed/empty registry phase.
- Do not concatenate existing proposal scripts with separate BEGIN/COMMIT frames. The
synthetic wrapper demonstrates composition but is not the final production migration.
- Confirm commit/receipts and metadata before routing clients. If response is ambiguous,
stop and inspect; never rerun the migration or import on a timeout assumption.
- Deploy separate versioned endpoint only after old deployment closure; verify JWT/CORS,
runtime identity, contract, effective timeout and allowed RPCs. Switch explicit router
mode and release version together, never fallback to an older unguarded writer.
- Confirm unrelated Proyecto and reads remain usable with approved non-destructive checks.
Do not create production documents or cut events simply to obtain a green test.

## Reversal paths

A failure before COMMIT rolls back the whole atomic migration. After verified COMMIT,
fail-closed containment disables new imports while preserving registry, decisions, receipts,
documents and cuts. Disable new client routing as necessary, but never restore an unguarded
writer as a shortcut. Preserve evidence and reconcile any interrupted request separately.
An old function before-image is not a safe rollback if it removes quarantine protection.
Recovery to open service requires independently reviewed registry/certificate and explicit
approval, not count manipulation or deletion of unresolved entries.

## Support consultation scope (draft only; do not send automatically)

Keep deployment incidents separate. An existing earlier opt-import ticket does not cover a
later Retail-recovery deployment unless support explicitly correlates both. A follow-up
should state the later function, UTC incident window, requested source/version/fingerprint,
observed deployed version and missing tool receipt, and ask:

- Did this later request reach the control plane? What terminal status/operation ID exists?
- Can any older queued/running request still overwrite the function?
- Which exact version/fingerprint is active and when did it become final?
- Is a separate versioned deployment safe without retrying the uncertain operation?

Request diagnosis only, no provider changes/deployments/restores. Do not attach browser
identity exports, PDF/index files, tokens, keys or raw customer data. User authorization for
sending and its destination must be checked separately. No support communication is sent
by this proposal.

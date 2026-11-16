# OPT: shared machining program, v462

Owner clarified on 2026-11-16 that Frame and Panel cutting use the same machining
program. OPT replaces paper cut tracking; physical profile classification is not
changed to Panel. No automatic cut completion is introduced.

## Applied to LAB database

One bounded append-only reconciliation added 1,253 missing assignments across nine
existing OPT documents to each document's unique, valid shared program. Each OPT
had one exact documentary reservation/system selector. Current and imported Frame
profile classifications agreed. Nine separate approval records retain the original
approval/manifest references and owner-authorized reason. Original document hashes,
lengths, assignments, approval evidence and completed cuts remain unchanged.

Before mutation, six affected/dependent tables were exported privately and restored
to an isolated database. Row counts and canonical JSON hashes matched the live DB.
After the single transaction: 3,007 pieces, 3,007 assignments, zero unassigned;
original 1,754 assignments and nine approvals unchanged; one event/three cuts unchanged.
This is not evidence of a newly completed physical cut or live authenticated UI test.

## Prepared source

Project Edge entrypoint explicitly enables the shared program policy. The private
validator still requires exact index reservation/system, unique production and valid
programming. Frame/Cover/Refuerzo/Muntin classification remains canonical. The switch
cannot be supplied by a browser request. Original documentary identity and piece
lengths are preserved. A later reimport whose original manifest differs remains a
conflict, never an implicit replacement.

Retail does not enable this policy. Its uncertain recovery deployment and historical
213/215 attempts are not repeated, unblocked or declared complete by this change.

## Verification and release state

- SQL synthetic test: exact association, ambiguous programs, canceled programs,
  inactive profiles, wrong systems, excluded productions, wrong fingerprint rollback,
  append-only preservation, no cuts and idempotency PASS.
- Full Node suite: 1,354 total, 1,344 passed, ten skipped, zero failed.
- Release verification v462 PASS. SQL change independently reviewed.
- Database reconciliation APPLIED and verified; new Edge source NOT DEPLOYED yet.
- get_edge_function could not return the active opt-import v6 source. Exact source
  recovery/rollback must be established before replacement. Active listing remained
  v6, archive 9549778565ab05db17d63e273f6cbd1949d549e2cba7c7a6eaae84e37fd1cf82.
- Firebase release remains v461 until this candidate's CI, merge and Hosting checks.

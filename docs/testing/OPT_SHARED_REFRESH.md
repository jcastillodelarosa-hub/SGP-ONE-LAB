# Shared OPT progress refresh (isolated candidate)

Read-only state refresh every20 seconds while the page is visible, and on window
focus/visibility recovery. It reuses authorized readers and never calls a writer.
Requests do not overlap. Navigation invalidates older responses; destroy removes
timer/listeners. The pieces viewport scroll is restored after automatic refresh.

Automatic refresh pauses during selected pieces, confirmation, sending, pending
uncertain operations, search focus, or an enlarged matrix. Selected pieces show a
pause notice. Existing manual refresh semantics remain explicit: discard selection.
This deliberately avoids changing prepared physical-cut confirmations behind the
operator. Existing server guards remain the final authority when saving.

Synthetic two-session DOM checks cover timer/focus updates, no writes, hidden page,
selection/confirmation preservation, single-flight, retained uncertain journal,
and teardown. Existing shared-workflow DOM tests cover stale navigation, storage
failure, authorization and idempotent retry. These are not plant acceptance.

No import endpoint, routes, database, real cut or external session changed.
Version470 is provisional only; coordinator must allocate version before release.

# Retail release package — execution not authorized

## Pins and independent review
Baseline main observed: ab10248937e78e20b6b38c3da07ba9fc4a598b14 (LAB454). CPU preparation febd571; Retail implementation142d414, including approved rounding aba95fc and isolated probe5aaa6f9. CPU patch and Retail patch are sequential, not interchangeable: apply CPU patch to baseline, then cumulative Retail patch based on febd571. Independent reviewer must review the combined tree, not just the small activation patch. No public original PDFs, index, snapshots, session tokens, real UUIDs or private evidence logs.

No release number has been assigned to this combined backend package. Labels candidate455 (ad8addc) remains separate and must be reconciled with current main at publication. Do not overwrite an independently published UI or reuse a stale version number.

## Required preflight / stop conditions
Read current main/PRs and live function version/hash again; no duplicate PR. Record allowedOrigins, JWT setting and exact rollback bundle for LAB opt-import v6 (observed hash9549778565ab05db17d63e273f6cbd1949d549e2cba7c7a6eaae84e37fd1cf82). A source commit is not a deployable rollback bundle. If the actual bundle cannot be retrieved or matched, stop Edge publication until a verified recovery artifact exists. Preserve all unrelated functions and environment values.

Review actual definitions of actor, validate_scope, in_scope, import_manifest and warning reader against tested contracts. Confirm new v3 names absent; if present, compare instead of replacing blindly. Export definitions/ACLs and inspect existing grants/RLS. Obtain independent review result and explicit authorization covering public PR/merge, the two private SECURITY DEFINER functions, opt-import replacement and any selected UI publication. Prior sandbox authorization does not cover LAB.

## Ordered execution after approval
1. **SQL only:** apply import_context_retail_v3_REVIEW.sql, then import_channel_retail_v3_REVIEW.sql, each transactionally. Do not apply install_REVIEW.sql or rebuild existing tables. Do not reapply rounding_read_warnings_REVIEW.sql: its helper already exists; verify sanitized warning propagation by read-only inspection. Stop if dependencies or ACLs differ. Postcheck exact signatures/security-definer/search_path/privileges. No document import to test SQL in production.
2. **Edge:** after SQL postcheck, apply the supplied activate-retail-v3.patch to the reviewed release tree. It adds retailV3:true and exactly two RPC names to the server allowlist. Bundle existing opt-import entrypoint with the verified incremental worksheet reader, PDF extraction fix, Retail contract and rounding logic. No probe, test harness, fixtures, private snapshot or source-document bytes in this bundle. Review and hash actual dependency-complete bundle. Deploy only LAB opt-import, verify_jwt=true; preserve existing origin policy and credential storage. Record returned function version/hash. Never derive service-role credentials from browser settings.
3. **Read-only/negative postchecks:** verify unauthenticated/invalid-session calls fail before parsing/writing. Confirm logs contain no startup/import failures. Read catalog/state with an existing authorized session only if available; do not invent a user token. Synthetic successful persistence remains local; live import is a distinct approved operation. Stop on incompatible contract, scope/ACL change, missing warnings or CPU termination. No retry loop.
4. **UI last (if included and separately approved):** backend change requires no new request fields; current UI already handles warning codes. Include only browser-needed parser/domain changes in the sealed positive-list frontend artifact. Labels branch is optional independent scope, not a prerequisite. Run release verifier and PC/mobile against artifact, preserve release numbering/cache stamps, exclude src/server probe and all test/private files. Hosting workflow main push is deployment-sensitive: inspect gate policy and use prepare/inspect/publish flow with source SHA, sealed ZIP hash, expected live version and retained rollback version. Do not merge casually assuming it only prepares. Verify deployed bytes/version after publication.

## Exact permission boundaries
New signatures:
- public.sgp_opt_import_contexto_retail_v3(text,jsonb,text,jsonb,text[])
- public.sgp_opt_importar_retail_validado_v3(text,bytea,jsonb,jsonb,jsonb)
Both SECURITY DEFINER with empty search_path; EXECUTE only service_role, revoked from PUBLIC/anon/authenticated. No browser grant, table grant, RLS relaxation or new cut-registration role. Session actor and BASE/PANELES_2/year/week checks remain inside SQL. Full label+reservation+system and exact profile destination resolve identity; finish is checked against the original index. Frames documentary pieces remain unassigned even if another line has programming. Final writer rereads context/revision under existing locks, validates scope/actor and uses immutable/import-idempotency infrastructure. Competing existing observations and session revocation are tested; no claim of global predicate locking against every phantom insertion.

Rounding is the approved uncertainty model, not a proved generator cause. ±1/64 inch per printed value, accumulated quantities and joint conservation, warning OPT_PRINTED_ROUNDING_COMPATIBLE, originalPrecisionVerified=false. Never change printed measurements, quantities or summary values. Outside envelope or incomplete/ambiguous identity remains blocked.

## Reconciliation of the two uncertain originals
Do not encode operational identifiers/hashes in public SQL. Keep a private reconciliation worksheet with verified original PDF/index hashes, origin, consecutive and exact scope. The current private read-only check found zero matching document hashes, Retail source rows and approvals for both originals. That observation is time-bound, not authorization to resubmit.

Immediately before any approved manual import: stop the active batch at the client without duplicating requests; verify pending invocation state/logs and repeat exact hash + source/consecutive checks. Query all origins for the same hash to identify pre-existing document reuse. Compare persisted original index hash, validation contract, source identity, manifest hash, assignments, warnings and cut events if a row exists. Do not infer absence from a client error.

Decision table:
- Exact document/source already committed and semantically matching: show/read existing result; no import.
- Same hash with different/missing source, changed manifest/assignment, or source pointing to another hash: blocked reconciliation review; no overwrite, deletion, forced relink or automatic retry.
- In-flight or unreadable state: remain uncertain, wait/read again when settled; no retry.
- No document/source/approval after requests are settled: candidate for a separately authorized manual import using unchanged original PDF/index, origin and scope. Rebuild context from current master/programming; do not trust old local snapshot as authority.

If an authorized single attempt yields transport uncertainty, stop and re-query state. Never run both documents in a blind batch. Expected local documentary/assigned counts and warning profile counts are in private evidence; compare without treating them as new authority if programming has changed. Existing cut records must never be marked, corrected or cleared by this procedure.

## Rollback
Stop initiating new imports first; identify and settle in-flight requests by observation. Restore the verified previous opt-import bundle with its original JWT/origins, and verify metadata plus invalid-session rejection. This restores legacy behavior; it does not undo accepted Retail documents and is not permission to resubmit them through v1. Leave new private SQL functions unused initially. If removal is needed after no execution can reference them, use import_retail_v3_ROLLBACK_REVIEW.sql (writer first, context second). Never delete document/source/approval/piece/assignment/cut/event rows; prior successful imports require read-only reconciliation.

For UI rollback use the retained Hosting version via the reviewed recover flow, with fresh expected-live check. UI and Edge rollback are separate operations. No project pause/reset, unrelated secret changes or global config disable. Authorization for rollout should explicitly include these narrowly scoped recovery operations.

## Evidence and remaining gates
287 OPT tests passed before additive harness; SQL synthetic persistence/reader warning/idempotency/scope/session/competing-state tests passed; PC/mobile Retail+Proyecto warning/remount tests passed. Deno original handler regression including3MiB index passed. Local official Edge Runtime six fresh workers passed with hard CPU2000ms, memory256MB, no network/writes, CPU978–1052ms; busy-loop control cancelled at2011ms. Memory40.6–43.5MB is shutdown measurement, not peak. No hosted hardware/version/SQL-latency equivalence is claimed. Containers, image and temporary input copies removed.

Remaining gates: independent review, reproducible verified v6 rollback bundle, exact final activation build/hash, fresh session/ACL/context checks, approval for production SQL/Edge/publication, and separate decision on manual import after uncertain-state reconciliation. No production step in this plan has been executed.

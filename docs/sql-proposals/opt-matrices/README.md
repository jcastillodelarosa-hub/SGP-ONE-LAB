# Private matrix catalog — implementation proposal

Not applied to any database or storage service. No real drawings belong in this
repository. Source files and candidate mappings remain in private preparation.

## Read contract

POST `opt-matrix-read`, platform JWT and JSON `{p_token,sistema,referencia}`.
`OPT-MATRIX-1` returns `available`, `unavailable` or `ambiguous`. Only an exact
system/reference pair is used, with no case folding, prefix match or fallback.
More than one non-retired candidate is ambiguous, including a pending revision.
A single candidate must have an explicit approval with reviewer/evidence/date.
The response projects only image PNG bytes/base64, hashes, page and revision;
no source location, storage path, signed URL or internal comment is exposed.
The image limit is 4 MiB. Actual downloaded bytes must match stored size and SHA.

The service-only resolver reuses the current OPT actor: enabling this catalog
never expands role lists or bypasses module access. Tables have RLS and no grants
to browser roles or service_role. Only the constrained read RPC is callable by
service_role. The server uses its private credential to fetch the exact derived
content-addressed image object. Browser URLs should be short-lived Blob URLs,
revoked on selection change, panel disposal or session change, without IndexedDB caching.

## Explicit application steps, not executed here

1. Review/apply the new private schema; `enabled=false` by default. Verify the
   existing `sgp_opt_shared.actor` identity and current roles before application.
2. Review/create the private PNG bucket via `storage_REVIEW.sql`. Confirm no
   inherited broad `storage.objects` policy exposes it. Do not copy to Hosting.
3. Authorize private upload of validated image assets and import source metadata.
   Keep ambiguous candidates pending. Preserve revisions; retire only after a
   separate deliberate review. Do not infer the currently valid revision by date.
4. Deploy the endpoint with platform JWT verification and the existing allowlist.
   Test unauthorized, missing, ambiguous and known synthetic/image reads.
5. Enable the catalog only after those checks and authorized release. No OPT cuts
   are created, replaced or modified by any part of this proposal.

Containment disables catalog reads, preserves assets and all production data, and
can neutralize the endpoint if needed. It cannot retract bytes already viewed.

Tests: `node --test tests/opt-matrix-handler.test.mjs`; run `test-synthetic.mjs`
with `PGLITE_MODULE` pointing to a local installed PGlite module. All sources in
these tests are fictional. A passed isolated test does not prove a live deployment.

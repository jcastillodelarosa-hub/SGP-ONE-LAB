# Retail publication gates — read-only follow-up

No deployment, migration, secret, hosted resource, original import or Resumen change performed. Prior test results remain valid and were not rerun.

## 1. Hosted timeout: what is known and what is not
Read-only metadata on LAB reports PostgreSQL17.11, nine sessions named PostgREST14.18, and no Retail v3 RPC yet. opt-import remains ACTIVE v6 with unchanged deployment fingerprint; the separate Retail endpoint does not exist.

Whitelisted pg_db_role_setting inspection found anon statement_timeout3s, authenticated8s, authenticator statement_timeout8s/lock_timeout8s. No persisted db-hoisted-tx-settings, db-pre-config, db-pre-request or db-config override was returned. Existing weekly-loader and read RPCs declare their own statement_timeout; this is evidence of function configuration, not proof their hosted timer is effective.

The connector runs as postgres/application_name=mgmt-api: its statement_timeout2min and null current_setting('pgrst.db_hoisted_tx_settings',true) are NOT the live PostgREST session values. SQL cannot read another backend's arbitrary GUCs via pg_stat_activity. No server file/env reading was attempted. The available connector exposes SQL, logs and function metadata but no PostgREST configuration endpoint. A static function inventory cannot prove hoisting.

PostgREST14 documentation includes statement_timeout in the default db-hoisted-tx-settings list. This makes support plausible, not verified deployment configuration: environment/config/pre-config may override defaults. Reference: https://docs.postgrest.org/en/v14/references/configuration.html#db-hoisted-tx-settings .

Minimal read-only next step: an already-authorized operator/provider exposes only the effective db-hoisted-tx-settings value (and whether db-config/pre-config overrides it) from the running PostgREST configuration. No password or secret needs to be shared. Alternatively an existing authorized read-only diagnostic RPC could report the setting through the actual API, but none has been established here; do not invent one or call a writer as a probe.

If effective configuration cannot be obtained, the remaining behavioral verification needs separate authorization: a bounded read-only diagnostic through actual PostgREST, with a known per-function timeout and controlled delay, plus cleanup if it requires a temporary function. That would be a new hosted object/test and is NOT authorized or executed now. Do not time out a real business RPC, alter global settings, import documents or claim the local12.2.12 proof verifies hosted14.18. Keep activation gated.

## 2. Retirement without password or temporary resources
The old cleanup blocker concerned the ability to remove a NEW hosted endpoint if rollout is stopped; it did not concern v6 or data deletion. Current tools can deploy/replace a named Edge function but cannot delete it. Therefore physical deletion is not currently available via these tools.

A safe alternative can be reviewed as part of the future rollout authorization:
1. Frontend optRetailMode=paused prevents new submissions in refreshed clients. This alone does NOT disable stale/direct callers.
2. Replace ONLY opt-retail-import-v3 with retirement/index.ts + handler.mjs, maintaining gateway JWT verification. The artifact has no credentials, body reading, parser, RPC or network calls. POST/GET/other methods return a definitive rejection of this attempt, OPTIONS only handles preflight. The existing client journal still preserves any previous uncertain outcome.
3. Do not assume replacement cancels an already-running old isolate or database transaction. Reconcile in-flight outcomes read-only and let the bounded SQL transactions settle. Never resubmit originals or send them to v6 as fallback. A cache of the old frontend cannot cause writes once routed to the retired version, subject to old in-flight instances settling.
4. Verify the deployed version/fingerprint and rejection with a synthetic request before declaring functional retirement. Retain private v3 SQL/data for existing document reads/audit; no destructive rollback. Optional physical endpoint deletion can occur later through an authorized management channel.

This is functional retirement, NOT physical removal. It needs explicit authorization to replace the future endpoint and acceptance that an inert hosted endpoint remains. It can use the existing authorized deployment connector without a new password, new secret or temporary resource. Nothing was deployed now. The local retirement artifact's two focused tests passed. No live endpoint is created just to test cleanup.

## 3. Labels integration, without modifying its branch
Candidate: feat/opt-reservation-labels, HEAD ad8addc, worktree /workspace/SGP-ONE-LAB-labels. Tracked files clean; untracked node_modules/vendor left intact. Baseline ab102489(v454), candidate v455. Its own review document records independent synthetic tests and no publication authorization. No changes were made there.

Labels functional files: opt-digital/workflow.js, opt-digital/sgp-theme.css, src/domain/opt-reservation-label.js; tests for label grouping/workflow/browser. It adds src/domain/opt-reservation-label.js to scripts/opt-artifact-files.json. It does not include Retail SQL or the importer endpoint.

Retail/labels overlap: index.html, scripts/build-release-info.mjs, scripts/opt-artifact-files.json, SGP_ONE_CHECKPOINT.md, docs/linea-produccion/ESTADO_OPERATIVO_ACTUAL.md. A non-checkout git merge-tree of Retail c5f81fb and labels ad8addc produced conflicts ONLY in the two continuity markdown files. Both version files make identical v454→v455 changes. The artifact allowlist auto-merges both src/domain/opt-import-endpoint.js and src/domain/opt-reservation-label.js. Retail does not edit the labels workflow/theme files. No merge or cherry-pick was applied.

Integration plan: create a separate integration branch from the latest approved Retail commit; merge the labels commit, preserving both continuity histories and writing one current status; retain both artifact entries. Check current remote main and actually published version at that time. If neither candidate has published, combine as one v455 release; if either v455 already published, increment the integrated release to the next unused version in both stamps/cache busts. Never publish two different deliveries as v455. Regenerate Retail's over-inclusive source fingerprint because workflow.js and theme changes affect its source manifest; rebuild final artifact. Run only integration-relevant labels workflow/selection + Retail routing/message + release artifact checks, reusing unaffected CPU/SQL evidence. This plan does not grant labels merge/publication authorization or include pending Resumen work.

## Minimal remaining actions
- Obtain effective hosted hoisting configuration in read-only form, or separately authorize the bounded behavioral diagnostic described above.
- Include acceptance of functional retirement (rather than guaranteed deletion) in the eventual deployment approval.
- Integrate labels only after coordination/authorization, choose one unused version and verify the final artifact/fingerprint.
- Obtain explicit SQL/Edge/UI rollout approval. No user credentials need to be requested for the read-only findings or the prepared retirement artifact.

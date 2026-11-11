# OPT v439 publication review

Status: reviewed packaging and implemented candidate. Backend installation and controlled publication still pending. No claim of productive import or human acceptance.

## Existing release controls retained

The OPT packaging changes do not replace Firebase credentials, project, site, live channel, deployment job, source pin, ZIP digest, runtime/visual distinction, exact inventory verification, before/after live identity checks or retained-version recovery checks.

The five changed protected scripts were reviewed specifically:

- `prepare-lp-main-visual.py`: adds the exact OPT asset list and an isolated `/tmp/opt-artifact-*` review output. Synthetic visual behavior remains a separate artifact mode.
- `seal-lp-visual.py`: reads the same validated output location; still stamps the source and seals sorted artifact bytes.
- `prepare-lp-runtime.py`: copies the explicit frontend OPT assets only. Server code, SQL, tests, documents and private inputs stay outside the public root.
- `prepare-lp-hosting-plan.py`: permits only the listed OPT modules, including the two pinned PDF.js `.mjs` files. Extra modules, private PDFs, path traversal, symlinks, unmanifested files, mismatched hashes and missing dependencies remain rejected.
- `lp-verify-downloaded-artifact.py`: reconstructs the artifact from the exact source and compares its file inventory and bytes before any Hosting action.

The initial local artifact review passed the complete runtime package and five negative cases, plus seven inventory/public-byte postcheck tests. A focused policy check confirmed that updating reviewed hashes still causes `POLICY_TRANSITION_REQUIRES_EXPLICIT_REVIEW` on push. Source drift and unapproved asset drift still block publication. The inherited local history lacks one historical legacy-tree file required by the complete policy test; the same unmodified full test passed on remote head 919f824 and must pass again on the final remote head. This local limitation is not converted into a passing result.

The additional protected `supabase/config.toml` change adds only `[functions.opt-import] verify_jwt = true`. The existing LP block remains byte-equivalent and JWT verification stays enabled. This sixth pin is reviewed as a new, explicitly authorized OPT boundary, not an exception to the protected-file gate.

The current integrated artifact test again passed source/ZIP inventory and byte checks, rejection of a mismatched digest and rejection of a self-consistently resealed artifact missing a source asset. Server imports, bundled server fonts, SQL and private input files are absent from Hosting. The reviewed policy updates exactly these six hashes and the observed retained baseline below; mode, credential use, gate logic, required source/digest pins and before/after checks are unchanged. A policy-changing push remains HOLD and requires the existing explicit reviewed publish operation.

## Observed current baseline

Firebase workflow [43031813999](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/43031813999), controlled job 130560684949, published source `53b4054619e3be5a7282b816fd8ecd73401bc5bb` on 2026-11-11.

At 13:45:19 UTC it observed FINALIZED live version `sites/sgp-one-lab/versions/54ba640d99bb8317`. API inventory contains 170 paths, including the two retained Firebase-managed paths. The postcheck verified 168 application files byte-identical to that source. Inventory SHA256: `be0d70d56624252ab72f0122bdc34caaad16fafe1fc7fa9fe20095dec7c852d5`. Configuration SHA256: `b1c8097ce32ce29d3d39d04e54f86699c1cd013dcbfc8a4f9b89f033cadc34fd`.

This is a timestamped observation, not a fresh mutation-time assertion. Publication must reread live identity and stop if it differs. The exact retained version is the recovery target, not a rebuilt branch artifact. Do not reuse an older baseline from the historical LP rollout.

## Backend and final release conditions

The new OPT import endpoint, its exact runtime compatibility, private SQL contracts and activation remain subject to final verification. A server-held privileged credential must stay out of frontend configuration and public artifacts. The existing LP function and JWT setting remain unchanged. No synthetic user, production cut or real document is created to make a readiness check pass.

Before publication, record the final commit, all CI results, reviewed artifact run/digest, SQL installation receipts, endpoint version/JWT setting, activation scope and negative authentication checks. Update only the exact reviewed policy pins and baseline/rollback references. The policy transition must stay held until the explicit publish operation with those material inputs. Verify the final visible LAB version and data-release-commit after publishing.

Matrices work is separate. No real PDF, index, user record or private manifest belongs in this repository or Hosting artifact.

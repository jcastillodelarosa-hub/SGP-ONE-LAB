# Shared private matrix viewer (not deployed)

The existing SGP visual system is the design reference: blue actions, navy text,
white drawing canvas, bordered cards and mobile-friendly native dialog. No
external visual redesign or illustrative replacement of technical drawings.

## User flow

- Local OPT viewer: select a reservation/system, then a profile reference. The
  viewer queries that exact pair. A file name alone does not establish a system.
- Shared cuts: each reference has **Ver matriz del perfil**. This reads its stored
  system/reference and displays the original reviewed document page.
- **Ampliar matriz** opens the source page in a modal. Close/Escape returns focus.
- Missing means **Matriz no disponible**. Multiple candidates mean pending review,
  never a fuzzy replacement. Errors remain visible and allow a repeated selection.
- This is a visual guide only. It does not credit cuts or alter production orders.

The module routes the existing SGP session to a dedicated authenticated read
endpoint. Images are integrity checked, displayed using temporary Blob URLs, and
not retained in localStorage/IndexedDB or public hosting. Selection/disposal
invalidates late responses and revokes previous image URLs.

## Source review

A private source inventory exists outside this repository. Filename-derived
system/reference/revision are **candidates**, not approved manufacturing metadata.
A PDF may contain other profiles in an assembly, different codes in the title
block, multiple pages, or a document version distinct from filename revision.
Before enabling an entry, verify the exact SGP system, title-block reference,
source page and the document edition with its provenance; retain reviewer/evidence/date.
A uniquely matched source can be a visual guide without claiming that engineering
has approved its current manufacturing validity. Do not silently equate a file
REV label with a drawing VERSION field.
No real drawing, catalog source ID or private source link belongs in this repo.

## Checks and release boundary

Unit tests: `node --test tests/opt-matrix-{handler,library}.test.mjs`.
DOM tests: `node tests/opt-matrix-library/dom.mjs` (requires jsdom; optionally set
`JSDOM_PACKAGE` to an installed package.json).
Existing OPT workflow/native-session/shared-catalog DOM suites remain applicable.
SQL proposals and isolated SQL tests: `docs/sql-proposals/opt-matrices/`.

These local tests do not prove live database privileges or hosted rendering.
Before release: authorize/apply private storage+schema, inspect existing storage
policies, deploy the endpoint, import only reviewed source mappings, test hosted
read/denial/ambiguity and mobile zoom, and increment the release version using the
current branch baseline. Do not overwrite a concurrently released OPT UI change.
The backend feature gate defaults off. No production write was performed here.

## Exact staged activation scope

1. Read-only preflight: confirm current OPT actor/RPC signatures, deployed origin
   allowlist, role gates, bucket absence and all applicable storage policies.
2. Apply only reviewed new objects: private schema `sgp_opt_matrices`, its three
   tables (`config`, `documents`, `entries`), index/page trigger, and public
   service-only resolver `sgp_opt_matriz_resolver_v1`. `config.enabled=false`.
3. Create only private bucket `opt-matrices-private` (PNG, max 4 MiB). No public
   policy and no grant to browser roles; no changes to other buckets.
4. Deploy only `opt-matrix-read`, with platform JWT verification and existing SGP
   session/OPT actor checks. No new admin role or credential given to users.
5. Release reviewed frontend assets over the current v445 baseline, increasing
   version at release time. Run synthetic CI and hosted authorization/denial QA.
6. Separate data approval: upload reviewed original-page PNGs to that private
   bucket and insert source hashes/page mappings. Keep unresolved candidates
   pending. This step has **not** been executed and must not be inferred from
   permission to inspect Drive. Full PDFs remain in the existing source location.
7. After correct mapping/revision approval and hosted verification, enable reads.
   Containment flips the matrix-only gate off, preserving documents and all cuts.

No deletion, existing reservation/cut update, broad role change, backup workflow,
public drawings or real-data CI artifact is part of this scope.

## Source-selection rubric

The review is of the source-to-reference binding, not an engineering approval.
A candidate can be technically ready as a visual guide when its primary title
block identifies the exact reference, the SGP pair exists, the correct full page
is identified and no unresolved competing document is known in the supplied
corpus. One source can serve multiple exact SGP pairs when each is observed.
Folder names and filename prefixes alone do not establish any of these facts.

Display edition provenance explicitly in `revision`, for example “Archivo REV1;
dibujo VERSION7”, or “Sin revisión identificada”. This is a source label, not a
claim that REV1 and VERSION7 are equivalent or that the drawing is current.
The operator still checks the physical profile. A technical review may approve a
verified batch; there is no blanket requirement to ask the owner about each page.

Require resolution only for actual ambiguity: conflicting documents for one
reference, unresolved multipage drawings, illegible/missing title-block code, or
missing system evidence. Do not choose a revision merely by date or file name.
Different source hashes remain distinct until equivalence is established.

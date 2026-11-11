# OPT server import endpoint

Implemented locally; not evidence of hosted deployment or production activation.
The entry point is `supabase/functions/opt-import/index.ts`. It calls the real
parser, shared index reader, exact manifest validator and protected SQL import.
The tests use synthetic fixtures and isolated PostgreSQL, never a mock as a
production backend.

## Request and authorization

POST JSON to `/functions/v1/opt-import`:

- `p_token`: existing SGP session token.
- `scope`: exactly `{linea:'PANELES_2', anio, semana, modo:'BASE'}`.
- `source`: exactly `{origin:'RETAIL'|'PROYECTO'|'DESCONOCIDO',opt,mode:'INDICE'|'INDIVIDUAL'}`.
- `pdf`: exactly `{name,base64}`, original PDF bytes.
- `index` for INDICE: `{name,base64,format:'xlsx'|'csv'|'json',sheet?}`.
  XLSX defaults to ARCHIVOS for Retail and Optimizaciones for Proyecto. An
  explicitly selected missing/hidden/ambiguous worksheet is rejected.
- No index for INDIVIDUAL. No plans, extraction, manifest, assignments, bindings,
  approval flags or evidence from the client are accepted.

Platform `verify_jwt=true` stays enabled. Use the existing public gateway anon
JWT at the client, never the server key. The server uses standard
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables internally.
No new credential is created or exposed. It checks real SGP session, one of
ADMINISTRADOR / COORDINADOR / LIDER MECANIZADO, and an existing Mecanizado access.
The SQL actor independently enforces enabled configuration, configured roles,
real session and access again. Nothing here grants client SQL access.

Default origins are the two existing LAB Hosting origins. Optional
`SGP_OPT_ALLOWED_ORIGINS` uses the same exact HTTPS origin validation as LP.
No wildcard CORS or other LP configuration is changed.

## Server processing and identity

1. Read bounded original bytes, authenticate and authorize SGP.
2. SHA-256 the original PDF and index. Parse the complete PDF and selected index
   on the server. The index makes documentary claims, not authorized assignments.
3. The PDF's printed document ID must be unique. INDICE must match its OPT;
   INDIVIDUAL derives the canonical OPT from the PDF, not the uploaded filename.
4. Read `sgp_opt_import_contexto_v1` for all documentary production IDs, with no
   line/week prefilter that could hide real ambiguity.
5. Build documentary links from original index rows, or for INDIVIDUAL from exact
   production IDs printed in the PDF joined to all SGP candidates. Multiple or
   missing reservations/programs return concrete diagnostics, not invented units
   or a generic human-approval requirement.
6. Run `functions/opt-import-manifest-core.mjs`, including exact 1/32-inch
   arithmetic, per-reference quantities, stock and final summaries. Rejection
   means no import RPC is invoked. Other original weeks remain assigned to their
   real programming; changing the viewed week never rewrites the document.
7. Invoke `sgp_opt_importar_validado_v1` with private bytea, pieces and evidence.
   SQL locks existing context rows and re-reads the entire context before import.
   A committed change before that read changes its revision and rejects the
   import atomically. That read is the observation point; later concurrent
   program insertions are not blocked by gap/predicate locks and do not reassign
   this original binding. No global locks or role isolation changes are added.

INDICE source_key is `OPT:${encodeURIComponent(opt)}`. INDIVIDUAL source_key is
`SHA256:${sha256}`. Same PDF/manifest remains the same document across modes and
weeks. SQL serializes by consecutive before checking existing sources: a
*different* PDF hash with the same consecutive is rejected if origins match or
if either is DESCONOCIDO. This prevents duplicating units by switching upload
mode. Two explicit Retail/Proyecto origins are not automatically equated.
Same-PDF changed assignments remain rejected, not overwritten.

SQL persists immutable document/hash/source/piece/assignment records, not a raw
PDF/index object store. This endpoint does not introduce original-file download
or physical inventory/cut events. Every imported unit remains PENDIENTE.

## Response

Success HTTP 200:

- `contract:'OPT-IMPORT-1', ok:true, physical_completion_verified:false`
- `data:{contract_version:2,id_documento,duplicado,cantidad_piezas,sin_asignacion,
  import_contract:'OPT-IMPORT-1',ok:true,physical_completion_verified:false}`
- `document:{sha256,source_key,origin,opt,mode}`
- `scope` is the validated request scope.
- `totals:{documentaryBars,documentaryCuts,cutLength32}`
- `scopeTotals:{assigned,outsideScope}`

`documentaryCuts === cantidad_piezas`, `assigned + outsideScope === cantidad_piezas`
and `outsideScope === sin_asignacion` are checked server-side and by the client.

Errors include `contract,ok:false,code,error,definitive`. Validation errors and
SQL P0001 rollback are definitive. A lost write response, transport failure or
incompatible success response returns `OPT_IMPORT_OUTCOME_UNKNOWN` with
`definitive:false`: retry the exact same originals; never fabricate success.
Documentary blockers are bounded to 100; each candidate list to 20 and nested
issues to 100, with full counts provided. Nothing is partially imported.

## Exact limits and runtime caveats

- HTTP request: 29 MiB; decoded PDF: 16 MiB; index: 5 MiB.
- Core PDF reader and private SQL independently cap PDF at 32 MiB; the public
  handler is deliberately stricter to reserve memory for bytea and validation.
- 500 PDF pages; 100,000 text items/page; 500,000 total items; 8,000,000 characters.
- 500,000 operators/page; 2,000,000 total operators; 100,000 path commands and
  600,000 path coordinates per path; 4,000,000 path coordinates total.
- 100,000 expanded cuts, 20,000 per pattern, 10,000 repeats. 1,000 documentary
  production IDs; 20,000 context rows; at most 2,000,000 row×context or row×index
  comparisons. The XLSX reader bounds ZIP/XML expansion at 16 MiB and 64 entries.
- One active import per isolate. Others receive HTTP 429 before parsing.
- Resource-limit rejection before the write has no persistence. Platform failure
  after a write was attempted has an uncertain outcome and an idempotent retry.

PDF.js is pinned to official `4.10.38`. Its modern build and explicit worker run
in process, without native canvas, evaluation, XFA, runtime font fetching, PDF
JavaScript execution or annotation navigation. Fourteen unmodified official
standard fonts are bundled with their licenses. Unsupported external CMaps and
unknown font resources fail closed. All pages must complete. The operator cap
is checked after PDF.js builds a page operator list, so it is not an allocator or
CPU sandbox; these caps do not guarantee a hostile file fits Edge budgets.

Deno 2.2.12 tested the actual PDF adapter and handler with PDF/CSV/XLSX, real
pinned dependencies and no runtime network. Whole entry typecheck passed.
These local Deno checks do not establish Supabase Edge CPU/heap limits or
hosted verification. Actual Edge entry boot, JWT, service-role RPC and
representative file budget still require staging/hosted verification before
claiming the flow verified. No real PDF, index, reservation or user record is
included in repository evidence.

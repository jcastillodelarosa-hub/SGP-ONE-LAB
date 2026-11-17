# Missing panel impact: bounded SQL proposal (not applied)

## Verified scope

Only **ACEPTAR with missing impact** changes. Existing MODIFICAR and Reportar diferencia already validate and save impact; their SQL branches are unchanged. Current installed rule is integer >= 1 bounded by partial-programming quantity, otherwise the exact order quantity. This proposal retains it for PANELES_2, does not invent zero, and does not reject/overwrite a legacy known zero when merely accepting. Other production lines keep their present contract.

The area-context capability advertises `impacto_paneles_version: 1` only for PANELES_2. The writer resolves the line from the linked PDT/order on the server, not a client flag. An omitted/invalid impact is rejected, never defaulted to one or inferred from piece quantity. Existing PDT/receipt locks, role validation, version matching and idempotency remain in their current wrappers. Known PDT impact conflicting with an entered value is rejected. Existing closed-PDT and identity guards are not bypassed.

## Files and application order

1. `accept-missing-impact-review.sql`: checksum-guarded replacement of area processor and area context. Atomic. Original accepted-row snapshots and history capture the before/after values at audit time.
2. `complement-history-review.sql`: new private append-only-by-API ledger and public context/write RPCs. Entire schema creation fails if that schema already exists, requiring inspection rather than repeat.
3. `report-capability-review.sql`: checksum-guarded report enrichment with row-level capability and stored-complement availability. Original quantity/snapshot fields are unchanged. A single unique ledger join adds impacto_complementario with source, actor name, timestamp, explicit consolidated impact and quantity recorded when complemented. No client N+1 queries: context loads only on user action.

No migration or SQL here has been executed against the connected database. Existing functions' complete definitions were inspected read-only. No operational rows are present in these files.

## Historical complement contract

- `sgp_picking_impacto_contexto(p_token text,p_id_entrega uuid)` returns `ok`, `contract_version:1`, `pendientes` (alias `pendientes_al_recibir`), `cantidad_programada`, `can_complement`, and `complemento`.
- Read access uses the current report roles (ADMINISTRADOR, COORDINADOR, PICKING, SUPERVISOR DE PICKING). `can_complement` is true only for ADMINISTRADOR/COORDINADOR, exact supported line, known order quantity, at least one historical null, and no prior complement.
- `sgp_picking_impacto_complementar(p_token,p_id_entrega,p_id_solicitud,p_detalle,p_motivo)` requires current ADMINISTRADOR/COORDINADOR authorization. `p_detalle={faltantes:[{id_faltante,id_pendiente,ventanas_afectadas}],total_consolidado:null|integer}`.
- All and only missing snapshot identities must be supplied; known values cannot be amended. The unique complement per receipt stores actor, current timestamp, reason, original snapshot, observed current order quantity and full request/response. Exact idempotent retries return the saved response; changed reuse or another correction to the same receipt fails.
- Original historical receipt/PDT data are never updated by this complement. The response source is `COMPLEMENTO_POSTERIOR`, distinct from `LEDGER_AUDITORIA`. `nombre` and `registrado_en` are available in the context complement object.
- One distinct impacted identity can use its explicit entered quantity. For multiple identities, no effective total is published unless a consolidated total is explicitly entered. The consolidation is bounded between maximum individual impact and min(order total, sum of distinct reported impacts). Duplicate known identities are counted once; conflicting duplicates fail. This sum is only a validity ceiling, never an inferred total.
- If no consolidation is supplied with multiple identities, per-item data are retained and `cantidad_efectiva` remains null. The current report/cards may use the explicit consolidated impact with current scheduled quantity, clearly marked Actualizado, while historical helper/disclosure preserves the original values. A null consolidated value stays unknown; no implied sum. The quantity recorded when complemented is supplied separately for provenance and is not mislabeled as the current schedule.

## Proof completed in isolated PGlite

`test-accept.mjs` executes the complete proposed area processor with the unchanged production contract/identity triggers and synthetic dependencies. PASS: missing fill persisted to PDT/faltante, original and new snapshot, piece quantity preserved, unknown/fraction/zero/out-of-bounds rejected, known values unchanged, other line unchanged, closed PDT rejected atomically, bad role rejected.

`test-complement.mjs` executes actual proposed schema and RPC definitions with synthetic report/session adapters. PASS: missing-only identities, invalid quantities, unchanged history, role denial, private ledger denial, one complement, exact retry and changed-retry rejection, explicit-vs-missing consolidation, duplicate-identity ceiling, unsupported line. Session adapter tests permission boundaries, not live account login.

`test-report-capability.mjs` exercises actual proposed report definition over synthetic exact/missing/ambiguous mappings; capability follows canonical order, not reserve or a different production. Tests verify one-row-per-receipt after ledger join, unchanged historical pending snapshot, source/name/time, current quantity distinct from recorded complement quantity, and explicit versus null consolidation. Also retains original source-guard and restore tests.

The tests use PGLITE_MODULE for the installed PGlite module. Tests under tests/picking-impact-sql use repository-relative SQL fixtures. Multi-connection contention and authenticated browser integration remain release checks, not claimed here.

## Backup and rollback

Capture fresh definitions/owner/ACL and verify proposal hashes before deployment. Never retry a migration after an uncertain result; read back first. Keep the original function definitions separately from the public repository.

Before any complementary record exists, the new ledger is empty; rollback may restore original report/context/processor definitions and remove new RPCs/schema only after that emptiness is verified and approved. If any complement exists, do NOT drop or purge it. Restore UI capability/read-contract versions or disable new write RPC access under an explicit rollback plan, retaining ledger data for later recovery/export. Restoring original audit processor never rewrites already-completed audits. Frontend must not be made to guess or submit stale values after rollback.

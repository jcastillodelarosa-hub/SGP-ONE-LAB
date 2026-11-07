/**
 * Isolated reference service, NOT an endpoint or an activation switch.
 * No production import/route uses this module. No RPC, database or HTTP client.
 * Partial reimports replace present values and preserve previously reported keys.
 * Plan means the version effective at close, with reason/time history, but that
 * complete version/reason/time history is not yet available. The existing planner
 * is Ensamble-specific; SALE and Disponible are never substitutes for its plan.
 * This isolated writer keeps comparison and continuity explicitly unavailable.
 * The future persistence adapter must supply auth + sources under the existing
 * stage/turn/source locks. See the integration contract before wiring anything.
 */
import {parsePowerBI, bytesBase64, POWERBI_VERSION} from '../domain/powerbi/adapter.js';
import {previewExportClosure} from '../domain/lp01-closure-export.js';

export const EXPORT_V2_VERSION = 'LP-EXPORT-PRODUCTION-3.0.0-ISOLATED';
export const EXPORT_V2_ENABLED = false;
export const EXPORT_V2_AUTHORITY = 'EXPORT_PRODUCTION_V2';
const clone = value => structuredClone(value);
const fail = code => { throw Error(code); };
const whole = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const nonblank = value => typeof value === 'string' && value.trim() === value && value.length > 0;
const validKey = key => nonblank(key) && key.endsWith('|PANELES_2') && key.length > '|PANELES_2'.length;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sorted = values => [...values].sort((a, b) => a.key.localeCompare(b.key));
const exact = (a, b) => ['stage', 'line', 'date', 'shift'].every(k => a?.[k] === b?.[k]);
function context(value) {
 if (!object(value) || value.stage !== 'ENSAMBLE' || value.line !== 'PANELES_2' || ![1, 2].includes(value.shift)
   || typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || +value.date.slice(0, 4) < 1
   || !Number.isFinite(Date.parse(value.date + 'T00:00:00Z'))
   || new Date(value.date + 'T00:00:00Z').toISOString().slice(0, 10) !== value.date) fail('V2_CONTEXTO_NO_ADMITIDO');
 return {stage: value.stage, line: value.line, date: value.date, shift: value.shift};
}
function canonical(value) {
 if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
 if (object(value)) return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
 return JSON.stringify(value);
}
async function digest(value) {
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)))))
  .map(b => b.toString(16).padStart(2, '0')).join('');
}
function validateSource(source, ctx) {
 if (source?.contract !== 'LP-EXPORT-SOURCE-2' || !exact(source, ctx) || source.universeComplete !== true
   || !nonblank(source.revision) || !Array.isArray(source.orders) || !Array.isArray(source.requiredKeys)
   || source.catalog?.contract !== 'LP-HOJA-1' || !exact(source.catalog, ctx) || !Array.isArray(source.catalog.productions)
   || typeof source.hasSuccessor !== 'boolean') fail('V2_FUENTE_NO_ACREDITADA');
 const keys = new Set();
 for (const row of source.catalog.productions) {
  if (!validKey(row.key) || keys.has(row.key) || row.oficial?.key_produccion !== row.key
    || row.oficial.id_linea !== ctx.line || !nonblank(row.oficial.produccion)) fail('V2_IDENTIDAD_INCOMPATIBLE');
  keys.add(row.key);
 }
 const refs = new Set(), groups = new Map();
 for (const order of source.orders) {
  if (!keys.has(order.key) || order.etapa !== ctx.stage || order.linea !== ctx.line || order.fecha !== ctx.date
    || order.turno !== ctx.shift || !uuid(order.parte) || refs.has(order.parte) || !whole(order.revision)
    || !(order.sale === null || whole(order.sale)) || !whole(order.ejecutado)) fail('V2_ORDEN_INCOMPATIBLE');
  refs.add(order.parte);
  const group = groups.get(order.key) ?? [];
  group.push(clone(order)); groups.set(order.key, group);
 }
 const required = new Set(source.requiredKeys);
 if (required.size !== source.requiredKeys.length || [...required].some(key => !keys.has(key))
   || [...groups.keys()].some(key => !required.has(key))) fail('V2_UNIVERSO_INCOMPATIBLE');
 // Scheduled or carried required keys not yet incorporated cannot disappear in a close.
 if ([...required].some(key => !groups.has(key))) fail('V2_INCORPORACION_EXPLICITA_REQUERIDA');
 return sorted([...groups].map(([key, orders]) => ({key,
  plan: null,
  assignments: orders.sort((a, b) => a.parte.localeCompare(b.parte))})));
}
export async function exportProductionSourceRevision(source) {
 const ctx = context(source), plans = validateSource(source, ctx);
 return digest({context: ctx, revision: source.revision, requiredKeys: [...source.requiredKeys].sort(),
  catalog: sorted(source.catalog.productions), plans, hasSuccessor: source.hasSuccessor});
}
export function newExportProductionState(ctx) {
 return {version: EXPORT_V2_VERSION, context: context(ctx), revision: 0, status: 'ABIERTO',
  imports: [], closures: [], reopenings: [], receipts: [], currentImportId: null, currentClosureId: null};
}
function checkState(state, ctx) {
 if (state?.version !== EXPORT_V2_VERSION || !exact(state.context, ctx) || !whole(state.revision)
   || !['ABIERTO', 'CERRADO', 'EN_REVISION'].includes(state.status)
   || ['imports', 'closures', 'reopenings', 'receipts'].some(k => !Array.isArray(state[k]))) fail('V2_VERSION_ESTADO_INCOMPATIBLE');
}
function checkCommand(command) {
 const common = ['id', 'op', 'context', 'revision', 'sourceRevision'];
 const extra = {IMPORTAR_XLSX: ['filename', 'bytes'], CERRAR: ['importId', 'reasons', 'type', 'confirmed'], REABRIR: ['reason']};
 if (!object(command) || !Object.hasOwn(extra, command.op) || !uuid(command.id) || !whole(command.revision)
   || typeof command.sourceRevision !== 'string' || !/^[a-f0-9]{64}$/.test(command.sourceRevision)
   || Object.keys(command).some(k => ![...common, ...extra[command.op]].includes(k))) fail('V2_COMANDO_INVALIDO');
 context(command.context);
 if (command.op === 'IMPORTAR_XLSX' && (typeof command.filename !== 'string' || command.filename.length > 255
   || !/^.+\.xlsx$/i.test(command.filename) || !(command.bytes instanceof Uint8Array)
   || command.bytes.length > 2097152 || command.bytes.length < 22)) fail('V2_ARCHIVO_INVALIDO');
 if (command.op === 'CERRAR' && (!object(command.reasons ?? {}) || !['CON_ACTIVIDAD', 'SIN_ACTIVIDAD'].includes(command.type ?? 'CON_ACTIVIDAD')
   || Object.values(command.reasons ?? {}).some(v => typeof v !== 'string' || !v.trim() || v.length > 2000))) fail('V2_MOTIVOS_INVALIDOS');
 if (command.op === 'REABRIR' && (typeof command.reason !== 'string' || !command.reason.trim() || command.reason.length > 2000)) fail('V2_MOTIVO_REAPERTURA_REQUERIDO');
}
function allowed(auth, op, keys, correction) {
 if (auth?.valid !== true || !nonblank(auth.user) || !Array.isArray(auth.operations) || !auth.operations.includes(op)
   || !Array.isArray(auth.keys) || keys.some(key => !auth.keys.includes(key))) fail('V2_SESION_O_AMBITO_DENEGADO');
 if (correction && auth.canCorrect !== true) fail('V2_CORRECCION_REQUIERE_COORDINADOR');
}
const fileIdentity = batch => ({id: batch.id, name: batch.file.name, sha256: batch.file.sha256, adapter: batch.file.adapter});
const valueSource = (batch, row) => ({importId: batch.id, importVersion: batch.version,
 universeRevision: batch.sourceRevision, context: clone(batch.context), file: fileIdentity(batch), sourceRows: clone(row.sourceRows)});
function projectedRows(imports, batch) {
 return batch.originalRows.map(row => {
  if (row.coverage === 'PRESENT') return {...clone(row), preserve: false, valueStatus: 'CURRENT_FILE', valueSource: valueSource(batch, row)};
  const previous = imports.filter(i => exact(i.context, batch.context) && i.version < batch.version
   && i.originalRows.some(r => r.key === row.key && r.coverage === 'PRESENT')).sort((a, b) => b.version - a.version)[0];
  const origin = previous?.originalRows.find(r => r.key === row.key && r.coverage === 'PRESENT');
  return {...clone(row), quantity: origin?.quantity ?? null, preserve: true,
   valueStatus: origin ? 'PRESERVED' : 'NEVER_REPORTED', valueSource: origin ? valueSource(previous, origin) : null};
 });
}
/** Revalidate immutable originals, not just the latest receipt or today's names.
 * Only the isolated reference uses this replay; SQL validates its private original
 * file/group and receipt records under the same transaction instead.
 */
async function verifyImports(state, DOMParser) {
 const seen = new Set(), versions = new Set();
 for (const batch of state.imports) {
  if (batch?.contract !== 'LP-EXPORT-IMPORT-3' || !uuid(batch.id) || seen.has(batch.id) || !whole(batch.version)
   || batch.version < 1 || batch.version > state.revision || versions.has(batch.version) || !exact(batch.context, state.context)
   || batch.file?.adapter !== POWERBI_VERSION || !nonblank(batch.file.name) || typeof batch.file.sha256 !== 'string'
   || !/^[a-f0-9]{64}$/.test(batch.file.sha256) || typeof batch.file.originalBase64 !== 'string'
   || !batch.file.originalBase64 || !Array.isArray(batch.originalRows) || !Array.isArray(batch.rows)) fail('V3_ORIGINAL_O_PROCEDENCIA_INCOMPATIBLE');
  seen.add(batch.id); versions.add(batch.version);
  const receipts = state.receipts.filter(r => r.id === batch.id);
  const receipt = receipts[0], response = receipt?.response;
  if (receipts.length !== 1 || receipt.user !== batch.user || response?.contract !== 'LP-EXPORT-IMPORT-3'
   || response.authority !== EXPORT_V2_AUTHORITY || response.id !== batch.id || response.importId !== batch.id
   || response.version !== batch.version || response.sha256 !== batch.file.sha256
   || canonical(response.rows) !== canonical(batch.rows)) fail('V3_ORIGINAL_O_PROCEDENCIA_INCOMPATIBLE');
  let parsed, preview;
  try {
   const bytes = Uint8Array.from(atob(batch.file.originalBase64), c => c.charCodeAt(0));
   if (bytesBase64(bytes) !== batch.file.originalBase64) fail('V3_BASE64_NO_CANONICO');
   parsed = await parsePowerBI(bytes, {DOMParser});
   if (parsed.sha256 !== batch.file.sha256 || await exportProductionSourceRevision(batch.sourceSnapshot) !== batch.sourceRevision) fail('V3_ORIGINAL_CAMBIO');
   preview = previewExportClosure(parsed, {...batch.context, catalog: batch.sourceSnapshot.catalog, orders: batch.sourceSnapshot.orders});
  } catch { fail('V3_ORIGINAL_O_PROCEDENCIA_INCOMPATIBLE'); }
  if (preview.needsIncorporation || canonical(preview.rows) !== canonical(batch.originalRows)
   || preview.totalReported !== batch.totalReported) fail('V3_ORIGINAL_O_PROCEDENCIA_INCOMPATIBLE');
 }
 for (const batch of state.imports) if (canonical(batch.rows) !== canonical(projectedRows(state.imports, batch))) fail('V3_ORIGINAL_O_PROCEDENCIA_INCOMPATIBLE');
}
/**
 * Repository contract: transaction serializes a context and its production/source
 * writers, clones/rolls back state on error, and commits one result atomically.
 * tx.readSource and tx.authorize are trusted SERVER reads, never request JSON.
 * This reference is deliberately only constructible in an isolated test harness.
 */
export function createExportProductionV2Reference({mode, repository, DOMParser}) {
 if (mode !== 'ISOLATED_TEST_ONLY' || repository?.kind !== 'ISOLATED_REFERENCE_STORE'
   || typeof repository.transaction !== 'function') fail('V2_DESACTIVADO');
 return Object.freeze({
  enabled: false, version: EXPORT_V2_VERSION,
  async execute(input) {
   // Snapshot caller-owned buffers before any await, including auth/network delays.
   const command = clone(input); checkCommand(command);
   const ctx = context(command.context);
   const payload = {...command};
   if (command.bytes) { payload.bytes = bytesBase64(command.bytes); }
   const payloadHash = await digest(payload);
   return repository.transaction(ctx, async tx => {
    const state = tx.state; checkState(state, ctx);
    const source = clone(await tx.readSource()), plans = validateSource(source, ctx);
    const keys = plans.map(p => p.key);
    const auth = await tx.authorize(command.op);
    const correction = state.status === 'EN_REVISION' && command.op !== 'REABRIR';
    allowed(auth, command.op, keys, correction);
    await verifyImports(state, DOMParser);
    const previous = state.receipts.find(r => r.id === command.id);
    if (previous) {
     allowed(auth, command.op, previous.keys, false);
     if (previous.payloadHash !== payloadHash || previous.user !== auth.user) fail('V2_IDEMPOTENCIA_REUTILIZADA');
     return clone({...previous.response, duplicate: true});
    }
    if (state.revision !== command.revision) fail('V2_CONFLICTO_REVISION');
    const sourceRevision = await exportProductionSourceRevision(source);
    if (sourceRevision !== command.sourceRevision) fail('V2_UNIVERSO_CAMBIO');
    const version = state.revision + 1;
    if (!whole(version)) fail('V2_REVISION_EXCESIVA');
    const at = await tx.now();
    if (typeof at !== 'string' || !Number.isFinite(Date.parse(at))) fail('V2_RELOJ_NO_ACREDITADO');
    let response;
    if (command.op === 'REABRIR') {
     if (state.status !== 'CERRADO') fail('V2_TURNO_NO_CERRADO');
     if (source.hasSuccessor) fail('V2_CONTINUIDAD_CONCILIAR');
     state.reopenings.push({id: command.id, previousClosureId: state.currentClosureId, user: auth.user, at, reason: command.reason.trim(), version});
     state.status = 'EN_REVISION'; state.currentClosureId = null; state.currentImportId = null;
     response = {ok: true, id: command.id, version, status: state.status};
    } else {
     if (state.status === 'CERRADO') fail('V2_REAPERTURA_REQUERIDA');
     if (command.op === 'IMPORTAR_XLSX') {
      const parsed = await parsePowerBI(command.bytes, {DOMParser});
      const preview = previewExportClosure(parsed, {...ctx, catalog: source.catalog, orders: source.orders});
      if (preview.needsIncorporation) fail('V2_INCORPORACION_EXPLICITA_REQUERIDA');
      const batch = {contract: 'LP-EXPORT-IMPORT-3', id: command.id, version, sourceRevision, context: ctx, user: auth.user, at,
       file: {name: command.filename, sha256: parsed.sha256, adapter: POWERBI_VERSION, originalBase64: payload.bytes},
       sourceSnapshot: clone(source), originalRows: clone(preview.rows), totalReported: preview.totalReported};
      batch.rows = projectedRows(state.imports, batch);
      state.imports.push(batch); state.currentImportId = batch.id;
      response = {ok: true, contract: batch.contract, authority: EXPORT_V2_AUTHORITY, id: command.id, importId: batch.id, version, sha256: parsed.sha256,
       updateMode: 'REPLACE_PRESENT_PRESERVE_ABSENT', reported: preview.reported, absent: preview.absent, totalReported: preview.totalReported,
       preserved: batch.rows.filter(r => r.valueStatus === 'PRESERVED').length,
       neverReported: batch.rows.filter(r => r.valueStatus === 'NEVER_REPORTED').length, rows: clone(batch.rows), canClose: false};
     } else {
      const type = command.type ?? 'CON_ACTIVIDAD';
      let batch = null, rows = [];
      if (type === 'SIN_ACTIVIDAD') {
       if (command.confirmed !== true || command.importId !== undefined || plans.length || Object.keys(command.reasons ?? {}).length) fail('V2_SIN_ACTIVIDAD_NO_ACREDITADO');
      } else {
       if (command.confirmed !== undefined || !uuid(command.importId) || command.importId !== state.currentImportId) fail('V2_IMPORTACION_VIGENTE_REQUERIDA');
       batch = state.imports.find(i => i.id === state.currentImportId);
       if (!batch || batch.sourceRevision !== sourceRevision || !exact(batch.context, ctx)) fail('V2_COBERTURA_CAMBIO_REIMPORTAR');
       if (!plans.length) fail('V2_COBERTURA_INCOMPATIBLE');
       if (batch.rows.length !== plans.length || batch.rows.some(r => !keys.includes(r.key))) fail('V2_COBERTURA_INCOMPATIBLE');
       if (Object.keys(command.reasons ?? {}).some(key => !keys.includes(key))) fail('V2_MOTIVO_FUERA_DE_AMBITO');
       rows = plans.map(plan => {
        const row = batch.rows.find(r => r.key === plan.key);
        if (!row) fail('V2_COBERTURA_INCOMPATIBLE');
        const reason = command.reasons?.[plan.key]?.trim() ?? null;
        if (row.coverage === 'ABSENT' && !reason) fail('V2_AUSENCIA_SIN_MOTIVO');
        const official = source.catalog.productions.find(p => p.key === plan.key).oficial;
        return {key: plan.key, identity: {key: plan.key, line: ctx.line, production: official.produccion, system: official.sistema ?? null},
         coverage: row.coverage, realized: row.quantity, valueStatus: row.valueStatus, valueSource: clone(row.valueSource),
         plan: null, planStatus: 'PLAN_SOURCE_REQUIRED', difference: null, pendingAgainstPlan: null,
         budget: {status: 'RECONCILIATION_REQUIRED', available: null},
         continuity: {status: 'RECONCILIATION_REQUIRED', quantity: null, allocation: 'NONE'},
         preserve: row.coverage === 'ABSENT', sourceRows: clone(row.sourceRows), reason,
         // Manual counts are immutable historical context, never quantity authority.
         manualHistory: {authority: 'HISTORICAL_ONLY', assignments: clone(plan.assignments)},
         assignmentRefs: plan.assignments.map(o => o.parte)};
       });
      }
      const closure = {contract: 'LP-EXPORT-CLOSE-3', id: command.id, version, authority: EXPORT_V2_AUTHORITY, context: ctx, type,
       comparisonComplete: false, planComparison: 'PLAN_SOURCE_REQUIRED', canContinue: false, reconciliation: 'RECONCILIATION_REQUIRED',
       importId: batch?.id ?? null, sourceRevision, rows, user: auth.user, at,
       file: batch ? fileIdentity(batch) : null};
      state.closures.push(closure); state.status = 'CERRADO'; state.currentClosureId = closure.id;
      response = {ok: true, id: closure.id, version, status: state.status, closure: clone(closure)};
     }
    }
    // Revalidate before committing; a changed/revoked source cannot be saved.
    const latestSource = await tx.readSource();
    if (await exportProductionSourceRevision(latestSource) !== sourceRevision) fail('V2_UNIVERSO_CAMBIO');
    const latestAuth = await tx.authorize(command.op);
    allowed(latestAuth, command.op, keys, correction);
    if (latestAuth.user !== auth.user) fail('V2_SESION_CAMBIO');
    state.revision = version;
    state.receipts.push({id: command.id, user: auth.user, payloadHash, keys, response: clone(response)});
    return clone(response);
   });
  }
 });
}
/** Read persisted current state only; caller must separately authorize every key.
 * Async because each original XLSX/hash is revalidated in this isolated model.
 */
export async function realizedExportProduction(state, {DOMParser} = {}) {
 checkState(state, context(state.context));
 if (state.status !== 'CERRADO') return {status: 'NO_CONFIRMED_CLOSE', rows: []};
 const incompatible = () => fail('V2_CIERRE_ACTUAL_INCOMPATIBLE');
 try { await verifyImports(state, DOMParser); } catch { incompatible(); }
 const closures = state.closures.filter(c => c.id === state.currentClosureId && c.version === state.revision);
 if (closures.length !== 1) incompatible();
 const close = closures[0];
 if (!uuid(close.id) || !whole(close.version) || close.version === 0 || close.authority !== EXPORT_V2_AUTHORITY
   || close.contract !== 'LP-EXPORT-CLOSE-3' || close.comparisonComplete !== false || close.planComparison !== 'PLAN_SOURCE_REQUIRED'
   || close.canContinue !== false || close.reconciliation !== 'RECONCILIATION_REQUIRED'
   || !exact(close.context, state.context) || !['SIN_ACTIVIDAD', 'CON_ACTIVIDAD'].includes(close.type)
   || !Array.isArray(close.rows)) incompatible();
 if (close.type === 'SIN_ACTIVIDAD') {
  if (close.rows.length || close.file !== null || close.importId !== null) incompatible();
 } else {
  const batches = state.imports.filter(i => i.id === close.importId);
  if (batches.length !== 1 || state.currentImportId !== close.importId || !close.rows.length) incompatible();
  const batch = batches[0], seen = new Set();
  if (!exact(batch.context, close.context) || canonical(close.file) !== canonical(fileIdentity(batch))
    || batch.sourceRevision !== close.sourceRevision || batch.version !== close.version - 1 || batch.rows.length !== close.rows.length) incompatible();
  for (const row of close.rows) {
   const imported = batch.rows.filter(r => r.key === row?.key);
   if (!row || !validKey(row.key) || seen.has(row.key) || row.plan !== null || row.planStatus !== 'PLAN_SOURCE_REQUIRED'
     || row.difference !== null || row.pendingAgainstPlan !== null || imported.length !== 1
     || imported[0].coverage !== row.coverage || imported[0].quantity !== row.realized || imported[0].preserve !== row.preserve
     || imported[0].valueStatus !== row.valueStatus || canonical(imported[0].valueSource) !== canonical(row.valueSource)
     || canonical(imported[0].sourceRows) !== canonical(row.sourceRows)
     || canonical(row.budget) !== canonical({status: 'RECONCILIATION_REQUIRED', available: null})
     || canonical(row.continuity) !== canonical({status: 'RECONCILIATION_REQUIRED', quantity: null, allocation: 'NONE'})) incompatible();
   const official = batch.sourceSnapshot.catalog.productions.find(p => p.key === row.key)?.oficial;
   if (!official || canonical(row.identity) !== canonical({key: row.key, line: close.context.line, production: official.produccion, system: official.sistema ?? null})) incompatible();
   seen.add(row.key);
  }
 }
 return {contract: 'LP-REALIZADO-CIERRE-3', status: close.type === 'SIN_ACTIVIDAD' ? 'CONFIRMED_EMPTY' : 'CONFIRMED', closureId: close.id,
  version: close.version, authority: close.authority, comparisonComplete: false, planComparison: 'PLAN_SOURCE_REQUIRED', canContinue: false,
  rows: close.rows.map(row => ({key: row.key, identity: clone(row.identity), quantity: row.realized, coverage: row.coverage, preserve: row.preserve,
   valueStatus: row.valueStatus, valueSource: clone(row.valueSource), fileId: row.valueSource?.file.id ?? null,
   sha256: row.valueSource?.file.sha256 ?? null, sourceRows: clone(row.sourceRows), plan: null, planStatus: 'PLAN_SOURCE_REQUIRED'}))};
}
/** No ABRIR, per-root remaining quantity, saldo write, or automatic planning. */
export async function exportProductionContinuity(state, options) {
 const current = await realizedExportProduction(state, options);
 if (current.status === 'NO_CONFIRMED_CLOSE') return {status: 'NO_CONFIRMED_CLOSE', canApply: false, rows: []};
 const close = state.closures.find(c => c.id === current.closureId);
 return {status: 'RECONCILIATION_REQUIRED', canApply: false, closureId: close.id,
  version: close.version, rows: close.rows.map(row => ({
   key: row.key, coverage: row.coverage, pendingAgainstPlan: null, quantity: null,
   sourcePlan: null, preserve: row.preserve, assignmentRefs: clone(row.assignmentRefs),
   allocation: 'NONE', budgetAuthority: 'RECONCILIATION_REQUIRED', nextPlan: null,
   sourceClosureId: close.id, sourceVersion: close.version
  }))};
}

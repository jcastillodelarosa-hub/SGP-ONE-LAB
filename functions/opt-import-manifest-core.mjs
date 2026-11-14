// Pure preparation, NOT an authorization boundary or a physical-cut validator.
// Invoke only with extraction and evidence reconstructed by the trusted server.
import {reconcileIndividuals, documentProduction} from '../opt-digital/individual-reconciliation.js';
import {inchesToThirtySeconds, reconcileOptSummary} from '../src/domain/opt-summary-reconciliation.js';
import {profileRoundingCompatibility} from '../src/domain/opt-rounding-compatibility.js';

const text = value => typeof value === 'string' && value.trim().length > 0;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const positive = value => Number.isSafeInteger(value) && value > 0;
const norm = value => String(value ?? '').replace(/\s+/g, '');
const key = (...values) => JSON.stringify(values);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const hash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const count = (map, id, quantity) => map.set(id, (map.get(id) || 0) + quantity);
const equalCounts = (left, right) => left.size === right.size && [...left].every(([id, quantity]) => right.get(id) === quantity);
const inches = value => `${Math.floor(value / 32)}${value % 32 ? ` ${value % 32}/32` : ''}"`;
const blockKey = row => key(row.ref, row.finish, exactLength32(row.length), row.code);
const referenceKey = (profile, finish, length, reference) => key(profile, finish, exactLength32(length), norm(reference));

export function exactLength32(value) {
  // The existing parser understands the printed fraction. Check its safe range
  // separately: it intentionally predates this stricter import contract.
  if (typeof value !== 'string' || !/^\d+(?:\s+\d+\/\d+)?["″]?$/.test(value.trim())) throw new TypeError('OPT_LONGITUD_INVALIDA');
  const result = inchesToThirtySeconds(value);
  if (!Number.isSafeInteger(result) || result < 0 || result > 100000000) throw new RangeError('OPT_LONGITUD_FUERA_RANGO');
  return result;
}

export function exactMillimeters(length32) {
  if (!positive(length32)) throw new TypeError('OPT_LONGITUD_INVALIDA');
  // 1/32 inch = 127/160 mm = 79375/100000 mm. No floating arithmetic,
  // toFixed, tolerance, or rounding is used to construct the decimal token.
  const scaled = BigInt(length32) * 79375n;
  const decimal = `${scaled / 100000n}.${String(scaled % 100000n).padStart(5, '0')}`.replace(/\.?0+$/, '');
  const number = Number(decimal);
  if (!(number > 0 && number < 100000) || JSON.stringify(number) !== decimal) throw new RangeError('OPT_LONGITUD_MM_FUERA_RANGO');
  return {decimal, number};
}

const assignmentOf = row => ({reserva:row.reserva, sistema:row.sistema, key_produccion:row.key_produccion, id_programacion:row.id_programacion});
const assignmentKey = row => key(row.reserva, row.sistema, row.key_produccion, row.id_programacion);
const scopeValid = scope => scope?.linea === 'PANELES_2' && scope.modo === 'BASE' &&
  Number.isSafeInteger(scope.anio) && scope.anio >= 2020 && scope.anio <= 2100 &&
  Number.isSafeInteger(scope.semana) && scope.semana >= 1 && scope.semana <= 53 &&
  Object.keys(scope).length === 4;

/**
 * `server` is a private server snapshot, never a request body. Its bindings must
 * be an exhaustive joined read for the documentary production IDs, including
 * other systems/reservations/programming IDs so ambiguity is not hidden.
 * See docs/opt-import-manifest/README.md for the required trust boundary.
 */
export function validateOptImportManifest({document, extraction}, server) {
  const blockers = [];
  const fail = (code, detail = {}) => blockers.push({code, ...detail});
  const result = manifest => ({schema:'sgp.opt.import-preparation.v1',
    status:manifest ? 'DOCUMENTARY_MANIFEST_READY' : 'BLOCKED', importable:!!manifest,
    productionEnabled:false, physicalCompletionVerified:false, blockers, manifest:manifest || null});
  if (!document || !hash(document.sha256) || !text(document.sourceKey) || !text(document.opt) ||
      !['RETAIL','PROYECTO','DESCONOCIDO'].includes(document.origin) || !['INDICE','INDIVIDUAL'].includes(document.mode)) {
    fail('DOCUMENT_IDENTITY_INVALID'); return result();
  }
  if (!server || server.schema !== 'sgp.opt.server-evidence.v1' || !text(server.revision) || !scopeValid(server.scope) ||
      server.pdfSha256 !== document.sha256 || !Array.isArray(server.bindings) || !server.bindings.every(record) ||
      !Array.isArray(server.indexRows) || !server.indexRows.every(record)) {
    fail('SERVER_EVIDENCE_INVALID'); return result();
  }
  const indexedProject = server.bindingMode === 'OPT_INDEX_RESERVATION';
  const indexedRetail = server.bindingMode === 'OPT_RETAIL_EXACT_3';
  if ((server.bindingMode != null && !['DOCUMENT_PRODUCTION','OPT_INDEX_RESERVATION','OPT_RETAIL_EXACT_3'].includes(server.bindingMode)) ||
      (indexedProject && (document.origin !== 'PROYECTO' || document.mode !== 'INDICE')) ||
      (indexedRetail && (document.origin !== 'RETAIL' || document.mode !== 'INDICE'))) {
    fail('SERVER_BINDING_MODE_INVALID'); return result();
  }
  if ((indexedProject || indexedRetail) && (!Array.isArray(server.profileDestinations) || !server.profileDestinations.every(record))) {
    fail('PROFILE_DESTINATIONS_INVALID'); return result();
  }
  const plans = extraction?.plans, rows = extraction?.sourceProjectRows,
    materialRows = extraction?.sourceMaterialRows, profileSummaries = extraction?.sourceProfileSummaries;
  if (!Array.isArray(plans) || !plans.length || !Array.isArray(rows) || !rows.length ||
      !Array.isArray(materialRows) || !materialRows.length || !Array.isArray(profileSummaries) || !profileSummaries.length ||
      !Array.isArray(extraction.issues) || !positive(extraction.pdfPages) || extraction.pdfPages > 500) {
    fail('FINAL_DETAIL_OR_EXTRACTION_MISSING'); return result();
  }
  if (![plans, rows, materialRows, profileSummaries, extraction.issues].every(values => values.every(record))) {
    fail('EXTRACTION_RECORD_INVALID'); return result();
  }
  if (extraction.issues.length) fail('EXTRACTION_ISSUES', {issues:extraction.issues.map(issue => ({...issue}))});
  const profileKeys = new Set(), planIds = new Set(), positions = new Set(), rowIds = new Set();
  const cutsByReference = new Map(), detailByReference = new Map(), barCounts = new Map(), printedBars = new Map();
  const transformed = [], provenance = new Map();
  let totalCuts = 0, detailCutLength32 = 0, detailQuantity = 0, printedBarQuantity = 0;
  try {
    for (const plan of plans) {
      const position = key(plan.page, plan.sourceRow);
      if (!text(plan.id) || !text(plan.ref) || !text(plan.finish) || typeof plan.code !== 'string' ||
          !positive(plan.page) || plan.page > extraction.pdfPages || !positive(plan.sourceRow) || plan.sourceRow > 100000 ||
          !positive(plan.barqty) || plan.barqty > 10000 || !Array.isArray(plan.cuts) || !plan.cuts.length ||
          plan.cuts.length > 20000 || !plan.cuts.every(record) || !Array.isArray(plan.issues) || plan.issues.length || plan.unresolvedCells?.length ||
          planIds.has(plan.id) || positions.has(position) || !positive(exactLength32(plan.length))) {
        fail('PATTERN_INVALID_OR_DUPLICATE', {patternId:plan.id}); continue;
      }
      exactLength32(plan.rest);
      planIds.add(plan.id); positions.add(position); profileKeys.add(key(plan.ref, plan.finish));
      count(barCounts, blockKey(plan), plan.barqty);
      const bars = new Map();
      for (const cut of plan.cuts) {
        totalCuts++;
        if (totalCuts > 100000) { fail('CUT_LIMIT'); return result(); }
        if (cut.uncertain || cut.qty !== 1 || !text(cut.project) || !positive(cut.profileInstance) || cut.profileInstance > plan.barqty ||
            !positive(cut.sourcePage) || cut.sourcePage > extraction.pdfPages || cut.sourcePage < plan.page ||
            !positive(cut.sourceColumn) || cut.sourceColumn > 4 || !positive(cut.sourceSlot) || cut.sourceSlot > 100000 ||
            !positive(cut.unitInstance) || cut.unitInstance > 10000) {
          fail('CUT_PROVENANCE_INVALID', {patternId:plan.id}); continue;
        }
        exactMillimeters(exactLength32(cut.length));
        count(cutsByReference, referenceKey(plan.ref, plan.finish, cut.length, cut.project), 1);
        if (!bars.has(cut.profileInstance)) bars.set(cut.profileInstance, []);
        bars.get(cut.profileInstance).push(cut);
      }
      // Ordering is by printed coordinates, not by input array order or size.
      for (let bar = 1; bar <= plan.barqty; bar++) {
        const cuts = (bars.get(bar) || []).toSorted((a,b) => a.sourceColumn-b.sourceColumn || a.sourceSlot-b.sourceSlot || a.unitInstance-b.unitInstance);
        if (!cuts.length) { fail('DOCUMENTARY_BAR_EMPTY', {patternId:plan.id, bar}); continue; }
        const seen = new Set();
        cuts.forEach((cut, index) => {
          const cell = key(cut.sourceColumn, cut.sourceSlot, cut.unitInstance);
          if (seen.has(cell)) fail('DUPLICATE_CUT_PROVENANCE', {patternId:plan.id, bar, cell});
          seen.add(cell);
          const coverageId = key(plan.id, cut.profileInstance, cut.sourceColumn, cut.sourceSlot, cut.unitInstance);
          provenance.set(coverageId, {plan, cut, position:{pagina:plan.page, patron:plan.sourceRow, barra:bar, corte:index+1}});
        });
        transformed.push({perf:1, blockId:blockKey(plan), planId:plan.id,
          cuts:cuts.map(cut => ({length:cut.length, reference:cut.project, quantity:1}))});
      }
      // The extractor repeats the same printed pattern on every documentary bar.
      const signatures = [...bars.values()].map(cuts => JSON.stringify(cuts.map(cut =>
        key(cut.sourceColumn, cut.sourceSlot, cut.unitInstance, exactLength32(cut.length), norm(cut.project))).sort()));
      if (new Set(signatures).size !== 1) fail('PATTERN_REPETITIONS_DIFFER', {patternId:plan.id});
    }
    for (const row of rows) {
      if (!text(row.sourceId) || rowIds.has(row.sourceId) || row.grouping !== 'PRINTED_CELL' ||
          !text(row.ref) || !text(row.finish) || !text(row.reference) || !positive(row.quantity) ||
          !positive(row.page) || row.page > extraction.pdfPages || !positive(exactLength32(row.length))) {
        fail('FINAL_DETAIL_ROW_INVALID', {sourceRowId:row.sourceId}); continue;
      }
      rowIds.add(row.sourceId);
      count(detailByReference, referenceKey(row.ref, row.finish, row.length, row.reference), row.quantity);
      detailQuantity += row.quantity; detailCutLength32 += exactLength32(row.length) * row.quantity;
    }
    for (const row of materialRows) {
      if (!text(row.ref) || !text(row.finish) || typeof row.code !== 'string' || !positive(row.quantity) ||
          !positive(row.page) || row.page > extraction.pdfPages || !positive(exactLength32(row.length))) {
        fail('FINAL_MATERIAL_ROW_INVALID'); continue;
      }
      count(printedBars, blockKey(row), row.quantity); printedBarQuantity += row.quantity;
    }
    for (const row of profileSummaries) for (const field of ['stockLength','cutLength','reusedLength','wasteLength']) exactLength32(row[field]);
    if (![detailQuantity, detailCutLength32, printedBarQuantity].every(Number.isSafeInteger)) fail('FINAL_DETAIL_TOTAL_OUT_OF_RANGE');
    if (!equalCounts(cutsByReference, detailByReference)) fail('FINAL_REFERENCE_LENGTH_QUANTITY_MISMATCH');
    if (!equalCounts(barCounts, printedBars)) fail('FINAL_STOCK_LENGTH_CODE_QUANTITY_MISMATCH');
  } catch (error) { fail('EXACT_LENGTH_INVALID', {reason:error.message}); }
  if (blockers.length) return result();

  const summary = reconcileOptSummary({patterns:transformed,
    summary:{bars:printedBarQuantity, cuts:detailQuantity, cutLength:inches(detailCutLength32)},
    blocks:[...printedBars].map(([id,bars]) => ({id,bars}))});
  if (!summary.verified) fail('FINAL_TOTALS_MISMATCH', {issues:summary.issues});
  const coverage = reconcileIndividuals({plans, projectRows:rows, profileSummaries,
    referenceMode:indexedProject ? 'EXACT_PRINTED_REFERENCE' : 'DOCUMENT_PRODUCTION'});
  for (const cut of coverage.cuts) if (!['UNIQUE_DOCUMENT_ROW','ROW_GROUP_MATCH',...(indexedProject?['DOCUMENT_ROW_GROUP_MATCH']:[])].includes(cut.status))
    fail('DOCUMENTARY_REFERENCE_UNRESOLVED', {cutId:cut.cutId, reason:cut.reason});
  for (const row of coverage.sourceCoverage) if (!['ROW_QUANTITY_MATCH',...(indexedProject?['ROW_GROUP_QUANTITY_MATCH']:[])].includes(row.status)) fail('FINAL_DETAIL_ROW_UNCOVERED', {sourceRowId:row.sourceId});
  for (const bar of coverage.bars) if (bar.distributionStatus !== 'PDF_PATTERN_REPETITION' || ['INCONSISTENT','UNRESOLVED'].includes(bar.remainderStatus))
    fail('PATTERN_LENGTH_INCONSISTENT', {barId:bar.barId});
  const summaryKeys = new Set(), roundingProfiles=[];
  for (const balance of coverage.profileBalances) {
    const id = key(balance.ref, balance.finish);
    const structureInvalid=summaryKeys.has(id) || !profileKeys.has(id) || !positive(balance.page) || balance.page > extraction.pdfPages ||
      [balance.stock32,balance.cut32,balance.reused32,balance.waste32].some(value => !Number.isSafeInteger(value) || value < 0);
    const exactTotals=balance.summaryBalanceDelta32===0&&balance.patternStockDelta32===0&&balance.patternCutsDelta32===0;
    if(indexedProject || indexedRetail){
      const ownPlans=plans.filter(plan=>plan.ref===balance.ref&&plan.finish===balance.finish);
      const diagnostic=profileRoundingCompatibility({
        stockTerms:ownPlans.map(plan=>({length:plan.length,quantity:plan.barqty})),
        cutTerms:ownPlans.flatMap(plan=>plan.cuts.map(cut=>({length:cut.length,quantity:1}))),
        summary:{stockLength:balance.stockLength,cutLength:balance.cutLength,reusedLength:balance.reusedLength,wasteLength:balance.wasteLength}
      });
      roundingProfiles.push({reference:balance.ref,finish:balance.finish,page:balance.page,
        printedSummary:{stockLength:balance.stockLength,cutLength:balance.cutLength,reusedLength:balance.reusedLength,wasteLength:balance.wasteLength},
        diagnostic});
      if(structureInvalid||!['PRINTED_EQUALITY','ROUNDING_COMPATIBLE'].includes(diagnostic.status))
        fail('FINAL_PROFILE_TOTALS_MISMATCH',{profile:balance.ref,finish:balance.finish,roundingStatus:diagnostic.status,reasons:diagnostic.reasons});
    }else if(structureInvalid||!exactTotals)
      fail('FINAL_PROFILE_TOTALS_MISMATCH', {profile:balance.ref, finish:balance.finish, page:balance.page,
        comparison:{unit:'1/32 inch',
          printed:{stock:balance.stockLength,cuts:balance.cutLength,reused:balance.reusedLength,waste:balance.wasteLength},
          printed32:{stock:balance.stock32,cuts:balance.cut32,reused:balance.reused32,waste:balance.waste32},
          delta32:{stock:balance.patternStockDelta32,cuts:balance.patternCutsDelta32,conservation:balance.summaryBalanceDelta32},
          acceptance:'BLOCKED_EXACT_TOTALS_REQUIRED',roundingCauseVerified:false}});
    summaryKeys.add(id);
  }
  if (summaryKeys.size !== profileKeys.size || [...profileKeys].some(id => !summaryKeys.has(id))) fail('FINAL_PROFILE_SUMMARY_MISSING');
  if (blockers.length) return result();

  // Exact documentary selectors from the index may narrow candidates. Neither
  // lengths, occurrence counts, array order, nor reservation principals allocate units.
  const indexes = server.indexRows.filter(row => row.pdfSha256 === document.sha256 && row.sourceKey === document.sourceKey &&
    row.origin === document.origin && row.opt === document.opt);
  if (document.mode === 'INDICE' && !indexes.length) fail('DOCUMENT_INDEX_LINK_MISSING');
  if (indexes.some(row => !text(row.rowId) || !text(row.reservation) || !text(row.system) ||
      (row.sourceRowId != null && !rowIds.has(row.sourceRowId)) ||
      (row.documentProduction != null && !/^\d+$/.test(row.documentProduction)) ||
      (row.reference != null && !text(row.reference)) ||
      (row.key_produccion != null && !text(row.key_produccion)) ||
      (row.id_programacion != null && !uuid(row.id_programacion)))) fail('DOCUMENT_INDEX_ROW_INVALID');
  const indexUsed = new Set(), assignments = new Map(), exclusions = new Map(), originalScopes = new Map();
  for (const row of rows) {
    const production = documentProduction(row.reference);
    let profileLine=null;
    if(indexedProject || indexedRetail){
      const matches=server.profileDestinations.filter(profile=>profile.referencia===row.ref);
      if(!matches.length){fail('PROFILE_DESTINATION_MISSING',{profile:row.ref});continue;}
      if(matches.some(profile=>profile.activa!=='SI' ||
          !['PANEL','FRAME','COVER','REFUERZO','MUNTIN'].includes(profile.tipo_pieza) ||
          !['PANEL','FRAME'].includes(profile.destino_productivo) ||
          (['PANEL','FRAME'].includes(profile.tipo_pieza)&&profile.tipo_pieza!==profile.destino_productivo))){
        fail('PROFILE_DESTINATION_INVALID',{profile:row.ref});continue;
      }
      if(new Set(matches.map(profile=>key(profile.tipo_pieza,profile.destino_productivo,profile.activa))).size!==1){
        fail('PROFILE_DESTINATION_CONFLICTING',{profile:row.ref});continue;
      }
      profileLine=matches[0].destino_productivo==='PANEL'?'PANELES_2':'FRAMES_2';
    }
    const applicable = indexes.filter(index => (index.sourceRowId == null || index.sourceRowId === row.sourceId) &&
      (index.documentProduction == null || index.documentProduction === production) &&
      (!indexedRetail || (index.documentProduction === production && index.finish === row.finish)) &&
      (index.reference == null || norm(index.reference) === norm(row.reference)));
    // Never assign a mixed-reservation PDF by row order, approximate names, or
    // whichever binding happens to remain eligible. Each source row needs one
    // exact documentary reservation/system selector before looking at SGP.
    if ((indexedProject || indexedRetail) && new Set(applicable.map(index => key(index.reservation,index.system))).size > 1) {
      fail('INDEX_RESERVATION_AMBIGUOUS', {sourceRowId:row.sourceId}); continue;
    }
    const candidates = server.bindings.filter(binding => (indexedProject ? binding.id_linea===profileLine : binding.documentProduction === production) && (!indexedRetail || binding.id_linea===profileLine) && applicable.some(index =>
      index.reservation === binding.reserva && index.system === binding.sistema &&
      (index.key_produccion == null || index.key_produccion === binding.key_produccion) &&
      (index.id_programacion == null || index.id_programacion === binding.id_programacion)));
    // Individual PDFs need an explicit server-resolved documentary relation.
    if (document.mode === 'INDIVIDUAL' && !indexes.length) fail('INDIVIDUAL_DOCUMENT_RELATION_MISSING', {sourceRowId:row.sourceId});
    // Exclusion needs an exact production identity and line, not an executable
    // machining assignment. Do not turn an unknown/mixed identity into null.
    if (candidates.some(candidate => !text(candidate.key_produccion) || !text(candidate.id_linea) || !text(candidate.sistema))) {
      fail('SGP_PRODUCTION_IDENTITY_INVALID', {sourceRowId:row.sourceId}); continue;
    }
    const identities = new Map(candidates.map(candidate => [key(candidate.key_produccion, candidate.id_linea, candidate.sistema),
      {documentProduction:production, key_produccion:candidate.key_produccion, id_linea:candidate.id_linea, sistema:candidate.sistema}]));
    if (identities.size > 1) {
      fail('SGP_BINDING_AMBIGUOUS', {sourceRowId:row.sourceId, documentProduction:production, candidates:[...identities.values()]}); continue;
    }
    const identity = [...identities.values()][0];
    if (identity && identity.id_linea !== server.scope.linea) {
      assignments.set(row.sourceId, null);
      exclusions.set(row.sourceId, {code:'FUERA_ALCANCE', linea:identity.id_linea, resolvedIdentity:identity});
      // Multiple/missing operational programs outside our line cannot affect a
      // null assignment. Keep every documentary unit and its original length.
      for (const index of applicable) if (candidates.some(candidate => index.reservation === candidate.reserva && index.system === candidate.sistema &&
          (index.key_produccion == null || index.key_produccion === candidate.key_produccion) &&
          (index.id_programacion == null || index.id_programacion === candidate.id_programacion))) indexUsed.add(index);
      continue;
    }
    const unique = new Map(candidates.map(binding => [assignmentKey(binding), binding]));
    if (unique.size !== 1) {
      fail(unique.size ? 'SGP_BINDING_AMBIGUOUS' : 'SGP_BINDING_MISSING', {sourceRowId:row.sourceId,
        documentProduction:production, candidates:[...unique.values()].map(assignmentOf)}); continue;
    }
    const binding = [...unique.values()][0];
    // These joined facts must come from a consistent server read. A true client
    // flag such as verified/approved cannot create or replace them.
    if (!text(binding.key_produccion) || !uuid(binding.id_programacion) || !text(binding.reserva) || !text(binding.sistema) ||
        !text(binding.id_linea) || !Number.isSafeInteger(binding.anio) || binding.anio < 2020 || binding.anio > 2100 ||
        !Number.isSafeInteger(binding.semana_base) || binding.semana_base < 1 || binding.semana_base > 53 ||
        binding.activa !== 'SI' || binding.excluida_export !== false || !text(binding.reserva_principal) ||
        binding.programacion_reserva !== binding.reserva_principal || binding.reserva_snapshot !== binding.reserva_principal ||
        !text(binding.estado_programacion) || binding.estado_programacion === 'CANCELADA' ||
        !Number.isFinite(binding.cantidad_snapshot) || binding.cantidad_snapshot <= 0) {
      fail('SGP_BINDING_OUTSIDE_VALID_PROGRAMMING', {sourceRowId:row.sourceId, assignment:assignmentOf(binding)}); continue;
    }
    // Duplicate join rows with contradictory eligibility cannot hide behind Map.
    if (candidates.some(candidate => JSON.stringify(candidate) !== JSON.stringify(binding))) {
      fail('SGP_BINDING_CONFLICTING_FACTS', {sourceRowId:row.sourceId}); continue;
    }
    // Import the complete immutable document for the authorized line. Week is a
    // read/registration filter, not a reason to discard a valid original binding.
    // Otherwise opening this PDF in another week would require rewriting it.
    originalScopes.set(row.sourceId,{linea:binding.id_linea,anio:binding.anio,semana:binding.semana_base,modo:'BASE'});
    assignments.set(row.sourceId, assignmentOf(binding));
    for (const index of applicable) if (index.reservation === binding.reserva && index.system === binding.sistema &&
        (index.key_produccion == null || index.key_produccion === binding.key_produccion) &&
        (index.id_programacion == null || index.id_programacion === binding.id_programacion)) indexUsed.add(index);
  }
  for (const index of indexes) if (!indexUsed.has(index)) fail('DOCUMENT_INDEX_ROW_UNRESOLVED', {rowId:index.rowId});
  // Every member of an equivalent printed-row group must independently resolve
  // to the same destination. No unit is attributed to an arbitrary member row.
  for(const entry of coverage.cuts)if(entry.status==='DOCUMENT_ROW_GROUP_MATCH'){
    const ids=entry.sourceRowIds;
    const signatures=ids.map(id=>key(assignments.get(id),originalScopes.get(id),exclusions.get(id)));
    if(new Set(signatures).size!==1 || ids.some(id=>!assignments.has(id)))
      fail('DOCUMENT_ROW_GROUP_DESTINATION_AMBIGUOUS',{sourceRowIds:[...ids]});
  }
  if (blockers.length) return result();

  const units = coverage.cuts.map(entry => {
    // This key reads an already-proven common value, never chooses an allocation.
    const commonRowId=entry.sourceRowId??entry.sourceRowIds?.[0];
    const {plan, cut, position} = provenance.get(entry.cutId);
    const mm = exactMillimeters(entry.length32);
    return {documentaryId:key(document.sha256, position.pagina, position.patron, position.barra, position.corte),
      sourceRowId:entry.sourceRowId, ...(entry.sourceRowIds?{sourceRowIds:[...entry.sourceRowIds],sourceGroupQuantity:coverage.sourceGroups.find(g=>g.groupId===JSON.stringify(entry.sourceRowIds)).quantity}:{}), documentProduction:entry.documentProduction,
      profile:plan.ref, finish:plan.finish, reference:cut.project,
      provenance:{patternId:plan.id, sourcePage:cut.sourcePage, sourceColumn:cut.sourceColumn, sourceSlot:cut.sourceSlot, unitInstance:cut.unitInstance},
      length32:entry.length32, millimetersExact:mm.decimal, position,
      assignment:assignments.get(commonRowId) ? {...assignments.get(commonRowId)} : null,
      originalScope:originalScopes.has(commonRowId) ? {...originalScopes.get(commonRowId)} : null,
      scopeStatus:exclusions.has(commonRowId) ? 'FUERA_ALCANCE' :
        originalScopes.get(commonRowId).anio===server.scope.anio && originalScopes.get(commonRowId).semana===server.scope.semana ? 'IN_SCOPE' : 'OTHER_ORIGINAL_WEEK',
      exclusion:exclusions.has(commonRowId) ? structuredClone(exclusions.get(commonRowId)) : null,
      status:'PENDIENTE', physicalBarIdentity:null, inventoryBarId:null};
  }).sort((a,b) => a.position.pagina-b.position.pagina || a.position.patron-b.position.patron || a.position.barra-b.position.barra || a.position.corte-b.position.corte);
  // SQL proposal-compatible pieces. No user, period, approval, or cut event.
  const pieces = units.map(unit => ({referencia:unit.profile, ...unit.position,
    longitud_mm:exactMillimeters(unit.length32).number, asignacion:unit.assignment ? {...unit.assignment} : null}));
  return result({pdfSha256:document.sha256, source:{source_key:document.sourceKey, origen:document.origin, consecutivo:document.opt, modo_carga:document.mode},
    serverRevision:server.revision, scope:{...server.scope}, units, pieces,
    sourceGroups:structuredClone(coverage.sourceGroups),
    ...((indexedProject || indexedRetail)?{
      roundingPolicy:{version:'OPT-PRINTED-ROUNDING-1',model:'INDEPENDENT_NEAREST_1_32_CLOSED_ENVELOPE',originalPrecisionVerified:false,originalsPreserved:true},
      roundingEvidence:roundingProfiles,
      validationWarnings:roundingProfiles.some(profile=>profile.diagnostic.status==='ROUNDING_COMPATIBLE')?
        [{code:'OPT_PRINTED_ROUNDING_COMPATIBLE',message:'Totales compatibles con redondeo de los valores impresos; precisión original no verificada.'}]:[]
    }:{}),
    totals:{documentaryBars:summary.bars, documentaryCuts:summary.cuts, cutLength32:summary.cutLength32},
    scopeTotals:{assigned:units.filter(unit => unit.assignment !== null).length, outsideScope:units.filter(unit => unit.assignment === null).length},
    physicalCompletionVerified:false, inventoryBound:false});
}

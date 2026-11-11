// Entirely synthetic. No private PDFs, SGP records, inventory, or cut execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {extractCoordinatePlans} from '../opt-digital/geometric-extraction.js';
import {validateOptImportManifest, exactMillimeters, exactLength32} from '../functions/opt-import-manifest-core.mjs';
import {createOptImportPreparation} from '../functions/opt-import-manifest-server.mjs';

const ref = '123456 - Synthetic (Line 1) A';
const sha = 'a'.repeat(64);
const uuid = '00000000-0000-0000-0000-000000000001';
const document = () => ({sha256:sha, sourceKey:'batch/synthetic.pdf', origin:'RETAIL', opt:'OPT-SYNTH', mode:'INDICE'});
const binding = () => ({documentProduction:'123456', reserva:'RES-SYNTH', sistema:'SYS-SYNTH', key_produccion:'123456|PANELES_2', id_programacion:uuid,
  id_linea:'PANELES_2', anio:2026, semana_base:46, activa:'SI', excluida_export:false, reserva_principal:'RES-SYNTH',
  programacion_reserva:'RES-SYNTH', reserva_snapshot:'RES-SYNTH', estado_programacion:'SIN INICIAR', cantidad_snapshot:1});
const evidence = () => ({schema:'sgp.opt.server-evidence.v1', pdfSha256:sha, revision:'synthetic-revision-1',
  scope:{linea:'PANELES_2', anio:2026, semana:46, modo:'BASE'}, bindings:[binding()],
  indexRows:[{rowId:'index-2', pdfSha256:sha, sourceKey:'batch/synthetic.pdf', origin:'RETAIL', opt:'OPT-SYNTH', reservation:'RES-SYNTH', system:'SYS-SYNTH'}]});
const item = (str,x,y) => ({str,width:0,transform:[1,0,0,1,x,y]});
const row = (values,centers,y) => values.flatMap((value,index) => value ? [item(value,centers[index],y)] : []);
const page = (items,n,rules=[]) => ({page:n,width:842,height:595,items,rules});
function pages() {
  const projectCenters = [25,100,200,300,520,740], patternCenters = [25,70,140,205,245,315,380,420,490,555,595,665,730,770,810];
  const rules = [{x1:10,y1:570,x2:800,y2:570},{x1:10,y1:550,x2:800,y2:550},
    {x1:350,y1:550,x2:350,y2:570},{x1:700,y1:550,x2:700,y2:570}];
  const materialCenters = [25,100,200,300,420,500,600,740];
  return [page([
    item('Optimizador de corte - OPT-SYNTH',20,590),
    ...row(['Item','Pipe','Code','Length','Reference','Qty'],projectCenters,580),
    ...row(['1','R1','FINISH','10 1/32"',ref,'4'],projectCenters,560)
  ],1,rules), page([
    item('Optimizador de corte - OPT-SYNTH',20,590),item('R1 FINISH',300,500),
    item('Longitud del perfil: 30", Perfiles usados: 2 UBICACION: X CODIGO: C',16,480),
    ...row(['#perf','Long.','Referencia','Cant.','Long.','Referencia','Cant.','Long.','Referencia','Cant.','Long.','Referencia','Cant.','Rest','Disp.'],patternCenters,460),
    ...row(['2','10 1/32"',ref,'2','','','','','','','','','','9"'],patternCenters,440),
    item('Resumen',16,400),
    item('Longitud de los cortes: 40 1/8", Longitud de los perfiles usados: 60", Length of reused stubs: 18", Longitud del desperdicio: 1 7/8"',16,380)
  ],2), page([
    item('Requerimientos de material:',16,580),
    ...row(['Item','Referencia','CODE','Longitud','Qty','UBICACION','CODIGO','OBSERVACION'],materialCenters,560),
    ...row(['1','R1','FINISH','30"','2','X','C',''],materialCenters,540)
  ],3)];
}
const fixture = () => ({document:document(), extraction:extractCoordinatePlans(pages())});
const run = (input=fixture(), server=evidence()) => validateOptImportManifest(input,server);
function blocked(input,server,code) {
  const out=run(input,server); assert.equal(out.importable,false,JSON.stringify(out)); assert.equal(out.manifest,null);
  assert(out.blockers.some(blocker => blocker.code===code),JSON.stringify(out.blockers)); return out;
}

test('real geometric extraction feeds pure gate; repeated units stay pending and are not inventory',()=>{
  const input=fixture(), out=run(input);
  assert.deepEqual(input.extraction.issues,[]);
  assert.equal(input.extraction.sourceMaterialRows.length,1); assert.equal(input.extraction.sourceProfileSummaries.length,1);
  assert.equal(out.status,'DOCUMENTARY_MANIFEST_READY',JSON.stringify(out));
  assert.deepEqual(out.manifest.totals,{documentaryBars:2,documentaryCuts:4,cutLength32:1284});
  assert.equal(new Set(out.manifest.units.map(unit=>unit.documentaryId)).size,4);
  assert(out.manifest.units.every(unit => unit.status==='PENDIENTE' && unit.physicalBarIdentity===null && unit.inventoryBarId===null));
  assert(out.manifest.units.every(unit => unit.length32===321 && unit.millimetersExact==='254.79375'));
  assert.equal(out.productionEnabled,false); assert.equal(out.physicalCompletionVerified,false);
  assert.equal(out.manifest.inventoryBound,false); assert.equal(out.manifest.physicalCompletionVerified,false);
  assert.equal(out.manifest.pieces.length,4);
  assert.deepEqual(Object.keys(out.manifest.pieces[0]),['referencia','pagina','patron','barra','corte','longitud_mm','asignacion']);
  assert(out.manifest.pieces.every(piece=>piece.longitud_mm===254.79375));
});

test('exact 1/32 inch conversion preserves all legal SQL decimal lengths without rounding',()=>{
  assert.deepEqual(exactMillimeters(1),{decimal:'0.79375',number:0.79375});
  assert.deepEqual(exactMillimeters(320),{decimal:'254',number:254});
  // Exhaustive legal integer range for <100000mm; compares decimal tokens as integers.
  for (let n=1;n<=125984;n++) {
    const mm=exactMillimeters(n), [whole,fraction='']=mm.decimal.split('.');
    assert.equal(BigInt(whole)*100000n+BigInt(fraction.padEnd(5,'0')),BigInt(n)*79375n);
    assert.equal(JSON.stringify(mm.number),mm.decimal);
  }
  for (const n of [0,-1,1.5,NaN,Infinity,125985]) assert.throws(()=>exactMillimeters(n));
  for (const length of ['1 1/3"','1 1/64"','10.03125"','9007199254740991"',321]) assert.throws(()=>exactLength32(length));
});

test('changing quantity, length by 1/32, reference, profile, finish or stock code blocks full manifest',()=>{
  const changes=[
    input=>input.extraction.sourceProjectRows[0].quantity++,
    input=>input.extraction.sourceProjectRows[0].length='10 1/16"',
    input=>input.extraction.sourceProjectRows[0].reference=ref+' other',
    input=>input.extraction.sourceProjectRows[0].ref='R2',
    input=>input.extraction.sourceProjectRows[0].finish='OTHER'
  ];
  for(const change of changes){const input=fixture();change(input);blocked(input,evidence(),'FINAL_REFERENCE_LENGTH_QUANTITY_MISMATCH');}
  for(const change of [row=>row.code='OTHER',row=>row.quantity=3,row=>row.length='30 1/32"']){
    const input=fixture();change(input.extraction.sourceMaterialRows[0]);blocked(input,evidence(),'FINAL_STOCK_LENGTH_CODE_QUANTITY_MISMATCH');
  }
});

test('aggregates alone cannot hide swapped per-reference measures',()=>{
  const input=fixture(), first=input.extraction.sourceProjectRows[0];
  first.quantity=2; const other={...first,sourceId:'project-p1-item2',reference:'123456 - Synthetic B'}; input.extraction.sourceProjectRows.push(other);
  input.extraction.plans[0].cuts.filter(cut=>cut.unitInstance===2).forEach(cut=>cut.project=other.reference);
  assert.equal(run(input).importable,true);
  first.reference='123456 - Synthetic C'; blocked(input,evidence(),'FINAL_REFERENCE_LENGTH_QUANTITY_MISMATCH');
});

test('omitted final sections, incomplete extraction and unpainted detail cells never pass',()=>{
  for(const field of ['sourceProjectRows','sourceMaterialRows','sourceProfileSummaries']){
    const input=fixture();delete input.extraction[field];blocked(input,evidence(),'FINAL_DETAIL_OR_EXTRACTION_MISSING');
  }
  const input=fixture();input.extraction.issues.push({code:'UNKNOWN_ROW'});blocked(input,evidence(),'EXTRACTION_ISSUES');
  const baseline=fixture();baseline.extraction.sourceProjectRows[0].grouping='BASELINE_ONLY';blocked(baseline,evidence(),'FINAL_DETAIL_ROW_INVALID');
});

test('profile lengths balance exactly, and duplicated or missing profiles block',()=>{
  for(const change of [row=>row.wasteLength='1 29/32"',row=>row.cutLength='40"',row=>row.stockLength='61"']){
    const input=fixture();change(input.extraction.sourceProfileSummaries[0]);blocked(input,evidence(),'FINAL_PROFILE_TOTALS_MISMATCH');
  }
  const duplicate=fixture();duplicate.extraction.sourceProfileSummaries.push({...duplicate.extraction.sourceProfileSummaries[0]});blocked(duplicate,evidence(),'FINAL_PROFILE_TOTALS_MISMATCH');
});

test('uncertified kerf and physical bar identity do not require a new human approval',()=>{
  const input=fixture();const bar=input.extraction.individualCoverage.bars[0];
  assert.equal(bar.remainderStatus,'KERF_OR_ALLOWANCE_UNVERIFIED'); assert.equal(bar.modelIsCertified,false);
  assert.equal(run(input).importable,true);
  input.extraction.plans[0].rest='30"';blocked(input,evidence(),'PATTERN_LENGTH_INCONSISTENT');
});

test('reference row ambiguity and quantity disagreement cannot be allocated by order',()=>{
  for(const reverse of [false,true]){
    const input=fixture(), row=input.extraction.sourceProjectRows[0];row.quantity=2;
    input.extraction.sourceProjectRows.push({...row,sourceId:'project-p1-item2'});
    if(reverse)input.extraction.sourceProjectRows.reverse();
    const out=blocked(input,evidence(),'DOCUMENTARY_REFERENCE_UNRESOLVED');
    assert(out.blockers.some(blocker=>blocker.reason==='MULTIPLE_SOURCE_ROWS'));
  }
});

test('SGP reservation, system, production key and programming must be uniquely determined',()=>{
  for(const change of [b=>b.id_programacion='00000000-0000-0000-0000-000000000002',b=>b.key_produccion='OTHER|PANELES_2',b=>b.reserva='OTHER',b=>b.sistema='OTHER']){
    const server=evidence(), extra=binding();change(extra);server.bindings.push(extra);
    server.indexRows.push({...server.indexRows[0],rowId:'index-3',reservation:extra.reserva,system:extra.sistema});
    for(const reverse of [false,true]){if(reverse)server.bindings.reverse();blocked(fixture(),server,'SGP_BINDING_AMBIGUOUS');}
  }
});

test('explicit documentary index selectors can resolve ambiguity without size heuristics',()=>{
  const server=evidence();server.bindings.push({...binding(),id_programacion:'00000000-0000-0000-0000-000000000002'});
  server.indexRows[0].id_programacion=uuid;server.indexRows[0].documentProduction='123456';
  server.indexRows[0].sourceRowId='project-p1-item1';server.indexRows[0].reference=ref;
  assert.equal(run(fixture(),server).importable,true);
  server.indexRows[0].documentProduction='654321';blocked(fixture(),server,'SGP_BINDING_MISSING');
});

test('associated reserve uses actual membership and principal, not arbitrary main-reserve selection',()=>{
  const server=evidence();server.indexRows[0].reservation='ASSOCIATED';server.bindings[0].reserva='ASSOCIATED';
  const out=run(fixture(),server);assert.equal(out.importable,true);assert.equal(out.manifest.pieces[0].asignacion.reserva,'ASSOCIATED');
  server.bindings[0].programacion_reserva='ASSOCIATED';blocked(fixture(),server,'SGP_BINDING_OUTSIDE_VALID_PROGRAMMING');
});

test('cancelled programming and invalid binding fields fail closed, regardless of line',()=>{
  for(const change of [b=>b.id_linea='',b=>b.anio=NaN,b=>b.semana_base=0,b=>b.activa='NO',b=>b.excluida_export=true,
    b=>b.estado_programacion='CANCELADA',b=>b.cantidad_snapshot=0,b=>b.id_programacion='bad',b=>b.reserva_snapshot='OTHER']){
    const server=evidence();change(server.bindings[0]);blocked(fixture(),server,'SGP_BINDING_OUTSIDE_VALID_PROGRAMMING');
  }
  const server=evidence();server.bindings[0].semana_actual=47;assert.equal(run(fixture(),server).importable,true);
});

test('unambiguous other line stays in the complete manifest with a null assignment',()=>{
  for(const change of [b=>b.id_linea='FRAMES_2']){
    const server=evidence();change(server.bindings[0]);const out=run(fixture(),server);
    assert.equal(out.importable,true,JSON.stringify(out.blockers));assert.equal(out.manifest.pieces.length,4);
    assert(out.manifest.pieces.every(piece=>piece.asignacion===null));
    assert(out.manifest.units.every(unit=>unit.scopeStatus==='FUERA_ALCANCE' && unit.exclusion.code==='FUERA_ALCANCE'));
    assert.deepEqual(out.manifest.scopeTotals,{assigned:0,outsideScope:4});
  }
});

function mixedFixture() {
  const input=fixture(),server=evidence(),first=input.extraction.sourceProjectRows[0];first.quantity=2;
  const other={...first,sourceId:'project-p1-item2',reference:'654321 - Company other line'};
  input.extraction.sourceProjectRows.push(other);
  input.extraction.plans[0].cuts.filter(cut=>cut.unitInstance===2).forEach(cut=>cut.project=other.reference);
  server.indexRows.push({...server.indexRows[0],rowId:'index-3',reservation:'OTHER-RES',system:'OTHER-SYS'});
  server.bindings.push({...binding(),documentProduction:'654321',key_produccion:'654321|FRAMES_2',id_linea:'FRAMES_2',
    reserva:'OTHER-RES',sistema:'OTHER-SYS',reserva_principal:'OTHER-RES',programacion_reserva:'OTHER-RES',reserva_snapshot:'OTHER-RES',
    id_programacion:'00000000-0000-0000-0000-000000000002'});
  return {input,server};
}

test('mixed company PDF reconciles entirely and imports every piece while assigning only the requested line',()=>{
  const {input,server}=mixedFixture(),out=run(input,server);
  assert.equal(out.importable,true,JSON.stringify(out.blockers));assert.equal(out.manifest.pieces.length,4);
  assert.deepEqual(out.manifest.totals,{documentaryBars:2,documentaryCuts:4,cutLength32:1284});
  assert.deepEqual(out.manifest.scopeTotals,{assigned:2,outsideScope:2});
  const selected=out.manifest.units.filter(unit=>unit.assignment!==null),excluded=out.manifest.units.filter(unit=>unit.assignment===null);
  assert(selected.every(unit=>unit.assignment.reserva==='RES-SYNTH'));
  assert(excluded.every(unit=>unit.documentProduction==='654321' && unit.exclusion.linea==='FRAMES_2' && unit.status==='PENDIENTE'));
  assert.equal(new Set(out.manifest.units.map(unit=>unit.documentaryId)).size,4);
  assert.equal(out.manifest.pieces.filter(piece=>piece.asignacion===null).length,2);
  input.extraction.sourceProjectRows[1].quantity=3;blocked(input,server,'FINAL_REFERENCE_LENGTH_QUANTITY_MISMATCH');
});

test('outside-scope marker can never hide ambiguous, missing or invalid bindings',()=>{
  for(const mutate of [
    s=>s.bindings.push({...s.bindings[1],id_programacion:'00000000-0000-0000-0000-000000000003'}),
    s=>s.bindings.pop(),
    s=>s.bindings[1].estado_programacion='CANCELADA'
  ]){
    const {input,server}=mixedFixture();mutate(server);
    const out=run(input,server);assert.equal(out.importable,false);assert.equal(out.manifest,null);
  }
  const {input,server}=mixedFixture();server.bindings.push({...server.bindings[0],id_linea:'FRAMES_2',key_produccion:'123456|FRAMES_2'});
  blocked(input,server,'SGP_BINDING_AMBIGUOUS');
});

test('changed PDF, missing link, unrelated index rows or conflicting facts cannot certify',()=>{
  const missing=evidence();missing.bindings=[];blocked(fixture(),missing,'SGP_BINDING_MISSING');
  const wrongHash=evidence();wrongHash.pdfSha256='b'.repeat(64);blocked(fixture(),wrongHash,'SERVER_EVIDENCE_INVALID');
  const noLink=evidence();noLink.indexRows[0].sourceKey='other-source';blocked(fixture(),noLink,'DOCUMENT_INDEX_LINK_MISSING');
  const unrelated=evidence();unrelated.indexRows.push({...unrelated.indexRows[0],rowId:'another',reservation:'OTHER'});blocked(fixture(),unrelated,'DOCUMENT_INDEX_ROW_UNRESOLVED');
  const contradictory=evidence();contradictory.bindings.push({...binding(),activa:'NO'});blocked(fixture(),contradictory,'SGP_BINDING_OUTSIDE_VALID_PROGRAMMING');
});

test('all documented units retain stable IDs after array permutations and hash separates different PDF bytes',()=>{
  const input=fixture(), before=run(input);input.extraction.plans[0].cuts.reverse();
  input.extraction.reconciliation=[{cutLengthsMatch:false}];input.extraction.individualCoverage={status:'FORGED'};
  assert.deepEqual(run(input).manifest,before.manifest);
  const server=evidence();input.document.sha256='b'.repeat(64);server.pdfSha256=input.document.sha256;server.indexRows[0].pdfSha256=input.document.sha256;
  const second=run(input,server);assert(second.manifest.units.every(unit=>!before.manifest.units.some(prior=>prior.documentaryId===unit.documentaryId)));
});

test('duplicate slots, duplicate patterns and varying repeated bars block import',()=>{
  const duplicated=fixture();duplicated.extraction.plans[0].cuts[1]={...duplicated.extraction.plans[0].cuts[0]};blocked(duplicated,evidence(),'DUPLICATE_CUT_PROVENANCE');
  const patterns=fixture();patterns.extraction.plans.push(structuredClone(patterns.extraction.plans[0]));blocked(patterns,evidence(),'PATTERN_INVALID_OR_DUPLICATE');
  const varying=fixture();varying.extraction.plans[0].cuts[0].sourceSlot=2;blocked(varying,evidence(),'PATTERN_REPETITIONS_DIFFER');
});

test('caller flags cannot override validation and output mutation never changes inputs',()=>{
  const input=fixture(), server=evidence(), original=structuredClone({input,server});
  const output=run(input,server);output.manifest.pieces[0].asignacion.reserva='MUTATED';output.manifest.units[0].provenance.sourcePage=99;
  assert.deepEqual({input,server},original);
  input.extraction.issues.push({code:'INCOMPLETE'});input.extraction.verified=true;input.extraction.productionEnabled=true;
  server.verified=true;server.approved=true;blocked(input,server,'EXTRACTION_ISSUES');
});

test('Retail, Project and individual sources remain exact; individual PDF needs a server documentary relation',()=>{
  for(const origin of ['RETAIL','PROYECTO','DESCONOCIDO']){
    const input=fixture(),server=evidence();input.document.origin=origin;server.indexRows[0].origin=origin;
    input.document.mode='INDIVIDUAL';assert.equal(run(input,server).importable,true);
    server.indexRows=[];blocked(input,server,'INDIVIDUAL_DOCUMENT_RELATION_MISSING');
  }
});

test('server seam hashes actual bytes, extracts itself, and never accepts client evidence/approved manifests',async()=>{
  const bytes=new TextEncoder().encode('%PDF-synthetic-not-a-real-pdf'), actualHash=createHash('sha256').update(bytes).digest('hex');
  let reads=0,parsed=0;
  const prepare=createOptImportPreparation({readPdfPages:async actual=>{parsed++;assert.deepEqual(actual,bytes);return pages();},
    readServerEvidence:async ({document:doc,documentaryRows})=>{reads++;assert.equal(doc.sha256,actualHash);assert.equal(documentaryRows.length,1);
      const server=evidence();server.pdfSha256=actualHash;server.indexRows[0].pdfSha256=actualHash;return server;}});
  const input={pdfBytes:bytes,source:document(),sha256:sha,extraction:{verified:true},serverEvidence:{approved:true},manifest:[{estado:'CORTADO'}]};
  const out=await prepare(input);assert.equal(out.importable,true);assert.equal(out.manifest.pdfSha256,actualHash);assert.equal(reads,1);assert.equal(parsed,1);
  for(const pdfBytes of [new Uint8Array(),new TextEncoder().encode('not-pdf'),new Uint8Array(33554433)])await assert.rejects(()=>prepare({pdfBytes,source:document()}),/PDF/);
  assert.equal(reads,1);
});

test('server read failures cannot fall back to an approved browser payload',async()=>{
  const prepare=createOptImportPreparation({readPdfPages:async()=>pages(),readServerEvidence:async()=>{throw Error('SERVER_SNAPSHOT_UNAVAILABLE');}});
  await assert.rejects(()=>prepare({pdfBytes:new TextEncoder().encode('%PDF-test'),source:document(),serverEvidence:evidence()}),/SERVER_SNAPSHOT_UNAVAILABLE/);
  assert.throws(()=>createOptImportPreparation({}),/DEPENDENCIES/);
});

test('malformed server and extraction rows return concrete blocks rather than treating absence as zero',()=>{
  for(const field of ['indexRows','bindings']){const server=evidence();server[field]=[null];blocked(fixture(),server,'SERVER_EVIDENCE_INVALID');}
  for(const field of ['plans','sourceProjectRows','sourceMaterialRows','sourceProfileSummaries','issues']){
    const input=fixture();input.extraction[field]=[null];blocked(input,evidence(),'EXTRACTION_RECORD_INVALID');
  }
  const input=fixture();input.extraction.plans[0].cuts=[null];blocked(input,evidence(),'PATTERN_INVALID_OR_DUPLICATE');
  for(const malformed of ['1"0','10""','"10','10e0'])assert.throws(()=>exactLength32(malformed));
});

test('contradictory duplicate server facts cannot be hidden by reordering the joined read',()=>{
  for(const reverse of [false,true]){
    const server=evidence();server.bindings.push({...binding(),cantidad_snapshot:2});if(reverse)server.bindings.reverse();
    blocked(fixture(),server,'SGP_BINDING_CONFLICTING_FACTS');
  }
});

test('aggregate-correct source group redistribution still fails per-row quantities',()=>{
  const input=fixture(),row=input.extraction.sourceProjectRows[0];
  row.quantity=2;const other={...row,sourceId:'project-p1-item2',reference:'123456 - Synthetic B'};input.extraction.sourceProjectRows.push(other);
  // Correct whole-PDF quantity/length but source rows no longer match the patterns.
  input.extraction.plans[0].cuts[0].project=other.reference;
  blocked(input,evidence(),'FINAL_REFERENCE_LENGTH_QUANTITY_MISMATCH');
});

test('original weeks remain assigned without changing immutable manifest when the view week changes',()=>{
 const server=evidence();server.bindings[0].anio=2025;server.bindings[0].semana_base=45;
 const first=run(fixture(),server);assert.equal(first.importable,true);assert(first.manifest.pieces.every(p=>p.asignacion!==null));
 assert(first.manifest.units.every(u=>u.scopeStatus==='OTHER_ORIGINAL_WEEK'&&u.originalScope.anio===2025&&u.originalScope.semana===45));
 const changed=structuredClone(server);changed.scope.anio=2025;changed.scope.semana=45;const later=run(fixture(),changed);assert.equal(later.importable,true);
 assert.deepEqual(first.manifest.pieces,later.manifest.pieces);assert(later.manifest.units.every(u=>u.scopeStatus==='IN_SCOPE'));
});

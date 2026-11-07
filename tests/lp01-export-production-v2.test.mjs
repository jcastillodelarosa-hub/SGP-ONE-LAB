import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {harness,ctx,id,key,xlsx} from './lp01-cierre-export-v2/fixture.mjs';
import {EXPORT_V2_ENABLED,EXPORT_V2_AUTHORITY,createExportProductionV2Reference,exportProductionSourceRevision,
 realizedExportProduction as readRealized,exportProductionContinuity as readContinuity} from '../src/server/lp-export-production-v2.js';

const realizedExportProduction=state=>readRealized(state,{DOMParser});
const exportProductionContinuity=state=>readContinuity(state,{DOMParser});

async function rejectedUnchanged(h, command, pattern) {
 const before=h.state;await assert.rejects(()=>h.service.execute(command),pattern);assert.deepEqual(h.state,before);
}
test('V2 is disconnected and rejects any ordinary production adapter or enable switch',()=>{
 assert.equal(EXPORT_V2_ENABLED,false);
 for(const options of [{},{mode:'production',repository:{kind:'ISOLATED_REFERENCE_STORE',transaction(){}}},{mode:'ISOLATED_TEST_ONLY',repository:{kind:'SQL',transaction(){}}}])assert.throws(()=>createExportProductionV2Reference(options),/DESACTIVADO/);
});
test('original XLSX is parsed server-side; one production for two UUIDs; manual execution never added',async()=>{
 const h=harness(), original=structuredClone(h.source.orders);const result=await h.import();
 assert.equal(result.totalReported,12);assert.equal(h.state.imports[0].rows.length,2);
 assert.equal(h.state.imports[0].rows[0].quantity,7);assert.equal(h.state.imports[0].file.originalBase64,btoa(String.fromCharCode(...xlsx())));
 assert.match(result.sha256,/^[a-f0-9]{64}$/);assert.deepEqual(h.source.orders,original);
 const close=await h.close();assert.equal(close.closure.authority,EXPORT_V2_AUTHORITY);
 const a=close.closure.rows[0];assert.equal(a.plan,null);assert.equal(a.planStatus,'PLAN_SOURCE_REQUIRED');assert.equal(a.realized,7);assert.equal(a.difference,null);assert.equal(a.pendingAgainstPlan,null);
 assert.equal(a.manualHistory.authority,'HISTORICAL_ONLY');assert.equal(a.manualHistory.assignments[0].ejecutado,999);
 assert.equal(a.parte,undefined);assert.equal(a.executed,undefined);
});
test('ABSENT preserves the production/history and remains null; explicit source zero is zero',async()=>{
 const h=harness();await h.import([['A',0]]);const before=h.state;
 await rejectedUnchanged(h,await h.command('CERRAR',{importId:before.currentImportId,reasons:{[key('A')]:'Sin ejecución'}}),/SIN_MOTIVO/);
 await h.close({[key('A')]:'Cero explícito',[key('B')]:'No incluida en filtro Export'});
 const rows=(await realizedExportProduction(h.state)).rows;assert.equal(rows[0].quantity,0);assert.equal(rows[0].coverage,'PRESENT');assert.equal(rows[1].quantity,null);assert.equal(rows[1].coverage,'ABSENT');
 const carry=(await exportProductionContinuity(h.state));assert.equal(carry.canApply,false);assert.equal(carry.rows[0].pendingAgainstPlan,null);assert.equal(carry.rows[1].pendingAgainstPlan,null);assert.equal(carry.rows[1].preserve,true);assert.equal(carry.rows[1].sourcePlan,null);
});
test('partial reimports replace present values and preserve absent quantities with their own original',async()=>{
 const h=harness();const first=await h.import([['A',7],['B',5]]), second=await h.import([['A',3]]);
 assert.equal(h.state.imports.length,2);assert.equal(h.state.imports[0].totalReported,12);assert.equal(second.totalReported,3);assert.notEqual(first.sha256,second.sha256);
 await rejectedUnchanged(h,await h.command('CERRAR',{importId:first.importId,reasons:{}}),/VIGENTE/);
 const close=await h.close({[key('A')]:'Corrección',[key('B')]:'Export filtrado'});assert.equal(close.closure.rows[0].realized,3);assert.equal(close.closure.rows[1].realized,5);
 assert.equal(close.closure.rows[1].valueStatus,'PRESERVED');assert.equal(close.closure.rows[1].valueSource.importId,first.importId);assert.equal(close.closure.rows[1].valueSource.file.sha256,first.sha256);assert.notEqual(close.closure.rows[1].valueSource.file.sha256,second.sha256);assert.deepEqual(close.closure.rows[1].sourceRows,[]);
 const carry1=(await exportProductionContinuity(h.state)),carry2=(await exportProductionContinuity(h.state));assert.deepEqual(carry1,carry2);assert.equal(carry1.rows[0].pendingAgainstPlan,null);
 assert.equal(carry1.rows[0].allocation,'NONE');assert.equal(carry1.rows[0].nextPlan,null);assert.equal(carry1.rows[0].assignmentRefs.length,2);
});
test('same request replays exactly; same file new request creates history but never adds realization',async()=>{
 const h=harness(), cmd=await h.command('IMPORTAR_XLSX',{filename:'Export.xlsx',bytes:xlsx()});
 const first=await h.service.execute(cmd), before=h.state, retry=await h.service.execute(cmd);
 assert.equal(retry.duplicate,true);assert.equal(retry.importId,first.importId);assert.deepEqual(h.state,before);
 await rejectedUnchanged(h,{...cmd,filename:'Otro.xlsx'},/IDEMPOTENCIA/);
 const next=await h.import();assert.equal(next.totalReported,12);assert.equal(h.state.imports.length,2);
});
test('simultaneous different requests with same revision cannot both commit; same request safely replays',async()=>{
 const h=harness(), a=await h.command('IMPORTAR_XLSX',{filename:'Export.xlsx',bytes:xlsx()}), b={...a,id:id(999)};
 const results=await Promise.allSettled([h.service.execute(a),h.service.execute(b)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(results.find(r=>r.status==='rejected').reason.message,/CONFLICTO_REVISION/);assert.equal(h.state.imports.length,1);
 const again=await Promise.all([h.service.execute(a),h.service.execute(a)]);assert(again.every(r=>r.duplicate));assert.equal(h.state.imports.length,1);
});
test('plan comparison remains unavailable: SALE, manual execution and quantity changes do not fabricate a target',async()=>{
 const h=harness();await h.import([['A',11],['B',5]]);const close=await h.close({});
 assert.equal(close.closure.comparisonComplete,false);assert.equal(close.closure.planComparison,'PLAN_SOURCE_REQUIRED');
 assert(close.closure.rows.every(r=>r.plan===null&&r.difference===null&&r.pendingAgainstPlan===null));
 const carry=await exportProductionContinuity(h.state);assert.equal(carry.canApply,false);assert(carry.rows.every(r=>r.quantity===null&&r.pendingAgainstPlan===null&&r.sourcePlan===null));
});
test('unknown legacy SALE does not block persistence or become an implicit plan',async()=>{
 const h=harness();h.source.orders[0].sale=null;await h.import();await h.close({});
 assert.equal((await realizedExportProduction(h.state)).rows[0].plan,null);
});
test('plan/source revision and universe changes invalidate imported evidence until reimported',async()=>{
 const h=harness();await h.import();h.source.orders[0].sale=7;
 await rejectedUnchanged(h,await h.command('CERRAR',{importId:h.state.currentImportId,reasons:{}}),/COBERTURA_CAMBIO/);
 await h.import([['A',11],['B',5]]);await h.close({});assert.equal(h.state.closures[0].rows[0].plan,null);
 const stale=await h.command('REABRIR',{reason:'x'});h.source.revision='source-r2';await rejectedUnchanged(h,stale,/UNIVERSO_CAMBIO/);
});
test('authorization and scopes are checked at execution, replay and before commit',async()=>{
 const h=harness(),cmd=await h.command('IMPORTAR_XLSX',{filename:'Export.xlsx',bytes:xlsx()});await h.service.execute(cmd);
 h.auth.keys=[key('A')];await rejectedUnchanged(h,cmd,/AMBITO_DENEGADO/);
 h.auth.keys=[key('A'),key('B')];h.auth.valid=false;await rejectedUnchanged(h,cmd,/AMBITO_DENEGADO/);
 const h2=harness(),c=await h2.command('IMPORTAR_XLSX',{filename:'Export.xlsx',bytes:xlsx()});let reads=0;
 h2.authRead=()=>({...h2.auth,valid:++reads===1});await rejectedUnchanged(h2,c,/AMBITO_DENEGADO/);
});
test('mid-transaction source drift or persistence failure rolls back original and receipt atomically',async()=>{
 const h=harness(),cmd=await h.command('IMPORTAR_XLSX',{filename:'Export.xlsx',bytes:xlsx()});let reads=0;
 h.sourceRead=()=>{const s=structuredClone(h.source);if(++reads>1)s.revision='drift';return s;};await rejectedUnchanged(h,cmd,/UNIVERSO_CAMBIO/);
 h.sourceRead=null;h.beforeCommit=()=>{throw Error('synthetic write failure');};await rejectedUnchanged(h,cmd,/write failure/);
 h.beforeCommit=null;await h.service.execute(cmd);assert.equal(h.state.imports.length,1);
});
test('reopen invalidates current Realizado; correction keeps immutable older closure',async()=>{
 const h=harness();await h.import();const close=await h.close();
 await h.service.execute(await h.command('REABRIR',{reason:'Corrección del archivo'}));assert.equal((await realizedExportProduction(h.state)).status,'NO_CONFIRMED_CLOSE');assert.equal(h.state.closures.length,1);
 assert.equal((await exportProductionContinuity(h.state)).canApply,false);h.auth.canCorrect=false;
 await rejectedUnchanged(h,await h.command('IMPORTAR_XLSX',{filename:'Export.xlsx',bytes:xlsx()}),/CORRECCION/);
 h.auth.canCorrect=true;await h.import([['A',8],['B',5]]);await h.close({[key('A')]:'Corrección'});
 assert.equal(h.state.closures.length,2);assert.deepEqual(h.state.closures[0],close.closure);assert.equal((await realizedExportProduction(h.state)).rows[0].quantity,8);
});
test('reopen cannot silently invalidate a consumed successor; no automatic replacement of downstream plan',async()=>{
 const h=harness();await h.import();await h.close();h.source.hasSuccessor=true;
 await rejectedUnchanged(h,await h.command('REABRIR',{reason:'Corrección'}),/CONTINUIDAD_CONCILIAR/);
});
test('outside catalog, ambiguous names, unincorporated productions and required missing orders fail closed',async()=>{
 for(const name of ['C','OUT']){const h=harness();await rejectedUnchanged(h,await h.command('IMPORTAR_XLSX',{filename:'Export.xlsx',bytes:xlsx([[name,1]])}),/INCORPORACION|ámbito/);}
 const h=harness();h.source.catalog.productions[2].oficial.produccion='A';await rejectedUnchanged(h,await h.command('IMPORTAR_XLSX',{filename:'Export.xlsx',bytes:xlsx()}),/ambigua/);
 const h2=harness();const cmd=await h2.command('IMPORTAR_XLSX',{filename:'Export.xlsx',bytes:xlsx()});h2.source.requiredKeys.push(key('C'));await rejectedUnchanged(h2,cmd,/INCORPORACION/);
});
test('selected shift only; omitted selected period and exact duplicate Export rows never imply zero or add',async()=>{
 const h=harness();await h.import([['A',7,1],['B',99,2]]);assert.equal(h.state.imports[0].totalReported,7);assert.equal(h.state.imports[0].rows[1].coverage,'ABSENT');
 await rejectedUnchanged(h,await h.command('IMPORTAR_XLSX',{filename:'Export.xlsx',bytes:xlsx([['A',1,2]])}),/período/);
 await rejectedUnchanged(h,await h.command('IMPORTAR_XLSX',{filename:'Export.xlsx',bytes:xlsx([['A',1],['A',1]])}),/duplicada/);
});
test('client totals, forged parsed rows, manual commands, Empaque and malformed contexts rejected',async()=>{
 const h=harness(),cmd=await h.command('IMPORTAR_XLSX',{filename:'Export.xlsx',bytes:xlsx()});
 for(const delta of [{parsed:{}},{quantity:100},{op:'EJECUTAR'},{op:'ABRIR'},{context:{...ctx,stage:'EMPAQUE'}},{context:{...ctx,line:'FRAMES_2'}},{context:{...ctx,date:'2026-02-30'}},{context:{...ctx,shift:'1'}}])await rejectedUnchanged(h,{...cmd,...delta},/COMANDO|CONTEXTO/);
});
test('SIN ACTIVIDAD requires truly empty required universe and explicit confirmation, not absent Export',async()=>{
 const h=harness();await rejectedUnchanged(h,await h.command('CERRAR',{type:'SIN_ACTIVIDAD',confirmed:true}),/SIN_ACTIVIDAD/);
 h.source.orders=[];h.source.requiredKeys=[];await rejectedUnchanged(h,await h.command('CERRAR',{type:'SIN_ACTIVIDAD'}),/SIN_ACTIVIDAD/);
 await h.service.execute(await h.command('CERRAR',{type:'SIN_ACTIVIDAD',confirmed:true}));assert.equal((await realizedExportProduction(h.state)).status,'CONFIRMED_EMPTY');assert.deepEqual((await realizedExportProduction(h.state)).rows,[]);
});
test('source fingerprint changes for same-revision plan drift; malformed/duplicated assignment roots rejected',async()=>{
 const h=harness(),before=await exportProductionSourceRevision(h.source);h.source.orders[0].sale++;assert.notEqual(await exportProductionSourceRevision(h.source),before);
 h.source.orders.push(h.source.orders[0]);await assert.rejects(()=>exportProductionSourceRevision(h.source),/ORDEN_INCOMPATIBLE/);
});
test('parser input is copied before awaits so caller mutation cannot replace original evidence',async()=>{
 const h=harness(),cmd=await h.command('IMPORTAR_XLSX',{filename:'Export.xlsx',bytes:xlsx()}),original=new Uint8Array(cmd.bytes);
 const promise=h.service.execute(cmd);cmd.bytes.fill(0);await promise;assert.equal(h.state.imports[0].file.originalBase64,btoa(String.fromCharCode(...original)));
});
test('historical reports never become current after invalid revision or duplicate closure',async()=>{
 const h=harness();await h.import();await h.close();const state=h.state;state.revision++;await assert.rejects(()=>realizedExportProduction(state),/CIERRE_ACTUAL/);
 const duplicate=h.state;duplicate.closures.push(duplicate.closures[0]);await assert.rejects(()=>realizedExportProduction(duplicate),/CIERRE_ACTUAL/);
});

test('current reader rejects tampered context, authority, provenance, quantity or absent coverage',async()=>{
 const h=harness();await h.import([['A',7]]);await h.close({[key('A')]:'Pendiente',[key('B')]:'Filtro'});
 for(const mutate of [s=>s.closures[0].context.shift=2,s=>s.closures[0].authority='MANUAL',s=>s.closures[0].file.sha256='f'.repeat(64),s=>s.closures[0].rows[0].realized=999,s=>s.closures[0].rows[1].realized=0,s=>s.closures[0].rows[0].pendingAgainstPlan=99,s=>s.closures[0].rows.push(s.closures[0].rows[0])]){
  const state=h.state;mutate(state);await assert.rejects(()=>realizedExportProduction(state),/CIERRE_ACTUAL/);
 }
});
test('correction privilege revoked before close commit rejects the entire corrected close',async()=>{
 const h=harness();await h.import();await h.close();await h.service.execute(await h.command('REABRIR',{reason:'x'}));await h.import();
 const command=await h.command('CERRAR',{importId:h.state.currentImportId,reasons:{[key('A')]:'Corrección'}});let reads=0;
 h.authRead=()=>({...h.auth,canCorrect:++reads===1});await rejectedUnchanged(h,command,/CORRECCION/);
});


test('reopen correction keeps absent last confirmed values and immutable older versions',async()=>{
 const h=harness(),first=await h.import([['A',7],['B',5]]),closed=await h.close({});
 await h.service.execute(await h.command('REABRIR',{reason:'Corrección parcial'}));
 assert.equal((await realizedExportProduction(h.state)).status,'NO_CONFIRMED_CLOSE');
 await h.import([['A',3]]);await h.close({[key('B')]:'Conservado, fuera del filtro'});
 const rows=(await realizedExportProduction(h.state)).rows;
 assert.equal(rows[0].quantity,3);assert.equal(rows[1].quantity,5);assert.equal(rows[1].valueSource.importId,first.importId);
 assert.equal(rows[1].fileId,first.importId);assert.deepEqual(h.state.closures[0],closed.closure);
});
test('an explicit correction to zero survives a later absence; newly incorporated never-reported key remains null',async()=>{
 const h=harness();await h.import([['A',7],['B',5]]);const zero=await h.import([['B',0]]);
 h.source.requiredKeys.push(key('C'));h.source.orders.push({...h.source.orders[2],key:key('C'),parte:id(4),sale:null});
 const corrected=await h.import([['A',3]]);assert.equal(corrected.preserved,1);assert.equal(corrected.neverReported,1);
 await h.close({[key('B')]:'Cero conservado',[key('C')]:'Nunca informado'});
 const rows=(await realizedExportProduction(h.state)).rows;
 assert.equal(rows[0].quantity,3);assert.equal(rows[1].quantity,0);assert.equal(rows[1].valueStatus,'PRESERVED');assert.equal(rows[1].valueSource.importId,zero.importId);
 assert.equal(rows[2].quantity,null);assert.equal(rows[2].valueStatus,'NEVER_REPORTED');assert.equal(rows[2].valueSource,null);assert.equal(rows[2].fileId,null);
});
test('a copied prior context, source hash, source revision, original bytes or fabricated preserved quantity fails closed',async()=>{
 const h=harness();await h.import([['A',7],['B',5]]);await h.import([['A',3]]);await h.close({[key('B')]:'Filtro'});
 for(const mutate of [
  s=>s.imports[0].context.shift=2,
  s=>s.receipts[0].response.rows[0].quantity=8,
  s=>s.receipts.splice(0,1),
  s=>s.closures[0].rows[0].identity.production='Fabricated name',
  s=>s.imports[0].sourceSnapshot.orders[0].sale=77,
  s=>s.imports[0].file.sha256='f'.repeat(64),
  s=>s.imports[0].file.originalBase64=btoa('not an XLSX'),
  s=>s.imports[1].rows[1].quantity=55,
  s=>s.imports[1].rows[1].valueSource.importId=s.imports[1].id,
  s=>s.closures[0].rows[1].valueSource.file=s.closures[0].file,
  s=>s.closures[0].rows[1].valueSource.context.shift=2,
  s=>s.closures[0].rows[1].valueSource.sourceRows=[999]
 ]){const state=h.state;mutate(state);await assert.rejects(()=>realizedExportProduction(state),/CIERRE_ACTUAL/);}
});
test('corrupted original cannot be used by another partial import or close; old state version is explicit incompatibility',async()=>{
 const h=harness();await h.import();const state=h.state;state.imports[0].file.originalBase64=btoa('bad bytes');h.state=state;
 await rejectedUnchanged(h,await h.command('IMPORTAR_XLSX',{filename:'Export.xlsx',bytes:xlsx([['A',3]])}),/PROCEDENCIA/);
 await rejectedUnchanged(h,await h.command('CERRAR',{importId:state.currentImportId,reasons:{}}),/PROCEDENCIA/);
 const old=harness();const v2=old.state;v2.version='LP-EXPORT-PRODUCTION-2.0.0-ISOLATED';old.state=v2;
 await rejectedUnchanged(old,await old.command('IMPORTAR_XLSX',{filename:'Export.xlsx',bytes:xlsx()}),/VERSION_ESTADO/);
});

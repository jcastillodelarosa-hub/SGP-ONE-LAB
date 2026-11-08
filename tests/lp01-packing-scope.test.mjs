import test from 'node:test';import assert from 'node:assert/strict';
import {packingSharedEvidence,packingNativeEvidence} from '../src/domain/lp01-packing-affectation-scope.js';
import {packingAssemblyState} from '../src/domain/lp01-assembly-sheet.js';
import {withExportGlassSummary} from '../src/domain/lp01-export-glass-summary.js';
import {sharedOrderSummary} from '../src/domain/lp01-shared-order-summary.js';
import {assemblySheetMarkup} from '../src/modules/lp01-assembly-sheet.js';
const o={cantidad:10,saldo_ensamble:0,saldos_inicializados:true,presente_ultimo_export:true};
test('packing assembly state distinguishes completed, partial, unstarted and invalid',()=>{
 for(const [saldo,label] of [[0,'Ensamblada'],[3,'Abierta (3)'],[10,'Sin iniciar'],[11,'Por validar'],[-1,'Por validar'],[null,'Por validar']])assert.equal(packingAssemblyState({...o,saldo_ensamble:saldo}).label,label);
 assert.equal(packingAssemblyState({...o,presente_ultimo_export:false}).label,'Por validar');
});
const native={key:'A|PANELES_2',line:'PANELES_2',stage:'EMPAQUE',reports:[{id:'p',originStage:'EMPAQUE',cause:'NOVEDAD',quantity:2,confirmed:0}],events:[],aluminumPending:{status:'AVAILABLE',rows:[{id:'al-ens',origin:'ENSAMBLE',state:'PENDIENTE',pieceQuantity:19},{id:'al-pick',origin:'PICKING',state:'PENDIENTE',pieceQuantity:8},{id:'al-pack',origin:'EMPAQUE',state:'PENDIENTE',pieceQuantity:1}]}};
const shared={...native,revision:3,reports:[{id:'a',origin_stage:'ENSAMBLE',cause:'NC_AL',quantity:19,confirmed:0},{id:'b',origin_stage:'EMPAQUE',cause:'NOVEDAD',quantity:2,confirmed:0},{id:'c',cause:'NC_V',quantity:9,confirmed:0}],legacyReports:[{id:'l',etapa:'ENSAMBLE',causa:'NC_V',ventanas:5,confirmadas:0}],history:[{reportId:'a'},{reportId:'b'}],accessories:[{pieces:5}]};
test('shared detail and summary retain only explicit Empaque evidence, global revision unchanged',()=>{
 const s=packingSharedEvidence(shared);assert.deepEqual(s.reports.map(r=>r.id),['b']);assert.equal(s.revision,3);assert.equal(s.history.length,1);assert.equal(s.legacyReports.length,0);assert.equal(s.accessories.length,0);
 const n=packingNativeEvidence(native);assert.deepEqual(n.aluminumPending.rows.map(r=>r.id),['al-pack']);
 const summary=sharedOrderSummary(native,shared);assert.equal(summary.categories.NC_AL,null);assert.equal(summary.categories.NOVEDAD,2);assert.deepEqual(summary.estimates.map(r=>r.quantity),[1]);
 assert.equal(packingSharedEvidence({...shared,stage:'ENSAMBLE'}).reports.length,3);assert.equal(native.aluminumPending.rows.length,3);
});
test('packing never inherits global Tecno Export estimate; no Tecno category remains',()=>{
 const result=withExportGlassSummary({categories:{TECNO:2},exportGlass:{rounded:40}},null,{key:native.key,line:native.line,stage:'EMPAQUE'});
 assert.equal(result.exportGlass,undefined);assert.equal(result.categories.TECNO,null);
});
test('packing compact markup has Estado Ensamble before Saldo Empaque and colored complete state',()=>{
 const row={key:'A|PANELES_2',id:'A',state:'ABIERTAS',produccion:'QA',oficial:o,balance:6,realized:null,week:{label:'45'},assignments:[],observations:[],observation:''};
 const html=assemblySheetMarkup([row],{stage:'EMPAQUE'});
 assert.ok(html.indexOf('data-label="Estado Ensamble"')<html.indexOf('data-label="Saldo Empaque"'));assert.match(html,/is-complete/);assert.match(html,/>Ensamblada</);assert.match(html,/data-label="Saldo Empaque"/);assert.doesNotMatch(html,/data-label="Saldo Export"/);
});
test('shared transport validates full revision history then exposes scoped reports for detail/write selectors',async()=>{
 const {sharedOrderTransport}=await import('../src/services/lp01-shared-order.js');
 const fixture={...shared,contract:'LP-SHARED-ORDER-1',canReport:true,revision:2,reports:shared.reports.slice(0,2).map(r=>({...r,key:native.key,solved:0})),history:[{reportId:'a',revision:1},{reportId:'b',revision:2}]};
 const t=sharedOrderTransport({client:{rpc:async()=>({data:fixture,error:null})},getToken:()=> 'token',key:native.key,line:native.line,stage:'EMPAQUE'});
 const d=await t.read();assert.equal(d.revision,2);assert.deepEqual(d.reports.map(r=>r.id),['b']);assert.deepEqual(d.history.map(e=>e.reportId),['b']);assert.equal(d.legacyReports.length,0);
});
test('Empaque removes historical Tecno from display without mutating persisted input',()=>{
 const data={...native,reports:[...native.reports,{id:'tecno',originStage:'EMPAQUE',cause:'TECNO',quantity:4,confirmed:0}],events:[{reportId:'tecno',stage:'EMPAQUE'}]};
 const projected=packingNativeEvidence(data);assert.equal(projected.reports.some(r=>r.cause==='TECNO'),false);assert.equal(data.reports.length,2);
 const old={...shared,legacyReports:[{id:'old',etapa:'EMPAQUE',causa:'TECNO',ventanas:4,confirmadas:0}]};assert.equal(packingSharedEvidence(old).legacyReports.length,0);assert.equal(old.legacyReports.length,1);
});
test('both Empaque transports reject new Tecno before any RPC',async()=>{
 const {affectationsTransport}=await import('../src/services/lp01-affectations.js');const {sharedOrderTransport}=await import('../src/services/lp01-shared-order.js');let calls=0;const client={rpc:async()=>{calls++;throw Error('RPC_CALLED');}},getToken=()=> 'qa';
 const context={key:native.key,line:native.line,stage:'EMPAQUE'};
 for(const transport of [affectationsTransport({client,getToken,context}),sharedOrderTransport({client,getToken,...context})])await assert.rejects(transport.command({action:'CREATE',cause:'TECNO',quantity:1}),/TECNO_SOLO_ENSAMBLE/);
 assert.equal(calls,0);
 await assert.rejects(affectationsTransport({client,getToken,context:{...context,stage:'ENSAMBLE'}}).command({action:'CREATE',cause:'TECNO',quantity:1}),/RPC_CALLED/);assert.equal(calls,1);
});

test('Tecno tab exists only in Ensamble, never Empaque',async()=>{
 const {affectationTabTypes}=await import('../src/modules/lp01-affectation-tabs.js');
 assert.equal(affectationTabTypes('EMPAQUE').some(([key])=>key==='TECNO'),false);
 assert.equal(affectationTabTypes('ENSAMBLE').some(([key])=>key==='TECNO'),true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOptProgrammingSnapshot,classifyOptLineScope,normalizeOptScopeContext} from '../src/domain/opt-line-scope.js';
const context={linea:'PANELES_2',anio:2026,semana:46,modo:'BASE'};
const production=(key='p1',reserve='R1')=>({key_produccion:key,id_linea:'PANELES_2',anio:2026,semana_base:46,sistema:'S1',reserva_principal:reserve});
const snapshot=(productions=[production()],shared=[])=>buildOptProgrammingSnapshot({context,productions,shared});
const row=(reservation='R1',extra={})=>({sourceKey:'retail-index-46',origin:'RETAIL',opt:'OPT1',reservation,system:'S1',...extra});
const file=(extra={})=>({sourceKey:'retail-index-46',origin:'RETAIL',opt:'OPT1',sha256:'a'.repeat(64),...extra});
test('exact line and BASE, yearless associations restricted by key, no inferred carry',()=>{
 const s=snapshot([production(),{...production('other'),id_linea:'FRAMES_2'}],[{key_produccion:'p1',reservas:[{reserva:'R2',tipo:'ASOCIADA'}]},{key_produccion:'old-year',reservas:[{reserva:'R3'}]}]);
 assert.equal(s.productions.length,1);assert.equal(s.ignoredShared.length,1);
 const r=classifyOptLineScope({snapshot:s,entries:[row('R1'),row('R2'),row('R3'),row('R1',{carry:true})]});
 assert.deepEqual(r.associations.map(x=>x.status),['IN_SCOPE','IN_SCOPE','UNRESOLVED_SCOPE','IN_SCOPE']);assert.equal(r.carryStatus,'KEEP_ORIGINAL_WEEK');assert.equal(r.canRegister,false);
});
test('mixed PDF retains every row, blanks and outside portions; no quantity inference',()=>{
 const entries=[row(),row('R9'),row('')]; const r=classifyOptLineScope({snapshot:snapshot(),entries,documents:[file()]});
 assert.equal(r.documents[0].status,'MIXED');assert.equal(r.documents[0].associations.length,3);assert.equal(r.associations[2].entry,entries[2]);assert.equal(r.groups.length,1);assert.equal(r.groups[0].canRegister,false);assert.equal(r.groups[0].units,undefined);
});
test('multiple OPT for same reservation legitimate, exact system and reserve matching',()=>{
 const r=classifyOptLineScope({snapshot:snapshot(),entries:[row(),row('R1',{opt:'OPT2'}),row('R1',{system:'s1'}),row('R1,R2')]});
 assert.deepEqual(r.groups[0].opts,['OPT1','OPT2']);assert.deepEqual(r.associations.map(a=>a.status),['IN_SCOPE','IN_SCOPE','UNRESOLVED_SCOPE','UNRESOLVED_SCOPE']);
});
test('multiple productions are documentary candidates, units still need explicit binding',()=>{
 const r=classifyOptLineScope({snapshot:snapshot([production(),production('p2')]),entries:[row(),row('R1',{key_produccion:'p2'}),row('R1',{key_produccion:'wrong'})]});
 assert.deepEqual(r.associations.map(a=>a.status),['IN_SCOPE','IN_SCOPE','AMBIGUOUS']);assert.equal(r.associations[0].candidates.length,2);assert.equal(r.associations[0].unitBindingRequired,true);
});
test('Retail and Proyecto do not join by name; equal hash deduplicates bytes and keeps sources',()=>{
 const entries=[row(),row('R9',{sourceKey:'project-index',origin:'PROYECTO'})];
 let r=classifyOptLineScope({snapshot:snapshot(),entries,documents:[file()]});assert.equal(r.documents.length,2);assert.equal(r.documents[0].status,'IN_SCOPE');assert.equal(r.documents[1].pdfStatus,'MISSING');
 r=classifyOptLineScope({snapshot:snapshot(),entries,documents:[file(),file({sourceKey:'project-index',origin:'PROYECTO'})]});assert.equal(r.documents.length,1);assert.equal(r.documents[0].sources.length,2);assert.equal(r.documents[0].status,'MIXED');
});
test('same source consecutive different hash requires version review',()=>{
 const r=classifyOptLineScope({snapshot:snapshot(),entries:[row()],documents:[file(),file({sha256:'b'.repeat(64)})]});assert.deepEqual(r.documents.map(d=>d.status),['AMBIGUOUS','AMBIGUOUS']);
});
test('individual without index retained; missing source identity cannot join; failures not outside',()=>{
 const r=classifyOptLineScope({snapshot:snapshot(),entries:[row('R1',{sourceKey:null})],documents:[file({sourceKey:null}),{name:'individual.pdf',sha256:'b'.repeat(64)}]});
 assert.equal(r.documents.length,3);assert.equal(r.documents[0].status,'UNASSOCIATED');assert.equal(r.documents[1].status,'UNASSOCIATED');
 const failed=classifyOptLineScope({entries:[row()],documents:[file()]});assert.equal(failed.associations[0].status,'UNAVAILABLE');assert.equal(failed.documents[0].status,'UNAVAILABLE');
});
test('reject mismatched period, duplicate production identities and unsupported context',()=>{
 assert.throws(()=>snapshot([{...production(),anio:2025}]),/CONTRATO/);assert.throws(()=>snapshot([production(),production()]),/CONTRATO/);assert.throws(()=>normalizeOptScopeContext({...context,modo:'ACTUAL'}),/AMBITO/);
});

test('approved original week does not authorize units or invent missing documentary bindings',()=>{
 const s=snapshot();assert.equal(s.coverage.operationalComplete,true);assert.equal(s.coverage.weekCriterion,'ORIGINAL_WEEK');assert.equal(s.coverage.reason,'ORIGINAL_WEEK_CONFIRMED');
 const r=classifyOptLineScope({snapshot:s,entries:[row('R9'),row('',{system:''})],documents:[file()]});
 assert.equal(r.associations[0].status,'UNRESOLVED_SCOPE');assert.ok(r.associations.every(a=>a.status!=='OUT_OF_SCOPE'));assert.equal(r.canRegister,false);
});
test('explicit PDF hash cannot attach a row to another version by matching source name',()=>{
 const r=classifyOptLineScope({snapshot:snapshot(),entries:[row('R1',{sha256:'a'.repeat(64)})],documents:[file(),file({sha256:'b'.repeat(64)})]});
 assert.equal(r.documents.find(d=>d.sha256==='a'.repeat(64)).associations.length,1);
 assert.equal(r.documents.find(d=>d.sha256==='b'.repeat(64)).associations.length,0);
});

test('reservation keeps original week despite execution dates, current week and carry labels',()=>{
 const original={...context,semana:45};
 const p={...production(),semana_base:45,semana_actual:46,fecha_programada:'2026-11-10'};
 const s=buildOptProgrammingSnapshot({context:original,productions:[p],shared:[]});
 const entries=[row(),row('R1',{carry:true}),row('R1',{mode:'CARRY'})];
 const current=classifyOptLineScope({snapshot:s,entries,documents:[file()]});
 assert.deepEqual(current.associations.map(a=>a.status),['IN_SCOPE','IN_SCOPE','IN_SCOPE']);
 assert.equal(current.groups.length,1);assert.equal(current.documents.length,1);
 assert.deepEqual(current.groups[0].opts,['OPT1']);assert.equal(current.groups[0].candidates.length,1);
 assert.equal(current.scope.semana,45);assert.equal(current.groups[0].canRegister,false);
 const next=classifyOptLineScope({snapshot:buildOptProgrammingSnapshot({context,productions:[],shared:[{...p,reservas:[{reserva:'R1'}]}]}),entries,documents:[file()]});
 assert.equal(next.groups.length,0);assert.equal(next.documents.length,1);
 assert.ok(next.associations.every(a=>a.status==='UNRESOLVED_SCOPE'));
 // A server payload cannot silently promote current execution week to origin.
 assert.throws(()=>buildOptProgrammingSnapshot({context,productions:[p],shared:[]}),/CONTRATO/);
});
test('original year remains independent from later calendar execution year',()=>{
 const original={...context,anio:2026,semana:53};
 const s=buildOptProgrammingSnapshot({context:original,productions:[{...production(),semana_base:53,semana_actual:1,fecha_programada:'2027-01-05'}],shared:[]});
 const r=classifyOptLineScope({snapshot:s,entries:[row()],documents:[file()]});
 assert.equal(r.groups.length,1);assert.deepEqual(r.scope,original);
 const nextYear=buildOptProgrammingSnapshot({context:{...context,anio:2027,semana:1},productions:[],shared:[{key_produccion:'old-year',reservas:[{reserva:'R1'}]}]});
 assert.equal(classifyOptLineScope({snapshot:nextYear,entries:[row()]}).groups.length,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGlassLocationAnalysis as build,locationQuantities} from '../src/domain/glass-location-analysis.js';
const row=(key,rack,qty,extra={})=>({key_produccion:key,produccion:key,reserva:'R1',parte:'1',posicion:rack,unidades:qty,preparadas:qty,...extra});
const weeks=new Map([['A','2026-46'],['B','2026-45'],['C','2026-46']]);
test('weekly scope retains global shared-rack content from other and unknown weeks',()=>{
 const v=build({rows:[row('A','X',6),row('A','Y',4),row('B','X',2),row('Z','Y',3)],weekByProduction:weeks,week:'2026-46'});
 assert.equal(v.summary.productionCount,1);assert.equal(v.summary.dispersedRatio,1);assert.equal(v.summary.mixedRackRatio,1);
 assert.equal(v.productions[0].concentration,.6);assert.equal(v.racks.find(r=>r.id==='X').otherWeekQty,2);assert.equal(v.racks.find(r=>r.id==='Y').unknownWeekQty,3);assert.equal(v.summary.qty,10);
});
test('state and query filter do not conceal mixing or misclassify same-week contents',()=>{
 const v=build({rows:[row('A','X',10,{preparadas:4,novedad:6}),row('C','X',3)],weekByProduction:weeks,week:'2026-46',state:'prepared',query:'A'});
 assert.equal(v.summary.qty,4);assert.equal(v.racks[0].shared,true);assert.equal(v.racks[0].otherSelectedWeekQty,9);assert.equal(v.racks[0].otherWeekQty,0);assert.equal(v.racks[0].totalQty,13);
});
test('missing production identity is not merged by name or declared exclusive',()=>{
 const v=build({rows:[row('A','X',2),row(null,'X',3,{produccion:'A'})],weekByProduction:weeks,week:'2026-46'});
 assert.equal(v.summary.productionCount,1);assert.equal(v.racks[0].productionCount,1);assert.equal(v.racks[0].exclusive,false);assert.equal(v.racks[0].unknownIdentity,true);assert.equal(v.racks[0].contents.length,2);
});
test('part identity is reserve scoped and metadata overrides source part',()=>{
 const v=build({rows:[row('A','X',2),row('C','X',3,{reserva:'R2'})],weekByProduction:weeks,metadata:new Map([['A',{prioridad:'2'}]])});
 assert.equal(v.racks[0].partCount,2);assert.equal(v.racks[0].reservationCount,2);assert.equal(v.productions.find(p=>p.key==='A').part,'2');assert.equal(v.groups.length,2);
});
test('repeated production rows aggregate quantities without inflating rack or window count',()=>{
 const v=build({rows:[row('A','X',2,{ventanas:5}),row('A','X',3,{ventanas:5})]});
 assert.equal(v.productions[0].qty,5);assert.equal(v.productions[0].rackCount,1);assert.equal(v.groups[0].windows,5);assert.equal(v.summary.dispersedRatio,0);
});
test('no location and zero quantities excluded; empty denominators are not zero performance',()=>{
 const v=build({rows:[row('A','SIN UBICACIÓN',2),row('C','X',0)],weekByProduction:weeks});
 assert.equal(v.summary.productionCount,0);assert.equal(v.summary.dispersedRatio,null);assert.equal(v.summary.unlocatedProductionCount,1);
});
test('query matching one rack retains full production distribution',()=>{
 const v=build({rows:[row('A','X',2),row('A','Y',3)],query:'X'});assert.equal(v.productions[0].rackCount,2);assert.equal(v.productions[0].qty,5);
});
test('others honor explicit values and residual fallback; invalid numbers are safe',()=>{
 assert.equal(locationQuantities({unidades:10,preparadas:4,novedad:2}).others,4);
 assert.equal(locationQuantities({unidades:10,preparadas:4,otros:1}).others,1);
 assert.equal(locationQuantities({unidades:-2,preparadas:'bad'}).all,0);
});

test('placeholder reserve and part labels are unknown, not invented grouping identities',()=>{
 const v=build({rows:[row('A','X',2,{reserva:'SIN RESERVA',parte:'SIN PARTE'})]});
 assert.equal(v.racks[0].reservationCount,0);assert.equal(v.racks[0].partCount,0);assert.equal(v.racks[0].unknownReservation,true);assert.equal(v.groups[0].reservation,null);
});

test('independent burro totals reveal unjoined production content without inventing identities',()=>{
 const v=build({rows:[row('A','X',3)],weekByProduction:weeks,week:'2026-46',rackTotals:[{posicion:'X',unidades:5}]});
 const r=v.racks[0];assert.equal(r.totalQty,5);assert.equal(r.selectedQty,3);assert.equal(r.unknownWeekQty,2);assert.equal(r.unknownIdentity,true);assert.equal(r.exclusive,false);assert.equal(r.productionCount,1);
 const extra=r.contents.find(c=>c.unmatchedSource);assert.equal(extra.key,null);assert.deepEqual(extra.reservations,[]);assert.equal(extra.part,null);assert.equal(extra.qty,2);
});
test('smaller independent total flags discrepancy without rewriting detail quantities',()=>{
 const v=build({rows:[row('A','X',6)],rackTotals:[{posicion:'X',unidades:4}]});
 assert.equal(v.racks[0].totalQty,6);assert.equal(v.racks[0].sourceQty,4);assert.ok(v.racks[0].completenessWarning);assert.equal(v.racks[0].exclusive,false);assert.equal(v.summary.discrepantRackCount,1);
});
test('missing contrast never declares exclusive; matching independent total can',()=>{
 const v=build({rows:[row('A','X',3)]});assert.equal(v.racks[0].completenessUnknown,true);assert.equal(v.racks[0].exclusive,false);assert.equal(v.productions[0].unverifiedRackCount,1);assert.match(v.productions[0].distribution,/no contrastado/);
 const matched=build({rows:[row('A','X',3)],rackTotals:[{posicion:'X',unidades:1},{posicion:'X',unidades:2}]});assert.equal(matched.racks[0].exclusive,true);assert.equal(matched.racks[0].completenessUnknown,false);
});

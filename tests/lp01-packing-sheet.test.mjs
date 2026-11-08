import test from 'node:test';import assert from 'node:assert/strict';
import {assemblySheetRows,filterAssemblySheetRows,assemblyValueKey} from '../src/domain/lp01-assembly-sheet.js';
import {assemblySheetMarkup} from '../src/modules/lp01-assembly-sheet.js';
import {assemblyCloseSummary} from '../src/modules/lp01-assembly-close.js';
const c={stage:'EMPAQUE',line:'PANELES_2',date:'2026-11-08',shift:1};
const p=(name,balance,assignments=[])=>({key:name+'|PANELES_2',oficial:{key_produccion:name+'|PANELES_2',id_linea:'PANELES_2',produccion:name,cantidad:20,saldo_ensamble:0,saldo_empaque:balance,saldos_inicializados:true,presente_ultimo_export:true,activa:'SI',anio:2026,semana_base:45,reserva_al:'R',prioridad_reserva:'1.2'},assignments});
const d=productions=>({contract:'LP-OPERACION-1',turn:{estado:'NO_ABIERTO',revision:0},orders:[],reports:[],catalog:{contract:'LP-HOJA-1',...c,productions}});
const plan={id:'root',key_produccion:'FULL|PANELES_2',cantidad:20,fecha:c.date,turno:1,prioridad:1,estado:'PROGRAMADA',source:'PROGRAMACION_LINEA'};
test('packing uses its own Export balance, includes open/rest/completed without manual progress',()=>{
 const rows=assemblySheetRows(d([p('OPEN',5),p('FULL',20),p('DONE',0)]),c,{includeCompleted:true});
 assert.deepEqual(rows.map(r=>[r.produccion,r.state,r.balance]),[['OPEN','ABIERTAS',5],['FULL','OTRAS',20],['DONE','COMPLETADAS',0]]);assert(rows.every(r=>r.etapa==='EMPAQUE'&&r.realized===null));
});
test('unscoped assembly planner never becomes packing program, quantities or origin',()=>{
 const [r]=assemblySheetRows(d([p('FULL',20,[plan])]),c);assert.equal(r.state,'OTRAS');assert.equal(r.scheduled,false);assert.equal(r.scheduleUnavailable,true);assert.deepEqual(r.currentAssignments,[]);assert.deepEqual(r.assignments,[]);assert.equal(r.originDate,null);
 const open=p('OPEN',5,[{...plan,key_produccion:'OPEN|PANELES_2'}]);const summary=assemblyCloseSummary(d([open]),c);assert.equal(summary.systems[0].planned,null);
});
test('explicit packing stage source supports programmed group, never an unlabeled source',()=>{
 const payload=d([p('FULL',20,[{...plan,source:'PROGRAMACION_EMPAQUE',stage:'EMPAQUE'}])]);payload.catalog.assignmentStage='EMPAQUE';const [r]=assemblySheetRows(payload,c);assert.equal(r.state,'PROGRAMADAS');assert.equal(r.scheduleUnavailable,false);
 payload.catalog.productions[0].assignments[0].stage='ENSAMBLE';assert.equal(assemblySheetRows(payload,c)[0].state,'OTRAS');
});
test('packing filters reservation/part/week with same controls and no glass callback',()=>{
 const rows=assemblySheetRows(d([p('OPEN',5),p('FULL',20)]),c);const filtered=filterAssemblySheetRows(rows,{columnFilters:{part:[assemblyValueKey('1.2')]},sort:'balance',direction:'desc'});assert.equal(filtered.length,2);assert.equal(filtered[0].state,'ABIERTAS');
 const markup=assemblySheetMarkup(rows,{stage:'EMPAQUE',onDetail:()=>{},onGlass:()=>{throw Error('must not expose');}});assert.match(markup,/órdenes de Empaque/);assert.doesNotMatch(markup,/data-assembly-glass|Ver vidrio/);assert.match(markup,/data-column-menu="reservation"/);assert.match(markup,/data-note-order-key/);
});
test('packing rejects cross-stage catalog and operational rows instead of showing assembly',()=>{
 const payload=d([p('OPEN',5)]);payload.catalog.stage='ENSAMBLE';assert.throws(()=>assemblySheetRows(payload,c),/Catálogo/);
 const data=d([p('OPEN',5)]);data.orders=[{key:'OPEN|PANELES_2',parte:'x',oficial:p('OPEN',5).oficial,linea:c.line,etapa:'ENSAMBLE',fecha:c.date,turno:1}];assert.throws(()=>assemblySheetRows(data,c),/ámbito/);
});

test('persisted packing operations legitimately show as programmed without borrowing root quantities',()=>{
 const payload=d([p('FULL',20,[plan])]);payload.orders=[{key:'FULL|PANELES_2',parte:'root',oficial:p('FULL',20).oficial,linea:c.line,etapa:'EMPAQUE',fecha:c.date,turno:1,prioridad:3,programada:999,ejecutado:50}];
 const [r]=assemblySheetRows(payload,c);assert.equal(r.state,'PROGRAMADAS');assert.equal(r.scheduled,true);assert.equal(r.currentAssignments.length,0);assert.equal(r.realized,null);assert.equal(r.operationTargets.length,1);assert.equal(assemblyCloseSummary(payload,c).systems[0].planned,null);
});

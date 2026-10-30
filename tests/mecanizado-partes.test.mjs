import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeParts,validateParts,coverageAmount} from '../src/domain/mecanizado-partes.js';
import {normalizeCarry,operationalLoad,workloadTotals} from '../src/domain/mecanizado-operational-load.js';
import {reportQuantityGroups,summarizeDeliveryEvents} from '../src/domain/picking-delivery-report.js';
test('288 = 90 + 90 + 90 + 18; configured capacity can differ',()=>{
 assert.deepEqual(proposeParts(288,90),[90,90,90,18]);
 assert.deepEqual(proposeParts(81,40),[40,40,1]);
});
test('reject invalid capacity, quantity, date, shift and an overcommitted proposal',()=>{
 for(const qty of [0,-1,1.5,NaN,null,''])assert.throws(()=>proposeParts(qty,90));
 for(const cap of [0,-1,2.5,null,''])assert.throws(()=>proposeParts(288,cap));
 const p={cantidad:90,fecha:'2026-10-30',turno:'TURNO 1',prioridad:1};
 assert.equal(validateParts([p],198)[0].cantidad,90);
 for(const row of [{...p,cantidad:199},{...p,fecha:'2026-02-30'},{...p,turno:''},{...p,prioridad:0}])assert.throws(()=>validateParts([row],198));
 assert.throws(()=>validateParts([p,p,p],198));
});
test('partial coverage is quantitative and legacy coverage retains its meaning',()=>{
 assert.equal(coverageAmount({cantidad:288,cantidad_programada:90,estado_orden:'PARCIAL'}),90);
 assert.equal(coverageAmount({cantidad:288,estado_orden:'PROGRAMADA'}),288);
 assert.equal(coverageAmount({cantidad:288,estado_orden:'REVISAR'}),0);
});
test('same production P2/P3 are independent carries; duplicate P2 is counted once',()=>{
 const p={reserva:'R',key_produccion:'8642595|PANELES_2',produccion:'8642595',sistema:'S',cantidad:90,estado:'SIN INICIAR'};
 const rows=normalizeCarry([{...p,parte_id:'p2',id_programacion_origen:'p2'},{...p,parte_id:'p3',id_programacion_origen:'p3'},{...p,parte_id:'p2',id_programacion_origen:'p2'}],'2026-10-30','TURNO 1');
 const model=operationalLoad([],rows,[],['2026-10-30']);
 assert.equal(model.rows.length,2);assert.equal(workloadTotals(model.rows).arrastre,180);
});
test('reports sum explicit windows; two parts remain one production',()=>{
 const a={id_programacion:'p1',parte_id:'p1',key_produccion_parte:'8642595|PANELES_2',produccion:'8642595',sistema:'S',cantidad_produccion:90};
 const rows=[{...a,id_entrega:'e1',cantidad_ventanas_entregadas:40},{...a,id_entrega:'e2',cantidad_ventanas_entregadas:50},{...a,id_programacion:'p2',parte_id:'p2',id_entrega:'e3',cantidad_ventanas_entregadas:18}];
 assert.deepEqual(reportQuantityGroups(rows).get('S'),{known:180,actual:108,unknown:0});
 assert.equal(summarizeDeliveryEvents(rows).produccionesUnicas,1);
});

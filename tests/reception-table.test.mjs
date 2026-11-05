import test from 'node:test';
import assert from 'node:assert/strict';
import {filterReceptionRows,receptionColumnValue,receptionOptions,receptionValueKey,newReceptionTableState,receptionAluminumSummary} from '../src/domain/reception-table.js';
import {indexReceptionAluminumStates} from '../src/domain/reception-aluminum-state.js';

const rows=[{reserva:'R10',cantidad:10,sistema:'B',estado:'RECIBIDA',legalizada:true},{reserva:'R2',cantidad:2,sistema:'A'},{reserva:'R0',cantidad:0,sistema:'A'},{reserva:'RN',cantidad:null,sistema:null}];
test('Recepción: ordenar texto, número, cero y nulo sin mutar fuente',()=>{
 const state=newReceptionTableState(),copy=structuredClone(rows);state.sort='quantity';
 assert.deepEqual(filterReceptionRows(rows,state).map(r=>r.cantidad),[0,2,10,null]);
 state.direction='desc';assert.deepEqual(filterReceptionRows(rows,state).map(r=>r.cantidad),[10,2,0,null]);
 state.sort='reservation';state.direction='asc';assert.deepEqual(filterReceptionRows(rows,state).map(r=>r.reserva),['R0','R2','R10','RN']);
 assert.deepEqual(rows,copy);assert.equal(receptionColumnValue({cantidad:''},'quantity'),null);assert.equal(receptionColumnValue({cantidad:'0'},'quantity'),0);
});
test('Recepción: filtros combinados, selección vacía y reset',()=>{
 const state=newReceptionTableState();state.filters.system=[receptionValueKey('A')];state.filters.quantity=[receptionValueKey(0)];
 assert.deepEqual(filterReceptionRows(rows,state).map(r=>r.reserva),['R0']);
 state.filters.quantity=[];assert.equal(filterReceptionRows(rows,state).length,0);
 assert.deepEqual(filterReceptionRows(rows,newReceptionTableState()),rows);
 assert.deepEqual(receptionOptions(rows,'quantity'),[['0',0],['2',2],['10',10],['null',null]]);
});
test('Recepción: valores de filtros coinciden con badges y días visibles',()=>{
 const index=indexReceptionAluminumStates([{reserva:'R2',estado_reserva:'PENDIENTE_BODEGA'}]);
 assert.equal(receptionColumnValue(rows[1],'aluminum',index),'PEND. BODEGA');
 assert.equal(receptionColumnValue(rows[0],'legal'),'LEGALIZADA');
 assert.equal(receptionColumnValue(rows[1],'legal'),'RECIBIDA SIN LEGALIZAR');
 assert.equal(receptionColumnValue({dias_pendiente:2.56},'days'),2.6);
 assert.equal(receptionColumnValue({tipo_reserva:'MIXTO'},'type'),'MIXTO');
});
test('Recepción: tarjetas deduplican cantidades por reserva, sin inferir reparto',()=>{
 const index=new Map([['R10','PENDIENTE_BODEGA'],['R2','PENDIENTE_BODEGA'],['R0','ALUMINIO_ENTREGADO']]);
 const summary=receptionAluminumSummary([...rows,rows[0],{...rows[0],reserva:' R10 ',cantidad:'10'}],index);
 assert.deepEqual(summary.cards.PENDIENTE_BODEGA,{reservations:2,windows:12,unknownQuantities:0});
 assert.deepEqual(summary.cards.ALUMINIO_ENTREGADO,{reservations:1,windows:0,unknownQuantities:0});
 assert.equal(summary.unclassified,1);assert.equal(summary.reservations,4);
});
test('Recepción: estados desconocidos y mixtos nunca cuentan como entregados',()=>{
 const index=indexReceptionAluminumStates([{reserva:'R10',estado_reserva:'ALUMINIO_ENTREGADO'},{reserva:'R10',estado_reserva:'PENDIENTE_BODEGA'},{reserva:'R2',estado_reserva:'NUEVO_ESTADO'}]);
 const summary=receptionAluminumSummary(rows,index);assert.equal(summary.unclassified,4);assert.equal(summary.cards.ALUMINIO_ENTREGADO.reservations,0);
});
test('Recepción: cantidad ausente, negativa o contradictoria no produce un total parcial',()=>{
 for(const quantity of [null,-1,11,'',NaN]){
  const summary=receptionAluminumSummary([rows[0],{...rows[0],cantidad:quantity}],new Map([['R10','PENDIENTE_BODEGA']]));
  assert.equal(summary.cards.PENDIENTE_BODEGA.reservations,1);assert.equal(summary.cards.PENDIENTE_BODEGA.windows,null);assert.equal(summary.cards.PENDIENTE_BODEGA.unknownQuantities,1);
 }
 assert.equal(receptionAluminumSummary([{reserva:'',cantidad:10}],new Map()).unidentified,1);
});

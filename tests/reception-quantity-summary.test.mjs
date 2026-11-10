import test from 'node:test';
import assert from 'node:assert/strict';
import {receptionAluminumSummary,receptionQuantitySummary} from '../src/domain/reception-table.js';

const warehouse='PENDIENTE_BODEGA',supply='PENDIENTE_ABASTECIMIENTO',delivered='ALUMINIO_ENTREGADO';
const rows=[
 {reserva:'RECEIVED-W1',cantidad:100,estado:'RECIBIDA',legalizada:false,completa:false},
 {reserva:'RECEIVED-W2',cantidad:200,estado:'RECIBIDA',legalizada:false,completa:false},
 {reserva:'PENDING-W',cantidad:30,estado:'PENDIENTE_POR_RECIBIR'},
 {reserva:'PENDING-S',cantidad:400,estado:'PENDIENTE_POR_RECIBIR'},
 {reserva:'RECEIVED-D',cantidad:500,estado:'RECIBIDA',legalizada:false}
];
const states=new Map([['RECEIVED-W1',warehouse],['RECEIVED-W2',warehouse],['PENDING-W',warehouse],['PENDING-S',supply],['RECEIVED-D',delivered]]);
test('Recepción: separa total semanal, recibidas SGP y pendientes, sin descontar dos veces la legalización',()=>{
 const before=structuredClone(rows),summary=receptionQuantitySummary(rows,states);
 assert.equal(summary.total.windows,1230);assert.equal(summary.received.windows,800);assert.equal(summary.pending.windows,430);
 assert.equal(summary.warehouse.windows,30);assert.equal(summary.supply.windows,400);
 assert.equal(summary.total.windows,summary.received.windows+summary.pending.windows);
 const tracking=receptionAluminumSummary(rows,states);
 assert.equal(tracking.cards[warehouse].windows,330);assert.equal(tracking.cards[supply].windows,400);
 assert.deepEqual(rows,before);
});
test('Recepción: deduplica reserva y mantiene cero sin inventar cantidad',()=>{
 const summary=receptionQuantitySummary([...rows,rows[0],{...rows[0],reserva:' RECEIVED-W1 ',cantidad:'100'},{reserva:'ZERO',cantidad:0,estado:'PENDIENTE'}],new Map([...states,['ZERO',warehouse]]));
 assert.equal(summary.total.windows,1230);assert.equal(summary.received.windows,800);assert.equal(summary.pending.windows,430);
 assert.equal(summary.total.reservations,6);assert.equal(summary.pending.reservations,3);
 assert.equal(receptionQuantitySummary([],new Map()).total.windows,0);
});
test('Recepción: cantidades desconocidas invalidan solo los totales afectados',()=>{
 for(const cantidad of [null,undefined,'',NaN,-1]){
  const summary=receptionQuantitySummary([...rows,{reserva:'UNKNOWN',cantidad,estado:'PENDIENTE'}],new Map([...states,['UNKNOWN',warehouse]]));
  assert.equal(summary.total.windows,null);assert.equal(summary.pending.windows,null);assert.equal(summary.received.windows,800);
  assert.equal(summary.warehouse.windows,null);assert.equal(summary.total.unknownQuantities,1);
 }
 const conflict=receptionQuantitySummary([...rows,{...rows[0],cantidad:101}],states);
 assert.equal(conflict.total.windows,null);assert.equal(conflict.received.windows,null);assert.equal(conflict.pending.windows,430);
});
test('Recepción: una identidad con estados físicos contradictorios no se asigna a un grupo',()=>{
 const summary=receptionQuantitySummary([...rows,{...rows[0],estado:'PENDIENTE'}],states);
 assert.equal(summary.total.windows,1230);assert.equal(summary.received.windows,null);assert.equal(summary.pending.windows,null);assert.equal(summary.conflictingReception,1);
});
test('Recepción: Seguimiento ausente o mixto no borra recepción ni pendientes físicos',()=>{
 for(const state of [undefined,'CONFLICTO','SIN_DATO']){
  const index=new Map(states);if(state)index.set('PENDING-W',state);else index.delete('PENDING-W');
  const summary=receptionQuantitySummary(rows,index);
  assert.equal(summary.pending.windows,430);assert.equal(summary.unclassifiedPending,1);assert.equal(summary.warehouse.windows,0);assert.equal(summary.supply.windows,400);
 }
 const failed=receptionQuantitySummary(rows,new Map());assert.equal(failed.received.windows,800);assert.equal(failed.pending.windows,430);assert.equal(failed.unclassifiedPending,2);
});
test('Recepción: entregada en Seguimiento sin recepción se mantiene pendiente con advertencia',()=>{
 const summary=receptionQuantitySummary([{reserva:'INCONSISTENT',cantidad:5,estado:'PENDIENTE'}],new Map([['INCONSISTENT',delivered]]));
 assert.equal(summary.total.windows,5);assert.equal(summary.received.windows,0);assert.equal(summary.pending.windows,5);assert.equal(summary.deliveredWithoutReception,1);
});
test('Recepción: sin identidad no ofrece conciliación numérica falsa',()=>{
 const summary=receptionQuantitySummary([...rows,{reserva:' ',cantidad:4,estado:'RECIBIDA'}],states);
 assert.equal(summary.unidentified,1);assert.equal(summary.total.windows,null);assert.equal(summary.received.windows,null);assert.equal(summary.pending.windows,null);
});

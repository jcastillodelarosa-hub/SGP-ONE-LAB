import test from 'node:test';import assert from 'node:assert/strict';
import {uniqueOpenPickingOrders as unique,pickingDeliveryQueue} from '../src/domain/picking-open-orders.js';
const orders=Array.from({length:6},(_,i)=>({key_produccion:'K'+i,produccion:'O'+i,cantidad:i+1}));
const rows=()=>orders.map((o,i)=>({id_programacion:'P'+i,reserva:'R',parte:'2.1',produccion:o.produccion,semana:46,ordenes:orders.map(x=>({...x,entrega_estado:x===o?'VALIDADA':null}))}));
test('six order programs do not create 28 phantom missing orders',()=>{const src=rows(),snapshot=JSON.stringify(src),out=unique(src);assert.equal(out.length,6);assert.equal(out.filter(x=>!x.order.entrega_estado).length,0);assert.equal(JSON.stringify(src),snapshot);});
test('truly missing order stays actionable using its own program',()=>{const src=rows();src.forEach(r=>r.ordenes[2].entrega_estado=null);const out=unique(src);assert.equal(out.length,6);const missing=out.filter(x=>!x.order.entrega_estado);assert.equal(missing.length,1);assert.equal(missing[0].row.id_programacion,'P2');});
test('quantitative parts 90+90+108 stay separate',()=>{const src=[90,90,108].map((n,i)=>({id_programacion:'P'+i,parte_id:'P'+i,reserva:'R',parte:'3',ordenes:[{key_produccion:'K',produccion:'O',cantidad:n,entrega_estado:i===1?'VALIDADA':null}]}));const out=unique(src);assert.equal(out.length,3);assert.equal(out.filter(x=>!x.order.entrega_estado).reduce((n,x)=>n+x.order.cantidad,0),198);});
test('do not conflate reserve, part, quantity, order label or unknown identity',()=>{const src=rows().slice(0,1);const base=src[0];src.push({...base,reserva:'R2'},{...base,parte:'2.2'},{...base,ordenes:[{...base.ordenes[0],cantidad:100}]},{...base,ordenes:[{produccion:'O0'},{produccion:'O0'}]});assert.equal(unique(src).length,21);});
test('older weeks remain available: global open batches have no week filtering',()=>{const src=rows();src[0].semana=45;assert.equal(unique(src).length,6);});

test('delivery queue excludes registered orders, even before audit and across repeated programs',()=>{
 const src=rows();src.forEach(r=>r.ordenes.forEach(o=>{if(o.key_produccion==='K2')o.entrega_estado=null;}));
 src[0].ordenes[0].entrega_estado='PENDIENTE_VALIDACION';
 src[1].ordenes[1].entrega_estado='AUDITADA_DIFERENCIA';
 src[3].ordenes[3].entrega_estado='ENTREGADA';
 const before=JSON.stringify(src),q=pickingDeliveryQueue(src);
 assert.deepEqual(q.pending.map(r=>[r.id_programacion,...r.ordenes.map(o=>o.produccion)]),[['P2','O2']]);
 assert.deepEqual(q.material,[]);assert.equal(JSON.stringify(src),before);
});
test('quantitative parts distinguish missing windows, completed delivery and material-only replacement',()=>{
 const src=[{delivered:30,open:0},{delivered:90,open:0},{delivered:90,open:2},{delivered:0,open:0}].map(({delivered,open},i)=>({
  id_programacion:'P'+i,parte_id:'P'+i,reserva:'R',parte:'3',cantidad_ventanas:90,cantidad_entregada:delivered,pdt_abiertos:open,
  ordenes:[{key_produccion:'K',produccion:'O',cantidad:90,entrega_estado:delivered?'PENDIENTE_VALIDACION':null}]
 }));
 const q=pickingDeliveryQueue(src);
 assert.deepEqual(q.pending.map(r=>r.id_programacion),['P0','P3']);
 assert.deepEqual(q.material.map(r=>r.id_programacion),['P2']);
});

test('finalized orders without Picking movement are for reconciliation, not delivery',()=>{
 const make=(id,order={},row={})=>({id_programacion:id,semana:45,reserva:'R',parte:'3',
  ordenes:[{key_produccion:id,produccion:id,cantidad:4,...order}],...row});
 const rows=[
  make('fin',{finalizada_sin_saldo:true}),
  make('new',{finalizada_sin_saldo:false}),
  make('legacy'),
  make('already',{finalizada_sin_saldo:true,entrega_estado:'VALIDADA'}),
  make('p3',{finalizada_sin_saldo:true,cantidad:108},{parte_id:'p3',cantidad_ventanas:108,cantidad_entregada:0}),
  make('p1',{finalizada_sin_saldo:true,entrega_estado:'VALIDADA'},{parte_id:'p1',cantidad_ventanas:90,cantidad_entregada:90}),
  make('p2',{finalizada_sin_saldo:true,entrega_estado:'PENDIENTE_VALIDACION'},{parte_id:'p2',cantidad_ventanas:90,cantidad_entregada:90,pdt_abiertos:0}),
  make('partial',{entrega_estado:'PENDIENTE_VALIDACION'},{parte_id:'partial',cantidad_ventanas:280,cantidad_entregada:30}),
  make('replacement',{finalizada_sin_saldo:true,entrega_estado:'VALIDADA'},{parte_id:'replacement',cantidad_ventanas:90,cantidad_entregada:90,pdt_abiertos:1}),
 ];
 const before=JSON.stringify(rows);
 const out=pickingDeliveryQueue(rows);
 const ids=name=>out[name].map(row=>row.id_programacion);
 assert.deepEqual(ids('pending'),['new','legacy','partial']);
 assert.deepEqual(ids('reconciliation'),['fin','p3']);
 assert.deepEqual(ids('material'),['replacement']);
 assert.equal(JSON.stringify(rows),before);
});

test('finalized duplicates with a real delivery stay out of either queue',()=>{
 const order={key_produccion:'K',produccion:'K',cantidad:8,finalizada_sin_saldo:true};
 const rows=[
  {id_programacion:'a',reserva:'R',parte:'1',ordenes:[order]},
  {id_programacion:'b',reserva:'R',parte:'1',ordenes:[{...order,entrega_estado:'PENDIENTE_VALIDACION'}]},
 ];
 const queue=pickingDeliveryQueue(rows);
 assert.equal(queue.pending.length,0);
 assert.equal(queue.reconciliation.length,0);
});

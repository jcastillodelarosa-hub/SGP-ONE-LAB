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

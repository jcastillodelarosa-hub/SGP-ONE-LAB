import test from 'node:test';
import assert from 'node:assert/strict';
import {productionPdtVisible,productionPdtGroup,productionPdtStatus,productionPdtDeliveryStatus,productionPdtActions} from '../src/modules/pdt-production-actions.js';
import {loadProductionPdtDeliveries} from '../src/services/pdt-production-deliveries.js';
const row={id_pendiente:'p',estado:'PENDIENTE',estado_repo:'PROCESADO',contrato_pdt:'V2',validacion_estado:'VALIDADO',cantidad_validada:6,avance_neto:6,detalles:[{id_detalle:'d',cantidad_validada:6,avance_neto:6}],ncs:[]};
const caps={contract_version:2,picking_cuantitativo:true};
const payload=(delivered=2,processed=6)=>({ok:true,contract_version:1,modo:'DIRECTO',finalizado:delivered===6,detalles:[{id_detalle:'d',cantidad_validada:6,procesada:processed,entregada:delivered,saldo_entrega:6-delivered,disponible_entrega:processed-delivered}],entregas:[]});
test('processed PDT stays visible until authoritative resolution; legacy picking remains excluded',()=>{
 for(const contract of ['V2','LEGACY'])assert.equal(productionPdtVisible({...row,contrato_pdt:contract}),true);
 assert.equal(productionPdtVisible({...row,estado:'RESUELTO'}),false);
 assert.equal(productionPdtVisible({...row,estado_repo:'PICKING',contrato_pdt:'LEGACY'}),false);
 assert.equal(productionPdtVisible({...row,estado_repo:'PICKING'}),true);
});
test('group follows actual stage, not NC, amounts or inferred delivery',()=>{
 assert.equal(productionPdtGroup(row),'delivery');assert.equal(productionPdtGroup({...row,estado_repo:'PICKING'}),'delivery');
 for(const estado_repo of ['PENDIENTE','CORTE','MECANIZADO'])assert.equal(productionPdtGroup({...row,estado_repo,saldo_mecanizado:0,ncs:[{estado:'FINALIZADA'}]}),'processing');
 assert.equal(productionPdtGroup({...row,avance_neto:0,saldo_mecanizado:6}),'delivery');
});
test('delivery partial uses the server ledger without changing totals, row or states',async()=>{
 const original=structuredClone(row),calls=[];const summaries=await loadProductionPdtDeliveries({rpc:async(name,args)=>(calls.push([name,args]),{data:payload()})},'T',[row],caps);
 assert.deepEqual(summaries.get('p'),{status:'verified',delivered:2,total:6,pending:4,available:4,finished:false});assert.deepEqual(row,original);
 assert.deepEqual(calls,[['sgp_pdt_picking_simple_estado_v1',{p_token:'T',p_id:'p'}]]);
 const html=productionPdtDeliveryStatus(summaries.get('p'),String);assert.match(html,/ENTREGA PARCIAL/);assert.match(html,/2 entregadas · 4 por entregar/);
});
test('partial machining and partial delivery remain separate quantities',async()=>{
 const partial={...row,estado_repo:'MECANIZADO',avance_neto:3,detalles:[{...row.detalles[0],avance_neto:3}]};
 const summary=(await loadProductionPdtDeliveries({rpc:async()=>({data:payload(1,3)})},'T',[partial],caps)).get('p');
 assert.equal(productionPdtGroup(partial),'processing');assert.match(productionPdtStatus(partial,'VALIDADO',String),/3 de 6 procesadas/);
 assert.match(productionPdtDeliveryStatus(summary,String),/1 entregadas · 5 por entregar · 2 procesadas disponibles/);
});
test('failed, mismatched, unknown and previous coverage never become zero or remove PDT',async()=>{
 for(const data of [{ok:false},{...payload(),detalles:[]},{...payload(),detalles:[{...payload().detalles[0],procesada:5}]}]){
  const summary=(await loadProductionPdtDeliveries({rpc:async()=>({data})},'T',[row],caps)).get('p');assert.equal(summary.status,'unavailable');assert.doesNotMatch(productionPdtDeliveryStatus(summary,String),/0 entregadas/);assert.equal(productionPdtVisible(row),true);
 }
 const failed=(await loadProductionPdtDeliveries({rpc:async()=>({error:new Error('offline')})},'T',[row],caps)).get('p');assert.equal(failed.status,'unavailable');
 const previous=(await loadProductionPdtDeliveries({rpc:async()=>({data:{ok:true,contract_version:1,modo:'ANTERIOR_PENDIENTE',finalizado:false,detalles:[],entregas:[]}})},'T',[row],caps)).get('p');
 assert.equal(previous.status,'legacy');assert.match(productionPdtDeliveryStatus(previous,String),/por conciliar/);assert.doesNotMatch(productionPdtDeliveryStatus(previous,String),/\d entregadas/);
});
test('legacy, unvalidated, absent details and capabilities do not query quantitative delivery',async()=>{
 let calls=0;const client={rpc:async()=>{calls++;throw new Error('must not query');}};
 for(const changes of [{contrato_pdt:'LEGACY'},{validacion_estado:'POR_VALIDAR'},{detalles:[]},{detalles:null}])assert.equal((await loadProductionPdtDeliveries(client,'T',[{...row,...changes}],caps)).get('p').status,'unknown');
 assert.equal((await loadProductionPdtDeliveries(client,'T',[row],null)).get('p').status,'unknown');assert.equal(calls,0);
});
test('bounded concurrent reads remain independent when one fails',async()=>{
 let active=0,max=0;const rows=Array.from({length:10},(_,i)=>({...row,id_pendiente:String(i)}));
 const result=await loadProductionPdtDeliveries({rpc:async(_,args)=>{active++;max=Math.max(active,max);await new Promise(r=>setTimeout(r,3));active--;if(args.p_id==='3')throw new Error('one unavailable');return {data:payload()};}},'T',rows,caps);
 assert.ok(max<=4);assert.equal(result.size,10);assert.equal(result.get('3').status,'unavailable');assert.equal(result.get('9').delivered,2);
});
test('delivered quantitative result is identified but does not optimistically close parent',async()=>{
 const summary=(await loadProductionPdtDeliveries({rpc:async()=>({data:payload(6)})},'T',[row],caps)).get('p');
 assert.match(productionPdtDeliveryStatus(summary,String),/ENTREGADO/);assert.equal(productionPdtVisible(row),true);
 assert.match(productionPdtDeliveryStatus({...summary,finished:false},String),/por finalizar/);
});
test('new presentation does not grant machining actions to consultation or picking',()=>{
 for(const role of ['CONSULTA','PICKING','PATINADOR'])assert.ok(!productionPdtActions(row,role,caps).some(([key])=>key==='advances'));
 assert.equal(productionPdtActions({...row,estado:'RESUELTO'},'COORDINADOR',caps).length,0);
});
test('unknown machining quantities are never displayed as zero',()=>{
 for(const changes of [{avance_neto:null},{cantidad_validada:null},{avance_neto:undefined},{cantidad_validada:''},{contrato_pdt:'LEGACY'},{validacion_estado:'POR_VALIDAR'}])assert.doesNotMatch(productionPdtStatus({...row,...changes},'',String),/de .* procesadas/);
});

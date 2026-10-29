import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptPendingListV2, executePendingV2} from '../src/services/aluminum-pending-v2.js';
import {pendingClosureState, ncAvailability} from '../src/domain/aluminum-pending-balances.js';

const detail = {id_detalle:'d',cantidad_validada:8,avance_neto:2,saldo:6};
const payload = (detalles=[detail]) => ({ok:true,contract_version:2,pendientes:[
  {id_pendiente:'p',cantidad_reportada:9,detalles,ncs:[{referencia:'001',resolucion:'INACTIVA'}]}
]});

test('v2 preserves reported 9 separately from validated 8 and historical NC', () => {
  const input=payload(); const before=structuredClone(input);
  const [row]=adaptPendingListV2(input);
  assert.equal(row.cantidad,9); assert.equal(row.cantidad_validada,8);
  assert.equal(row.avance_neto,2); assert.equal(row.saldo_mecanizado,6);
  assert.equal(row.ncs[0].resolucion,'INACTIVA'); assert.deepEqual(input,before);
});
test('historical pending without details has unknown totals, not zero', () => {
  const [row]=adaptPendingListV2(payload([]));
  assert.equal(row.cantidad_validada,null); assert.equal(row.saldo_mecanizado,null);
});
test('invalid contract, negative balances, missing quantities and duplicate detail fail', () => {
  assert.throws(()=>adaptPendingListV2({ok:true,pendientes:[]}));
  for(const d of [{...detail,saldo:-1},{...detail,avance_neto:10},{...detail,cantidad_validada:null}]) {
    assert.throws(()=>adaptPendingListV2(payload([d])));
  }
  assert.throws(()=>adaptPendingListV2(payload([detail,detail])));
});
test('browser boolean or object never certifies Picking closure', () => {
  for(const evidence of [true,{validated:true,quantity:8},null]) {
    assert.equal(pendingClosureState({saldo:0},evidence).closed,false);
  }
});
test('missing backend capabilities causes zero write attempts', async () => {
  let calls=0;const client={rpc:async()=>{calls++;}};
  await assert.rejects(executePendingV2(client,null,'sgp_aluminio_pendiente_registrar_avance_v1',{}));
  assert.equal(calls,0);
});
test('new write error is propagated once; no alternative legacy write', async () => {
  const calls=[]; const operation='sgp_aluminio_pendiente_registrar_avance_v1';
  const error=new Error('RPC unavailable');
  const client={rpc:async(name,args)=>{calls.push({name,args});return {error};}};
  await assert.rejects(executePendingV2(client,{contract_version:2,operations:[operation]},operation,{p_cantidad:2}),/RPC unavailable/);
  assert.deepEqual(calls,[{name:operation,args:{p_cantidad:2}}]);
});
test('client adapter never exposes closure even when response claims enabled', () => {
  const data=payload();data.pendientes[0].cierre_habilitado=true;
  assert.equal(adaptPendingListV2(data)[0].cierre_habilitado,false);
});
test('inactive or unresolved historical NC never certifies a potential solution', () => {
  for (const resolucion of ['INACTIVA','NO_ENCONTRADA','AMBIGUA']) {
    assert.equal(ncAvailability([{estado:'FINALIZADA',resolucion}]).posibleSolucion,false);
  }
  assert.equal(ncAvailability([{estado:'FINALIZADA',activo:false}]).finalizadas,0);
});

import {discoverPendingV2,loadPendingRows,executeManualPdt} from '../src/services/aluminum-pending-v2.js';
import {validateFabricationDistribution} from '../src/domain/aluminum-pending-balances.js';
test('missing capabilities RPC preserves legacy read without a new write',async()=>{
  const calls=[];const row={id_pendiente:'legacy',cantidad:9};
  const client={rpc:async(name)=>{calls.push(name);return name==='sgp_pdt_capacidades_v2'?{error:{code:'PGRST202'}}:{data:[row]};}};
  const loaded=await loadPendingRows(client,'synthetic');
  assert.deepEqual(loaded,{rows:[row],capabilities:null});
  assert.deepEqual(calls,['sgp_pdt_capacidades_v2','sgp_aluminio_pendientes_listar']);
});
test('capabilities transport/auth error never silently degrades',async()=>{
  let calls=0;await assert.rejects(discoverPendingV2({rpc:async()=>{calls++;return {error:new Error('Unauthorized')};}},'synthetic'),/Unauthorized/);
  assert.equal(calls,1);
});
test('Reception reads dedicated v2 without requesting forbidden legacy list',async()=>{
  const calls=[];const client={rpc:async(name)=>{calls.push(name);return name.startsWith('sgp_pdt_manual_')?{error:{code:'PGRST202'}}:{data:name==='sgp_pdt_capacidades_v2'?{ok:true,contract_version:2,operations:[]}:payload()};}};
  const loaded=await loadPendingRows(client,'synthetic','RECEPCION');
  assert.equal(loaded.rows[0].cantidad,9);
  assert.deepEqual(calls,['sgp_pdt_capacidades_v2','sgp_aluminio_pendientes_listar_v2','sgp_pdt_manual_listar_v1','sgp_pdt_manual_ids_v1']);
});
test('v2 enriches metadata without reinterpreting original quantities',async()=>{
  const client={rpc:async(name)=>name.startsWith('sgp_pdt_manual_')?{error:{code:'PGRST202'}}:({data:name==='sgp_pdt_capacidades_v2'?{ok:true,contract_version:2,operations:[]}:
    name==='sgp_aluminio_pendientes_listar'?[{id_pendiente:'p',semana:44,acabado:'DS',cantidad:9}]:payload()})};
  const {rows}=await loadPendingRows(client,'synthetic','COORDINADOR');
  assert.equal(rows[0].semana,44);assert.equal(rows[0].cantidad,9);assert.equal(rows[0].cantidad_validada,8);
});
test('manual header enriches existing PDT row without consulting piece sources',async()=>{
 const calls=[];const client={rpc:async(name)=>{calls.push(name);return {data:name==='sgp_pdt_capacidades_v2'?{ok:true,contract_version:2,operations:[]}:
  name==='sgp_pdt_manual_listar_v1'?{ok:true,contract_version:'pdt-manual-3',pendientes:[{id_pendiente:'p',semana:44,anio:2026,marca_original:'A',observacion_general:'QA'}]}:
  name==='sgp_aluminio_pendientes_listar'?[]:payload()};}};
 const {rows}=await loadPendingRows(client,'synthetic','COORDINADOR');
 assert.equal(rows[0].manual_pdt,true);assert.equal(rows[0].semana,44);assert.equal(rows[0].marca_original,'A');
 assert.equal(calls.includes('sgp_aluminio_pendiente_piezas'),false);
});
test('manual operations never fall back to a legacy write',async()=>{
 const calls=[];const client={rpc:async name=>{calls.push(name);return {error:{code:'PGRST202',message:'RPC unavailable'}};}};
 await assert.rejects(executeManualPdt(client,'sgp_pdt_manual_cerrar_v1',{}),error=>error.code==='PGRST202'&&error.message==='RPC unavailable');
 assert.deepEqual(calls,['sgp_pdt_manual_cerrar_v1']);
 await assert.rejects(executeManualPdt(client,'sgp_pdt_cerrar_v2',{}),/no permitida/);
 assert.equal(calls.length,1);
});
test('source reference distinguishes source rows; duplicate same source rejected',()=>{
  const row={fabricacion:'E17',longitud:'109.9375',acabado:'DS',cantidad:4};
  assert.equal(validateFabricationDistribution([{...row,id_pieza:'load:P:1'},{...row,id_pieza:'load:P:2'}]).total,8);
  assert.throws(()=>validateFabricationDistribution([{...row,id_pieza:'load:P:1'},{...row,id_pieza:'load:P:1'}]));
});
test('unmigrated legacy unknown quantity is not invented or rejected by v2 reader',()=>{
  const input=payload([]);input.pendientes[0].contrato_pdt='LEGACY';input.pendientes[0].cantidad_reportada=null;
  const [row]=adaptPendingListV2(input);assert.equal(row.cantidad,null);assert.equal(row.cantidad_validada,null);
});
test('historical alias and canonical NC count once without dropping references',()=>{
  const ncs=[{consecutivo:'001',referencia:'1001',estado:'FINALIZADA'},{consecutivo:'001',referencia:'001',estado:'FINALIZADA'}];
  assert.equal(ncAvailability(ncs).total,1);assert.equal(ncAvailability(ncs).finalizadas,1);assert.equal(ncs.length,2);
});

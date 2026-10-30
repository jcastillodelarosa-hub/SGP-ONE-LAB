import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationPieces,sourceKey} from '../src/domain/pdt-registration.js';
import {saveRegistration} from '../src/services/pdt-registration.js';

const source={id_pieza:'p1',key_produccion:'k1',reserva:'r1',reserva_principal:'r1',tipo_pieza:'PANEL',id_linea:'PANELES_2',acabado:'AZUL',cantidad_referencia:4,produccion:'o1',codigo_sap:'ref',fabricacion:'f',longitud:10};
const entry=(s=source,ncs=[])=>({source:sourceKey(s),cantidad:1,nc:ncs[0]||'',ncs});

test('Picking 0, 1, 2 y 20 NC conserva un solo pendiente y cantidad',()=>{
 for(const count of [0,1,2,20]){
  const ncs=Array.from({length:count},(_,i)=>`NC-${i+1}`);
  const rows=registrationPieces('PICKING',[source],[entry(source,ncs)]);
  assert.equal(rows.length,1);assert.equal(rows[0].cantidad,1);
  assert.equal(rows[0].nc,ncs[0]||'');
  if(count>1)assert.deepEqual(rows[0].ncs,ncs);
  else assert.equal('ncs' in rows[0],false);
 }
});
test('Picking rechaza NC repetidas, inválidas y límite excedido',()=>{
 for(const ncs of [['NC-1',' NC-1 '],['NC-1','NC\n-2'],['NC-1','x'.repeat(121)],Array.from({length:21},(_,i)=>`NC-${i}`)])
  assert.throws(()=>registrationPieces('PICKING',[source],[entry(source,ncs)]));
 assert.throws(()=>registrationPieces('PICKING',[source],[{...entry(source),ncs:{bad:true}}]));
});
test('NC adicional con principal vacía pasa a principal sin duplicar cantidad',()=>{
 const [row]=registrationPieces('PICKING',[source],[{...entry(source),ncs:['','NC-2']}]);
 assert.equal(row.nc,'NC-2');assert.equal('ncs' in row,false);
});
test('dos piezas con reserva compartida permanecen independientes',()=>{
 const other={...source,id_pieza:'p2',reserva:'shared',reserva_principal:'r1'};
 const rows=registrationPieces('PICKING',[source,other],[entry(source,['NC-1','NC-2']),entry(other,['NC-3','NC-4'])]);
 assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.reserva),['r1','shared']);
 assert.deepEqual(rows.map(r=>r.cantidad),[1,1]);
});
test('entrega completa omite PDT; incompleta envía una llamada V4',async()=>{
 const calls=[];const client={rpc:async(name,args)=>{calls.push({name,args});return {data:{ok:true}};}};
 for(const completa of [true,false])await saveRegistration(client,'token',{origin:'PICKING',context:{completa},sources:[source],entries:[entry(source,['NC-1','NC-2'])],idempotencyKey:'same-event'});
 assert.deepEqual(calls.map(c=>c.name),['sgp_pdt_registrar_v4','sgp_pdt_registrar_v4']);
 assert.equal(calls[0].args.p_piezas.length,0);
 assert.equal(calls[1].args.p_piezas.length,1);
 assert.equal(calls[1].args.p_piezas[0].ncs.length,2);
});
test('Ensamble y Empaque conservan NC obligatoria y no envían arreglo adicional',()=>{
 for(const origin of ['ENSAMBLE','EMPAQUE']){
  assert.throws(()=>registrationPieces(origin,[source],[entry(source)]),/obligatoria/);
  const [row]=registrationPieces(origin,[source],[entry(source,['NC-1'])]);
  assert.equal(row.nc,'NC-1');assert.equal('ncs' in row,false);
  assert.throws(()=>registrationPieces(origin,[source],[entry(source,['NC-1','NC-2'])]),/una NC/);
 }
});

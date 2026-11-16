import test from 'node:test';
import assert from 'node:assert/strict';
import {scopedPdtRegistration} from '../src/services/lp01-pdt-registration.js';
const context={key:'ORDER|PANELES_2',line:'PANELES_2',stage:'ENSAMBLE',production:'Order'};
test('order PDT reuses registration with fixed production and stage, and no writes on open',async()=>{
 let options,calls=0;const closed=()=>{};
 await scopedPdtRegistration({context,getToken:()=> 'session',client:{rpc:async()=>{calls++;return {data:true};}},open:async o=>{options=o;}})({onClosed:closed});
 assert.equal(calls,0);assert.equal(options.origin,'ENSAMBLE');assert.deepEqual(options.context,{key_produccion:context.key,produccion:'Order'});assert.equal(options.onClosed,closed);
 const args={p_token:'session',p_origen:'ENSAMBLE',p_contexto:options.context};
 await options.client.rpc('sgp_pdt_registro_fuentes_v4',args);assert.equal(calls,1);
 for(const bad of [{p_token:'other'},{p_origen:'PICKING'},{p_contexto:{key_produccion:'OTHER'}}])await assert.rejects(options.client.rpc('sgp_pdt_registrar_v4',{...args,...bad}),/AMBITO/);
 await assert.rejects(options.client.rpc('legacy',args),/AMBITO/);assert.equal(calls,1);
});
test('revoked or changed session cannot send an order PDT',async()=>{
 let options,token='session',calls=0;
 const open=scopedPdtRegistration({context,getToken:()=>token,client:{rpc:async()=>{calls++;}},open:async o=>{options=o;}});
 await open();token='other';
 await assert.rejects(options.client.rpc('sgp_pdt_registrar_v4',{p_token:'session',p_origen:'ENSAMBLE',p_contexto:options.context}),/NO_AUTORIZADO/);assert.equal(calls,0);
 token=null;await assert.rejects(open(),/NO_AUTORIZADO/);
});
test('unsupported line or stage never opens a fallback writer',async()=>{
 for(const change of [{line:'FRAMES_2'},{stage:'PICKING'},{key:''}])await assert.rejects(scopedPdtRegistration({context:{...context,...change},getToken:()=> 'session',client:{},open:()=>assert.fail('must not open')})(),/no disponible/);
});
test('changed session while waiting on an RPC is not treated as confirmed',async()=>{
 let options,finish,token='session';
 await scopedPdtRegistration({context,getToken:()=>token,client:{rpc:()=>new Promise(resolve=>finish=resolve)},open:async o=>{options=o;}})();
 const waiting=options.client.rpc('sgp_pdt_registrar_v4',{p_token:'session',p_origen:'ENSAMBLE',p_contexto:options.context});token=null;finish({data:{ok:true}});await assert.rejects(waiting,/NO_AUTORIZADO/);
});

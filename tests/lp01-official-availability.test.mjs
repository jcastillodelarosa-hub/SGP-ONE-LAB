import test from 'node:test';
import assert from 'node:assert/strict';
import {officialAvailabilityTransport} from '../src/services/lp01-official-availability.js';
const context={stage:'ENSAMBLE',line:'PANELES_2',date:'2026-11-01',shift:1},key='QA|PANELES_2';
const view={revision:2,role:'COORDINADOR',activeContext:{...context,date:'2026-11-06',shift:2},catalog:[{key_produccion:key,id_linea:context.line,saldo_ensamble:30,saldos_inicializados:true,presente_ultimo_export:true}],availability:[{key,stage:context.stage,line:context.line,quantity:8,status:'READY'}],state:{definitions:[]}};
test('Seguimiento cell reads same official quantity and defines using server active period, not hidden UI default',async()=>{
 let request;const transport=officialAvailabilityTransport({key,context,getToken:()=> 'QA',read:async()=>view,submit:async r=>{request=r;return {ok:true};}});
 const state=await transport.read();assert.equal(state.quantity,8);assert.ok(state.capabilities.includes('DEFINE'));
 await transport.save({id:'same-id',quantity:7,revision:2,sourceFingerprint:state.source.fingerprint,observation:'QA'});
 assert.equal(request.command.id,'same-id');assert.equal(request.command.shift,2);assert.equal(request.command.date,'2026-11-06');
});
test('missing active configured period gives read-only projection; missing baseline is explicit',async()=>{
 const t=officialAvailabilityTransport({key,context,getToken:()=> 'QA',read:async()=>({...view,activeContext:null,availability:[{...view.availability[0],quantity:null,status:'PENDING_BASE'}]})});
 const s=await t.read();assert.equal(s.status,'PENDING_BASE');assert.deepEqual(s.capabilities,['READ']);assert.equal(s.quantity,null);
});

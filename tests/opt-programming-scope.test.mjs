import test from 'node:test';
import assert from 'node:assert/strict';
import {createOptProgrammingScope} from '../src/services/opt-programming-scope.js';
const scope={linea:'PANELES_2',anio:2026,semana:46,modo:'BASE'};
const answer=name=>({data:name==='sgp_consultar_programacion_semana'?{producciones:[{id_linea:'PANELES_2',key_produccion:'p1',sistema:'S1',reserva_principal:'R1'}]}:[],error:null});
test('only two read RPCs with exact args; snapshot never contains session token',async()=>{
 const calls=[];const service=createOptProgrammingScope({rpc:async(name,args)=>{calls.push({name,args});return answer(name);}},()=> 'secret-token');
 const s=await service.load(scope);assert.equal(service.isCurrent(s),true);assert.deepEqual(s.scope,scope);assert.equal(s.canRegister,false);assert.ok(!JSON.stringify(s).includes('secret-token'));
 assert.deepEqual(calls,[{name:'sgp_consultar_programacion_semana',args:{p_token:'secret-token',p_anio:2026,p_semana:46}},{name:'sgp_reservas_asociadas_listar',args:{p_token:'secret-token',p_semana:46,p_linea:'PANELES_2'}}]);
 service.invalidate();assert.equal(service.isCurrent(s),false);assert.equal(s.status,'STALE');
});
test('missing session no reads; shared failure and bad payload fail closed',async()=>{
 let calls=0;const client={rpc:async(name)=>{calls++;return answer(name);}};
 await assert.rejects(createOptProgrammingScope(client,()=>null).load(scope),/SESION/);assert.equal(calls,0);
 await assert.rejects(createOptProgrammingScope({rpc:async name=>name.includes('asociadas')?{error:{message:'denied'}}:answer(name)},()=> 't').load(scope),/NO_DISPONIBLE/);
 await assert.rejects(createOptProgrammingScope({rpc:async()=>({data:[]})},()=> 't').load(scope),/CONTRATO/);
});
test('session/filter changes while pending reject late responses',async()=>{
 for(const change of ['session','filter','invalidate']){
  let token='t',context=scope;const pending=[];const service=createOptProgrammingScope({rpc:name=>new Promise(resolve=>pending.push(()=>resolve(answer(name))))},()=>token,{getContext:()=>context});
  const work=service.load(scope);
  if(change==='session')token='new';if(change==='filter')context={...scope,semana:45};if(change==='invalidate')service.invalidate();
  pending.forEach(fn=>fn());await assert.rejects(work,/OBSOLETA/);
 }
});
test('newer request wins even if earlier completes last',async()=>{
 const pending=[];const service=createOptProgrammingScope({rpc:name=>new Promise(resolve=>pending.push(()=>resolve(answer(name))))},()=> 't');
 const old=service.load(scope),next=service.load({...scope,semana:45});pending[2]();pending[3]();const s=await next;pending[0]();pending[1]();await assert.rejects(old,/OBSOLETA/);assert.equal(service.isCurrent(s),true);
});

test('hung programming read times out; late data cannot become current',async()=>{
 let finish;const service=createOptProgrammingScope({rpc:name=>name.includes('asociadas')?Promise.resolve(answer(name)):new Promise(r=>finish=()=>r(answer(name)))},()=> 't',{timeoutMs:5});
 await assert.rejects(service.load(scope),/TIMEOUT/);finish();await new Promise(r=>setTimeout(r,1));assert.equal(service.isCurrent(null),false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createOptSharedCuts} from '../src/services/opt-shared-cuts.js';
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const scope = {linea:'PANELES_2',anio:2026,semana:46,modo:'BASE'};
const period = () => ({fecha:'2026-11-10',turno:2,inicio:'2026-11-10T18:00:00-05:00',fin:'2026-11-11T06:00:00-05:00',zona:'America/Bogota',horario_sha256:'b'.repeat(64)});
const command = () => ({scope:{...scope},reserva:'R',piezas:[id(1)],idempotencyKey:id(9)});
const state = () => ({contract_version:2,scope:{...scope},habilitado:true,reserva:'R',manifiesto_validado:true,puede_registrar:true,totales:{piezas:1,cortadas:0,pendientes:1},referencias:[{id_documento:id(2),sha256:'a'.repeat(64),fuentes:[{source_key:'source',origen:'RETAIL',consecutivo:'OPT-1',modo_carga:'INDICE'}],sistema:'S',referencia:'REF',piezas:[{id_pieza:id(1),registrable:true,pagina:1,patron:1,barra:1,corte:1,longitud_mm:123.45,estado:'PENDIENTE',usuario:null,registrado_en:null,id_registro:null,periodo:null}]}]});
const receipt = args => ({contract_version:2,scope:{...scope},reserva:args.p_reserva,ok:true,duplicado:false,cantidad_piezas:args.p_piezas.length,piezas:args.p_piezas,usuario:'server-actor',id_registro:args.p_idempotency_key,registrado_en:'2026-11-11T00:00:00Z',periodo:period()});
test('exact IDs, current token and caller-owned replay key; server actor only',async()=>{
 const calls=[];let token='alice';const api=createOptSharedCuts({rpc:async(name,args)=>{calls.push({name,args});return {data:name.includes('estado')?state():receipt(args)};}},()=>token);
 await api.estado('R',scope);token='bob';await api.registrar(command());await api.registrar(command());
 assert.equal(calls[0].args.p_token,'alice');assert.equal(calls[1].args.p_token,'bob');assert.deepEqual(calls[1],calls[2]);assert.equal('usuario' in calls[1].args,false);assert.equal('periodo' in calls[1].args,false);
});
test('malformed IDs, repeated IDs, empty reservation and overlarge commands never call RPC',()=>{
 const api=createOptSharedCuts({rpc:()=>assert.fail()},()=> 'token');
 for(const bad of [{...command(),piezas:['p1']},{...command(),piezas:[id(1),id(1)]},{...command(),reserva:''},{...command(),idempotencyKey:'bad'},{...command(),piezas:[]},{...command(),piezas:Array.from({length:1001},(_,i)=>id(i))}]) assert.throws(()=>api.registrar(bad),/PARAMETROS/);
});
test('unknown contracts and inconsistent state fail closed',async()=>{
 const mutations=[d=>delete d.contract_version,d=>d.reserva='OTHER',d=>d.habilitado=false,d=>d.totales.pendientes=99,d=>d.manifiesto_validado=false,d=>d.referencias[0].sha256='bad',d=>d.referencias[0].piezas[0].estado='DONE',d=>d.referencias[0].piezas[0].longitud_mm=NaN,d=>d.referencias[0].piezas.push(d.referencias[0].piezas[0]),d=>d.referencias[0].piezas[0].usuario='spoof',d=>delete d.referencias[0].piezas[0].registrable,d=>d.referencias[0].piezas[0].registrable=false];
 for(const change of mutations){const data=state();change(data);await assert.rejects(createOptSharedCuts({rpc:async()=>({data})},()=> 't').estado('R',scope),/CONTRATO/);}
});
test('receipt must match full submitted command',async()=>{
 for(const change of [d=>d.id_registro=id(7),d=>d.piezas=[id(8)],d=>d.reserva='OTHER',d=>d.cantidad_piezas=2,d=>d.usuario='',d=>d.registrado_en='invalid',d=>d.ok=false]) {
  const api=createOptSharedCuts({rpc:async(_,args)=>{const data=receipt(args);change(data);return {data};}},()=> 't');await assert.rejects(api.registrar(command()),/CONTRATO/);
 }
});
test('late response after token change is uncertain and cannot update session',async()=>{
 let token='alice';const api=createOptSharedCuts({rpc:async(_,args)=>{token='bob';return {data:receipt(args)};}},()=>token);
 await assert.rejects(api.registrar(command()),error=>error.message==='OPT_SESION_CAMBIADA' && error.definitive!==true);
});
test('only recognized SQL rollbacks are definitive, transport remains uncertain',async()=>{
 for(const [error,definitive] of [[{message:'OPT_CORTE_YA_REGISTRADO',code:'P0001'},true],[{message:'OPT_CORTE_YA_REGISTRADO'},false],[{message:'network',code:'P0001'},false],[{message:'permission denied',code:'42501'},false]]){
  const api=createOptSharedCuts({rpc:async()=>({error})},()=> 't');await assert.rejects(api.registrar(command()),e=>e.definitive===definitive);
 }
 const api=createOptSharedCuts({rpc:async()=>{throw new Error('timeout');}},()=> 't');await assert.rejects(api.registrar(command()),e=>e.definitive!==true);
 await assert.rejects(createOptSharedCuts({rpc:()=>assert.fail()},()=> '').estado('R',scope),/SESION/);
});
test('valid empty manifest is distinct from a pending piece',async()=>{
 const data={...state(),manifiesto_validado:false,puede_registrar:false,referencias:[],totales:{piezas:0,cortadas:0,pendientes:0}};
 assert.equal((await createOptSharedCuts({rpc:async()=>({data})},()=> 't').estado('R',scope)).manifiesto_validado,false);
});

test('v2 rejects missing, different or extra scope; v1 never silently upgrades',async()=>{
 let calls=0;const api=createOptSharedCuts({rpc:async()=>{calls++;return {data:state()};}},()=> 't');
 for(const bad of [null,undefined,{...scope,anio:2019},{...scope,semana:0},{...scope,linea:'FRAMES_2'},{...scope,modo:'ACTUAL'},{...scope,extra:true}]){
  await assert.rejects(api.estado('R',bad),/SCOPE/);assert.throws(()=>api.registrar({...command(),scope:bad}),/SCOPE/);
 }assert.equal(calls,0);
 for(const change of [d=>d.contract_version=1,d=>d.scope.semana=45,d=>d.scope.anio=2025,d=>d.scope.modo='ACTUAL',d=>delete d.scope]){
  const d=state();change(d);await assert.rejects(createOptSharedCuts({rpc:async()=>({data:d})},()=> 't').estado('R',scope),/CONTRATO/);
 }
});
test('one SHA and one source cannot become two physical documents',async()=>{
 for(const change of [r=>{},r=>r.sha256='b'.repeat(64)]){
  const d=state(),other=structuredClone(d.referencias[0]);other.id_documento=id(3);other.referencia='OTHER';other.piezas[0].id_pieza=id(4);change(other);d.referencias.push(other);d.totales.piezas=d.totales.pendientes=2;
  await assert.rejects(createOptSharedCuts({rpc:async()=>({data:d})},()=> 't').estado('R',scope),/CONTRATO/);
 }
});
test('same document multiple references keeps one source set and distinct physical positions',async()=>{
 const d=state(),r=structuredClone(d.referencias[0]);r.referencia='SECOND';r.piezas[0].id_pieza=id(4);r.piezas[0].corte=2;d.referencias.push(r);d.totales.piezas=d.totales.pendientes=2;
 assert.equal((await createOptSharedCuts({rpc:async()=>({data:d})},()=> 't').estado('R',scope)).referencias.length,2);
 r.piezas[0].corte=1;await assert.rejects(createOptSharedCuts({rpc:async()=>({data:d})},()=> 't').estado('R',scope),/CONTRATO/);
});
test('scope belongs to receipt and exact retries preserve it',async()=>{
 for(const change of [d=>d.scope.semana=45,d=>d.scope.anio=2025,d=>delete d.scope]){
  const api=createOptSharedCuts({rpc:async(_,args)=>{const d=receipt(args);change(d);return {data:d};}},()=> 't');await assert.rejects(api.registrar(command()),/CONTRATO/);
 }
});

test('server period is mandatory and strict on both receipt and cut state; errors remain uncertain',async()=>{
 const mutations=[d=>delete d.periodo,d=>d.periodo=null,d=>d.periodo.fecha='2026-02-30',d=>d.periodo.fecha='2026-11-11',d=>d.periodo.turno=0,d=>d.periodo.turno=3,d=>d.periodo.turno='2',d=>d.periodo.turno=false,d=>d.periodo.zona='UTC',d=>d.periodo.horario_sha256='x'.repeat(64),d=>d.periodo.horario_sha256=123,d=>d.periodo.extra=true,d=>delete d.periodo.fin,d=>d.periodo.fin=d.periodo.inicio,d=>d.periodo.fin='2026-11-10T17:00:00-05:00',d=>d.periodo.inicio='2026-02-30T18:00:00-05:00',d=>d.periodo.inicio='2026-11-10T24:00:00-05:00',d=>d.periodo.inicio='2026-11-10T18:00:00',d=>d.registrado_en=d.periodo.fin,d=>d.registrado_en='2026-11-10T17:59:59-05:00'];
 for(const mutate of mutations){
  const r=receipt({p_reserva:'R',p_piezas:[id(1)],p_idempotency_key:id(9)});mutate(r);
  await assert.rejects(createOptSharedCuts({rpc:async()=>({data:r})},()=> 't').registrar(command()),e=>e.message==='OPT_CONTRATO_NO_COMPATIBLE'&&e.definitive!==true);
  const d=state();Object.assign(d.referencias[0].piezas[0],{estado:'CORTADO',usuario:r.usuario,registrado_en:r.registrado_en,id_registro:id(9),periodo:r.periodo});d.totales={piezas:1,cortadas:1,pendientes:0};
  await assert.rejects(createOptSharedCuts({rpc:async()=>({data:d})},()=> 't').estado('R',scope),/CONTRATO/);
 }
 for(const value of [undefined,period()]){const d=state();d.referencias[0].piezas[0].periodo=value;await assert.rejects(createOptSharedCuts({rpc:async()=>({data:d})},()=> 't').estado('R',scope),/CONTRATO/);}
});
test('night period keeps operational start day across midnight and replay returns original attribution',async()=>{
 const calls=[];let original;
 const api=createOptSharedCuts({rpc:async(_,args)=>{calls.push(structuredClone(args));if(!original)original={...receipt(args),registrado_en:'2026-11-11T04:30:00-05:00'};return {data:{...structuredClone(original),duplicado:calls.length>1}};}},()=> 't');
 const first=await api.registrar({...command(),usuario:'spoof',periodo:{turno:1}}),replay=await api.registrar(command());
 assert.equal(first.periodo.fecha,'2026-11-10');assert.equal(first.periodo.turno,2);assert.deepEqual(first.periodo,replay.periodo);assert.equal(first.registrado_en,replay.registrado_en);assert.equal(replay.duplicado,true);assert.deepEqual(calls[0],calls[1]);assert(!('periodo' in calls[0]));
 const d=state();Object.assign(d.referencias[0].piezas[0],{estado:'CORTADO',usuario:first.usuario,registrado_en:first.registrado_en,id_registro:first.id_registro,periodo:first.periodo});d.totales={piezas:1,cortadas:1,pendientes:0};assert.equal((await createOptSharedCuts({rpc:async()=>({data:d})},()=> 't').estado('R',scope)).totales.cortadas,1);
});
test('period comparison preserves SQL microseconds and accepts explicit equivalent ISO offsets',async()=>{
 for(const [at,valid] of [['2026-11-11T00:00:00.000001Z',true],['2026-11-10T19:00:00.000001-05:00',true],['2026-11-11T00:00:00.000002+00:00',false],['2026-11-11T00:00:00.000000Z',false]]){
  const api=createOptSharedCuts({rpc:async(_,args)=>({data:{...receipt(args),registrado_en:at,periodo:{...period(),inicio:'2026-11-11T00:00:00.000001+00:00',fin:'2026-11-11T00:00:00.000002Z'}}})},()=> 't');
  if(valid)await api.registrar(command());else await assert.rejects(api.registrar(command()),/CONTRATO/);
 }
});
test('known server schedule rejection is definitive only for the current SQL attempt',async()=>{
 for(const message of ['OPT_HORARIO_NO_CONFIGURADO','OPT_HORARIO_SIN_TURNO','OPT_HORARIO_SUPERPUESTO','HORARIO_OPERATIVO_NO_CONFIGURADO','HORARIO_OPERATIVO_AMBIGUO']){
  await assert.rejects(createOptSharedCuts({rpc:async()=>({error:{code:'P0001',message}})},()=> 't').registrar(command()),e=>e.definitive===true);
 }
});

test('invalid RPC timeout is rejected before any network request',()=>{
 for(const timeoutMs of [0,-1,Infinity,NaN,'25',null,1.5,2147483648])assert.throws(()=>createOptSharedCuts({rpc:()=>assert.fail()},()=> 't',{timeoutMs}),/OPT_ESPERA_INVALIDA/);
});
test('hung reads and writes time out as uncertain without automatic retry',async()=>{
 let calls=0;const api=createOptSharedCuts({rpc:()=>{calls++;return new Promise(()=>{});}},()=> 't',{timeoutMs:10});
 for(const run of [()=>api.estado('R',scope),()=>api.registrar(command())])await assert.rejects(run(),e=>e.message==='OPT_RPC_TIMEOUT'&&e.definitive!==true);
 assert.equal(calls,2);
});
test('late write success cannot settle the timed-out attempt; explicit replay preserves command and receipt',async()=>{
 const calls=[];let finish,committed,settled=0;
 const api=createOptSharedCuts({rpc:(_,args)=>{calls.push(structuredClone(args));if(calls.length===1){committed=receipt(args);return new Promise(resolve=>{finish=resolve;});}return Promise.resolve({data:{...committed,duplicado:true}});}},()=> 't',{timeoutMs:10});
 const attempt=api.registrar(command());attempt.then(()=>settled++,()=>settled++);
 await assert.rejects(attempt,e=>e.message==='OPT_RPC_TIMEOUT'&&e.definitive!==true);assert.equal(settled,1);assert.equal(calls.length,1);
 finish({data:committed});await new Promise(resolve=>setTimeout(resolve,15));assert.equal(settled,1);assert.equal(calls.length,1);await assert.rejects(attempt,/OPT_RPC_TIMEOUT/);
 const replay=await api.registrar(command());assert.deepEqual(calls[0],calls[1]);assert.equal(replay.duplicado,true);assert.deepEqual(replay.periodo,committed.periodo);assert.equal(replay.registrado_en,committed.registrado_en);
});
test('timely response and synchronous RPC error release their timeout timers',async()=>{
 const api=createOptSharedCuts({rpc:(_,args)=>({data:receipt(args)})},()=> 't',{timeoutMs:1000});assert.equal((await api.registrar(command())).ok,true);
 await assert.rejects(createOptSharedCuts({rpc:()=>{throw Error('sync transport failure');}},()=> 't',{timeoutMs:1000}).registrar(command()),/sync transport failure/);
});

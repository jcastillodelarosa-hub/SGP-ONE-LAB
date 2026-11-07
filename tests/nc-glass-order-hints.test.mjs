import test from 'node:test';
import assert from 'node:assert/strict';
import {ncGlassOrderHints,isActiveGlassNc} from '../src/services/nc-glass-order-hints.js';

const source={consecutivo:'NC-17',orden:'982383 - Producción de prueba',sistema:'ES-TEST',semana_maestro:45,estado_nc:'ABIERTA',linea_responsable:'PANELES 2',cant_repo:9};
const row={key:'1314100|PANELES_2',produccion:source.orden,oficial:{sistema:source.sistema},linea:'PANELES_2',etapa:'ENSAMBLE'};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function setup(options={}){
 let token='A',role='COORDINADOR',current=true;const calls=[];
 const service=ncGlassOrderHints({getToken:()=>token,getRole:()=>role,isCurrent:()=>current,getClient:async()=>({rpc:(name,args)=>{calls.push({name,args});return Promise.resolve({data:{rows:[source]}});}}),...options});
 return {service,calls,setToken:v=>token=v,setRole:v=>role=v,setCurrent:v=>current=v};
}
const tick=()=>Promise.resolve();

test('one open-week RPC serves every row, coalesces reads and caches the completed response',async()=>{
 const x=setup(),first=x.service.read();assert.equal(first,x.service.read());assert.equal(first,x.service.read({force:true}));
 assert.equal((await first).status,'READY');
 for(let i=0;i<50;i++){assert.equal(x.service.candidatesFor({...row,key:'different-'+i}).count,1);await x.service.read();}
 assert.deepEqual(x.calls,[{name:'sgp_consultar_nc_vidrio',args:{p_token:'A',p_semana:null}}]);
 assert.equal(x.service.status,'READY');assert.equal(x.service.state.status,'READY');
 await x.service.read({force:true});assert.equal(x.calls.length,2);
});

test('not loaded, loading and failed data have count null; a successful empty response has count zero',async()=>{
 const wait=deferred(),x=setup({getClient:async()=>({rpc:()=>wait.promise})});
 assert.deepEqual(x.service.candidatesFor(row),{status:'UNAVAILABLE',reason:'NOT_LOADED',count:null,candidates:[]});
 const pending=x.service.read();assert.equal(x.service.state.reason,'LOADING');assert.equal(x.service.candidatesFor(row).count,null);
 wait.resolve({data:{rows:[]}});await pending;
 assert.deepEqual(x.service.candidatesFor(row),{status:'READY',reason:'LOADED',count:0,candidates:[]});
});

test('matching uses normalized exact production and system, never canonical key, prefix or SAP',async()=>{
 const x=setup();await x.service.read();
 const exact={...row,key:'unrelated',produccion:'  982383 - PRODUCCIO\u0301N   DE PRUEBA  ',oficial:{sistema:' es-test '}};
 assert.equal(x.service.candidatesFor(exact).count,1);
 for(const mismatch of [{...row,produccion:'982383'},{...row,produccion:'other'},{...row,oficial:{sistema:'other'}},{...row,oficial:{sistema:''}},{...row,produccion:''},{key:row.key,orden_sap:'982383'}])assert.equal(x.service.candidatesFor(mismatch).count,0);
 const candidate=x.service.candidatesFor(row).candidates[0];
 assert.equal(candidate.reference,'NC-17');assert.equal(candidate.source.orden,source.orden);
 for(const key of ['key','quantity','windows','linked','canAssign','stage'])assert.equal(Object.hasOwn(candidate,key),false);
});

test('counts distinct NC references, not source rows, items or replacement quantities',async()=>{
 const rows=[source,{...source,item:'2',cant_repo:200},{...source,consecutivo:' nc-17 ',item:'3'},{...source,consecutivo:'NC-18',cant_repo:50}];
 const x=setup({getClient:async()=>({rpc:async()=>({data:{rows}})})});await x.service.read();
 const hints=x.service.candidatesFor(row);assert.equal(hints.count,2);assert.equal(hints.candidates[0].sources.length,3);
 assert.deepEqual(hints.candidates[0].sources.map(s=>s.cant_repo),[9,200,9]);assert.equal(hints.candidates[1].source.cant_repo,50);
});

test('saved references are excluded after normalization; caller array and source remain unchanged',async()=>{
 const x=setup();await x.service.read();const saved=[' nc-17 '];
 assert.equal(x.service.candidatesFor(row,saved).count,0);assert.deepEqual(saved,[' nc-17 ']);
 assert.equal(x.service.candidatesFor(row).count,1);
 assert.throws(()=>{x.service.candidatesFor(row).candidates[0].source.orden='changed';},TypeError);
 assert.equal(source.orden,row.produccion);
});

test('responsible line only prioritizes evidence; different or missing line remains a possible candidate',async()=>{
 const rows=[{...source,consecutivo:'NC-OTHER',linea_responsable:'FRAMES 2'},{...source,consecutivo:'NC-MISSING',linea_responsable:null},source];
 const x=setup({getClient:async()=>({rpc:async()=>({data:{rows}})})});await x.service.read();
 const hints=x.service.candidatesFor({...row,linea:' paneles_2 '});assert.equal(hints.count,3);
 assert.deepEqual(hints.candidates.map(c=>[c.reference,c.sameResponsibleLine]),[['NC-17',true],['NC-OTHER',false],['NC-MISSING',false]]);
 assert.equal(x.service.candidatesFor({...row,linea:null}).candidates.every(c=>c.sameResponsibleLine===false),true);
 assert.equal(x.service.candidatesFor({...row,etapa:'EMPAQUE'}).count,3);
});

test('retains every returned estado_nc without an invented active/open enum filter',async()=>{
 const statuses=['ABIERTA','CERRADA','EN REVISIÓN',null];
 const x=setup({getClient:async()=>({rpc:async()=>({data:{rows:statuses.map((estado_nc,i)=>({...source,consecutivo:'NC-'+i,estado_nc}))}})})});await x.service.read();
 const hints=x.service.candidatesFor(row);assert.equal(hints.count,4);assert.deepEqual(hints.candidates.map(c=>c.source.estado_nc),statuses);
});

test('an optional caller-supplied source selector is explicit and cannot change exact matching',async()=>{
 const rows=[source,{...source,consecutivo:'NC-18',estado_nc:'OTHER'},{...source,consecutivo:'NC-19',orden:'unrelated'}];
 const x=setup({selectSource:value=>value.estado_nc==='ABIERTA',getClient:async()=>({rpc:async()=>({data:{rows}})})});await x.service.read();
 const hints=x.service.candidatesFor(row);assert.equal(hints.count,1);assert.equal(hints.candidates[0].reference,'NC-17');
});

test('incomplete source identity cannot invent an NC reference or a match',async()=>{
 const rows=[{...source,consecutivo:''},{...source,orden:''},{...source,sistema:null},{...source,orden:undefined,orden_sap:source.orden}];
 const x=setup({getClient:async()=>({rpc:async()=>({data:{rows}})})});await x.service.read();assert.equal(x.service.candidatesFor(row).count,0);
});

test('only COORDINADOR and ADMINISTRADOR can read; restricted roles never access getClient',async()=>{
 for(const role of ['LIDER','SUPERVISOR ENSAMBLE','CONSULTA',null,'coordinador']){
  let clients=0;const x=setup({getClient:async()=>{++clients;}});x.setRole(role);
  assert.equal((await x.service.read()).status,'UNAUTHORIZED');assert.equal(x.service.candidatesFor(row).count,null);assert.equal(clients,0);
 }
 const admin=setup();admin.setRole('ADMINISTRADOR');assert.equal((await admin.service.read()).status,'READY');
 const noSession=setup();noSession.setToken(null);assert.equal((await noSession.service.read()).status,'UNAUTHORIZED');assert.equal(noSession.calls.length,0);
});

test('session or exact role changes while getClient is pending prevent any RPC',async()=>{
 for(const change of [x=>x.setToken('B'),x=>x.setRole('ADMINISTRADOR'),x=>x.setRole('CONSULTA')]){
  let calls=0;const wait=deferred(),x=setup({getClient:()=>wait.promise});const pending=x.service.read();change(x);
  wait.resolve({rpc:()=>{++calls;return {data:{rows:[source]}};}});
  assert.equal((await pending).status,'UNAUTHORIZED');assert.equal(calls,0);assert.equal(x.service.candidatesFor(row).count,null);
 }
});

test('session or exact role changes after RPC discard late results and cached matches',async()=>{
 for(const change of [x=>x.setToken('B'),x=>x.setRole('ADMINISTRADOR'),x=>x.setRole('CONSULTA')]){
  const wait=deferred(),x=setup({getClient:async()=>({rpc:()=>wait.promise})});const pending=x.service.read();await tick();change(x);
  wait.resolve({data:{rows:[source]}});assert.equal((await pending).status,'UNAUTHORIZED');assert.equal(x.service.candidatesFor(row).count,null);
  const ready=setup();await ready.service.read();change(ready);assert.equal(ready.service.status,'UNAUTHORIZED');assert.equal(ready.service.candidatesFor(row).count,null);
 }
});

test('scope change invalidates both pending and completed evidence',async()=>{
 const wait=deferred(),x=setup({getClient:async()=>({rpc:()=>wait.promise})});const pending=x.service.read();await tick();x.setCurrent(false);
 wait.resolve({data:{rows:[source]}});assert.equal((await pending).status,'UNAVAILABLE');assert.equal(x.service.state.reason,'STALE_SCOPE');assert.equal(x.service.candidatesFor(row).count,null);
 const ready=setup();await ready.service.read();ready.setCurrent(false);assert.equal(ready.service.status,'UNAVAILABLE');assert.equal(ready.service.candidatesFor(row).count,null);
});

test('clear aborts the request and a late result cannot overwrite a newer read',async()=>{
 const wait=deferred();let calls=0,requestSignal;
 const x=setup({getClient:async()=>({rpc:()=>{if(++calls===1)return {abortSignal(signal){requestSignal=signal;return wait.promise;}};return Promise.resolve({data:{rows:[{...source,consecutivo:'NC-NEW'}]}});}})});
 const old=x.service.read();await tick();x.service.clear();assert.equal(requestSignal.aborted,true);
 await x.service.read();wait.resolve({data:{rows:[source]}});assert.equal((await old).reason,'CANCELLED');
 assert.equal(x.service.status,'READY');assert.equal(x.service.candidatesFor(row).candidates[0].reference,'NC-NEW');assert.equal(calls,2);
});

test('clear before getClient resolves prevents RPC and lets the next read capture a new session',async()=>{
 const wait=deferred();let calls=0;const x=setup({getClient:()=>wait.promise});const old=x.service.read();x.service.clear();x.setToken('B');
 wait.resolve({rpc:(name,args)=>{++calls;assert.equal(args.p_token,'B');return Promise.resolve({data:{rows:[source]}});}});
 assert.equal((await old).reason,'CANCELLED');assert.equal(calls,0);assert.equal((await x.service.read()).status,'READY');assert.equal(calls,1);
});

test('dispose and external abort are permanent, discard data and do not retry',async()=>{
 for(const cancel of ['dispose','signal']){
  const signal=new AbortController(),wait=deferred();let calls=0,requestSignal;
  const x=setup({signal:signal.signal,getClient:async()=>({rpc:()=>{++calls;return {abortSignal(value){requestSignal=value;return wait.promise;}};}})});
  const old=x.service.read();await tick();if(cancel==='dispose')x.service.dispose();else signal.abort();assert.equal(requestSignal.aborted,true);
  wait.resolve({data:{rows:[source]}});assert.equal((await old).status,'UNAVAILABLE');assert.equal(x.service.candidatesFor(row).count,null);
  x.service.clear();assert.equal((await x.service.read({force:true})).reason,'DISPOSED');assert.equal(calls,1);
 }
 const signal=new AbortController();signal.abort();const x=setup({signal:signal.signal});assert.equal((await x.service.read()).reason,'DISPOSED');assert.equal(x.calls.length,0);
});

test('denial has distinct UNAUTHORIZED state and no fallback or automatic retry',async()=>{
 for(const failure of [{error:Error('NO_AUTORIZADO')},{error:'NO_AUTORIZADO'},{error:{code:'42501',message:'permission denied'}},{error:{code:'PGRST301'}},{status:403},{error:{status:401}}]){
  let calls=0;const x=setup({getClient:async()=>({rpc:async()=>{++calls;return failure;}})});
  assert.equal((await x.service.read()).status,'UNAUTHORIZED');assert.equal(x.service.candidatesFor(row).count,null);
  await x.service.read();assert.equal(calls,1);
 }
});

test('network failure and incompatible responses stay UNAVAILABLE, distinct from empty',async()=>{
 for(const response of [{error:Error('network timeout')},{data:null},{data:{rows:{}}},{data:{rows:[null]}},{data:{rows:['NC-17']}}]){
  let calls=0;const x=setup({getClient:async()=>({rpc:async()=>{++calls;return response;}})});
  assert.equal((await x.service.read()).status,'UNAVAILABLE');assert.equal(x.service.candidatesFor(row).count,null);await x.service.read();assert.equal(calls,1);
 }
 const x=setup({getClient:async()=>{throw Error('offline');}});assert.equal((await x.service.read()).reason,'READ_FAILED');
});

test('forced refresh clears prior evidence while pending and does not leave stale hints after failure',async()=>{
 let calls=0;const wait=deferred(),x=setup({getClient:async()=>({rpc:()=>++calls===1?Promise.resolve({data:{rows:[source]}}):wait.promise})});
 await x.service.read();assert.equal(x.service.candidatesFor(row).count,1);
 const refresh=x.service.read({force:true});assert.equal(x.service.candidatesFor(row).count,null);assert.equal(refresh,x.service.read({force:true}));
 wait.resolve({error:Error('offline')});assert.equal((await refresh).status,'UNAVAILABLE');assert.equal(x.service.candidatesFor(row).count,null);assert.equal(calls,2);
});

test('a synchronous client failure is cached but a later explicit retry still runs',async()=>{
 let clients=0;const x=setup({getClient:()=>{if(++clients===1)throw Error('client unavailable');return {rpc:async()=>({data:{rows:[source]}})};}});
 assert.equal((await x.service.read()).status,'UNAVAILABLE');await x.service.read();assert.equal(clients,1);
 assert.equal((await x.service.read({force:true})).status,'READY');assert.equal(clients,2);
});

test('active glass NC requires explicit activo true and normalized ABIERTA, never an unknown state',()=>{
 assert.equal(isActiveGlassNc({activo:true,estado_nc:'ABIERTA'}),true);
 assert.equal(isActiveGlassNc({activo:true,estado_nc:' abierta '}),true);
 for(const value of [{activo:true,estado_nc:'CERRADA'},{activo:true,estado_nc:null},{activo:false,estado_nc:'ABIERTA'},{activo:true,estado_nc:'DESCONOCIDO'},{estado_nc:'ABIERTA'},null])assert.equal(isActiveGlassNc(value),false);
});

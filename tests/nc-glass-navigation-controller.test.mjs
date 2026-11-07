import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {globalTrackingData,trackingIdentity} from '../src/domain/lp01-tracking-global.js';
import {requireNcTrackingTarget,NC_TRACKING_LINES,NC_TRACKING_STAGES} from '../src/services/nc-glass-tracking.js';

// Reconstructed after workspace recovery, not a byte-for-byte recovery.
// Execute the production controller bodies in a VM with the real imported
// RPC normalizer and destination matcher. Only transport/rendering are stubbed.
// No browser, backend, or production write runs.
const source=readFileSync(new URL('../src/modules/lp01-operation.js',import.meta.url),'utf8');
function between(text,start,end){
 const a=text.indexOf(start),b=text.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,`Production source markers must exist: ${start} / ${end}`);
 return text.slice(a,b);
}
const openBody=between(source,' async function openOrder(target){',' return {load,openOrder};');
const cancelBody=between(source,' function cancelNavigation(){',' async function openOrder(target){');
const stopBody=between(source,' function stopEnrichment(){',' function startEnrichment(){');
const loadBody=between(source,' async function load({quiet=false}={}){',' async function performLoad(');
const affectationsBody=between(source,'onAffectations:async({host,row,target,cause})=>{','   onOperate:');
function eventLine(prefix){
 const line=source.split('\n').find(value=>value.trimStart().startsWith(prefix));
 assert.ok(line,`Production event handler must exist: ${prefix}`);
 return line;
}
const roleHandler=eventLine("document.addEventListener('sgp:lp-role'");
const panelHandler=eventLine("document.addEventListener('sgp:production-panel',e=>{if(!revealing)");
const stageHandler=eventLine("document.addEventListener('sgp:production-stage'");
const json=value=>JSON.parse(JSON.stringify(value));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(setImmediate);
const selection={key:'1314100|PANELES_2',line:'PANELES_2',stage:'ENSAMBLE',production:'982383 - Orden de prueba',system:'ES-TEST',ncReference:'NC-17',session:'A'};
function row(overrides={}){
 return {key:selection.key,linea:selection.line,etapa:selection.stage,trackingId:JSON.stringify([selection.key,selection.stage]),produccion:selection.production,oficial:{sistema:selection.system},...overrides};
}
function payload(orders=[row()]){
 return {contract:'LP-SEGUIMIENTO-1',role:'COORDINADOR',line:selection.line,stage:selection.stage,productions:orders.map(r=>({
  key:r.key,line:r.linea,stage:r.etapa,classification:'ABIERTA',assignments:[],operations:[],
  oficial:{key_produccion:r.key,id_linea:r.linea,produccion:r.produccion,saldos_inicializados:true,presente_ultimo_export:true,saldo_ensamble:3,saldo_empaque:2,...r.oficial}
 }))};
}

function fixture({read=async()=>payload()}={}){
 let token='A',sourceCurrent=true,saleOpen=false;
 const calls=[],events=[],listeners=new Map(),nodes=new Map();
 const effects={renders:0,refreshes:0,focus:0,scroll:0,clears:0,globalLoads:0,operationLoads:0,mounts:[]};
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{value:'',textContent:'',hidden:false});
  return nodes.get(selector);
 };
 node('[data-line]').value='FRAMES_2';node('[data-op-stage]').value='EMPAQUE';
 node('[data-op-date]').value='2026-11-06';node('[data-op-shift]').value='2';
 const capture=()=>({line:node('[data-line]').value,stage:node('[data-op-stage]').value,date:node('[data-op-date]').value,shift:Number(node('[data-op-shift]').value)});
 const drawer={focus:()=>effects.focus++,scrollIntoView:()=>effects.scroll++};
 const live={querySelector:selector=>selector==='#lp-tracking-drawer'?drawer:null,replaceChildren:()=>effects.clears++};
 const document={
  querySelector:selector=>selector==='.lp-sale-dialog[open]'&&saleOpen?{open:true}:null,
  addEventListener:(name,fn)=>{const list=listeners.get(name)||[];list.push(fn);listeners.set(name,list);},
  createElement:tag=>({tagName:tag,className:'',textContent:''})
 };
 const saved={filters:{system:['OTHER'],week:[12]},sort:'production',selected:'previous',open:false};
 const stateKey=JSON.stringify([selection.line,selection.stage]);
 const context=vm.createContext({
  AbortController,document,bridge:{getToken:()=>token,getClient:async()=>({})},
  get:node,tracking:{querySelector:node},live,message:{textContent:'Original status'},capture,
  trackingRole:'COORDINADOR',viewPanel:'operacion',trackingViewState:{},trackingStates:new Map([[stateKey,saved]]),
  navigationGeneration:0,navigating:false,navigationFlight:null,revealing:false,temporaryTrackingState:null,
  seq:0,loading:false,globalQueued:true,busy:false,pending:null,dirty:false,enrichment:null,
  globalData:null,globalContext:null,globalSession:'A',summaryScope:'old-scope',
  summaries:new Map([['old',{}]]),summaryTimes:new Map([['old',1]]),orderDetails:new Map([['old',{}]]),detailsAt:new Map([['old',1]]),detailsGenerations:new Map([['old',1]]),
  orderSaleScope:null,orderSaleProvider:null,operationRequest:null,session:'A',context:null,
  rpc:async(name,args,options={})=>{calls.push({name,args,options});events.push('read');return read(name,args,options);},
  globalTrackingData:(result,ctx)=>{events.push('normalize');assert.equal(ctx.line,selection.line);assert.equal(ctx.stage,selection.stage);return globalTrackingData(result,ctx);},
  trackingIdentity,requireNcTrackingTarget,NC_TRACKING_LINES,NC_TRACKING_STAGES,
  globalControls:value=>events.push(`controls:${value}`),
  renderGlobal:()=>{effects.renders++;events.push('render');},
  refreshSummaries:()=>effects.refreshes++,paintSummaries:()=>{},rememberDetails:(_key,details)=>details,ncHints:null,
  clear:()=>effects.clears++,
  loadGlobal:async()=>{effects.globalLoads++;},performLoad:async()=>{effects.operationLoads++;return true;},
  mountTrackingAffectations:async options=>{effects.mounts.push(options);}
 });
 vm.runInContext(stopBody+'\n'+cancelBody+'\n'+openBody+'\n'+loadBody+'\n'+roleHandler+'\n'+panelHandler+'\n'+stageHandler+'\nglobalThis.affectations=({'+affectationsBody+'}).onAffectations;',context);
 const dispatch=(name,detail)=>{for(const listener of listeners.get(name)||[])listener({detail});};
 const target=overrides=>({
  ...selection,isCurrent:()=>sourceCurrent,
  reveal:()=>{events.push('reveal');dispatch('sgp:production-panel','seguimiento');},...overrides
 });
 return {context,calls,events,effects,node,capture,saved,stateKey,target,dispatch,
  setToken:value=>{token=value;},setCurrent:value=>{sourceCurrent=value;},setSale:value=>{saleOpen=value;}};
}

function assertNotOpened(x){assert.equal(x.events.includes('reveal'),false);assert.equal(x.effects.renders,0);assert.equal(x.context.temporaryTrackingState,null);}
function host(){return {isConnected:true,textContent:'',notices:[],prepend(notice){this.notices.unshift(notice);}};}

test('exact chosen candidate is revalidated before reveal and uses temporary state without changing saved filters',async()=>{
 const other=row({key:'999|PANELES_2',trackingId:'other'}),chosen=row();
 const x=fixture({read:async()=>payload([other,chosen])}),before=JSON.stringify(x.saved),generation=x.context.navigationGeneration;
 const result=await x.context.openOrder(x.target());
 assert.deepEqual(json(result),{key:selection.key,line:selection.line,stage:selection.stage});
 assert.notEqual(result.key.split('|')[0],selection.production.split(' ')[0]);
 assert.deepEqual(x.events,['read','normalize','reveal','controls:true','render']);
 assert.deepEqual(json(x.calls[0].args),{p_linea:selection.line,p_etapa:selection.stage});
 assert.equal(x.context.navigationGeneration,generation+1,'reveal panel event must not cancel its own navigation');
 assert.equal(x.context.globalData.orders[1].key,chosen.key);assert.equal(x.context.globalSession,'A');
 assert.deepEqual(json(x.context.trackingViewState),{selected:chosen.trackingId,open:true,tab:'Afectaciones',cause:'NC_V'});
 assert.equal(x.context.temporaryTrackingState.state,x.context.trackingViewState);
 assert.equal(x.context.temporaryTrackingState.scope,JSON.stringify(['A',selection.line,selection.stage]));
 assert.equal(x.context.trackingStates.get(x.stateKey),x.saved);assert.equal(JSON.stringify(x.saved),before);
 assert.notEqual(x.context.trackingViewState,x.saved);
 assert.equal(x.node('[data-line]').value,selection.line);assert.equal(x.node('[data-op-stage]').value,selection.stage);
 assert.equal(x.node('[data-op-date]').value,'2026-11-06');assert.equal(x.node('[data-op-shift]').value,'2');
 for(const key of ['summaries','summaryTimes','orderDetails','detailsAt','detailsGenerations'])assert.equal(x.context[key].size,0,key);
 assert.equal(x.effects.focus,1);assert.equal(x.effects.scroll,1);assert.equal(x.context.navigating,false);assert.equal(x.context.navigationFlight,null);
});

test('open shared detail, Disponible dialog, operation draft, pending or busy save block navigation without reading',async()=>{
 const cases=[
  ['shared detail',x=>{x.context.trackingViewState={open:true,draft:'keep'};}],
  ['Disponible dialog',x=>x.setSale(true)],
  ['draft',x=>{x.context.dirty=true;}],
  ['pending save',x=>{x.context.pending={signature:'keep'};}],
  ['uncertain save',x=>{x.context.pending={uncertain:true};}],
  ['busy save',x=>{x.context.busy=true;}]
 ];
 for(const [label,block] of cases){
  const x=fixture();block(x);const draft=x.context.trackingViewState,pending=x.context.pending;
  await assert.rejects(x.context.openOrder(x.target()),/Cierra primero|borrador|guardado pendiente/,label);
  assert.equal(x.calls.length,0,label);assertNotOpened(x);assert.equal(x.context.trackingViewState,draft);assert.equal(x.context.pending,pending);assert.equal(x.context.navigating,false);
 }
});

test('source cancellation while final read is pending discards the late result',async()=>{
 const gate=deferred(),x=fixture({read:()=>gate.promise}),opening=x.context.openOrder(x.target());
 assert.equal(x.calls.length,1);x.setCurrent(false);gate.resolve(payload());
 await assert.rejects(opening,/navegación o sesión cambió/);assertNotOpened(x);
 assert.equal(x.context.navigating,false);assert.equal(x.context.navigationFlight,null);assert.equal(x.node('[data-line]').value,'FRAMES_2');
});

test('roles, source session and navigation scope are checked before and after the final read',async()=>{
 for(const role of ['CONSULTA','LIDER','SUPERVISOR ENSAMBLE',null]){
  const x=fixture();x.context.trackingRole=role;
  await assert.rejects(x.context.openOrder(x.target()),/no autorizado/);assert.equal(x.calls.length,0);
 }
 for(const overrides of [{session:'B'},{line:'UNKNOWN'},{stage:'OTHER'},{key:'1314100|FRAMES_2'}]){
  const x=fixture();await assert.rejects(x.context.openOrder(x.target(overrides)),/no autorizado|incompatible/);assert.equal(x.calls.length,0);
 }
 const cases=[
  ['token',x=>x.setToken('B')],
  ['role',x=>x.dispatch('sgp:lp-role','CONSULTA')],
  ['new authorized session',x=>{x.setToken('B');x.dispatch('sgp:lp-role','COORDINADOR');}],
  ['generation',x=>{x.context.navigationGeneration++;}],
  ['panel',x=>x.dispatch('sgp:production-panel','ensamble')],
  ['stage',x=>x.dispatch('sgp:production-stage','EMPAQUE')]
 ];
 for(const [label,change] of cases){
  const gate=deferred(),x=fixture({read:()=>gate.promise}),opening=x.context.openOrder(x.target());
  change(x);gate.resolve(payload());await assert.rejects(opening,/navegación o sesión cambió/,label);assertNotOpened(x);assert.equal(x.context.navigating,false,label);
 }
});

test('missing destination or changed key, line, stage, production or system cannot reveal a replacement',async()=>{
 const alternatives=[[],[row({key:'982383|PANELES_2'})],[row({linea:'FRAMES_2'})],[row({etapa:'EMPAQUE'})],[row({produccion:'Changed'})],[row({oficial:{sistema:'OTHER'}})]];
 for(const orders of alternatives){
  const x=fixture({read:async()=>payload(orders)});
  await assert.rejects(x.context.openOrder(x.target()),/coincidencia ya no está disponible|Identidad global ajena/);assertNotOpened(x);
  assert.equal(x.calls.length,1);assert.equal(x.context.globalData,null);assert.equal(x.context.summaries.size,1);assert.equal(x.context.navigating,false);
 }
});

test('denied final read fails closed without fallback, destination mutation or filter loss',async()=>{
 const denial=Error('NO_AUTORIZADO'),x=fixture({read:async()=>{throw denial;}}),before=JSON.stringify(x.saved);
 await assert.rejects(x.context.openOrder(x.target()),error=>error===denial);
 assertNotOpened(x);assert.equal(x.calls.length,1);assert.equal(x.context.globalData,null);assert.equal(x.context.globalContext,null);
 assert.equal(x.node('[data-line]').value,'FRAMES_2');assert.equal(JSON.stringify(x.saved),before);
 assert.equal(x.context.navigating,false);assert.equal(x.context.navigationFlight,null);
});

test('second open cannot issue a read or release the first owner lock',async()=>{
 const gate=deferred(),x=fixture({read:()=>gate.promise}),first=x.context.openOrder(x.target()),owner=x.context.navigationFlight;
 await assert.rejects(x.context.openOrder(x.target()),/apertura anterior/);
 assert.equal(x.calls.length,1);assert.equal(x.context.navigationFlight,owner);assert.equal(x.context.navigating,true);assert.equal(owner.controller.signal.aborted,false);
 gate.resolve(payload());await first;assert.equal(x.effects.renders,1);assert.equal(x.context.navigationFlight,null);assert.equal(x.context.navigating,false);
});

test('a newly opened detail, draft or pending save during the read prevents replacing that work',async()=>{
 for(const change of [x=>{x.context.trackingViewState={open:true,draft:'keep'};},x=>{x.context.dirty=true;},x=>{x.context.pending={uncertain:true};},x=>{x.context.busy=true;}]){
  const gate=deferred(),x=fixture({read:()=>gate.promise}),opening=x.context.openOrder(x.target());
  change(x);const state=x.context.trackingViewState,pending=x.context.pending;gate.resolve(payload());
  await assert.rejects(opening,/detalle o borrador abierto/);assertNotOpened(x);
  assert.equal(x.context.trackingViewState,state);assert.equal(x.context.pending,pending);assert.equal(x.context.globalData,null);assert.equal(x.context.navigating,false);
 }
});

test('navigation only calls the existing read RPC and never a write command or editor submit',async()=>{
 const x=fixture();await x.context.openOrder(x.target());
 assert.deepEqual(x.calls.map(call=>call.name),['sgp_lp_seguimiento_consultar']);
 assert.deepEqual([...openBody.matchAll(/rpc\(\s*['"]([^'"]+)['"]/g)].map(match=>match[1]),['sgp_lp_seguimiento_consultar']);
 assert.doesNotMatch(openBody,/\b(?:send|transmit|submit|requestSubmit|mountTrackingAffectations)\s*\(|p_cmd|sgp_lp_operacion_comando/);
 assert.equal(x.effects.mounts.length,0);assert.equal(x.context.pending,null);assert.equal(x.context.dirty,false);
});

test('previous enrichment is aborted before final destination read and cannot own the destination',async()=>{
 const old=new AbortController();let x;
 x=fixture({read:async()=>{assert.equal(old.signal.aborted,true);assert.equal(x.context.enrichment,null);return payload();}});
 x.context.enrichment={controller:old};await x.context.openOrder(x.target());
 assert.equal(old.signal.aborted,true);assert.equal(x.context.enrichment,null);assert.equal(x.effects.renders,1);
});

test('abort releases navigation immediately and an old finally cannot clear the new flight',async()=>{
 const gates=[deferred(),deferred()];let read=0;
 const x=fixture({read:()=>gates[read++].promise}),sourceAbort=new AbortController();
 const old=x.context.openOrder(x.target({signal:sourceAbort.signal})),oldOwner=x.context.navigationFlight;
 const oldRejected=assert.rejects(old,/navegación o sesión cambió/);
 assert.equal(x.calls[0].options.signal,oldOwner.controller.signal);x.context.loading=true;
 sourceAbort.abort();assert.equal(oldOwner.controller.signal.aborted,true);
 assert.equal(x.context.navigating,false);assert.equal(x.context.navigationFlight,null);assert.equal(x.context.loading,false);
 const fresh=x.context.openOrder(x.target()),newOwner=x.context.navigationFlight;x.context.loading=true;
 assert.notEqual(newOwner,oldOwner);assert.equal(x.calls.length,2);assert.equal(x.context.navigating,true);
 gates[0].resolve(payload());await oldRejected;
 assert.equal(x.context.navigationFlight,newOwner);assert.equal(x.context.navigating,true);assert.equal(x.context.loading,true);assert.equal(newOwner.controller.signal.aborted,false);assertNotOpened(x);
 gates[1].resolve(payload());await fresh;
 assert.equal(x.context.navigationFlight,null);assert.equal(x.context.navigating,false);assert.equal(x.context.loading,false);assert.equal(x.effects.renders,1);
 // A successful flight removes the source abort listener; an old source cannot
 // abort a later navigation or change its generation after completion.
 const done=fixture(),completedSource=new AbortController();await done.context.openOrder(done.target({signal:completedSource.signal}));
 const generation=done.context.navigationGeneration;completedSource.abort();assert.equal(done.context.navigationGeneration,generation);
});

test('queued operation reload does not replay after intention, panel, token or scope changes',async()=>{
 const cases=[
  ['navigation generation',x=>{x.context.navigationGeneration++;}],
  ['panel',x=>{x.context.viewPanel='seguimiento';}],
  ['line',x=>{x.node('[data-line]').value='PANELES_2';}],
  ['stage',x=>{x.node('[data-op-stage]').value='ENSAMBLE';}],
  ['session',x=>x.setToken('B')]
 ];
 for(const [label,change] of cases){
  const gate=deferred(),x=fixture();x.context.operationRequest={scope:'previous-operation-scope',promise:gate.promise};
  const waiting=x.context.load({quiet:true});assert.equal(x.effects.clears,1,label);
  change(x);x.context.operationRequest=null;gate.resolve(true);await waiting;
  assert.equal(x.effects.operationLoads,0,label);assert.equal(x.effects.globalLoads,0,label);assert.equal(x.effects.renders,0,label);
 }
 // Positive control: a still-current intent really retries, so the assertion
 // above cannot pass merely because the extracted load never executes.
 const gate=deferred(),same=fixture();same.context.operationRequest={scope:'previous-operation-scope',promise:gate.promise};
 const waiting=same.context.load();same.context.operationRequest=null;gate.resolve(true);assert.equal(await waiting,true);assert.equal(same.effects.operationLoads,1);
});

test('origin notice is immutable and bound to exact key/line/stage; stale mount and session changes clear it',async()=>{
 const x=fixture();await x.context.openOrder(x.target());
 const origin=x.context.temporaryTrackingState.origin;
 assert.equal(Object.isFrozen(origin),true);assert.deepEqual(json(origin),{key:selection.key,line:selection.line,stage:selection.stage,reference:selection.ncReference});
 const chosen=row(),matching=host();await x.context.affectations({host:matching,row:chosen,cause:'NC_V'});
 assert.equal(matching.notices.length,1);assert.equal(matching.notices[0].className,'nc-tracking-origin');assert.match(matching.notices[0].textContent,/NC-17.*sin guardar.*no vinculada/);
 const originalScope=x.context.globalContext;
 for(const [candidate,scope] of [[row({key:'999|PANELES_2'}),originalScope],[chosen,{...originalScope,line:'FRAMES_2'}],[chosen,{...originalScope,stage:'EMPAQUE'}]]){
  x.context.globalContext=scope;const pane=host();await x.context.affectations({host:pane,row:candidate,cause:'NC_V'});assert.equal(pane.notices.length,0);
 }
 x.context.globalContext=originalScope;
 for(const invalidate of [
  (ctx,pane)=>{ctx.temporaryTrackingState=null;},
  (ctx,pane)=>{ctx.temporaryTrackingState={...ctx.temporaryTrackingState,origin:Object.freeze({...origin})};},
  (ctx,pane)=>{pane.isConnected=false;},
  ()=>x.setToken('B')
 ]){
  x.setToken('A');x.context.temporaryTrackingState={origin};const gate=deferred(),pane=host();
  x.context.mountTrackingAffectations=()=>gate.promise;
  const mounting=x.context.affectations({host:pane,row:chosen,cause:'NC_V'});await tick();invalidate(x.context,pane);gate.resolve();await mounting;assert.equal(pane.notices.length,0);
 }
 // Execute the real role invalidation listener: an invisible previous user's
 // open drawer must neither keep its notice nor block a new user's selection.
 x.context.trackingViewState={open:true};x.context.temporaryTrackingState={origin};x.setToken('B');x.dispatch('sgp:lp-role','COORDINADOR');
 assert.deepEqual(json(x.context.trackingViewState),{});assert.equal(x.context.temporaryTrackingState,null);assert.equal(x.context.trackingStates.size,0);assert.equal(x.context.globalData,null);
 await x.context.openOrder(x.target({session:'B'}));assert.equal(x.context.globalSession,'B');
});

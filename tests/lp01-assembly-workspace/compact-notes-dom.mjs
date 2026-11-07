// Actual v404 compact-note adapter inside Ensamble, with synthetic RPC transport.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {parseHTML}=await import(process.env.LP_DOM_PACKAGE||'linkedom');
const {window}=parseHTML('<html><body><main id="sheet"></main></body></html>');
for(const name of ['document','MutationObserver','HTMLElement','HTMLInputElement','Event','CustomEvent'])globalThis[name]=window[name];globalThis.window=window;globalThis.CSS={escape:v=>String(v)};
for(const proto of [window.Element.prototype,window.Document.prototype])for(const name of ['querySelector','querySelectorAll']){const original=proto[name];proto[name]=function(selector){return original.call(this,selector.replaceAll(':modal','[open]'));};}
Object.defineProperty(window.HTMLElement.prototype,'elements',{get(){return new Proxy([...this.querySelectorAll('input,select,textarea,button')],{get:(list,key)=>Reflect.get(list,key)??list.find(n=>n.getAttribute('name')===key)});}});
window.HTMLElement.prototype.focus=function(){document._active=this;};Object.defineProperty(document,'activeElement',{get:()=>document._active||document.body});
window.HTMLElement.prototype.showModal=function(){this.setAttribute('open','');};window.HTMLElement.prototype.close=function(){this.removeAttribute('open');};
const intervals=new Set(),set=globalThis.setInterval,clear=globalThis.clearInterval;globalThis.setInterval=(...args)=>{const timer=set(...args);intervals.add(timer);return timer;};globalThis.clearInterval=timer=>{intervals.delete(timer);clear(timer);};
const {mountAssemblyWorkspace}=await import('../../src/modules/lp01-assembly-workspace.js');
const {paintOrderNoteRows,retainOrderNoteRows}=await import('../../src/modules/lp01-order-note-rows.js');
const host=document.querySelector('#sheet'),context={line:'PANELES_2',stage:'ENSAMBLE',date:'2026-11-07',shift:1};
const production=name=>({key:name+'|PANELES_2',oficial:{key_produccion:name+'|PANELES_2',id_linea:context.line,produccion:name,sistema:'TEST',reserva_al:'R-'+name,cantidad:20,saldo_ensamble:6,saldos_inicializados:true,presente_ultimo_export:true,anio:2026,semana_base:43,activa:'SI'},assignments:[]});
const data={contract:'LP-OPERACION-1',turn:{estado:'NO_ABIERTO',revision:0},orders:[],reports:[],catalog:{contract:'LP-HOJA-1',...context,productions:[production('ABIERTA'),production('OTRA')]}};
let token='synthetic-session',active=true,closed=0,reported=0,releaseFirst;
const commands=[],calls=[],stored={revision:0,observation:''},history=[],tick=()=>new Promise(resolve=>setTimeout(resolve,20));
const details=key=>({contract:'LP-ORDER-DETAILS-1',key,line:context.line,stage:context.stage,note:key==='ABIERTA|PANELES_2'?{...stored}:{revision:0,observation:''},history:key==='ABIERTA|PANELES_2'?structuredClone(history):[],capabilities:['READ','NOTE'],export:{quantity:'20',percentage:'0',present:true}});
const bridge={getToken:()=>token,getClient:async()=>({rpc:async(name,args)=>{
 calls.push({name,args:structuredClone(args)});
 if(name==='sgp_lp_order_details_read_v1')return {data:details(args.p_key),error:null};
 if(name==='sgp_lp_order_note_save_v1'){
  commands.push(structuredClone(args.p_cmd));const cmd=args.p_cmd;
  if(commands.length===1){stored.revision=cmd.revision+1;stored.observation=cmd.observation;history.push({id:cmd.id,revision:stored.revision,observation:stored.observation,stage:context.stage});await new Promise(resolve=>releaseFirst=resolve);return {data:null,error:{message:'Synthetic lost response after commit'}};}
  return {data:{contract:'LP-ORDER-NOTE-SAVED-1',key:args.p_key,id:cmd.id,revision:stored.revision,observation:stored.observation,duplicate:true},error:null};
 }
 return {data:null,error:{code:'PGRST202',message:'Synthetic unavailable independent source'}};
}})};
const workspace=mountAssemblyWorkspace({host,bridge,noteRows:{paintOrderNoteRows,retainOrderNoteRows},isCurrent:()=>active,onClose:()=>closed++,onReports:()=>reported++,onGlass:()=>{}}),checks=[];
try{
 workspace.update(data,context);await tick();
 const open=()=>host.querySelector('[data-note-order-key="ABIERTA|PANELES_2"] [data-order-note-open]');open().click();await tick();
 const dialog=host.querySelector('dialog'),input=dialog.querySelector('[data-order-note]'),save=dialog.querySelector('[data-order-note-save]');input.value='Borrador de Ensamble';input.oninput();assert.equal(workspace.canLeave(),false);
 workspace.update(structuredClone(data),context);assert.equal(host.querySelector('dialog'),dialog);assert.equal(input.value,'Borrador de Ensamble');
 const filter=value=>{const search=host.querySelector('[data-assembly-search]');search.value=value;search.dispatchEvent(new Event('input'));};
 filter('OTRA');assert(dialog.isConnected);assert(dialog.closest('[data-note-parked]'));assert.equal(input.value,'Borrador de Ensamble');assert.equal(workspace.canLeave(),false);
 filter('');open().click();assert.equal(host.querySelector('dialog'),dialog);assert.equal(input.value,'Borrador de Ensamble');
 checks.push('Actual compact editor and its dirty draft survive quiet refresh, filtering out and reopening');
 workspace.open('OTRA|PANELES_2');host.querySelector('[data-assembly-close]').click();host.querySelector('[data-assembly-reports]').click();assert.equal(workspace.editing,false);assert.equal(closed,0);assert.equal(reported,0);
 checks.push('Dirty compact draft blocks detail/close/reports navigation without silently discarding');
 const first=save.onclick();await tick();assert.equal(commands.length,1);assert.equal(workspace.canLeave(),false);dialog.querySelector('[data-order-note-cancel]').onclick();assert(dialog.isConnected);
 releaseFirst();await first;assert.match(save.textContent,/Reintentar/);assert.equal(workspace.canLeave(),false);filter('OTRA');filter('');open().click();assert.equal(host.querySelector('dialog'),dialog);
 await save.onclick();assert.equal(commands.length,2);assert.deepEqual(commands[0],commands[1]);assert.equal(history.length,1);assert.equal(stored.revision,1);assert.equal(workspace.canLeave(),true);assert.match(open().textContent,/Borrador de Ensamble/);
 checks.push('In-flight and uncertain saves cannot be abandoned; retry keeps exact UUID/payload and only one acknowledged revision');
 assert(calls.filter(call=>call.name.includes('save')).every(call=>call.args.p_token==='synthetic-session'&&call.args.p_stage==='ENSAMBLE'&&call.args.p_key==='ABIERTA|PANELES_2'));
 const writes=commands.length;token='different-session';workspace.clear();host.replaceChildren();active=false;await tick();assert.equal(commands.length,writes);assert.equal(host.querySelector('dialog'),null);
 checks.push('Session reset removes old editor; the only writes are the explicitly invoked synthetic note save/retry');
 const result={status:'PASS',type:'Actual local modules with synthetic DOM and RPC; not browser or production verification',checks,saveAttempts:commands.length,storedNoteRevisions:history.length};await writeFile(new URL('./compact-notes-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{releaseFirst?.();workspace.clear();host.replaceChildren();for(const timer of intervals)clear(timer);}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {acceptCloseReceipt,closeReadbackPending,mountExportCloseEditor} from '../src/modules/lp01-export-close-editor.js';
const context={stage:'ENSAMBLE',line:'PANELES_2',date:'2026-11-07',shift:1};
test('confirmed close survives report timeout; stale open data cannot mount another editor',()=>{
 const state={observation:'cierre de prueba'},result={ok:true,version:2};
 acceptCloseReceipt(state,result,context,'same-command');
 // A failed read does not change confirmed receipt or draft state.
 assert(closeReadbackPending(state,context));assert.equal(state.confirmedClose.result,result);
 assert.equal(mountExportCloseEditor({state,context,data:{turn:{estado:'ABIERTO'}},onClose(){},onImport(){}}),null);
 assert.equal(state.observation,'cierre de prueba');
 assert(!closeReadbackPending(state,{...context,shift:2}));
});
test('uncertain timeout is not a confirmed close; result receipt confirmation keeps original command',()=>{
 const state={uncertain:true,busy:false};assert(!closeReadbackPending(state,context));
 assert.throws(()=>acceptCloseReceipt(state,{ok:false},context,'command-1'));
 assert(!closeReadbackPending(state,context));
 acceptCloseReceipt(state,{ok:true},context,'command-1');
 assert.equal(state.confirmedClose.commandId,'command-1');assert.equal(state.uncertain,false);
 acceptCloseReceipt(state,{ok:true,duplicado:true},context,'command-1');
 assert.equal(state.confirmedClose.commandId,'command-1');assert(closeReadbackPending(state,context));
});
test('already-closed error blocks close pending authoritative read, without reopening',()=>{
 const state={closeCheckRequired:{...context}};assert(closeReadbackPending(state,context));assert.equal(state.confirmedClose,undefined);
});
test('controller confirms receipt before refresh, guards second close, and only reads after reopening-required error',()=>{
 const source=readFileSync(new URL('../src/modules/lp01-operation.js',import.meta.url),'utf8');
 assert(source.indexOf('acceptCloseReceipt(exportCloseState,result')<source.indexOf('const refreshed=await load()'));
 assert.match(source,/\['CERRAR','IMPORTAR_XLSX'\]\.includes\(op\)&&closeReadbackPending/);
 const handler=source.slice(source.indexOf("if(op==='CERRAR'&&String(e.message)"),source.indexOf("if(e.code&&e.code!=="));
 assert.match(handler,/closeCheckRequired/);assert.match(handler,/await load\(\)/);assert.doesNotMatch(handler,/send\(|sgp_lp_operacion_comando/);
 assert.match(source,/receipt\?\.committed\?receipt.result/);
});

function controllerHarness(mode){
 const source=readFileSync(new URL('../src/modules/lp01-operation.js',import.meta.url),'utf8');
 const functions=source.slice(source.indexOf(' async function send('),source.indexOf(' function renderReports('));
 return Function('acceptCloseReceipt','closeReadbackPending','mode',`
 let busy=false,loading=false,pending=null,session='fixture',exportCloseState={},bi=null,fileId=null;
 const context={stage:'ENSAMBLE',line:'PANELES_2',date:'2026-11-07',shift:1};
 const data={turn:{revision:2}},bridge={getToken:()=>session},message={textContent:''},calls=[];
 const get=()=>({hidden:false}),operation={querySelector:()=>null},renderDetail=()=>{};
 const load=async()=>false;
 const rpc=async(name,args)=>{calls.push({name,args});if(name==='sgp_lp_operacion_resultado')return {committed:true,result:{ok:true,version:2}};
 if(mode==='uncertain'){mode='ok';throw Object.assign(Error('network timeout'),{code:'FETCH_ERROR'});}
 if(mode==='closed')throw Object.assign(Error('REAPERTURA_REQUERIDA'),{code:'P0001'});
 return {ok:true,version:2};};
 ${functions}
 return {send,transmit,calls,state:()=>exportCloseState,pending:()=>pending};
 `)(acceptCloseReceipt,closeReadbackPending,mode);
}
test('actual controller: confirmed write plus refresh timeout cannot issue a second close',async()=>{
 const h=controllerHarness('ok');await h.send('CERRAR',{observation:'fixture'},null);
 assert.equal(h.calls.length,1);assert(h.state().confirmedClose);
 await assert.rejects(h.send('CERRAR',{observation:'fixture'},null),/ya está registrado/);
 assert.equal(h.calls.length,1);
});
test('actual controller: uncertain write retries receipt under same UUID without a duplicate close',async()=>{
 const h=controllerHarness('uncertain');await assert.rejects(h.send('CERRAR',{observation:'fixture'},null),/timeout/);
 const id=h.pending().cmd.id;assert.equal(h.state().confirmedClose,undefined);
 await h.transmit();assert.equal(h.calls.length,2);
 assert.equal(h.calls[0].name,'sgp_lp_operacion_comando');assert.equal(h.calls[0].args.p_cmd.id,id);
 assert.equal(h.calls[1].name,'sgp_lp_operacion_resultado');assert.equal(h.calls[1].args.p_id,id);
 assert.equal(h.state().confirmedClose.commandId,id);assert.equal(h.pending(),null);
});
test('actual controller: already closed error reads state and never reopens or repeats',async()=>{
 const h=controllerHarness('closed');await assert.rejects(h.send('CERRAR',{observation:'fixture'},null),/ya tiene cierre/);
 assert(h.state().closeCheckRequired);assert.equal(h.calls.length,1);
 await assert.rejects(h.send('CERRAR',{observation:'fixture'},null),/ya está registrado/);
 assert.equal(h.calls.length,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOptImport,prepareOptImport} from '../src/services/opt-import.js';
const scope={linea:'PANELES_2',anio:2026,semana:46,modo:'BASE'};
const file=(name,text)=>new File([text],name);
const input=()=>({scope:{...scope},source:{origin:'RETAIL',opt:'OPT-1',mode:'INDICE'},pdf:file('OPT-1.pdf','%PDF-1.7\nsynthetic'),index:{file:file('index.csv','OPT,Reserva,Sistema\nOPT-1,R,PANEL'),format:'csv',sheet:'ARCHIVOS'}});
function storage(){const values=new Map();return {get length(){return values.size;},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),values};}
async function receipt(body){
 const bytes=Uint8Array.from(atob(body.pdf.base64),c=>c.charCodeAt(0));const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
 return {contract:'OPT-IMPORT-1',ok:true,scope:body.scope,data:{contract_version:2,import_contract:'OPT-IMPORT-1',ok:true,physical_completion_verified:false,id_documento:'01234567-89ab-4cde-8fab-0123456789ab',duplicado:false,cantidad_piezas:3,sin_asignacion:1},document:{sha256:sha,source_key:body.source.mode==='INDICE'?`OPT:${encodeURIComponent(body.source.opt)}`:`SHA256:${sha}`,origin:body.source.origin,opt:body.source.opt,mode:body.source.mode},totals:{documentaryBars:1,documentaryCuts:3,cutLength32:96},scopeTotals:{assigned:2,outsideScope:1},physical_completion_verified:false};
}
test('original-only payload, exact files, strict receipt, public Edge gateway wiring',async()=>{
 const calls=[],store=storage(),api=createOptImport({invoke:async body=>{calls.push(body);return {data:await receipt(body)};}},()=> 'synthetic-session',{storage:store,storageScope:'alice'});
 const request=input();request.extraction={forged:true};request.bindings=[1];request.evidence='no';const result=await api.process(request);
 assert.equal(result.data.cantidad_piezas,3);assert.deepEqual(Object.keys(calls[0]).sort(),['index','p_token','pdf','scope','source']);assert.deepEqual(Object.keys(calls[0].index).sort(),['base64','format','name','sheet']);
 assert.equal(JSON.parse(store.getItem(store.key(0))).state,'confirmed');assert(!store.getItem(store.key(0)).includes('synthetic-session'));assert(!store.getItem(store.key(0)).includes('base64'));
 const host=readFileSync(new URL('../src/modules/opt-digital.js',import.meta.url),'utf8');assert.match(host,/functions\.invoke\('opt-import'/);assert.match(host,/lpPowerBiGatewayJwt/);assert(!/service_role/i.test(host));
 await assert.rejects(api.process({...input(),pdf:file('similar.pdf','%PDF')}),/NOMBRE_EXACTO/);assert.equal(calls.length,1);
});
test('missing index, wrong origin/scope, oversize or storage failure prevent all writes',async()=>{
 let calls=0;const api=createOptImport({invoke:async()=>calls++},()=> 't',{storage:storage(),storageScope:'a'});
 for(const request of [{...input(),index:null},{...input(),scope:{...scope,linea:'FRAMES_2'}},{...input(),source:{origin:'DESCONOCIDO',opt:'OPT-1',mode:'INDICE'}},{...input(),pdf:{name:'OPT-1.pdf',size:16*1024*1024+1,arrayBuffer:()=>assert.fail('too big')}}])await assert.rejects(api.process(request));
 const broken=createOptImport({invoke:async()=>calls++},()=> 't',{storage:{length:0,getItem:()=>null,setItem:()=>{throw Error('quota');}},storageScope:'a'});await assert.rejects(broken.process(input()),/DIARIO/);assert.equal(calls,0);
});
test('malformed/false/inconsistent successes are uncertain and replay identical',async()=>{
 for(const mutate of [r=>delete r.data,r=>r.ok=false,r=>r.data.id_documento='bad',r=>r.document.sha256='f'.repeat(64),r=>r.scope.semana=45,r=>r.scopeTotals.assigned++,r=>r.document.source_key='client-key',r=>r.data.physical_completion_verified=true]){
  const calls=[],store=storage();let bad=true;const api=createOptImport({invoke:async body=>{calls.push(structuredClone(body));const r=await receipt(body);if(bad)mutate(r);return {data:r};}},()=> 't',{storage:store,storageScope:'a'});
  await assert.rejects(api.process(input()),e=>e.uncertain===true);assert.equal(JSON.parse(store.getItem(store.key(0))).state,'pending');
  bad=false;await api.process(input());assert.deepEqual(calls[0],calls[1]);
 }
});
test('timeout keeps journal, late result is ignored, different source or index cannot replace pending identity',async()=>{
 const store=storage(),calls=[];let resolve;const api=createOptImport({invoke:body=>{calls.push(structuredClone(body));return new Promise(r=>resolve=r);}},()=> 't',{storage:store,storageScope:'a',timeoutMs:10});
 await assert.rejects(api.process(input()),e=>e.uncertain===true);const saved=store.getItem(store.key(0));resolve({data:await receipt(calls[0])});await new Promise(r=>setTimeout(r,10));assert.equal(store.getItem(store.key(0)),saved);
 for(const request of [{...input(),source:{origin:'PROYECTO',opt:'OPT-1',mode:'INDICE'}},{...input(),index:{...input().index,file:file('index.csv','changed')}},{...input(),scope:{...scope,semana:45}},{...input(),pdf:file('OPT-1.pdf','changed bytes')}])await assert.rejects(api.process(request),/REINTENTO_IDENTICO/);
 assert.equal(calls.length,1);
 const resumed=createOptImport({invoke:async body=>{calls.push(body);return {data:await receipt(body)};}},()=> 'new-session',{storage:store,storageScope:'a'});assert.equal(resumed.pending().length,1);await resumed.process(input());assert.equal(resumed.pending().length,0);assert.deepEqual({...calls[0],p_token:'new-session'},calls[1]);
});
test('session/filter invalidation does not claim a late write failed',async()=>{
 for(const change of ['session','scope','invalidate']){
  let token='t',context={...scope},resolve;const store=storage(),api=createOptImport({invoke:body=>new Promise(r=>resolve=async()=>r({data:await receipt(body)}))},()=>token,{storage:store,storageScope:'a',getContext:()=>context});
  const pending=api.process(input());while(!resolve)await new Promise(r=>setTimeout(r,1));if(change==='session')token='new';if(change==='scope')context.semana=45;if(change==='invalidate')api.invalidate();await resolve();await assert.rejects(pending,e=>e.uncertain===true);assert.equal(JSON.parse(store.getItem(store.key(0))).state,'pending');
 }
});
test('definitive errors clear only new attempts; prior uncertainty is retained',async()=>{
 let uncertain=false;const store=storage(),api=createOptImport({invoke:async()=>{if(uncertain)throw Error('network');return {error:{context:new Response(JSON.stringify({contract:'OPT-IMPORT-1',ok:false,code:'OPT_AMBIGUA',definitive:true,blockers:['source']}))}};}},()=> 't',{storage:store,storageScope:'a'});
 await assert.rejects(api.process(input()),e=>e.definitive===true&&e.blockers[0]==='source');assert.equal(JSON.parse(store.getItem(store.key(0))).state,'rejected');uncertain=true;await assert.rejects(api.process(input()),e=>e.uncertain===true);uncertain=false;await assert.rejects(api.process(input()),e=>e.uncertain===true);assert.equal(JSON.parse(store.getItem(store.key(0))).state,'pending');
});
test('individual derives canonical OPT on server without a client association or index',async()=>{
 const value={scope,source:{origin:'DESCONOCIDO',opt:'loose',mode:'INDIVIDUAL'},pdf:file('loose.pdf','%PDF')};const api=createOptImport({invoke:async body=>{assert(!body.index);const r=await receipt(body);r.document.opt='CANONICAL';return {data:r};}},()=> 't',{storage:storage(),storageScope:'a'});assert.equal((await api.process(value)).document.opt,'CANONICAL');
 const prepared=await prepareOptImport(value);assert.deepEqual(Object.keys(prepared.body).sort(),['pdf','scope','source']);
});

test('bounded PDF/index limits reject before reading or invoking the server',async()=>{
 let calls=0;const api=createOptImport({invoke:async()=>calls++},()=> 't',{storage:storage(),storageScope:'bounded'});
 const tooBig=name=>({name,size:1048577,arrayBuffer:()=>assert.fail('oversized file must not be read')});
 await assert.rejects(api.process({...input(),pdf:tooBig('OPT-1.pdf')}),/1 MiB/);
 await assert.rejects(api.process({...input(),index:{...input().index,file:tooBig('index.csv')}}),/ORIGINAL_INVALIDO/);
 assert.equal(calls,0);
});

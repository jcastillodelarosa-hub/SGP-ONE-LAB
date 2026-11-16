import test from 'node:test';import assert from 'node:assert/strict';import {createOptImportObservation,optImportOutcomeKind as kind} from '../src/services/opt-import-observation.js';
const identity={scope:{linea:'PANELES_2',anio:2026,semana:46,modo:'BASE'},source:{origin:'RETAIL',opt:'OPT2026-46-5-PLI-1',mode:'INDICE'},pdf:{name:'OPT2026-46-5-PLI-1.pdf',sha256:'a'.repeat(64)},index:{name:'SYNTH.xlsx',sha256:'b'.repeat(64),format:'xlsx',sheet:'ARCHIVOS'}};
const response=(request,status)=>({data:{contract:'OPT-IMPORT-OBSERVATION-1',identity:request,status,retryAuthorized:false,pdfArchived:false}});
test('observes exact identity only; no PDF bytes, writer or journal clearing; absence never permits retry',async()=>{
 for(const status of ['COMMITTED_MATCH','NOT_OBSERVED','EVIDENCE_MISMATCH']){
  let calls=0;const api=createOptImportObservation({rpc:async(name,args)=>{calls++;assert.equal(name,'sgp_opt_import_observacion_v1');assert.deepEqual(Object.keys(args).sort(),['p_identity','p_token']);assert.deepEqual(args.p_identity,identity);return response(args.p_identity,status);}},()=> 'synthetic');
  const out=await api.observe(identity);assert.equal(out.status,status);assert.equal(out.retryAuthorized,false);assert.equal(calls,1);
 }
});
test('rejects session/scope races, wrong identity and retry grants',async()=>{
 for(const change of ['session','scope','identity','retry']){
  let token='synthetic',scope=structuredClone(identity.scope);
  const api=createOptImportObservation({rpc:async()=>{const r=response(structuredClone(identity),'COMMITTED_MATCH');if(change==='session')token='other';if(change==='scope')scope.semana++;if(change==='identity')r.data.identity.index.sha256='c'.repeat(64);if(change==='retry')r.data.retryAuthorized=true;return r;}},()=>token,{getContext:()=>scope});
  await assert.rejects(api.observe(identity));
 }
});
test('uncertainty remains distinct from discarded names, missing programming and failed attempts',()=>{
 assert.equal(kind({previousPending:true,selectionReason:'EXACT_NAME_MISSING'}),'PREVIOUS_UNCERTAINTY');assert.equal(kind({error:{uncertain:true}}),'UNCERTAIN');
 for(const [selectionReason,expected] of [['EXACT_NAME_MISSING','INDEX_EXCLUDED'],['OUTSIDE_PROGRAMMING','PROGRAMMING_OMITTED'],['DUPLICATE_NAME','DUPLICATE_BLOCKED']])assert.equal(kind({selectionReason}),expected);assert.equal(kind({error:{definitive:true}}),'DEFINITIVE_REJECTION');
 assert.equal(kind({error:Error('denied')}),'FAILED');assert.equal(kind({receiptValidated:true}),'CONFIRMED');assert.equal(kind(),'NOT_SENT');assert.equal(kind({journalUnavailable:true}),'JOURNAL_UNAVAILABLE');
});

import {createOptImport} from '../src/services/opt-import.js';
async function fixture(status,mutate){
 const requestHash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(identity)))).toString('hex'),key='sgp-opt-import-v1:synthetic:'+requestHash;
 const entry={version:1,state:'pending',requestHash,identity},values=new Map([[key,JSON.stringify(entry)]]),storage={get length(){return values.size;},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 let token='synthetic';const api=createOptImport({invoke:()=>assert.fail('No import allowed')},()=>token,{storage,storageScope:'synthetic',observationApi:{observe:async request=>{mutate?.({setToken:t=>token=t,values,key});return response(request,status).data;}}});
 return {api,values,key,raw:values.get(key),entry};
}
test('positive exact observation confirms historical entry without resend or deleting identity; absence remains pending',async()=>{
 for(const status of ['COMMITTED_MATCH','NOT_OBSERVED','EVIDENCE_MISMATCH']){
  const f=await fixture(status);await f.api.reconcilePending(identity);const saved=JSON.parse(f.values.get(f.key));assert.deepEqual(saved.identity,identity);assert.equal(saved.requestHash,f.entry.requestHash);
  if(status==='COMMITTED_MATCH'){assert.equal(saved.state,'confirmed');assert.equal(saved.reconciliation.previousState,'pending');assert.equal(f.api.pending().length,0);}else{assert.equal(f.values.get(f.key),f.raw);assert.equal(f.api.pending().length,1);}
 }
});
test('stale session and changed journal never settle pending history',async()=>{
 const f=await fixture('COMMITTED_MATCH',({setToken})=>setToken('other'));await assert.rejects(f.api.reconcilePending(identity),/OBSOLETA/);assert.equal(f.values.get(f.key),f.raw);
 const g=await fixture('COMMITTED_MATCH',({values,key})=>values.set(key,values.get(key)+' '));await assert.rejects(g.api.reconcilePending(identity),/DIARIO_CAMBIO/);assert.equal(g.api.pending().length,1);
});

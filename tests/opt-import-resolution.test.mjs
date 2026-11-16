import test from 'node:test';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';
import {createOptImport,prepareOptImport} from '../src/services/opt-import.js';
import {validateOptResolution,createOptImportResolution} from '../src/services/opt-import-resolution.js';
import {validateRetailResolution} from '../src/server/opt-retail-resolution.js';
globalThis.crypto??=webcrypto;
const scope={linea:'PANELES_2',anio:2026,semana:46,modo:'BASE'},source={origin:'RETAIL',mode:'INDICE',opt:'OPT2026-46-4-PINI-213'};
const file=(name,text)=>({name,size:Buffer.byteLength(text),arrayBuffer:async()=>new TextEncoder().encode(text).buffer});
const input={scope,source,pdf:file(source.opt+'.pdf','%PDF-synthetic'),index:{file:file('index.csv','synthetic'),format:'csv',sheet:'ARCHIVOS'}};
const storage=()=>{const m=new Map();return {get length(){return m.size},key:n=>[...m.keys()][n],getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}};
const cert=p=>({contract:'OPT-IMPORT-RESOLUTION-1',status:'ABSENT_FINAL',proofKind:'DURABLE_FENCE',retryMode:'MANUAL_EXACT_ONLY',pdfArchived:false,identity:p.identity,requestHash:p.requestHash,evidenceSha256:'a'.repeat(64),decisionId:crypto.randomUUID(),retryGeneration:crypto.randomUUID(),issuedAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+60000).toISOString()});
async function setup(){const p=await prepareOptImport(input),s=storage(),key='sgp-opt-import-v1:actor:'+p.requestHash;const original={version:1,state:'pending',identity:p.identity,requestHash:p.requestHash};s.setItem(key,JSON.stringify(original));return {p,s,key,original};}
test('export whitelists identity; absence does not resend; explicit retry preserves history and UUID',async()=>{
 const {p,s,key,original}=await setup(),c=cert(p),calls=[];const api=createOptImport({invoke:async b=>{calls.push(b);throw Error('lost receipt');}},()=> 'private-token',{getContext:()=>scope,storage:s,storageScope:'actor',resolutionApi:{resolve:async()=>c}});
 const exported=await api.exportPendingIdentities();assert.equal(exported.items[0].requestHash,p.requestHash);assert.equal(JSON.stringify(exported).includes('private-token'),false);assert.equal(JSON.stringify(exported).includes('base64'),false);
 await assert.rejects(api.process(input),/RESOLUTION_REQUERIDA/);assert.equal(s.getItem(key),JSON.stringify(original));
 await api.resolvePending(p.identity);assert.equal(calls.length,0);assert.deepEqual(JSON.parse(s.getItem(key)).history[0].entry,original);
 await assert.rejects(api.retryResolved(input));await assert.rejects(api.retryResolved(input));assert.equal(calls.length,2);assert.equal(calls[0].resolution.attemptId,calls[1].resolution.attemptId);
 assert.equal(JSON.parse(s.getItem(key)).state,'pending');await assert.rejects(api.process(input),/RESOLUTION_REQUERIDA/);
 await assert.rejects(api.retryResolved({...input,pdf:file(source.opt+'.pdf','%PDF-different')}),/IDENTICO/);assert.equal(calls.length,2);
});
test('invalid identity and stale session never export or archive',async()=>{
 const {p,s,key,original}=await setup();let token='token';const api=createOptImport({},()=>token,{getContext:()=>scope,storage:s,storageScope:'actor',resolutionApi:{resolve:async()=>{token='different';return cert(p)}}});await assert.rejects(api.resolvePending(p.identity),/OBSOLETA/);assert.equal(s.getItem(key),JSON.stringify(original));
 s.setItem(key,JSON.stringify({...original,identity:{...p.identity,token:'secret'}}));await assert.rejects(api.exportPendingIdentities(),/IDENTIDAD/);
});
test('certificate fails closed for absence, expiry, identity or RPC failure',async()=>{
 const {p}=await setup(),c=cert(p);for(const patch of [{status:'NOT_OBSERVED'},{expiresAt:new Date(0).toISOString()},{retryMode:'AUTO'},{identity:{}}])assert.throws(()=>validateOptResolution({...c,...patch},p.identity,p.requestHash));
 const api=createOptImportResolution({rpc:async()=>({error:{message:'absent'}})},()=> 'token',{getContext:()=>scope});await assert.rejects(api.resolve(p.identity,p.requestHash),/UNAVAILABLE/);
});
test('Edge binds resolution to original byte hashes, scope and exact envelope',async()=>{
 const p=await prepareOptImport(input),c=cert(p),r={identity:p.identity,requestHash:p.requestHash,decisionId:c.decisionId,retryGeneration:c.retryGeneration,attemptId:crypto.randomUUID()},body={...p.body,resolution:r},hashes={pdfHash:p.identity.pdf.sha256,indexHash:p.identity.index.sha256,indexSheet:null};
 assert.equal(await validateRetailResolution(body,hashes),r);
 for(const bad of [{...hashes,pdfHash:'f'.repeat(64)},{...hashes,indexHash:'f'.repeat(64)}])await assert.rejects(validateRetailResolution(body,bad),/IDENTITY/);
 await assert.rejects(validateRetailResolution({...body,resolution:{...r,token:'x'}},hashes),/IDENTITY/);
 await assert.rejects(validateRetailResolution({...body,scope:{...scope,semana:47}},hashes),/IDENTITY/);
});

test('unverified backend keeps certified retry disabled without changing the journal',async()=>{
 const {p,s,key,original}=await setup();let sends=0;
 const api=createOptImport({invoke:async()=>{sends++;}},()=> 'token',{storage:s,storageScope:'actor',getContext:()=>scope});
 assert.equal(api.canResolveImports,false);
 assert.equal((await api.exportPendingIdentities()).items.length,1);
 await assert.rejects(api.resolvePending(p.identity),/UNAVAILABLE/);
 await assert.rejects(api.retryResolved(input),/OPT_RECUPERACION_PAUSADA/);
 assert.equal(sends,0);assert.equal(s.getItem(key),JSON.stringify(original));
});

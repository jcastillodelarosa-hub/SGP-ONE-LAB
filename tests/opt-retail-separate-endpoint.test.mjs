import test from 'node:test';import assert from 'node:assert/strict';
import {optImportEndpoint} from '../src/domain/opt-import-endpoint.js';
import {createOptImportHandler} from '../src/server/opt-import-handler.js';
import {body} from './opt-digital/import-fixtures.mjs';
test('candidate routing isolates Retail index; rollback pauses Retail only; no fallback',()=>{
 const retail={origin:'RETAIL',mode:'INDICE'};
 assert.equal(optImportEndpoint(retail),'opt-import');assert.equal(optImportEndpoint(retail,{retailMode:'candidate'}),'opt-retail-import-v3');
 for(const mode of ['paused','unknown'])assert.equal(optImportEndpoint(retail,{retailMode:mode}),null);
 for(const source of [{origin:'PROYECTO',mode:'INDICE'},{origin:'RETAIL',mode:'INDIVIDUAL'},{origin:'DESCONOCIDO',mode:'INDIVIDUAL'}])assert.equal(optImportEndpoint(source,{retailMode:'candidate'}),'opt-import');
});
test('separate server rejects other origins/modes before RPC or PDF and ignores no permissions',async()=>{
 let calls=0;const handler=createOptImportHandler({retailV3:true,retailOnly:true,rpc:async()=>{calls++;throw Error('Unexpected RPC');},readPdf:async()=>{calls++;throw Error('Unexpected parse');},allowedOrigins:['https://offline.invalid']});
 for(const source of [{origin:'PROYECTO',mode:'INDICE'},{origin:'RETAIL',mode:'INDIVIDUAL'}]){
 const input=body();input.source={...input.source,...source};if(source.mode==='INDIVIDUAL')delete input.index;
 const response=await handler(new Request('https://offline.invalid',{method:'POST',headers:{origin:'https://offline.invalid','content-type':'application/json'},body:JSON.stringify(input)}));assert.equal(response.status,422);assert.equal((await response.json()).code,'OPT_RETAIL_ONLY');
 }assert.equal(calls,0);
});

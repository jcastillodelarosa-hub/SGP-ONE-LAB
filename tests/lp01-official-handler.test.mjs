import test from 'node:test';
import assert from 'node:assert/strict';
import {createPowerBIHandler} from '../src/server/lp-powerbi-handler.js';
import {OFFICIAL_POWERBI_VERSION} from '../src/domain/powerbi/adapter.js';
const body={adapter:OFFICIAL_POWERBI_VERSION,p_token:'QA',command:{action:'CLOSE'},observation:'QA'};
const request=b=>new Request('https://qa.invalid/powerbi',{method:'POST',headers:{'content-type':'application/json',origin:'https://qa.invalid'},body:JSON.stringify(b)});
test('same Power BI endpoint keeps official contract disabled unless server explicitly wires it',async()=>{
 let calls=0;const handler=createPowerBIHandler({allowedOrigins:['https://qa.invalid'],rpc:async()=>{calls++;}});
 const r=await handler(request(body));assert.equal(r.status,422);assert.match((await r.json()).error,/habilitación/);assert.equal(calls,0);
});
test('official route delegates only file/command input, never catalog/actor/plan from client',async()=>{
 const seen=[];const handler=createPowerBIHandler({allowedOrigins:['https://qa.invalid'],rpc:async()=>{throw Error('V1 must not run');},officialService:{run:async a=>{seen.push(a);return {contract:'LP-OFFICIAL-COMMITTED-1'};}}});
 assert.equal((await handler(request(body))).status,200);assert.equal(seen[0].observation,'QA');
 for(const extra of [{catalog:[]},{actor:'forged'},{plan:{}},{base64:'AAAA'},{filename:'bad.xlsx'}])assert.equal((await handler(request({...body,...extra}))).status,422);
 assert.equal(seen.length,1);
 assert.equal((await handler(request({...body,command:{action:'IMPORT'},filename:'qa.xlsx',base64:'AQID'}))).status,200);
 assert.deepEqual([...seen[1].bytes],[1,2,3]);
});
test('uncertain commit remains retryable with same command instead of claiming input rejection',async()=>{
 const handler=createPowerBIHandler({allowedOrigins:['https://qa.invalid'],officialService:{run:async()=>{throw Object.assign(Error('No receipt'),{code:'OFFICIAL_COMMIT_UNCERTAIN'});}}});
 const r=await handler(request(body));assert.equal(r.status,503);assert.equal((await r.json()).code,'OFFICIAL_COMMIT_UNCERTAIN');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {powerBIOrigins} from '../src/server/lp-powerbi-origins.js';
import {createPowerBIHandler} from '../src/server/lp-powerbi-handler.js';
test('LAB runtime permits only exact Hosting origins by default, without secret configuration',()=>{
 assert.deepEqual(powerBIOrigins(),['https://sgp-one-lab.web.app','https://sgp-one-lab.firebaseapp.com']);
 assert.deepEqual(powerBIOrigins('https://example.test, https://example.test'),['https://example.test']);
 for(const value of ['', '*','http://example.test','https://example.test/','https://user:pass@example.test','https://example.test/path','https://example.test,'])assert.throws(()=>powerBIOrigins(value));
});
test('real HTTP boundary accepts Hosting preflight and rejects foreign origins before RPC',async()=>{
 const handler=createPowerBIHandler({allowedOrigins:powerBIOrigins(),rpc(){throw Error('RPC must not run in CORS check');}});
 for(const origin of powerBIOrigins()){
  const response=await handler(new Request('https://backend.test',{method:'OPTIONS',headers:{origin}}));
  assert.equal(response.status,204);assert.equal(response.headers.get('access-control-allow-origin'),origin);
 }
 for(const origin of ['https://sgp-one-lab.web.app.attacker.test','https://attacker.test','null']){
  const response=await handler(new Request('https://backend.test',{method:'POST',headers:{origin}}));
  assert.equal(response.status,403);assert.equal(response.headers.get('access-control-allow-origin'),null);
 }
});

import test from 'node:test';import assert from 'node:assert/strict';
import {retiredRetail} from '../docs/opt-import-endpoint/release-review/retirement/handler.mjs';
test('retired endpoint rejects current attempt without reading originals or returning a receipt',async()=>{
 for(const method of ['POST','GET','DELETE']){
  const request=new Request('https://synthetic.invalid',{method,...(method==='POST'?{body:'untrusted original'}:{})});
  const response=retiredRetail(request),result=await response.json();
  assert.equal(request.bodyUsed,false);assert.equal(response.status,503);
  assert.equal(result.definitive,true);assert.equal(result.code,'OPT_RETAIL_PAUSADO');assert.equal(result.ok,false);assert.equal(result.data,undefined);
  assert.match(result.error,/anterior pendiente/);
 }
});
test('retirement permits preflight without invoking the writer',()=>{
 const response=retiredRetail(new Request('https://synthetic.invalid',{method:'OPTIONS'}));
 assert.equal(response.status,204);assert.equal(response.headers.get('cache-control'),'no-store');
});

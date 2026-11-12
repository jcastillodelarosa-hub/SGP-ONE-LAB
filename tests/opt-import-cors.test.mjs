import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {createOptImportHandler} from '../src/server/opt-import-handler.js';
const origin='https://sgp-one-lab.web.app';
test('CORS preflight permits every header emitted by the actual Supabase Functions client',async()=>{
 let outgoing;
 const client=createClient('https://example.supabase.co','public-test-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,options)=>{outgoing=new Headers(options.headers);return new Response('{}',{status:200,headers:{'content-type':'application/json'}});}}});
 await client.functions.invoke('opt-import',{body:{fixture:true},headers:{Authorization:'Bearer synthetic'}});
 assert(outgoing.has('x-client-info'));
 const handler=createOptImportHandler({rpc:async()=>{throw Error('must not run');},readPdf:async()=>{throw Error('must not run');},allowedOrigins:[origin]});
 const response=await handler(new Request('https://example.invalid',{method:'OPTIONS',headers:{origin,'access-control-request-method':'POST','access-control-request-headers':[...outgoing.keys()].join(',')}}));
 assert.equal(response.status,204);assert.equal(response.headers.get('access-control-allow-origin'),origin);
 const allowed=response.headers.get('access-control-allow-headers').toLowerCase().split(',').map(v=>v.trim());
 for(const key of outgoing.keys()) assert(allowed.includes(key),`CORS denies SDK header ${key}`);
 const hostile=await handler(new Request('https://example.invalid',{method:'OPTIONS',headers:{origin:'https://hostile.invalid'}}));
 assert.equal(hostile.status,403);assert.equal(hostile.headers.get('access-control-allow-origin'),null);
});

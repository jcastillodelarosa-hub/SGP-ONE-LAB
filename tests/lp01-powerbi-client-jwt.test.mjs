import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {importPowerBI} from '../src/modules/lp01-powerbi-client.js';
import {createPowerBIHandler} from '../src/server/lp-powerbi-handler.js';
const ref='ocvxbwzqxbrfndkvjmfx',url='https://'+ref+'.supabase.co';
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
// Synthetic request-shape fixture only: not a platform-signed JWT/authentication test.
const jwt=(claims={},header={alg:'HS256',typ:'JWT'})=>encode(header)+'.'+encode({role:'anon',ref,exp:Math.floor(Date.now()/1000)+3600,...claims})+'.qa_signature_not_verified';
const body={token:'QA_SGP_SESSION',command:{stage:'ENSAMBLE'},filename:'qa.xlsx',base64:'AAAA'};
test('public configuration contains only an anon JWT for the correct project',()=>{
 const value=readFileSync('config.js','utf8').match(/lpPowerBiGatewayJwt: "([^"]+)"/)?.[1];
 assert.ok(value);const claims=JSON.parse(Buffer.from(value.split('.')[1],'base64url'));
 assert.equal(claims.role,'anon');assert.equal(claims.ref,ref);assert.ok(claims.exp*1000>Date.now());
 assert.match(readFileSync('supabase/config.toml','utf8'),/verify_jwt\s*=\s*true/);
});
test('client sends public gateway JWT and SGP session separately; transport fixture certifies no save',async()=>{
 const oldWindow=globalThis.window,oldFetch=globalThis.fetch,publicJwt=jwt();let call;
 try{
  globalThis.window={SGP_CONFIG:{supabaseUrl:url,supabasePublishableKey:'sb_publishable_QA',lpPowerBiGatewayJwt:publicJwt}};
  globalThis.fetch=async(target,options)=>{call={target,options};return new Response(JSON.stringify({data:{transportFixture:true}}),{status:200});};
  assert.deepEqual(await importPowerBI(body),{transportFixture:true});
  assert.equal(call.target,url+'/functions/v1/lp-powerbi');
  assert.equal(call.options.headers.Authorization,'Bearer '+publicJwt);
  assert.equal(call.options.headers.apikey,'sb_publishable_QA');
  assert.equal(JSON.parse(call.options.body).p_token,body.token);
  assert.ok(!call.options.headers.Authorization.includes(body.token));
 }finally{globalThis.window=oldWindow;globalThis.fetch=oldFetch;}
});
test('missing, elevated, foreign or expired JWT configuration blocks file transmission',async()=>{
 const oldWindow=globalThis.window,oldFetch=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;throw Error('Must not transmit');};
  for(const value of [undefined,'bad',jwt({role:'service_role'}),jwt({role:'authenticated'}),jwt({ref:'other'}),jwt({exp:1}),jwt({exp:'2036'}),jwt({},{alg:'none'})]){
   globalThis.window={SGP_CONFIG:{supabaseUrl:url,lpPowerBiGatewayJwt:value}};
   await assert.rejects(()=>importPowerBI(body),/JWT público/);
  }
  assert.equal(calls,0);
 }finally{globalThis.window=oldWindow;globalThis.fetch=oldFetch;}
});
test('gateway rejection remains an error, never a successful import',async()=>{
 const oldWindow=globalThis.window,oldFetch=globalThis.fetch;
 try{
  globalThis.window={SGP_CONFIG:{supabaseUrl:url,lpPowerBiGatewayJwt:jwt()}};
  globalThis.fetch=async()=>new Response(JSON.stringify({message:'Invalid JWT'}),{status:401});
  await assert.rejects(()=>importPowerBI(body),error=>error.code==='PBI_REJECTED');
 }finally{globalThis.window=oldWindow;globalThis.fetch=oldFetch;}
});
test('handler distinguishes an unavailable session RPC from an invalid session; transport fixtures only',async()=>{
 const data={p_token:'QA_INVALID_SESSION',filename:'qa.xlsx',base64:'AAAA',command:{id:'00000000-0000-4000-8000-000000000001',stage:'ENSAMBLE',line:'PANELES_2',date:'2026-11-03',shift:1,revision:0}};
 for(const [answer,status,code] of [[{data:null,error:{message:'QA transport unavailable'}},503,'SGP_SESSION_UNAVAILABLE'],[{data:{valida:false},error:null},401,'SGP_SESSION_INVALID']]){
  let calls=0;const handler=createPowerBIHandler({allowedOrigins:[],rpc:async name=>{calls++;assert.equal(name,'sgp_sesion_actual');return answer;}});
  const response=await handler(new Request('https://backend.test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}));
  assert.equal(response.status,status);assert.equal((await response.json()).code,code);assert.equal(calls,1);
 }
});

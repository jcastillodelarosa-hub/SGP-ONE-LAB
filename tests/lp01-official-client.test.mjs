import test from 'node:test';
import assert from 'node:assert/strict';
import {submitOfficialClose} from '../src/modules/lp01-powerbi-client.js';
import {createPowerBIHandler} from '../src/server/lp-powerbi-handler.js';
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const command={id:'00000000-0000-4000-8000-000000000001',action:'CLOSE',stage:'ENSAMBLE',line:'PANELES_2',date:'2026-11-03',shift:1,revision:0};
const input={token:'QA',command,observation:'Cierre de prueba'};
const receipt={ok:true,contract:'LP-OFFICIAL-COMMITTED-1',id:command.id,revision:1};
async function browser(fetcher,run){
 const previous={window:globalThis.window,fetch:globalThis.fetch};
 globalThis.window={SGP_CONFIG:{supabaseUrl:'https://qa.supabase.co',lpPowerBiGatewayJwt:encode({alg:'HS256'})+'.'+encode({role:'anon',ref:'qa',exp:Math.floor(Date.now()/1000)+3600})+'.synthetic'}};
 globalThis.fetch=fetcher;
 try{await run();}finally{Object.assign(globalThis,previous);}
}
test('official browser request uses existing endpoint and explicit adapter; server-disabled stays rejected',async()=>{
 const handler=createPowerBIHandler({allowedOrigins:[]});
 await browser((url,options)=>handler(new Request(url,options)),async()=>{
  await assert.rejects(()=>submitOfficialClose(input),e=>e.code==='PBI_INPUT_INVALID');
 });
});
test('official browser confirms matching receipt and preserves exact request for retry',async()=>{
 const sent=[];let calls=0;
 await browser(async(url,options)=>{
  sent.push(JSON.parse(options.body));
  if(calls++===0)throw Error('connection lost after commit');
  return Response.json({data:receipt});
 },async()=>{
  await assert.rejects(()=>submitOfficialClose(input),e=>e.code==='OFFICIAL_COMMIT_UNCERTAIN');
  assert.deepEqual(await submitOfficialClose(input),receipt);
 });
 assert.deepEqual(sent[0],sent[1]);assert.equal(sent[0].adapter,'LP-PBI-XLSX-2');
 assert.equal(sent[0].p_token,'QA');assert.equal(sent[0].base64,undefined);
});
test('malformed, foreign or missing receipts and server failures cannot confirm a save',async()=>{
 for(const response of [()=>new Response('bad'),()=>Response.json(null),()=>Response.json({data:{...receipt,id:'another'}}),()=>Response.json({data:{...receipt,revision:2}}),()=>Response.json({data:{...receipt,ok:false}}),()=>Response.json({error:'uncertain'},{status:503})]){
  await browser(async()=>response(),async()=>assert.rejects(()=>submitOfficialClose(input),e=>e.code==='OFFICIAL_COMMIT_UNCERTAIN'));
 }
});
test('official upload forwards original bytes without browser catalog or plan',async()=>{
 let payload;
 await browser(async(url,options)=>{payload=JSON.parse(options.body);return Response.json({data:receipt});},async()=>{
  await submitOfficialClose({...input,command:{...command,action:'IMPORT'},filename:'qa.xlsx',base64:'AQID',catalog:['forged'],plan:['forged']});
 });
 assert.equal(payload.base64,'AQID');assert.equal(payload.filename,'qa.xlsx');assert.equal(payload.catalog,undefined);assert.equal(payload.plan,undefined);
});

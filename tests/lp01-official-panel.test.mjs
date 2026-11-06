import test from 'node:test';
import assert from 'node:assert/strict';
import {officialCloseController} from '../src/modules/lp01-official-close-panel.js';
import {officialCloseService} from '../src/server/lp-official-close-service.js';
import {emptyOfficialClose} from '../src/domain/lp01-official-close.js';
const context={stage:'ENSAMBLE',line:'PANELES_2',date:'2026-11-03',shift:1};
test('panel retains exact uncertain upload across remount and separates sessions',async()=>{
 let token='A',requests=[];const controller=officialCloseController({getToken:()=>token,submit:async r=>{requests.push(structuredClone(r));if(requests.length===1)throw Object.assign(Error('lost'),{code:'OFFICIAL_COMMIT_UNCERTAIN'});return {ok:true};}});
 await assert.rejects(()=>controller.save(context,3,{action:'IMPORT',filename:'qa.xlsx',base64:'AQID'}));assert.equal(controller.pending(context),true);
 token='B';assert.equal(controller.pending(context),false);token='A';
 await controller.save(context,99,{action:'CLOSE',observation:'must not replace uncertain request'});
 assert.deepEqual(requests[0],requests[1]);assert.equal(controller.pending(context),false);
});
test('confirmed rejection releases pending command for corrected input',async()=>{
 const controller=officialCloseController({getToken:()=> 'A',submit:async()=>{throw Object.assign(Error('rejected'),{code:'PBI_INPUT_INVALID'});}});
 await assert.rejects(()=>controller.save(context,0,{action:'CLOSE',observation:'QA'}));assert.equal(controller.pending(context),false);
});
test('official read uses authenticated existing context without commit or client-supplied data',async()=>{
 let calls=[];const state=emptyOfficialClose();state.receipts=[{signature:'server-only'}];
 const service=officialCloseService({rpc:async(name,args)=>{calls.push(name);return {data:{contract:'LP-OFFICIAL-CONTEXT-1',state,plan:{revision:'QA',rows:[]},schedule:{timezone:'America/Bogota'}}};}});
 const result=await service.run({token:'QA',command:{...context,id:'00000000-0000-4000-8000-000000000001',action:'READ',revision:0}});
 assert.deepEqual(calls,['sgp_lp_official_read_v1']);assert.equal(result.contract,'LP-OFFICIAL-VIEW-1');assert.deepEqual(result.state.receipts,[]);assert.equal(state.receipts.length,1);
});

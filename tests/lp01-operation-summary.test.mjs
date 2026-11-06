import test from 'node:test';
import assert from 'node:assert/strict';
import {readOperationSummary} from '../src/services/lp01-operation-summary.js';
for(const stage of ['ENSAMBLE','EMPAQUE']){
 const scope={key:'QA|PANELES_2',line:'PANELES_2',stage};
 const native={...scope,contract:'LP-AFFECTATIONS-2',revision:0,reports:[{id:'old',originStage:stage,cause:'NC_V',quantity:8,solved:0,confirmed:0}],events:[],capabilities:[],available:null};
 const shared={...scope,contract:'LP-SHARED-ORDER-1',revision:0,canReport:false,reports:[{id:'new',key:scope.key,origin_stage:stage==='ENSAMBLE'?'EMPAQUE':'ENSAMBLE',cause:'NC_V',quantity:3,solved:0,confirmed:0}],history:[],legacyReports:[],accessories:[]};
 const read=(answer)=>readOperationSummary({...scope,getToken:()=> 'QA',client:{rpc:async(name)=>name==='sgp_lp_afectaciones_consultar_v2'?{data:native}:{...answer}}});
 test(stage+' uses canonical shared summary including other leader reports',async()=>{
  const s=await read({data:shared});assert.equal(s.categories.NC_V,3);assert.equal(s.total,null);assert.equal(s.available,null);
 });
 test(stage+' unavailable shared contract preserves labeled legacy and never turns unknown into zero',async()=>{
  const s=await read({error:{code:'PGRST202',message:'missing function'}});assert.equal(s.sharedUnavailable,true);assert.equal(s.categories.NC_V,8);assert.equal(s.categories.NC_AL,null);assert.equal(s.total,null);
 });
 test(stage+' revoked and incompatible shared scopes cannot fall back to legacy',async()=>{
  await assert.rejects(()=>read({error:{code:'P0001',message:'NO_AUTORIZADO'}}),/NO_AUTORIZADO/);
  await assert.rejects(()=>read({data:{...shared,key:'foreign'}}),/CONTRACT_INVALID/);
 });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {officialCloseBinding} from '../src/server/lp-official-binding.js';
test('deployment binding defaults to disabled and explicit enablement uses only official reader',async()=>{
 let calls=[];const rpc=async(name)=>{calls.push(name);return {data:{contract:'LP-OFFICIAL-CONTEXT-1',state:{revision:0,definitions:[]},plan:{revision:'QA',rows:[]}}};};
 for(const enabled of [undefined,false,'true'])assert.equal(officialCloseBinding({enabled,rpc}),null);
 const service=officialCloseBinding({enabled:true,rpc});
 await service.run({token:'QA',command:{id:'00000000-0000-4000-8000-000000000001',action:'READ',stage:'ENSAMBLE',line:'PANELES_2',date:'2026-11-03',shift:1,revision:0}});
 assert.deepEqual(calls,['sgp_lp_official_read_v1']);
});

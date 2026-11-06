import test from 'node:test';
import assert from 'node:assert/strict';
import {openDueOfficialTurns} from '../src/server/lp-official-turn-runner.js';
test('runner passes only approved scopes and identity; schedule is derived by server',async()=>{
 const calls=[];const result=await openDueOfficialTurns({token:'QA',scopes:[{stage:'ENSAMBLE',line:'PANELES_2'},{stage:'EMPAQUE',line:'PANELES_2'}],rpc:async(name,args)=>{calls.push({name,args});return args.p_stage==='ENSAMBLE'?{data:{status:'OPENED'}}:{error:{message:'TURNO_PREVIO_PENDIENTE'}};}});
 assert.deepEqual(calls[0],{name:'sgp_lp_official_open_due_v1',args:{p_token:'QA',p_stage:'ENSAMBLE',p_line:'PANELES_2'}});assert.equal(result[1].status,'BLOCKED');
});
test('invalid batch fails before opening any scope',async()=>{
 let calls=0;await assert.rejects(()=>openDueOfficialTurns({token:'QA',scopes:[{stage:'ENSAMBLE',line:'PANELES_2'},{stage:'INVALID',line:'PANELES_2'}],rpc:async()=>{calls++;}}),/SCOPE_INVALID/);assert.equal(calls,0);
});

import test from 'node:test';import assert from 'node:assert/strict';
import {packingInclusionController} from '../src/services/lp01-packing-inclusion.js';
import {canIncorporateAssembly} from '../src/modules/lp01-assembly-incorporate.js';
import {materializeAssemblyTurn} from '../src/services/lp01-current-turn.js';
const context={stage:'EMPAQUE',line:'PANELES_2',date:'2026-11-08',shift:1};
const input={key:'QA|PANELES_2',quantity:3,observation:'Prioridad explícita'};
const response=c=>({contract:'LP-INCORPORAR-EMPAQUE-1',...context,...c,turnRevision:c.revision+1});
test('packing uses distinct capability and stage-specific current-turn endpoint',async()=>{
 const d={contract:'LP-OPERACION-1',writeContract:'LP-OPERACION-CAS-2',writes:true,turn:{estado:'ABIERTO',revision:0},incorporation:{contract:'LP-INCORPORAR-EMPAQUE-1',...context,enabled:true,canIncorporate:true}};
 assert.equal(canIncorporateAssembly(d,context),true);d.incorporation.contract='LP-INCORPORAR-1';assert.equal(canIncorporateAssembly(d,context),false);
 d.turn={estado:'NO_ABIERTO'};d.turnoHorario={contract:'LP-TURNO-HORARIO-1',mode:'AUTHENTICATED_ON_ENTRY',enabled:true,canMaterialize:true};d.schedule={status:'AVAILABLE',currentPeriod:{date:context.date,shift:1}};
 assert.equal(await materializeAssemblyTurn(d,context,async(name,args)=>{assert.equal(name,'sgp_lp_empaque_turno_actual');assert.deepEqual(args,{});return {contract:'LP-TURNO-HORARIO-1',...context,mode:'AUTHENTICATED_ON_ENTRY',state:'MATERIALIZED',currentPeriod:d.schedule.currentPeriod};}),true);
});
test('ambiguous transport retry preserves exact id/payload, never routes into Ensamble plan command',async()=>{
 const calls=[];let n=0;const c=packingInclusionController({context,revision:4,isCurrent:()=>true,id:()=> 'request-1',rpc:async(name,args)=>{calls.push({name,args});if(n++===0)throw Error('Network');return response(args.p_cmd);}});
 await assert.rejects(()=>c.save(input),e=>e.uncertain===true);await assert.rejects(async()=>c.save({...input,quantity:5}),/Reintenta/);
 const result=await c.retry();assert.equal(result.turnRevision,5);assert.deepEqual(calls[0],calls[1]);assert.equal(calls[0].name,'sgp_lp_empaque_incorporar');assert.equal(calls[0].args.p_cmd.op,undefined);
});
test('confirmed SQL denial allows correcting data; session change blocks retry',async()=>{
 let current=true,n=0;const c=packingInclusionController({context,revision:0,isCurrent:()=>current,id:()=>String(++n),rpc:async()=>{throw Object.assign(Error('business reject'),{code:'P0001'});}});
 await assert.rejects(()=>c.save(input),e=>e.uncertain===false);await assert.rejects(()=>c.save({...input,quantity:2}),e=>e.uncertain===false);assert.equal(n,2);
 current=false;await assert.rejects(()=>c.retry(),/sesión/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyOfficialClose} from '../src/domain/lp01-official-close.js';
import {changeOfficialWorkflow,officialPlan,officialAvailability} from '../src/domain/lp01-official-workflow.js';
import {officialSheet} from '../src/domain/lp01-official-sheet.js';
const context={stage:'ENSAMBLE',line:'PANELES_2',date:'2026-11-03',shift:1},key='QA|PANELES_2';
const source={key_produccion:key,id_linea:context.line,saldos_inicializados:true,presente_ultimo_export:true,saldo_ensamble:20,cantidad:30};
const plan={...context,revision:'initial',rows:[]};
const base={actor:'QA',role:'COORDINADOR',recordedAt:'2026-11-03T12:00:00Z',catalog:[source],plan,observation:'QA motivo'};
const command=(action,revision=0)=>({...context,id:'id-'+revision,revision,action,key,quantity:10,priority:2});
test('persisted availability baseline consumes only new official advance and restores downward corrections',()=>{
 let state=emptyOfficialClose();state.entries=[{...context,key,quantity:3,periodStart:'2026-11-03T10:00:00Z',periodEnd:'2026-11-03T22:00:00Z',sha256:'QA'}];
 state=changeOfficialWorkflow(state,{...base,command:command('DEFINE_AVAILABLE')}).state;
 state.entries[0].quantity=7;assert.equal(officialAvailability(state)[0].quantity,6);
 state.entries[0].quantity=4;assert.equal(officialAvailability(state)[0].quantity,9);
 assert.equal(state.definitions[0].baselines[0].quantity,3);
});
test('missing intraturn baseline remains pending when later official summary arrives',()=>{
 let state=changeOfficialWorkflow(emptyOfficialClose(),{...base,command:command('DEFINE_AVAILABLE')}).state;
 state.entries=[{...context,key,quantity:7,periodStart:'2026-11-03T10:00:00Z',periodEnd:'2026-11-03T22:00:00Z'}];
 assert.equal(officialAvailability(state)[0].status,'PENDING_BASE');assert.equal(officialAvailability(state)[0].quantity,null);
});
test('incorporation preserves plan and projects one canonical order into sheet with official availability',()=>{
 const state=changeOfficialWorkflow(emptyOfficialClose(),{...base,role:'LIDER',command:command('INCORPORATE')}).state;
 assert.deepEqual(state.inclusions[0].initialPlan,plan);assert.equal(plan.rows.length,0);assert.equal(officialPlan(state,plan).rows[0].quantity,10);
 const view={contract:'LP-OFFICIAL-VIEW-1',context,state,catalog:[source],availability:[{key,...context,quantity:8}]};
 const sheet=officialSheet({orders:[]},view,context);assert.equal(sheet.orders.length,1);assert.equal(sheet.orders[0].officialAvailable,8);assert.equal(sheet.orders[0].officialInclusion,true);
 assert.throws(()=>changeOfficialWorkflow(state,{...base,command:command('INCORPORATE',1)}),/YA_PROGRAMADA/);
});
test('unknown official balances never authorize incorporation',()=>{
 for(const saldo_ensamble of [null,undefined,'',-1,'unknown'])assert.throws(()=>changeOfficialWorkflow(emptyOfficialClose(),{...base,catalog:[{...source,saldo_ensamble}],command:command('INCORPORATE')}),/SALDO_OFICIAL/);
});
test('sheet keeps missing balance for review and exposes unprogrammed canonical candidates in both processes',()=>{
 for(const stage of ['ENSAMBLE','EMPAQUE']){
  const ctx={...context,stage};
  for(const balance of [undefined,null,'',false]){
   const view={contract:'LP-OFFICIAL-VIEW-1',context:ctx,state:emptyOfficialClose(),catalog:[{...source,saldo_ensamble:balance,saldo_empaque:balance}],availability:[]};
   const sheet=officialSheet({orders:[]},view,ctx);assert.equal(sheet.orders.length,1);assert.equal(sheet.orders[0].officialUnscheduled,true);
  }
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {powerBICommand} from '../src/modules/lp01-powerbi-client.js';
const base={id:'00000000-0000-4000-8000-000000000001',stage:'ENSAMBLE',line:'PANELES_2',date:'2026-11-07',shift:1,revision:3};
test('legacy gateway payload remains exact and never includes user, role or file fields',()=>{
 const input={...base,op:'IMPORTAR_XLSX',turn_revision:3,filename:'QA.xlsx',base64:'QA',role:'ADMINISTRADOR',user:'other'};
 assert.deepEqual(powerBICommand(input),base);assert.equal(input.filename,'QA.xlsx');
});
test('explicit production Export authority and request identity survive identical retry',()=>{
 const input={...base,authority:'EXPORT_PRODUCTION_V2',op:'IMPORTAR_XLSX',turn_revision:3};
 assert.deepEqual(powerBICommand(input),{...base,authority:'EXPORT_PRODUCTION_V2'});
 assert.deepEqual(powerBICommand({...input}),powerBICommand(input));
 assert.equal(input.op,'IMPORTAR_XLSX');
});
test('unknown authority or scope never silently downgrades to legacy',()=>{
 for(const authority of [null,undefined,'',true,'LEGACY','EXPORT_PRODUCTION_V3'])assert.throws(()=>powerBICommand({...base,authority}),/Autoridad/);
 for(const patch of [{stage:'OTHER'},{line:'FRAMES_2'}])assert.throws(()=>powerBICommand({...base,...patch,authority:'EXPORT_PRODUCTION_V2'}),/Autoridad/);
 for(const input of [null,[],false,'payload'])assert.throws(()=>powerBICommand(input),/Contexto/);
});

test('packing authority retains exact stage for independently enabled server',()=>assert.equal(powerBICommand({...base,stage:'EMPAQUE',authority:'EXPORT_PRODUCTION_V2'}).stage,'EMPAQUE'));

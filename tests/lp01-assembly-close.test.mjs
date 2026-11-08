import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assemblyCloseSummary} from '../src/modules/lp01-assembly-close.js';
const context={line:'PANELES_2',stage:'ENSAMBLE',date:'2026-11-07',shift:1};
const production=(name,assignments=[],balance=10)=>({key:name+'|PANELES_2',oficial:{key_produccion:name+'|PANELES_2',id_linea:'PANELES_2',produccion:name,sistema:'ES100',cantidad:20,saldo_ensamble:balance,saldos_inicializados:true,presente_ultimo_export:true},assignments});
const plan=(name,id,cantidad=8)=>({id,key_produccion:name+'|PANELES_2',fecha:context.date,turno:1,cantidad,prioridad:1,source:'PROGRAMACION_LINEA'});
const data=productions=>({contract:'LP-OPERACION-1',orders:[],reports:[],catalog:{contract:'LP-HOJA-1',...context,productions}});
test('B15 previews production groups once and distinguishes missing Realizado from zero',()=>{
 const d=data([production('A',[plan('A','a'),plan('A','b',4)]),production('B',[],20),production('C',[],0)]);
 const summary=assemblyCloseSummary(d,context);
 assert.equal(summary.rows.length,1);assert.equal(summary.pending,1);assert.equal(summary.systems[0].planned,12);assert.equal(summary.systems[0].realized,0);assert.equal(summary.systems[0].pending,1);
});
test('invalid planned quantity is unknown, never NaN or an invented zero',()=>{
 const summary=assemblyCloseSummary(data([production('A',[plan('A','a',null)])]),context);
 assert.equal(summary.systems[0].planned,null);
});
test('partial catalog fallback does not turn missing plan coverage into zero',()=>{
 const p=production('A');const summary=assemblyCloseSummary({contract:'LP-OPERACION-1',reports:[],orders:[{...p,...context,etapa:context.stage,linea:context.line,fecha:context.date,turno:context.shift,parte:'a',programada:8}]},context);
 assert.equal(summary.rows.length,1);assert.equal(summary.rows[0].partial,true);assert.equal(summary.systems[0].planned,null);
});
test('new assembly close view cannot dispatch old manual commands or upload a file',()=>{
 const code=readFileSync(new URL('../src/modules/lp01-assembly-close.js',import.meta.url),'utf8');
 assert.doesNotMatch(code,/\.rpc\(|data-bi-file|data-executed|send\(['"]CERRAR/);
 assert.match(code,/Cierre por Export pendiente de habilitación/);
 const integration=readFileSync(new URL('../src/modules/lp01-operation.js',import.meta.url),'utf8');
 assert.match(integration,/if\(\['ENSAMBLE','EMPAQUE'\]\.includes\(context.stage\)\)\{renderAssemblyClose/);
});

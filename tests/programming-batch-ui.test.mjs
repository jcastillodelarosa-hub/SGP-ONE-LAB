import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=source.indexOf('function renderProgParts(');
const end=source.indexOf('function openProgModal(',start);
const body=source.slice(start,end);
test('programacion: seleccion multiple y cobertura',()=>{
 for(const phrase of ['Programar órdenes seleccionadas','prog-completed-orders','Órdenes pendientes por programar','sgp_mecanizado_reconciliar_programacion_legacy'])assert.ok(body.includes(phrase),phrase);
});
test('programacion: guardado seguro',()=>{
 for(const phrase of ['if(saving)return','Number.isInteger(x.qty)','for(const item of selected)','if(error){failed=','await loadProgramming({invalidateCarry:true})'])assert.ok(body.includes(phrase),phrase);
});

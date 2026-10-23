import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../planner-readonly-v326.js',import.meta.url),'utf8');
test('cola de pendientes filtra saldo positivo y no escribe datos',()=>{
 assert.match(source,/sgpPendingAssemblyQueue/);
 assert.match(source,/Number\(r\.saldo_ensamble\)>0/);
 assert.match(source,/SGPLinePlanner\?\.selectProduction/);
 assert.match(source,/button\.textContent='Continuar'/);
 assert.doesNotMatch(source,/sgp_linea_plan_programar/);
});
test('cola mantiene filtro y vista accesible',()=>{
 assert.match(source,/sgpPendingSearch/);
 assert.match(source,/aria-label="Filtrar pendientes"/);
 assert.match(source,/focus-visible/);
});

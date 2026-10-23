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

test('estado de mecanizado se muestra sin confundir PROCESADO con entrega Picking',()=>{
 assert.match(source,/r\.estado_mecanizado/);
 assert.match(source,/explorerState\(r\.estado_mecanizado\)/);
 assert.match(source,/data-state/);
 assert.match(source,/Observación mecanizado:/);
 assert.doesNotMatch(source,/estado_mecanizado\s*===\s*['"]PROCESADO['"]\s*\?\s*['"]ENTREGADO/);
});

test('explorador permite filtrar y ordenar por estado de mecanizado',()=>{
 assert.match(source,/sgpExplorerStateFilter/);
 assert.match(source,/sgpExplorerSort/);
 assert.match(source,/estado_asc/);
 assert.match(source,/estado_desc/);
 assert.match(source,/ventanas_desc/);
 assert.match(source,/explorerStateFilter\.addEventListener/);
 assert.match(source,/explorerSort\.addEventListener/);
});

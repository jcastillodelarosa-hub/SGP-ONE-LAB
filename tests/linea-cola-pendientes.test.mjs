import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../planner-readonly-v326.js',import.meta.url),'utf8');
test('cola de pendientes filtra saldo positivo y no escribe datos',()=>{
 assert.match(source,/sgpPendingAssemblyQueue/);
 assert.match(source,/Number\(r\.saldo_ensamble\)>0/);
 assert.match(source,/SGPLinePlanner\?\.selectProduction/);
 assert.match(source,/button\.textContent='Programar'/);
 assert.doesNotMatch(source,/sgp_linea_plan_programar/);
});
test('cola mantiene filtro y vista accesible',()=>{
 assert.match(source,/sgpPendingSearch/);
 assert.match(source,/aria-label="Filtrar pendientes"/);
 assert.match(source,/focus-visible/);
});

test('estado de mecanizado se muestra sin confundir PROCESADO con entrega Picking',()=>{
 assert.match(source,/r\.estado_mecanizado/);
 assert.match(source,/explorerState\(explorerMechanized\(r\)\)/);
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

test('tarjeta de reserva cerrada muestra Estado con distintivo coloreado',()=>{
 assert.match(source,/sgp-explorer-status-summary/);
 assert.match(source,/Estado: '\+\(\[/);
 assert.match(source,/\.map\(explorerState\)/);
 assert.match(source,/sgp-explorer-status-summary \.sgp-explorer-state/);
 assert.doesNotMatch(source,/<span>Mecanizado: '\+explorerEsc/);
});

test('cola distingue saldo de ensamble de saldo sin programar y conecta el formulario',()=>{assert.match(source,/El saldo Export no equivale necesariamente al saldo sin programar/);assert.match(source,/sgpPendingCount/);assert.match(source,/sgp:line-plan-updated/);assert.match(source,/sgpPlanProduction/);});

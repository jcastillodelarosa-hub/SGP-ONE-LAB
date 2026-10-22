import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../planner-readonly-v326.js',import.meta.url),'utf8');
test('v327: explorer has week, system, search and expandable reserve cards',()=>{
 for(const id of ['sgpPlannerExplorer','sgpExplorerWeek','sgpExplorerSystem','sgpExplorerSearch','sgpExplorerResults']) assert.ok(source.includes(id),id);
 assert.match(source,/sgp-explorer-reservation/);
 assert.match(source,/sgp-explorer-part/);
 assert.match(source,/sgp-explorer-order/);
});
test('v327: explorer uses authenticated assembly bridge without new database writes',()=>{
 assert.ok(source.includes('SGPPlannerBridge?.loadAssembly'));
 assert.ok(!source.includes('service_role'));
 assert.ok(source.includes('explorerLoadDetail()'));
});

test('v327: glass and part detail is session-gated and joins by key_produccion',()=>{
 assert.ok(source.includes("sgp_linea_plan_explorador_v327"));
 assert.ok(source.includes("p_token:token"));
 assert.ok(source.includes("explorerDetail.get(r.key_produccion)"));
 assert.ok(source.includes("vidrio_preparado"));
 assert.ok(source.includes("vidrio_novedad"));
 assert.ok(source.includes("vidrio_traslado"));
});

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

test('v327: week selection, responsive cards and visual state/glass counters',()=>{
 assert.ok(source.includes("sgp_picking_semanas"));
 assert.ok(source.includes("explorerRefreshWeeks"));
 assert.ok(source.includes("#sgpExplorerResults{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))"));
 assert.ok(source.includes("@media(max-width:780px){#sgpExplorerResults{grid-template-columns:1fr}"));
 for(const cls of ['sgp-glass-prep','sgp-glass-nov','sgp-glass-trans','sgp-explorer-state'])assert.ok(source.includes(cls));
 assert.ok(source.includes('explorerState(r.estado_mecanizado)'));
});

test('v327: planner retains calendar, table and kanban selector above reservation cards',()=>{
 assert.ok(source.includes('value="calendar"'));
 assert.ok(source.includes('value="table"'));
 assert.ok(source.includes('value="kanban"'));
 assert.ok(source.includes("explorer.insertBefore(viewActions,explorer.querySelector('.sgp-explorer-filters'))"));
});

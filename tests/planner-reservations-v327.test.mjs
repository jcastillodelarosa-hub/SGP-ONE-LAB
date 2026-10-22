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
 assert.match(source,/SGPPlannerBridge\\?\\.loadAssembly/);
 assert.doesNotMatch(source,/service_role|\\.from\\(['\"]sgp_producciones/);
 assert.match(source,/setTimeout\\(explorerRender,0\\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../planner-readonly-v326.js',import.meta.url),'utf8');
test('planner view actions moved to explorer bind on explorer, never stale section',()=>{
 assert.match(s,/explorer\.insertBefore\(viewActions,explorer\.querySelector\('\.sgp-explorer-filters'\)\)/);
 for(const id of ['sgpPlannerView','sgpPlannerSearch','sgpPlannerRefresh','sgpPlannerLocations']){
  assert.ok(s.includes("explorer.querySelector('#"+id+"').addEventListener"),id);
  assert.ok(!s.includes("section.querySelector('#"+id+"').addEventListener"),id);
 }
});

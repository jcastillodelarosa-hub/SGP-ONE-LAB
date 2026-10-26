import test from 'node:test';
import assert from 'node:assert/strict';
import {distributionState,sourceUsable,renderSourceDistribution} from '../src/modules/pdt-source-distribution.js';
const sources=[{id_pieza:'fixture:1',fabricacion:'E17',longitud:109.9375,acabado:'DS',cantidad:20},{id_pieza:'fixture:2',fabricacion:'E17-1',longitud:109.9375,acabado:'DS',cantidad:15}];
const selected=(a,b)=>sources.map((s,i)=>({...s,cantidad:i?b:a}));
test('9 = 5 + 4 preserves source identity and does not use reference stock as assignment',()=>{
 const before=structuredClone(sources);const state=distributionState(sources,selected(5,4),9);
 assert.equal(state.valid,true);assert.equal(state.total,9);assert.equal(state.corrected,false);
 assert.deepEqual(state.details.map(x=>x.id_pieza),['fixture:1','fixture:2']);assert.deepEqual(sources,before);
});
test('9 to 8 requires a nonblank explanation and never changes the original',()=>{
 assert.equal(distributionState(sources,selected(5,3),9).valid,false);
 assert.equal(distributionState(sources,selected(5,3),9,'  ').valid,false);
 const state=distributionState(sources,selected(5,3),9,'Corrección comprobada');assert.equal(state.valid,true);assert.equal(state.total,8);assert.equal(state.corrected,true);
});
test('empty/error/invalid selections cannot validate or invent identities from legacy grouping',()=>{
 assert.equal(distributionState([],[],9).valid,false);assert.equal(distributionState(sources,[],9).valid,false);
 for(const qty of ['',0,-1,1.5,'invalid'])assert.equal(distributionState(sources,selected(qty,4),9,'reason').valid,false);
 assert.equal(distributionState(sources,[{...sources[0],id_pieza:null,cantidad:9}],9).valid,false);
 assert.equal(sourceUsable({...sources[0],id_pieza:null},sources),false);
 const duplicate=[sources[0],sources[0]];assert.equal(sourceUsable(duplicate[0],duplicate),false);
 assert.equal(distributionState(sources,selected(5,4),null).valid,false);
});
test('source fields, empty reason and retry exist; confirm starts disabled',()=>{
 const escape=s=>String(s??'').replaceAll('<','&lt;');
 const html=renderSourceDistribution(sources,9,null,escape);
 for(const text of ['Fabricación','Longitud (in)','Acabado','Cant. referencia','A asignar','data-assigned-total','data-source-retry'])assert.ok(html.includes(text));
 assert.match(html,/data-operation="validate" disabled/);
 assert.ok(renderSourceDistribution([],9,'Network <error>',escape).includes('Network &lt;error>'));
});

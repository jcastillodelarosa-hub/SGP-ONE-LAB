import test from 'node:test';import assert from 'node:assert/strict';
import {selectProgrammedFiles} from '../opt-digital/import-selection.js';
const scope={linea:'PANELES_2',anio:2026,semana:46,modo:'BASE'};
const file=name=>({name,arrayBuffer(){assert.fail('metadata preflight must never read bytes');}});
const request=()=>({files:['EXACT.pdf','foreign.pdf','near.pdf','MIXED.PDF'].map(file),origin:'RETAIL',scope,snapshot:{status:'READY',scope,relations:[{reservation:'R',system:'PANEL'}]},indexReady:true,pending:[],entries:[{origin:'RETAIL',opt:'EXACT',reservation:'R',system:'PANEL',sourceRow:2},{origin:'RETAIL',opt:'foreign',reservation:'OTHER',system:'PANEL'},{origin:'RETAIL',opt:'MIXED',reservation:'R',system:'PANEL'},{origin:'RETAIL',opt:'MIXED',reservation:'OUTSIDE',system:'FRAME'}]});
test('filter before reading bytes; exact evidence and whole mixed PDF preserved',()=>{
 const r=selectProgrammedFiles(request());assert.deepEqual(r.selected.map(f=>f.name),['EXACT.pdf','MIXED.PDF']);assert.deepEqual(r.decisions.map(d=>d.reason),['CANDIDATE','OUTSIDE_PROGRAMMING','EXACT_NAME_MISSING','CANDIDATE']);assert.deepEqual(r.decisions[0].indexRows,[{row:2,reservation:'R',system:'PANEL'}]);
});
test('fail closed on wrong line, stale scope, missing index or unreadable journal',()=>{
 for(const overrides of [{scope:{...scope,linea:'FRAMES_2'}},{scope:{...scope,semana:47}},{scope:{...scope,anio:2025}},{indexReady:false},{pending:null},{snapshot:{status:'LOADING'}},{origin:'INDIVIDUAL'}])assert.equal(selectProgrammedFiles({...request(),...overrides}).selected.length,0);
});
test('no approximation, no duplicate choice, no unresolved import replay across scope/origin',()=>{
 const a=request();a.files=[file('exact.pdf'),file('EXACT.pdf'),file('EXACT.PDF'),file('MIXED.pdf')];a.pending=[{source:{origin:'PROYECTO',opt:'MIXED'},scope:{...scope,semana:45}}];
 assert.deepEqual(selectProgrammedFiles(a).decisions.map(d=>d.reason),['EXACT_NAME_MISSING','DUPLICATE_NAME','DUPLICATE_NAME','PENDING_OUTCOME']);assert.equal(selectProgrammedFiles(a).selected.length,0);
});
test('same reserve in wrong system or origin never qualifies',()=>{
 const a=request();a.snapshot.relations=[{reservation:'R',system:'FRAME'}];assert.equal(selectProgrammedFiles(a).selected.length,0);a.origin='PROYECTO';assert.equal(selectProgrammedFiles(a).selected.length,0);
});

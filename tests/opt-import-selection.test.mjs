import test from 'node:test';import assert from 'node:assert/strict';
import {selectProgrammedFiles,programmedEntryMatcher} from '../opt-digital/import-selection.js';
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
test('same reserve qualifies regardless of system, but never another origin',()=>{
 const a=request();a.snapshot.relations=[{reservation:'R',system:'FRAME'}];assert.equal(selectProgrammedFiles(a).selected.length,2);a.origin='PROYECTO';assert.equal(selectProgrammedFiles(a).selected.length,0);
});

test('blank or different systems are informational; reservations stay exact',()=>{
 const a=request();a.entries[0].system='';a.snapshot.relations=[{reservation:'R',system:''},{reservation:'R',system:'OTHER'}];
 assert.equal(selectProgrammedFiles(a).selected.length,2);
 a.entries[0].reservation='r';assert.equal(selectProgrammedFiles(a).decisions[0].reason,'OUTSIDE_PROGRAMMING');
});
test('both uncertain originals stay blocked after reservation-only selection',()=>{
 const a=request();a.entries[0].system='OTHER';a.pending=[{pdf:{name:'EXACT.pdf'}},{source:{opt:'MIXED'}}];
 assert.equal(selectProgrammedFiles(a).selected.length,0);assert.equal(selectProgrammedFiles(a).decisions.filter(d=>d.reason==='PENDING_OUTCOME').length,2);
 assert.equal(a.pending.length,2);
});

test('Proyecto keeps reservation AND system eligibility; Retail alone ignores system',()=>{
 const a=request();a.origin='PROYECTO';a.entries=a.entries.map(e=>({...e,origin:'PROYECTO'}));
 assert.equal(selectProgrammedFiles(a).selected.length,2);
 a.snapshot.relations=[{reservation:'R',system:'OTHER'}];assert.equal(selectProgrammedFiles(a).selected.length,0);
 a.snapshot.relations=[{reservation:'R',system:''}];assert.equal(selectProgrammedFiles(a).selected.length,0);
});
test('shared selector used for queued jobs fails closed on unknown origin',()=>{
 const relations=[{reservation:'R',system:'CANONICAL'}];
 const changed={reservation:'R',system:'DOCUMENTARY'},same={reservation:'R',system:'CANONICAL'};
 assert.equal(programmedEntryMatcher(relations,'RETAIL')(changed),true);
 assert.equal(programmedEntryMatcher(relations,'PROYECTO')(changed),false);
 assert.equal(programmedEntryMatcher(relations,'PROYECTO')(same),true);
 for(const origin of [undefined,'INDIVIDUAL','FUTURE'])assert.equal(programmedEntryMatcher(relations,origin)(same),false);
});

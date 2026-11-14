import test from 'node:test';import assert from 'node:assert/strict';import {optFileSelectionState as state} from '../src/domain/opt-file-selection-state.js';
const file={name:'OPT-SYNTH.pdf',webkitRelativePath:'carpeta/semana/OPT-SYNTH.pdf'};
test('reset input does not erase separately captured File descriptor; only actual relative path is shown',()=>{
 const input={value:''};const s=state({file,available:true});assert.equal(input.value,'');assert.equal(s.location,file.webkitRelativePath);assert.equal(s.available,true);assert.equal(s.savedDataConfirmed,false);
 for(const path of ['C:\\fakepath\\OPT-SYNTH.pdf','/home/user/OPT-SYNTH.pdf','../OPT-SYNTH.pdf','carpeta/../OPT-SYNTH.pdf','https://example/OPT-SYNTH.pdf','carpeta/OTHER.pdf'])assert.equal(state({file:{...file,webkitRelativePath:path}}).location,file.name);
 assert.equal(state({file:{name:'C:\\fakepath\\OPT.pdf'}}).location,null);
});
test('local processed, persisted data, errors and uncertainty are separate facts',()=>{
 assert.equal(state({file,available:true,localOutcome:'processed'}).savedDataConfirmed,false);
 assert.equal(state({file,serverOutcome:'confirmed'}).serverPdfArchived,false);
 assert.equal(state({file,serverOutcome:'confirmed'}).available,false);
 assert.equal(state({file,serverOutcome:'processing'}).savedDataConfirmed,false);
 assert.equal(state({file,serverOutcome:'rejected'}).savedDataConfirmed,false);
 assert.equal(state({file,serverOutcome:'uncertain'}).requiresReconciliation,true);
 assert.equal(state({file,localOutcome:'error',serverOutcome:'confirmed'}).savedDataConfirmed,true);
 assert.equal(state().location,null);assert.equal(state().available,false);
 assert.throws(()=>state({serverOutcome:'uploaded'}),/OPT_FILE_STATE_INVALID/);
});

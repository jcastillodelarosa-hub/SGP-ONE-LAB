// Synthetic fixture labels and identifiers; no private source records.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOptimaSevenColumnTable} from '../src/domain/opt-pdf-seven-column.js';
import {expandPhysicalCuts,summarizePhysicalCuts} from '../src/domain/opt-physical-cuts.js';
test('7-column table preserves all quantity cells',()=>{
 const row=['1','58 13/16" 7000003 - SYNTHETIC SITE E 2\nSYNTHETIC LABEL C','50 9/16" 700006 - SYNTHETIC SITE D 1\nSYNTHETIC RESIDENCE','','','3 3/4"','Cortar'];
 const result=parseOptimaSevenColumnTable([row],{opt:'PLI-132',page:23,table:0});
 assert.equal(result.verified,true);
 assert.deepEqual(summarizePhysicalCuts(expandPhysicalCuts(result.patterns)),{bars:1,cuts:3,completed:0});
});
test('page-spanning fragments block verification',()=>{
 const result=parseOptimaSevenColumnTable([['','8000 (Line 25)','','','','','']],{page:23});
 assert.equal(result.verified,false);
 assert.equal(result.issues[0].code,'CONTINUACION_PENDIENTE');
});

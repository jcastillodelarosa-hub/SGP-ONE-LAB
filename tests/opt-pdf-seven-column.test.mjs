import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOptimaSevenColumnTable} from '../src/domain/opt-pdf-seven-column.js';
import {expandPhysicalCuts,summarizePhysicalCuts} from '../src/domain/opt-physical-cuts.js';
test('7-column table preserves all quantity cells',()=>{
 const row=['1','58 13/16" 1154831 - JG 7300 2\nMindello','50 9/16" 908711 - HUGHES 1\nRESIDENCE','','','3 3/4"','Cortar'];
 const result=parseOptimaSevenColumnTable([row],{opt:'PLI-132',page:23,table:0});
 assert.equal(result.verified,true);
 assert.deepEqual(summarizePhysicalCuts(expandPhysicalCuts(result.patterns)),{bars:1,cuts:3,completed:0});
});
test('page-spanning fragments block verification',()=>{
 const result=parseOptimaSevenColumnTable([['','8000 (Line 25)','','','','','']],{page:23});
 assert.equal(result.verified,false);
 assert.equal(result.issues[0].code,'CONTINUACION_PENDIENTE');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOptimaCutCell,parseOptimaWideTable} from '../src/domain/opt-pdf-table-parser.js';
import {expandPhysicalCuts,summarizePhysicalCuts} from '../src/domain/opt-physical-cuts.js';

test('Optima first line Cant. is not production line number',()=>{
 const c=parseOptimaCutCell('34 13/16" 1158220 - Floridian - 2\nChow pending SGDs\n(Line 1) 116B,(Line 2) 116A');
 assert.equal(c.quantity,2);
 assert.match(c.reference,/116A/);
});
test('PDF page 22 first physical bar has 5 independent cuts',()=>{
 const header=['#perf','Long.','Referencia','Cant.','Long.','Referencia','Cant.','Long.','Referencia','Cant.','Long.','Referencia','Cant.','Rest','Disp.'];
 const row=['1','34 13/16" 1158220 - Floridian - 2\nChow',null,null,'34 1/4" 1033380 - Duenas 2\nLuna',null,null,'33 1/4" 1158220 - Floridian 1\nChow',null,null,'',null,null,'0 1/32"','Cortar'];
 const patterns=parseOptimaWideTable([header,row],{opt:'OPT2026-44-5-PLI-132',page:22,profile:'ES-SGD2020-024',code:'10203537'});
 assert.deepEqual(summarizePhysicalCuts(expandPhysicalCuts(patterns)),{bars:1,cuts:5,completed:0});
});

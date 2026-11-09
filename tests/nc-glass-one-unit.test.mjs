import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compactSummaryMarkup} from '../src/modules/lp01-affectation-summary.js';
test('NC creation fixes one unit independently of editable input and hides quantity',()=>{
 const source=readFileSync(new URL('../src/modules/lp01-shared-affectations-panel.js',import.meta.url),'utf8');
 assert.ok(source.includes("fixedCause==='NC_V'&&action==='CREATE'?1:Number(form.elements.quantity.value)"));
 assert.ok(source.includes("hidden=link||singleNc"));
 assert.ok(source.includes("Cada NC de vidrio corresponde a 1 unidad"));
});
test('NC source count is not labelled estimation, other estimates remain unchanged',()=>{
 const html=compactSummaryMarkup({status:'AVAILABLE',categories:{},ncEstimate:2,reportedQuantities:{},aluminumCoverage:'COMPLETE'});
 assert.match(html,/NC Vidrio · 2 \(1 por NC\)/);
 assert.doesNotMatch(html,/estimación/);
});

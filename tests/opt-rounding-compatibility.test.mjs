import test from 'node:test';import assert from 'node:assert/strict';import {profileRoundingCompatibility as check} from '../src/domain/opt-rounding-compatibility.js';
const real=()=>({stockTerms:[{length:'10 1/32"',quantity:3}],cutTerms:[{length:'2 1/32"',quantity:6}],summary:{stockLength:'30 1/16"',cutLength:'12 5/32"',reusedLength:'0"',wasteLength:'17 29/32"'}});
test('synthetic compatible under explicit envelopes, never certifies actual precision/import',()=>{const x=real(),before=JSON.stringify(x),r=check(x);assert.equal(r.status,'ROUNDING_COMPATIBLE');assert.equal(r.exactEquality,false);assert.equal(r.authorizesImport,false);assert.equal(r.originalPrecisionVerified,false);assert.equal(JSON.stringify(x),before);assert.deepEqual(r.printedDelta32,{stock:'1',cuts:'1',balance:'0'});});
test('exact printed arithmetic remains separate from physical/precision validation',()=>{const r=check({stockTerms:[{length:'10',quantity:1}],cutTerms:[{length:'8',quantity:1}],summary:{stockLength:'10',cutLength:'8',reusedLength:'1',wasteLength:'1'}});assert.equal(r.status,'PRINTED_EQUALITY');assert(r.exactEquality);assert.equal(r.authorizesImport,false);});
test('joint conservation detects contradiction even when individual totals agree',()=>{const x=real();x.summary.wasteLength='200';const r=check(x);assert.equal(r.status,'INCOMPATIBLE');assert(r.reasons.includes('CONSERVATION_INTERVAL_DISJOINT'));});
test('large discrepancies, malformed fractions/counts and overflow fail closed',()=>{let x=real();x.summary.stockLength='3100';assert.equal(check(x).status,'INCOMPATIBLE');for(const n of [0,-1,NaN,Infinity,1.2,100001,Number.MAX_SAFE_INTEGER]){x=real();x.stockTerms[0].quantity=n;assert.equal(check(x).status,'UNSUPPORTED');}x=real();x.cutTerms[0].length='1 1/3';assert.equal(check(x).status,'UNSUPPORTED');});
test('order and equivalent quantity expansion do not alter envelopes',()=>{const x=real(),r=check(x);x.cutTerms=Array.from({length:6},()=>({length:'2 1/32"',quantity:1}));assert.deepEqual(check(x),r);});
test('one displayed cut permits at most 1/32 aggregate gap, inclusive endpoints only',()=>{
 const x={stockTerms:[{length:'10"',quantity:1}],cutTerms:[{length:'8"',quantity:1}],summary:{stockLength:'10"',cutLength:'8 1/32"',reusedLength:'0"',wasteLength:'1 31/32"'}};
 assert.equal(check(x).status,'ROUNDING_COMPATIBLE');
 x.summary.cutLength='8 1/16"';x.summary.wasteLength='1 15/16"';
 const r=check(x);assert.equal(r.status,'INCOMPATIBLE');assert(r.reasons.includes('CUT_INTERVAL_DISJOINT'));assert.equal(r.authorizesImport,false);
});
test('four displayed summary terms have a bounded conservation envelope, not arbitrary tolerance',()=>{
 const x={stockTerms:[{length:'10"',quantity:1}],cutTerms:[{length:'8"',quantity:1}],summary:{stockLength:'10"',cutLength:'8"',reusedLength:'1"',wasteLength:'1 1/16"'}};
 assert.equal(check(x).status,'ROUNDING_COMPATIBLE');
 x.summary.wasteLength='1 3/32"';assert.equal(check(x).status,'INCOMPATIBLE');
});

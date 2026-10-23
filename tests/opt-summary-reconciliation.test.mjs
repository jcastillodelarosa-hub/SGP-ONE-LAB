import test from 'node:test';
import assert from 'node:assert/strict';
import {inchesToThirtySeconds,reconcileOptSummary} from '../src/domain/opt-summary-reconciliation.js';
test('mixed inch fractions are exact',()=>{
 assert.equal(inchesToThirtySeconds('4103 19/32"'),131315);
 assert.equal(inchesToThirtySeconds('177 5/32"'),5669);
 assert.throws(()=>inchesToThirtySeconds('10 1/3"'),/incompatible/);
});
test('PDF reference ES-SGD2020-024 mismatched partial extraction is blocked',()=>{
 const result=reconcileOptSummary({
  patterns:[{perf:1,blockId:'10203537',planId:'p1',cuts:[{length:'34 13/16"',quantity:2,reference:'1158220'},{length:'34 1/4"',quantity:2,reference:'1033380'},{length:'33 1/4"',quantity:1,reference:'1158220'}]}],
  summary:{bars:23,cuts:90,plans:20,cutLength:'4103 19/32"'},
  blocks:[{id:'10203537',bars:7},{id:'10185496',bars:16}]
 });
 assert.equal(result.verified,false);
 assert.ok(result.issues.some(i=>i.code==='DIFERENCIA_BARRAS'));
 assert.ok(result.issues.some(i=>i.code==='DIFERENCIA_CORTES'));
 assert.ok(result.issues.some(i=>i.code==='DIFERENCIA_BARRAS_BLOQUE'));
});
test('fully reconciled plan passes',()=>{
 const p={perf:2,blockId:'A',planId:'p1',cuts:[{length:'10 1/2"',quantity:3,reference:'X'}]};
 const result=reconcileOptSummary({patterns:[p],summary:{bars:2,cuts:6,plans:1,cutLength:'63"'},blocks:[{id:'A',bars:2,cuts:6}]});
 assert.equal(result.verified,true);
});

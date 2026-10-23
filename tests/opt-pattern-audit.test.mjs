import test from 'node:test';
import assert from 'node:assert/strict';
import {auditOptPatterns} from '../src/domain/opt-pattern-audit.js';

test('repeated physical bars multiply all quantity columns',()=>{
 const result=auditOptPatterns([{patternId:'p1',perf:3,cuts:[{length:'34 1/4',reference:'A',quantity:2},{length:'33 1/4',reference:'B',quantity:1}]}],{bars:3,cuts:9});
 assert.equal(result.verified,true);
});
test('incomplete row crossing a page cannot be certified',()=>{
 const result=auditOptPatterns([{patternId:'page22-row5',perf:1,continues:true,cuts:[{length:'46 1/4',reference:'908711',quantity:2}]}]);
 assert.equal(result.verified,false);
 assert.ok(result.issues.some(i=>i.code==='PATRON_INCOMPLETO'));
});
test('source totals are mandatory when provided',()=>{
 const result=auditOptPatterns([{patternId:'p',perf:1,cuts:[{length:'10',reference:'A',quantity:2}]}],{bars:23,cuts:90});
 assert.equal(result.verified,false);
 assert.ok(result.issues.some(i=>i.code==='TOTAL_CORTES_DIFIERE'));
});

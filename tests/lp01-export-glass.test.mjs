import test from 'node:test';
import assert from 'node:assert/strict';
import {exportGlassEstimate as estimate} from '../src/domain/lp01-export-glass.js';
test('Export available percentage produces exact missing fraction, approved ceiling without report',()=>{
 for(const [q,p,result] of [[60,80,'12'],[3,50,'1.5'],[1,99,'0.01'],[60,1,'59.4'],[60,0,'60'],[60,100,'0'],[0,0,'0'],[3,'99.99','0.0003'],['999999999999999','0.01','999899999999999.0001']]){
  const d=estimate({quantity:q,percentage:p});assert.equal(d.exact,result);assert.equal(d.integer,!result.includes('.'));assert.equal(d.quantified,false);
 }
});
test('missing, stale, negative, out-of-range, non-finite and malformed inputs never mean zero',()=>{
 for(const [quantity,percentage,present] of [[null,80,true],[60,null,true],[undefined,80,true],[-1,50,true],[1,101,true],[1,-1,true],[1,Infinity,true],[1,NaN,true],[1,'',true],[1,'80%',true],[1,50,false],[1.5,80,true]])assert.equal(estimate({quantity,percentage,present}).status,'UNAVAILABLE');
});
test('percentage 0.5 remains half a percent, not fifty percent',()=>assert.equal(estimate({quantity:60,percentage:0.5}).exact,'59.7'));

test('approved ceiling preserves exact decimal and never exceeds order quantity',()=>{
 for(const [q,p,rounded] of [[3,50,'2'],[60,1,'60'],[1,99,'1'],[60,100,'0'],[0,0,'0'],['999999999999999','0.01','999900000000000']]){const d=estimate({quantity:q,percentage:p});assert.equal(d.rounded,rounded);assert.equal(d.rounding,'CEILING');assert.ok(BigInt(d.rounded)<=BigInt(q));assert.equal(d.quantified,false);}
});

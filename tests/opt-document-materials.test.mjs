import test from 'node:test';
import assert from 'node:assert/strict';
import {documentaryLength,documentaryMaterials,documentaryBar} from '../opt-digital/document-materials.js';

test('length preserves explicit zero and does not coerce absent or invalid values',()=>{
  assert.equal(documentaryLength(0),'0 pulgadas');
  assert.equal(documentaryLength(63),'1.96875 pulgadas');
  for(const value of [undefined,null,NaN,Infinity,-1,'64',1.5])assert.equal(documentaryLength(value),'No informado');
});
test('scrap comes only from the explicit PDF summary, segregated by reference and finish',()=>{
  const rows=documentaryMaterials({profileBalances:[{ref:'A',finish:'BL',page:3,waste32:64,reused32:0},{ref:'B',waste32:999},{ref:'A',finish:'NA',page:4,reused32:32}]},'A');
  assert.equal(rows.length,2);assert.equal(rows[0].scrap,'2 pulgadas');assert.equal(rows[0].reusable,'0 pulgadas');
  assert.match(rows[0].source,/página 3 · acabado BL/);assert.equal(rows[1].scrap,'No informado');
  assert.deepEqual(documentaryMaterials(undefined,'A'),[]);
});
test('residual and threshold never become scrap or automatic reusable material',()=>{
  const bar=documentaryBar({printedRemainder32:63,unexplainedLength32:160,printedMinimumReusable32:32});
  assert.equal(bar.remainder,'1.96875 pulgadas');assert.equal(bar.difference,'5 pulgadas');
  assert.equal(bar.disposition,'No informado en el PDF');assert.equal('scrap' in bar,false);
  assert.equal(documentaryBar({unexplainedLength32:-32}).inconsistent,true);
  assert.equal(documentaryBar().difference,'No calculable');
});
test('explicit printed disposition is preserved without interpreting its meaning',()=>{
  assert.equal(documentaryBar({printedDisposition:'R'}).disposition,'R');
});

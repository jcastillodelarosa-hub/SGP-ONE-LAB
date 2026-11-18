import test from 'node:test';import assert from 'node:assert/strict';
import {documentProduction} from '../opt-digital/individual-reconciliation.js';import {retailSelectors} from '../src/server/opt-retail-contract.js';
const entry={project:'123456 - SYNTHETIC - 10000-10000',reservation:'9000001',system:'SYNTH-SYS',finish:'FINISH'};
test('V4 exact-label selector preserves compact numeric ranges in project title',()=>{
 assert.equal(documentProduction(entry.project),null); // legacy remains fail-closed
 assert.equal(documentProduction(entry.project,{numericRanges:true}),'123456');
 assert.equal(retailSelectors([entry],[{reference:entry.project+' (Line 1) 001'}],{reservationOnly:true})[0].documentProduction,'123456');
 assert.throws(()=>retailSelectors([entry],[],{reservationOnly:false}),/SELECTOR_INVALID/);
});
test('V4 ranges never bypass complete label or multiple documentary identity checks',()=>{
 assert.equal(documentProduction('123456 - First; 987654 - Second',{numericRanges:true}),null);
 assert.throws(()=>retailSelectors([entry],[{reference:'123456 - OTHER - 10000-10000'}],{reservationOnly:true}),/LABEL_MISMATCH/);
 assert.throws(()=>retailSelectors([entry,{...entry,project:'123456 - DIFFERENT'}],[{reference:entry.project}],{reservationOnly:true}),/LABEL_AMBIGUOUS/);
});

test('V4 numeric range exception is never applied to unverified Line suffix',()=>{
 const e={...entry,project:'123456 - Synthetic'};
 assert.equal(documentProduction(e.project+' (Line 1) 987654-2 Other',{numericRanges:true}),null);
 assert.throws(()=>retailSelectors([e],[{reference:e.project+' (Line 1) 987654-2 Other'}],{reservationOnly:true}),/LABEL_AMBIGUOUS/);
});

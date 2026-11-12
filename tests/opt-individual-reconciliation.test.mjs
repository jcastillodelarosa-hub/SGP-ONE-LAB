import test from 'node:test';import assert from 'node:assert/strict';
import {reconcileIndividuals,documentProduction} from '../opt-digital/individual-reconciliation.js';
const source=(qty=1,reference='123456 - Test (Line 1) A')=>({sourceId:'p1-item1',ref:'R1',finish:'F',length:'10"',quantity:qty,reference});
const cut=(i=1,reference='123456 - Test (Line 1) A')=>({length:'10"',project:reference,profileInstance:1,sourceColumn:1,sourceSlot:1,unitInstance:i});
const plan=(cuts=[cut()])=>({id:'p1',ref:'R1',finish:'F',length:'20"',rest:'6"',barqty:1,page:1,sourceSettings:{kerf:'1"',leftTrim:'1"',rightTrim:'1"'},cuts,issues:[]});
test('unique documentary row does not create SGP or physical identity',()=>{
 const r=reconcileIndividuals({plans:[plan()],projectRows:[source()]});assert.equal(r.totals.uniqueDocumentRows,1);assert.equal(r.totals.sgpProductionLinked,0);assert.equal(r.totals.physicalBarIdentified,0);assert.equal(r.productionEnabled,false);
});
test('repeated identical units match a row group without arbitrary unit allocation',()=>{
 const r=reconcileIndividuals({plans:[plan([cut(1),cut(2)])],projectRows:[source(2)]});assert.equal(r.totals.rowGroupMatched,2);assert.equal(r.totals.uniqueDocumentRows,0);assert.equal(r.totals.individualUnitUnresolved,2);
});
test('several source rows cannot be resolved by input order',()=>{
 const rows=[source(),{...source(),sourceId:'other'}];for(const projectRows of [rows,[...rows].reverse()]){const r=reconcileIndividuals({plans:[plan()],projectRows});assert.equal(r.cuts[0].reason,'MULTIPLE_SOURCE_ROWS');assert.equal(r.cuts[0].sourceRowId,null);}
});
test('same production and length do not imply same piece reference',()=>{
 const r=reconcileIndividuals({plans:[plan()],projectRows:[source(1,'123456 - Test (Line 2) B')]});assert.equal(r.cuts[0].productionStatus,'DOCUMENT_ID_MATCH');assert.equal(r.cuts[0].reason,'REFERENCE_GROUP_DIFFERS');assert.equal(r.totals.uniqueDocumentRows,0);
});
test('quantity mismatch remains unresolved',()=>{
 const r=reconcileIndividuals({plans:[plan()],projectRows:[source(2)]});assert.equal(r.cuts[0].status,'UNRESOLVED_QUANTITY');assert.equal(r.cuts[0].sourceRowId,null);assert.equal(r.sourceCoverage[0].matchedOccurrences,0);
});
test('multiple production numbers and incomplete data do not yield identity',()=>{
 assert.equal(documentProduction('123456 - First; 987654 - Second'),null);
 const p=plan();p.cuts[0].uncertain=true;const r=reconcileIndividuals({plans:[p],projectRows:[source()]});assert.equal(r.cuts[0].productionStatus,'UNRESOLVED');assert.equal(r.totals.uniqueDocumentRows,0);
});
test('pattern repetitions preserve distinct source slots, duplicates invalidate all copies',()=>{
 const p=plan([cut(),{...cut(),sourceSlot:2}]);let r=reconcileIndividuals({plans:[p],projectRows:[source(2)]});assert.equal(r.bars[0].distributionStatus,'PDF_PATTERN_REPETITION');
 p.cuts[1].sourceSlot=1;r=reconcileIndividuals({plans:[p],projectRows:[source(2)]});assert(r.cuts.every(c=>c.reason==='DUPLICATE_CUT_PROVENANCE'));assert.equal(r.totals.rowGroupMatched,0);assert.equal(r.bars[0].distributionStatus,'UNRESOLVED');
});
test('remainder comparison is exact and kerf models never certify physical passes',()=>{
 let r=reconcileIndividuals({plans:[plan()],projectRows:[]});assert.equal(r.bars[0].unexplainedLength32,128);assert(r.bars[0].arithmeticModels.some(m=>m.delta32===0));assert.equal(r.bars[0].modelIsCertified,false);
 const p=plan();p.rest='6 1/32"';r=reconcileIndividuals({plans:[p],projectRows:[]});assert(r.bars[0].arithmeticModels.every(m=>m.delta32!==0));
 p.rest='30"';r=reconcileIndividuals({plans:[p],projectRows:[]});assert.equal(r.bars[0].remainderStatus,'INCONSISTENT');
 delete p.rest;r=reconcileIndividuals({plans:[p],projectRows:[]});assert.equal(r.bars[0].remainderStatus,'UNRESOLVED');
});

test('printed summary differences stay exact and threshold reuse is only a hypothesis',()=>{
 const plan={id:'p',ref:'P',finish:'F',page:1,barqty:1,length:'20"',rest:'5"',restDisposition:'Almac.',sourceSettings:{minimumReusable:'5"'},cuts:[{length:'10"',project:'123456 - A',profileInstance:1,sourceColumn:1,sourceSlot:1,unitInstance:1}]};
 const result=reconcileIndividuals({plans:[plan],projectRows:[],profileSummaries:[{ref:'P',finish:'F',stockLength:'20"',cutLength:'10"',reusedLength:'5"',wasteLength:'5 1/32"'}]});
 const balance=result.profileBalances[0];assert.equal(balance.summaryBalanceDelta32,-1);assert.equal(balance.thresholdReuseDelta32,0);assert.equal(balance.certified,false);assert.equal(result.productionEnabled,false);
 plan.sourceSettings={};const unknown=reconcileIndividuals({plans:[plan],profileSummaries:[{ref:'P',finish:'F',reusedLength:'5"'}]});assert.equal(unknown.profileBalances[0].thresholdReuseDelta32,null);
});
test('baseline-only project evidence cannot identify a source row',()=>{
 const result=reconcileIndividuals({plans:[{id:'p',ref:'P',finish:'F',barqty:1,cuts:[{length:'10"',project:'123456 - A'}]}],projectRows:[{sourceId:'r',ref:'P',finish:'F',length:'10"',reference:'123456 - A',quantity:1,grouping:'BASELINE_ONLY'}]});
 assert.equal(result.totals.uniqueDocumentRows,0);
});

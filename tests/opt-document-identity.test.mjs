import test from 'node:test';import assert from 'node:assert/strict';
import {documentaryOptCode,indexedDocumentIdentity} from '../src/domain/opt-document-identity.js';
test('synthetic project titles keep exact consecutive, preserve descriptive title',()=>{
 for(const [code,suffix] of [['OPT2099-44-4-PINI-22','SYNTHETIC SITE_Synthetic block level 4_SYSTEM'],['OPT2099-44-4-PINI-261','SYNTHETIC LONG SITE_BLOCK E6 V2_Synthetic block production 1_SYSTEM']]){
 const title=code+'_'+suffix;assert.deepEqual(indexedDocumentIdentity([title],code),{opt:code,title});assert.equal(documentaryOptCode(code),code);
 }
});
test('different consecutive, prefix collision, ambiguous title, controls fail closed',()=>{
 for(const title of ['OPT2099-44-4-PINI-220_X','OPT2099-44-4-PINI-22X_X','junk_OPT2099-44-4-PINI-22','OPT2099-44-4-PINI-22\n_X'])assert.equal(indexedDocumentIdentity([title],'OPT2099-44-4-PINI-22'),null);
 assert.equal(indexedDocumentIdentity(['OPT2099-44-4-PINI-22_A','OPT2099-44-4-PINI-22_B'],'OPT2099-44-4-PINI-22'),null);
 assert.deepEqual(indexedDocumentIdentity(['OPT-SYNTH'],'OPT-SYNTH'),{opt:'OPT-SYNTH',title:'OPT-SYNTH'});
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {optAccessAllowed} from '../src/modules/opt-digital.js';
test('OPT reuses existing machining production permissions and denies invalid sessions',()=>{
 for(const access of [['mecanizado'],['mecanizado.proceso'],['mecanizado.produccion']]) assert.equal(optAccessAllowed({valid:true,access}),true);
 for(const access of [[],['mecanizado.recepcion'],['picking'],['mecanizado.opt-digital']]) assert.equal(optAccessAllowed({valid:true,access}),false);
 assert.equal(optAccessAllowed({valid:false,admin:true}),false);
 assert.equal(optAccessAllowed({valid:true,admin:true}),true);
 assert.equal(optAccessAllowed(),false);
});

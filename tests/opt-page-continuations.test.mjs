import test from 'node:test';
import assert from 'node:assert/strict';
import {joinPageContinuations} from '../src/domain/opt-page-continuations.js';

test('page 23 to 24 joins only trailing reference description',()=>{
 const result=joinPageContinuations([
  {page:23,rows:[{kind:'pattern',cells:['1','48 11/16" 1141728 - Witold Kania 1','48 15/16" 908711 - HUGHES 1','48 13/16" 908711 - HUGHES 1','48" 908711 - HUGHES 1'],openColumn:3,continues:true}]},
  {page:24,rows:[{kind:'continuation',text:'* 203,(Line 30) * 203, (Line 31) * 205',endsRow:true},
   {kind:'pattern',cells:['1','48 11/16" 1141728 - Witold Kania 1'],continues:false}]}
 ]);
 assert.equal(result.verified,true);
 assert.equal(result.rows.length,2);
 assert.match(result.rows[0].cells[3],/Line 31/);
 assert.deepEqual(result.rows[0].sourcePages,[23,24]);
});
test('orphan continuation cannot silently create a bar',()=>{
 const result=joinPageContinuations([{page:24,rows:[{kind:'continuation',text:'some text',endsRow:true}]}]);
 assert.equal(result.verified,false);
 assert.equal(result.rows.length,0);
 assert.equal(result.issues[0].code,'CONTINUACION_HUERFANA');
});
test('unclosed page fragment blocks verification',()=>{
 const result=joinPageContinuations([{page:23,rows:[{kind:'pattern',cells:['1','part'],openColumn:1,continues:true}]}]);
 assert.equal(result.verified,false);
 assert.equal(result.issues[0].code,'CONTINUACION_FALTANTE');
});

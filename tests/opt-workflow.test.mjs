import test from 'node:test';
import assert from 'node:assert/strict';
import {parseIndex,reservationGroups} from '../opt-digital/workflow.js';
test('index CSV preserves quoted cells and separates origin/system',()=>{
 const rows=parseIndex('OPT;Reserva;Sistema;Produccion\nA;R;PANEL;"One; two"\nB;R;FRAME;Other\n','csv','RETAIL');
 assert.equal(rows[0].production,'One; two');assert.equal(reservationGroups(rows).length,2);
 assert.equal(reservationGroups([...rows,{...rows[0],origin:'PROYECTO'}]).length,3);
});
test('index rejects missing schema, malformed quoting and excessive rows',()=>{
 assert.throws(()=>parseIndex('name\nx','csv','RETAIL'));
 assert.throws(()=>parseIndex('OPT,Reserva,Sistema\n"x,R,P','csv','RETAIL'));
 assert.throws(()=>parseIndex('{}','json','RETAIL'));
});

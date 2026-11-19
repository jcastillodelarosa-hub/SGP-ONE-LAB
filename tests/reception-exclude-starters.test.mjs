import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterReceptionQueueSystems} from '../src/domain/reception-aluminum-state.js';

test('excludes only the exact Starters y Receptors system from the pending queue', ()=>{
 const kept=[{sistema:'STARTERSYRECEPTORS',estado:'RECIBIDA'},{sistema:'Otro sistema'},{sistema:'STARTERSYRECEPTORS 2'},{sistema:null}];
 const rows=[{sistema:'STARTERSYRECEPTORS',estado:'PENDIENTE'},{sistema:' starters_y-receptors ',estado:'PENDIENTE'},...kept];
 assert.deepEqual(filterReceptionQueueSystems(rows),kept);
 assert.equal(rows.length,6);
 assert.deepEqual(filterReceptionQueueSystems(null),[]);
});

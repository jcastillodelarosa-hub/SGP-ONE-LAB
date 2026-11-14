import test from 'node:test';import assert from 'node:assert/strict';
import {projectDataView} from '../src/domain/opt-project-data.js';
const data={rows:[{item:6,reference:'Orden 10 · ubicación FINAL-LONG',quantity:16,length:'132 5/16"'},{item:7,reference:'Orden 2 · línea\nsegunda',quantity:14,length:'133 1/16"'},{item:8,reference:'Orden 2 · línea\nsegunda',quantity:1,length:'10"'}],totalQuantity:31};
test('reference sorting is stable, numeric-aware and does not mutate printed order/lengths',()=>{
 const before=structuredClone(data);assert.deepEqual(projectDataView(data,{order:'asc'}).rows.map(r=>r.item),[7,8,6]);assert.deepEqual(projectDataView(data,{order:'desc'}).rows.map(r=>r.item),[6,7,8]);assert.deepEqual(projectDataView(data).rows,data.rows);assert.deepEqual(data,before);
});
test('full-reference filter matches final text, accents, case and wrapped lines; totals stay documentary',()=>{
 let r=projectDataView(data,{query:'ubicacion final-long'});assert.equal(r.rows[0].length,'132 5/16"');assert.equal(r.visibleQuantity,16);assert.equal(r.totalQuantity,31);assert.equal(r.totalRows,3);
 r=projectDataView(data,{query:'LÍNEA SEGUNDA'});assert.equal(r.rows.length,2);assert.equal(r.visibleQuantity,15);
 r=projectDataView(data,{query:'absent'});assert.equal(r.rows.length,0);assert.equal(r.visibleQuantity,0);assert.equal(r.totalQuantity,31);
});

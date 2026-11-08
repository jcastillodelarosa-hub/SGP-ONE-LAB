import test from 'node:test';
import assert from 'node:assert/strict';
import {glassLocationDetailMarkup} from '../src/modules/glass-location-detail.js';
const source={produccion:{produccion:'A',orden_oves:'OVE1 · OVE2',tipo_vidrio:'LAMINADO'},detalle:[{categoria:'PREPARADO',posicion:'B1',unidades:3,piezas:[{unidades:2,dimensiones:'100 × 200',marca:'SGD-A'},{unidades:1,dimensiones:'200 × 300',marca:'SGD-B'}]}]};
test('OVES/type and exact location export fields render in native inline accordion',()=>{
 const m=glassLocationDetailMarkup(source);
 assert.match(m.title,/OVES OVE1 · OVE2/);assert.match(m.meta,/LAMINADO/);
 assert.match(m.body,/<details class="glass-burro"><summary>/);assert.match(m.body,/<th>Cantidad<\/th><th>Dimensiones<\/th><th>Marca<\/th>/);
 assert.match(m.body,/<td>2<\/td><td>100 × 200<\/td><td>SGD-A/);
 assert.equal((m.body.match(/<details /g)||[]).length,1);assert.doesNotMatch(m.body,/dialog|modal/);
});
test('missing backend detail is explicit rather than invented or derived from legacy compositions',()=>{
 const m=glassLocationDetailMarkup({detalle:[{categoria:'OTROS',composiciones:'legacy'}]});
 assert.match(m.title,/No informado/);assert.match(m.body,/no está informado/);assert.doesNotMatch(m.body,/legacy/);
});
test('all source text escaped and category filter preserved',()=>{
 const d=structuredClone(source);d.produccion.orden_oves='<img>';d.detalle[0].piezas[0].marca='<script>';
 const m=glassLocationDetailMarkup(d);assert.match(m.title,/&lt;img&gt;/);assert.match(m.body,/&lt;script&gt;/);assert.doesNotMatch(m.body,/<script>/);
 assert.doesNotMatch(glassLocationDetailMarkup(d,'','NOVEDAD').body,/SGD-B/);
});

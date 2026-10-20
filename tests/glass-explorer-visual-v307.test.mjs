import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGlassNodeInsights,glassCoverage,glassRackBreakdown} from '../src/domain/glass-explorer-insights.js';

const data=[
 {reserva:'8690348',parte:'3.3',key_produccion:'O|1',ventanas:9,posicion:'B3-3-4011',unidades:5,preparadas:4,novedad:1,traslado:0},
 {reserva:'8690348',parte:'3.3',key_produccion:'O|1',ventanas:9,posicion:'B3-4-6122',unidades:5,preparadas:5,novedad:0,traslado:0},
 {reserva:'8689722',parte:'1.1',key_produccion:'O|2',ventanas:12,posicion:'B3-3-4011',unidades:11,preparadas:11,novedad:0,traslado:0},
 {reserva:'8690338',parte:'2.1',key_produccion:'O|3',ventanas:3,posicion:'B3-3-4011',unidades:3,preparadas:0,novedad:3,traslado:0},
 {reserva:'8690348',parte:'3.3',key_produccion:'O|4',ventanas:2,posicion:'L8-1',unidades:2,preparadas:0,novedad:0,traslado:2}
];

test('completitud numérica: 9 ventanas y 9 preparados es completa, 8 es parcial',()=>{
 const model=buildGlassNodeInsights(data);
 const order=model.get('o:O|1');
 assert.equal(order.windows,9);
 assert.equal(order.prepared,9);
 assert.equal(order.novelty,1);
 assert.deepEqual(glassCoverage(order),{windows:9,prepared:9,percentage:100,complete:true});
 assert.deepEqual(glassCoverage({windows:9,prepared:8}),{windows:9,prepared:8,percentage:89,complete:false});
 assert.equal(glassCoverage({windows:0,prepared:1}).complete,false);
 assert.equal(glassCoverage({windows:9,prepared:12}).percentage,100);
});

test('no duplicar ventanas de una orden por cada ubicación',()=>{
 const model=buildGlassNodeInsights(data);
 assert.equal(model.get('p:8690348:3.3').windows,11);
 assert.equal(model.get('r:8690348').windows,11);
 assert.equal(model.get('o:O|1').total,10);
 assert.equal(model.get('o:O|1').prepared,9);
 assert.equal(model.get('o:O|1').others,0);
});

test('burro compartido distingue dos reservas preparadas y tercera en novedad',()=>{
 const insights=buildGlassNodeInsights(data);
 const rack=insights.get('b:B3-3-4011');
 assert.equal(rack.total,19);
 assert.equal(rack.prepared,15);
 assert.equal(rack.novelty,4);
 assert.equal(glassRackBreakdown(rack,'prepared').length,2);
 assert.equal(glassRackBreakdown(rack,'all').length,3);
 assert.deepEqual(glassRackBreakdown(rack,'prepared').map(x=>[x.reserva,x.prepared]),[['8689722',11],['8690348',4]]);
 assert.equal(glassRackBreakdown(rack,'all').find(x=>x.reserva==='8690338').novelty,3);
});

test('no confundir una reserva múltiple con burro compartido entre principales',()=>{
 const model=buildGlassNodeInsights([{reserva:'8689722,8689919',parte:'1.1',key_produccion:'X',ventanas:2,posicion:'B-1',unidades:2,preparadas:2}]);
 assert.equal(glassRackBreakdown(model.get('b:B-1'),'prepared').length,1);
 assert.equal(glassRackBreakdown(model.get('b:B-1'),'prepared')[0].reserva,'8689722');
});

test('HTML y JS tienen pop-up, estados de nodo, detalle por reserva, versión nueva',()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert.match(app,/buildGlassNodeInsights\(visibleGlassEfficiencyRows\(\)\)/);
 assert.match(app,/glassRackBreakdown\(metric,mode\)/);
 assert.match(app,/glassCoverage\(metric\)/);
 assert.match(app,/showGlassExplorerTooltip/);
 assert.match(app,/mouseenter/);
 assert.match(app,/focus/);
 assert.match(app,/glassBurroReservas/);
 assert.match(html,/id="glassExplorerTooltip"/);
 assert.match(html,/id="glassBurroReservas"/);
 assert.ok(Number(html.match(/LAB v(\d+)/)?.[1])>=307,'el explorador debe conservar LAB v307 o superior');
 assert.match(css,/\.glass-explorer-tooltip/);
});

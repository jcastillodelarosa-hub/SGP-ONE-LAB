import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGlassRelationGraph,traceGlassRelations,summarizeGlassBurro} from '../src/domain/glass-relations-graph.js';

const rows=[
 {reserva:'8690348',parte:'3.1',key_produccion:'A|panel',produccion:'Orden A',ventanas:8,posicion:'B3-1',unidades:3,preparadas:2,novedad:1,traslado:0},
 {reserva:'8690348',parte:'3.1',key_produccion:'A|panel',produccion:'Orden A',ventanas:8,posicion:'B3-2',unidades:2,preparadas:2,novedad:0,traslado:0},
 {reserva:'8690348',parte:'3.2',key_produccion:'B|panel',produccion:'Orden B',ventanas:5,posicion:'B3-1',unidades:4,preparadas:4,novedad:0,traslado:0},
 {reserva:'8566601',parte:'4',key_produccion:'C|panel',produccion:'Orden C',ventanas:12,posicion:'B3-1',unidades:6,preparadas:3,novedad:2,traslado:1}
];

const has=(trace,ids)=>ids.every(id=>trace.nodes.has(id));
const edgeId=(a,b)=>JSON.stringify([a,b]);

test('reserva, parte y orden muestran ventanas únicas, burro cuenta vidrios',()=>{
 const model=buildGlassRelationGraph(rows);
 assert.equal(model.nodes.get('r:8690348').windows,13);
 assert.equal(model.nodes.get('p:8690348:3.1').windows,8);
 assert.equal(model.nodes.get('p:8690348:3.2').windows,5);
 assert.equal(model.nodes.get('o:A|panel').windows,8);
 assert.equal(model.nodes.get('b:B3-1').glass,9);
 assert.equal(model.nodes.get('b:B3-2').glass,2);
 assert.equal(model.nodes.get('r:8566601').windows,12);
});

test('reserva ilumina todas las partes, ordenes y burros asociados',()=>{
 const model=buildGlassRelationGraph(rows);
 const trace=traceGlassRelations(model,'r:8690348');
 assert.ok(has(trace,['r:8690348','p:8690348:3.1','p:8690348:3.2','o:A|panel','o:B|panel','b:B3-1','b:B3-2']));
 assert.equal(trace.nodes.has('r:8566601'),false);
 assert.ok(trace.edges.has(edgeId('o:A|panel','b:B3-2')));
});

test('parte y orden resaltan ambos extremos sin saltar a otras partes por burro compartido',()=>{
 const model=buildGlassRelationGraph(rows);
 const part=traceGlassRelations(model,'p:8690348:3.1');
 assert.ok(has(part,['r:8690348','o:A|panel','b:B3-1','b:B3-2']));
 assert.equal(part.nodes.has('o:B|panel'),false);
 assert.equal(part.nodes.has('r:8566601'),false);
 const order=traceGlassRelations(model,'o:A|panel');
 assert.ok(has(order,['r:8690348','p:8690348:3.1','b:B3-1','b:B3-2']));
 assert.equal(order.nodes.has('o:B|panel'),false);
});

test('burro resalta todas sus órdenes, partes y reservas compartidas',()=>{
 const model=buildGlassRelationGraph(rows);
 const trace=traceGlassRelations(model,'b:B3-1');
 assert.ok(has(trace,['o:A|panel','o:B|panel','o:C|panel','p:8690348:3.1','p:8690348:3.2','p:8566601:4','r:8690348','r:8566601']));
 assert.ok(trace.edges.has(edgeId('r:8566601','p:8566601:4')));
});

test('detalle del burro suma estados sin duplicar ventanas por orden',()=>{
 const details=summarizeGlassBurro(rows,'B3-1');
 assert.equal(details.orders,3);
 assert.equal(details.parts,3);
 assert.equal(details.reservations,2);
 assert.deepEqual(details.totals,{preparados:9,novedad:3,traslado:1,otros:0,total:13});
 assert.equal(details.items.find(x=>x.key==='A|panel').ventanas,8);
});

test('frontend contiene ventana, doble clic táctil y contadores de nodos',()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(app,/traceGlassRelations\(model,selected\)/);
 assert.match(app,/n\.windows\+' ventanas'/);
 assert.match(app,/n\.glass\+' vidrios'/);
 assert.match(app,/openGlassBurroDetail\(n\.label\)/);
 assert.match(app,/glassExplorer\.lastClickAt<600/);
 assert.match(html,/id="glassBurroModal"/);
 assert.match(html,/id="glassBurroBody"/);
 assert.doesNotMatch(html,/onclick="document.querySelector\('#glassBurroClose'\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {consolidatePieceReferences,totalPieceQuantity} from '../src/domain/piece-detail-views.js';

const pieces=[
  {produccion:'1048620 - Ryan',perfil:'ES-EL400-009',cantidad:3,descripcion:'TOP RAIL'},
  {produccion:'1095607 - SABRY',codigo_sap:'ES-EL400-009',cantidad:4,descripcion:'TOP RAIL'},
  {produccion:'1048620 - Ryan',perfil:'ES-EL400-011',cantidad:5,descripcion:'STILE'},
  {produccion:'1127543 - Snyder',perfil:'ES-EL400-011',cantidad:2,descripcion:'STILE'},
  {produccion:'1127543 - Snyder',perfil:'ES-EL400-030',cantidad:6,descripcion:'INTERLOCK'}
];

test('referencias consolidadas suman piezas sin separación por órdenes',()=>{
 const rows=consolidatePieceReferences(pieces);
 assert.deepEqual(rows,[
  {perfil:'ES-EL400-009',cantidad:7},
  {perfil:'ES-EL400-011',cantidad:7},
  {perfil:'ES-EL400-030',cantidad:6}
 ]);
 assert.equal(rows.length,3);
 assert.equal(totalPieceQuantity(rows),20);
 assert.equal(totalPieceQuantity(pieces),20);
});

test('la agrupación acepta perfil o codigo_sap y conserva la fuente',()=>{
 const original=structuredClone(pieces);
 consolidatePieceReferences(pieces);
 assert.deepEqual(pieces,original);
 assert.deepEqual(consolidatePieceReferences([{perfil:'ES-EL400-010',cantidad:'4'}, {codigo_sap:'ES-EL400-010',cantidad:'3'}]),[{perfil:'ES-EL400-010',cantidad:7}]);
 assert.deepEqual(consolidatePieceReferences([{cantidad:3},{perfil:'P-1',cantidad:'invalid'},{perfil:'P-2',cantidad:2}]),[{perfil:'P-2',cantidad:2}]);
});

test('vista de parte mantiene Por órdenes y añade Solo referencias; orden mantiene resumen',()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(app,/currentPieceContext=production\?'order':'picking-part'/);
 assert.match(app,/currentPieceView=production\?'summary':'pickorders'/);
 assert.match(app,/if\(currentPieceView==='pickorders'\)\{renderPickingPartPieces\(\);return;\}/);
 assert.match(app,/if\(currentPieceView==='references'\)/);
 assert.match(app,/consolidatePieceReferences\(src\)/);
 assert.match(app,/view==='references'&&!\['picking-part','query-reserva'\]/);
 assert.match(html,/data-piece-view="pickorders"/);
 assert.match(html,/data-piece-view="references"/);
 assert.match(html,/data-piece-view="summary"/);
 assert.match(html,/data-piece-view="expanded"/);
 assert.match(html,/data-piece-view="detailed"/);
});

test('resumen y ampliado muestran Descripción al final y cantidad en columna previa',()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/<th>Perfil<\/th><th>Cantidad<\/th><th>Descripción<\/th>/);
 assert.match(app,/<th>Perfil<\/th><th>Marca<\/th><th>Cantidad<\/th><th>Descripción<\/th>/);
 assert.match(app,/pieceDetailColumns=\['perfil','marca','fabricacion','longitud','cantidad','descripcion'\]/);
});

test('scroll se limita al modal de piezas y no altera otros modales',()=>{
 const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(css,/#pieceModal:not\(\[hidden\]\)/);
 assert.match(css,/#pieceModal>\.piece-modal-card/);
 assert.match(css,/#pieceModal \.table-wrap\s*\{[^}]*overflow-x:auto!important;[^}]*overflow-y:auto!important;/s);
 assert.match(css,/#pieceModal \.table-wrap thead th\{position:sticky;top:0/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.ok(Number(html.match(/LAB v(\d+)/)?.[1])>=309);
 assert.match(html,/app\.js\?v=346/);
 assert.match(html,/styles\.css\?v=346/);
});

test('v309 compacta Cantidad en cada vista sin alterar Detallado ni el scroll',()=>{
 const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/pieceTable\.dataset\.pieceView=currentPieceView/);
 for(const view of ['summary','expanded','references','pickorders']){
   assert.ok(css.includes('table[data-piece-view="'+view+'"]'));
 }
 assert.match(css,/width:68px/);
 assert.match(css,/table:not\(\[data-piece-view="detailed"\]\)/);
 assert.match(css,/#pieceModal \.table-wrap/);
});

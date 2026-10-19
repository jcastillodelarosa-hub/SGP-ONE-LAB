import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('v284 order coverage UI',()=>{
 assert.match(app,/sgp_mecanizado_cobertura_ordenes/);
 assert.match(app,/progOrderCoverage/);
 assert.match(app,/REVISAR HISTÓRICO/);
 assert.match(app,/sgp_mecanizado_reconciliar_programacion_legacy/);
 assert.match(html,/LAB v28[4-9]|LAB v2[9-9][0-9]|LAB v[3-9][0-9]{2,}/);
});

test('v286 identifica histórico exacto y permite programar la orden pendiente',()=>{
 assert.match(app,/legacyTarget/);
 assert.match(app,/Histórico identificado:/);
 assert.match(app,/selected!==target/);
 assert.match(app,/PENDIENTE/);
 assert.match(app,/data-program-order/);
 assert.match(app,/Programar esta orden/);
 assert.match(app,/function openProgModal\(reserva,produccion,qty,partPriority=null\)/);
 assert.match(app,/part:selectedPart\|\|null/);
 assert.match(html,/LAB v286/);
});

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
 assert.match(html,/LAB v284/);
});

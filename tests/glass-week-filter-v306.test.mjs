import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {glassWeekKey,indexGlassProductionWeeks,weeksWithGlass,filterGlassRowsByWeek} from '../src/domain/glass-week-filter.js';

const rows=[
 {reserva:'8690348',key_produccion:'prod|1',preparadas:4},
 {reserva:'8690348',key_produccion:'prod|1',preparadas:2},
 {reserva:'8690348',key_produccion:'prod|2',preparadas:5},
 {reserva:'8566601',key_produccion:'prod|3',preparadas:3},
];
const productions=[
 {key_produccion:'prod|1',anio:2026,semana_base:41,semana_actual:43},
 {key_produccion:'prod|2',anio:2026,semana_base:42,semana_actual:42},
 {key_produccion:'prod|3',anio:2026,semana_base:41,semana_actual:41}
];

test('week lookup uses key_produccion and actual week, never primary reservation',()=>{
 const index=indexGlassProductionWeeks(productions);
 assert.equal(index.get('prod|1'),'2026-43');
 assert.equal(index.get('prod|2'),'2026-42');
 assert.equal(index.get('prod|3'),'2026-41');
 assert.deepEqual(weeksWithGlass(rows,index),['2026-43','2026-42','2026-41']);
 assert.equal(filterGlassRowsByWeek(rows,index,'2026-43').length,2);
 assert.equal(filterGlassRowsByWeek(rows,index,'2026-42').length,1);
 assert.equal(filterGlassRowsByWeek(rows,index,'all').length,4);
 assert.equal(filterGlassRowsByWeek(rows,index,'2026-40').length,0);
});
test('year is part of filter key and invalid mapping never fabricates weeks',()=>{
 const index=indexGlassProductionWeeks([
  {key_produccion:'same',anio:2025,semana_actual:43},
  {key_produccion:'different',anio:2026,semana_actual:43},
  {key_produccion:'invalid',anio:2026,semana_actual:null,semana_base:0},
 ]);
 assert.notEqual(index.get('same'),index.get('different'));
 assert.equal(index.has('invalid'),false);
 assert.equal(glassWeekKey(2026,54),null);
 assert.equal(glassWeekKey(2026,1),'2026-1');
});
test('frontend keeps filter scoped to efficiency list and graph without changing global metrics',()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/id="glassEfficiencyWeek"/);
 assert.ok(Number(html.match(/LAB v(\d+)/)?.[1])>=306,'la versión LAB visible debe ser 306 o posterior');
 assert.match(app,/function visibleGlassEfficiencyRows\(/);
 assert.match(app,/visibleGlassEfficiencyRows\(\)\.forEach\(r=>\{/);
 assert.match(app,/sgp_consultar_programacion_semana/);
 assert.match(app,/sgp_picking_semanas/);
 assert.match(app,/async function loadLocationReport\(/);
 assert.match(app,/glassEfficiencyWeek.*addEventListener\('change'/);
});

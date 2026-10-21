import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 normalizeReceptionWeek,attachReceptionWeeks,receptionWeekOptions,filterReceptionRows
} from '../src/domain/picking-reception-weeks.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const reception=[
 {id_entrega:'e1',id_programacion:'p1',reserva:'8672143',parte:'1.3',produccion:'1123975',proyecto:'Hunter Hink',cantidad_ventanas:8,fecha_entrega:'2026-10-16',reservas_compartidas:[{reserva:'8672143'}]},
 {id_entrega:'e2',id_programacion:'p2',reserva:'8672143',parte:'1.3',produccion:'1141947',proyecto:'Hyatt',cantidad_ventanas:12,fecha_entrega:'2026-10-16'},
 {id_entrega:'e3',id_programacion:'p3',reserva:'8672675',parte:'10',produccion:'1148508',proyecto:'Caridad',cantidad_ventanas:2,fecha_entrega:'2026-10-16'},
 {id_entrega:'e4',id_programacion:'p4',reserva:'8672675',parte:'10',produccion:'94723',proyecto:'Service',cantidad_ventanas:1,fecha_entrega:'2026-10-16'}
];
const queue=[
 {id_programacion:'p1',semana:42},{id_programacion:'p2',semana:43},
 {id_programacion:'p3',semana:42},{id_programacion:'p4',semana:null}
];

test('LAB v318: semana operativa se asocia por id_programacion, no por reserva ni fecha',()=>{
 const rows=attachReceptionWeeks(reception,queue);
 assert.deepEqual(rows.map(x=>x.semana),['42','43','42',null]);
 assert.equal(rows[0].fecha_entrega,'2026-10-16');
 assert.equal(rows[1].fecha_entrega,'2026-10-16');
 assert.equal(rows[0].id_entrega,'e1');
 assert.equal(rows[0].reservas_compartidas[0].reserva,'8672143');
 assert.equal(reception[0].semana,undefined,'no mutar registros originales');
});

test('las semanas inválidas, ausentes y conflictivas no se inventan',()=>{
 assert.equal(normalizeReceptionWeek('42'),'42');
 assert.equal(normalizeReceptionWeek(53),'53');
 for(const x of [0,54,-1,'','0','42a','2026-10-16',null,undefined])assert.equal(normalizeReceptionWeek(x),null);
 const rows=attachReceptionWeeks(reception,[{id_programacion:'p1',semana:42},{id_programacion:'p1',semana:43},{id_programacion:'p1',semana:42},{id_programacion:'p2',semana:42}]);
 assert.equal(rows[0].semana,null,'programación ambigua no debe mostrar semana incorrecta');
 assert.equal(rows[1].semana,'42');
 assert.equal(rows[2].semana,null,'id sin coincidencia queda visible sin semana');
});

test('filtro combina semana y búsqueda por orden, proyecto o reserva',()=>{
 const rows=attachReceptionWeeks(reception,queue);
 assert.deepEqual(filterReceptionRows(rows,{week:'42'}).map(x=>x.id_entrega),['e1','e3']);
 assert.deepEqual(filterReceptionRows(rows,{week:'43'}).map(x=>x.id_entrega),['e2']);
 assert.deepEqual(filterReceptionRows(rows,{week:'sin-semana'}).map(x=>x.id_entrega),['e4']);
 assert.deepEqual(filterReceptionRows(rows,{week:'42',search:'Hunter'}).map(x=>x.id_entrega),['e1']);
 assert.deepEqual(filterReceptionRows(rows,{week:'42',search:'Hyatt'}),[]);
 assert.deepEqual(filterReceptionRows(rows,{search:'8672675'}).map(x=>x.id_entrega),['e3','e4']);
 assert.deepEqual(filterReceptionRows(rows,{search:'1141947'}).map(x=>x.id_entrega),['e2']);
 assert.equal(filterReceptionRows(rows).length,4);
});

test('selector solo ofrece semanas presentes, descendentes y con conteo',()=>{
 const options=receptionWeekOptions(attachReceptionWeeks(reception,queue));
 assert.deepEqual(options,[
  {value:'43',label:'Semana 43 (1)',count:1},
  {value:'42',label:'Semana 42 (2)',count:2},
  {value:'sin-semana',label:'Sin semana (1)',count:1}
 ]);
 assert.deepEqual(receptionWeekOptions([]),[]);
});

test('UI muestra semana en cabecera y orden, filtra sin perder auditoría',()=>{
 assert.match(html,/id="pickReceptionWeek"[^>]*aria-label="Filtrar órdenes pendientes de auditoría por semana"/);
 assert.match(html,/id="pickReceptionFilterStatus"[^>]*aria-live="polite"/);
 assert.match(html,/id="pickReceptionWeekWarning"/);
 assert.match(app,/db\.rpc\('sgp_picking_recepcion_cola'/);
 assert.match(app,/db\.rpc\('sgp_picking_cola'/);
 assert.match(app,/attachReceptionWeeks\(reception\.data\|\|\[\],programming\.error\?\[\]:\(programming\.data\|\|\[\]\)\)/);
 assert.match(app,/querySelector\('#pickReceptionWeek'\)\?\.addEventListener\('change',renderPickingReception\)/);
 assert.match(app,/filterReceptionRows\(pickingReceptionRows,\{week,search:q\}\)/);
 assert.match(app,/pick-reception-group-head/);
 assert.match(app,/Semana '\+escapeHtml\(semana\|\|'sin identificar'\)/);
 assert.match(app,/data-audit-pieces=/);
 assert.match(app,/data-audit=/);
 assert.match(app,/function openPickingAudit\(id\)/);
 assert.match(app,/function savePickingAudit\(/);
});

test('fallo de consulta semanal no bloquea la recepción ni inventa semanas',()=>{
 assert.match(app,/if\(reception\.error\)throw reception\.error/);
 assert.match(app,/programming\.error\?\[\]:\(programming\.data\|\|\[\]\)/);
 assert.match(app,/No fue posible consultar la semana de programación/);
 assert.match(app,/requestId!==pickingReceptionLoadId/);
 assert.match(app,/options\.some\(o=>o\.value===previous\)\?previous:''/);
});

test('estilo proporcional y móvil, sin modificar selectores de Entrega de órdenes',()=>{
 assert.match(css,/\.pick-reception-toolbar select\{/);
 assert.match(css,/\.pick-reception-group-head\{display:flex/);
 assert.match(css,/#pickReceptionSearch\{grid-column:1\/-1!important\}/);
 assert.match(css,/#pickReceptionWeek\{grid-column:1!important\}/);
 assert.match(css,/@media\(max-width:430px\)/);
 assert.match(html,/id="pickWeek"/);
 assert.match(html,/id="pickState"/);
 assert.match(html,/id="pickDeliveryTab"/);
 assert.match(html,/id="pickReceptionTab"/);
});

test('versión y archivos de publicación sincronizados',()=>{
 assert.match(html,/LAB v320/);
 assert.match(html,/app\.js\?v=320/);
 assert.match(html,/styles\.css\?v=320/);
});

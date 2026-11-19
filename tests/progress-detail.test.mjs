import test from 'node:test';import assert from 'node:assert/strict';
import {basePhysicalProgress} from '../src/domain/mecanizado-base-progress.js';
import {progressDetailMarkup} from '../src/modules/mecanizado-progress-detail.js';
const base={key_produccion:'DEMO',id_linea:'PANELES_2',anio:2026,semana_base:47,sistema:'SYS',cantidad:12,produccion:'ORDER',reserva_al:'RES'};
const schedule={id_programacion:'PLAN',key_produccion:'DEMO',parte_id:'PLAN',reserva:'RES',sistema:'SYS',produccion:'ORDER',cantidad_programada:8,fecha_programacion:'2026-11-17',turno:'TURNO 1',estado:'PROGRAMADA'};
const run=(extra={})=>basePhysicalProgress({base:[base],receipts:[],shared:[],schedule:[schedule],executions:[],orderExecutions:[],moves:[],links:[],coverage:[],...extra},{year:2026,weeks:[47]});
test('detail reconciles programmed, partial assignment and unassigned without changing totals',()=>{const r=run();assert.equal(r.total.pending,12);assert.equal(r.details[0].unassigned,4);assert.equal(r.details[0].assignments[0].date,'2026-11-17');assert.equal(r.details[0].assignments[0].state,'SIN INICIAR');});
test('order execution and current target appear with exact identity and existing state classes',()=>{const r=run({orderExecutions:[{id_programacion:'PLAN',produccion:'ORDER',estado:'MECANIZADO'}]});const html=progressDetailMarkup(r.details,'SYS',{canManage:true});assert.match(html,/state-mecanizado/);assert.match(html,/data-id="PLAN"/);assert.match(html,/data-production="ORDER"/);assert.match(html,/Sin asignar/);});
test('consultation role never renders writable controls',()=>{const html=progressDetailMarkup(run().details,'SYS');assert.doesNotMatch(html,/data-progress-save/);assert.match(html,/Solo consulta/);});
test('completed legacy aggregate is not silently overwritten from per-order control',()=>{const r=run({schedule:[{...schedule,parte_id:null,key_produccion:null}],executions:[{id_programacion:'PLAN',estado:'PROCESADO',cantidad_procesada:8}]});assert.equal(r.details[0].assignments[0].editable,false);assert.doesNotMatch(progressDetailMarkup(r.details,'SYS',{canManage:true}),/data-progress-save/);});
test('allocation inconsistency blocks editing and never renders misleading zero',()=>{const r=run({executions:[{id_programacion:'PLAN',estado:'MECANIZADO',cantidad_procesada:30}]});assert.equal(r.details[0].pending,null);assert.equal(r.details[0].editable,false);assert.doesNotMatch(progressDetailMarkup(r.details,'SYS',{canManage:true}),/data-progress-save/);assert.match(progressDetailMarkup(r.details,'SYS'),/Por conciliar/);});
test('all filter includes completed orders while pending excludes them',()=>{const r=run({base:[{...base,cantidad:8}],executions:[{id_programacion:'PLAN',estado:'PROCESADO',cantidad_procesada:8}]});assert.match(progressDetailMarkup(r.details,'SYS'),/No hay órdenes/);assert.match(progressDetailMarkup(r.details,'SYS',{filter:'all'}),/ORDER/);});
test('user data escaped in row identity, labels and warnings',()=>{const r=run();r.details[0].production='<script>x</script>';r.details[0].warnings=['<img src=x>'];const html=progressDetailMarkup(r.details,'SYS');assert.doesNotMatch(html,/<script>|<img/);assert.match(html,/&lt;script&gt;/);});

test('Conciliar includes 100% processed claims, exposes the discrepancy and only offers authorized navigation',()=>{
 const details=[{system:'X',production:'YA PROCESADA',reserve:'R1',programmed:10,received:0,processed:10,pending:0,receiptReserves:['R1'],unassigned:0,editable:false,warnings:['Procesadas supera recibidas'],assignments:[{reserva:'R1',date:'2026-11-19',shift:'TURNO 1',quantity:10,processed:10,state:'PROCESADO'}]},{system:'X',production:'ORDEN NUEVA',reserve:'R1',programmed:4,received:0,processed:0,pending:4,unassigned:4,editable:true,warnings:[],assignments:[]}];
 const review=progressDetailMarkup(details,'X',{filter:'review',canReception:true,canProduction:true});
 assert.match(review,/YA PROCESADA/);assert.match(review,/Base 10 · Recibidas 0 · Procesadas 10 · Pendientes 0 · Diferencia 10/);
 assert.match(review,/data-progress-review="recepcion" data-reserve="R1"/);assert.match(review,/data-progress-review="proceso" data-date="2026-11-19" data-shift="TURNO 1"/);
 assert.doesNotMatch(review,/ORDEN NUEVA|data-progress-save/);
 const pending=progressDetailMarkup(details,'X');assert.match(pending,/ORDEN NUEVA/);assert.doesNotMatch(pending,/YA PROCESADA/);
 const unauthorized=progressDetailMarkup(details,'X',{filter:'review'});assert.match(unauthorized,/YA PROCESADA/);assert.doesNotMatch(unauthorized,/data-progress-review="/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {indexReceptionAluminumStates,receptionAluminumStateMeta} from '../src/domain/reception-aluminum-state.js';

test('seguimiento de aluminio usa estado_reserva real y agrupa por reserva',()=>{
 const rows=[
  {id:'100',reserva:'8664654',estado_reserva:'ALUMINIO_ENTREGADO',estado_operativo:'RECIBIDA SIN LEGALIZAR'},
  {id:'101',reserva:' 8664654 ',estado_reserva:'ALUMINIO_ENTREGADO'},
  {id:'102',reserva:'8664662',estado_reserva:'PENDIENTE_BODEGA'},
  {id:'103',reserva:'8672218',estado_reserva:'PENDIENTE_ABASTECIMIENTO'}
 ];
 const copy=structuredClone(rows);
 const index=indexReceptionAluminumStates(rows);
 assert.equal(index.size,3);
 assert.equal(index.get('8664654'),'ALUMINIO_ENTREGADO');
 assert.equal(index.get('8664662'),'PENDIENTE_BODEGA');
 assert.equal(index.get('8672218'),'PENDIENTE_ABASTECIMIENTO');
 assert.deepEqual(rows,copy);
});

test('ausencia, estado desconocido y contradicciones nunca se interpretan como entregado',()=>{
 const index=indexReceptionAluminumStates([
  {reserva:'R1',estado_reserva:'ALUMINIO_ENTREGADO'},
  {reserva:'R1',estado_reserva:'PENDIENTE_BODEGA'},
  {reserva:'R1',estado_reserva:'ALUMINIO_ENTREGADO'},
  {reserva:'R2',estado_operativo:'OK / ENTREGADA EN SISTEMA'},
  {reserva:'R3',estado_reserva:'NO_CLASIFICADO'},
  {reserva:'',estado_reserva:'ALUMINIO_ENTREGADO'}
 ]);
 assert.equal(index.get('R1'),'CONFLICTO');
 assert.equal(index.get('R2'),'SIN_DATO');
 assert.equal(index.get('R3'),'SIN_DATO');
 assert.equal(index.has(''),false);
 assert.equal(receptionAluminumStateMeta(index.get('R1')).label,'ESTADO MIXTO');
 assert.equal(receptionAluminumStateMeta(index.get('R2')).label,'SIN DATO');
 assert.equal(receptionAluminumStateMeta(index.get('NO_EXISTE')).label,'SIN DATO');
 assert.deepEqual(indexReceptionAluminumStates(null),new Map());
});

test('colores y etiquetas: entregado verde, bodega amarillo, abastecimiento rojo',()=>{
 assert.deepEqual(receptionAluminumStateMeta('ALUMINIO_ENTREGADO'),{label:'ALUMINIO ENTREGADO',css:'rec-al-delivered'});
 assert.deepEqual(receptionAluminumStateMeta('PENDIENTE_BODEGA'),{label:'PEND. BODEGA',css:'rec-al-warehouse'});
 assert.deepEqual(receptionAluminumStateMeta('PENDIENTE_ABASTECIMIENTO'),{label:'PEND. ABASTECIMIENTO',css:'rec-al-supply'});
});

test('Recepción conserva auditoría y consulta la misma RPC de seguimiento que el tablero',()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert.match(app,/client\.rpc\('sgp_recepcion_listar'/);
 assert.match(app,/client\.rpc\('sgp_consultar_seguimiento_aluminio'/);
 assert.match(app,/indexReceptionAluminumStates\(/);
 assert.match(app,/receptionAluminumBadge\(r\.reserva\)/);
 assert.match(app,/pending=rows\.filter\(r=>r\.estado!=='RECIBIDA'\)/);
 assert.match(app,/received=rows\.filter\(r=>r\.estado==='RECIBIDA'\)/);
 assert.match(app,/openReception\(b\.dataset\.receive\)/);
 assert.match(html,/id="recTable"/);
 assert.match(html,/id="recReceivedBody"/);
 assert.equal((html.match(/<th>Estado aluminio<\/th>/g)||[]).length,2);
 assert.match(html,/id="recTrackingStatus"/);
 assert.match(css,/\.rec-al-delivered\s*\{[^}]*#dcfce7/);
 assert.match(css,/\.rec-al-warehouse\s*\{[^}]*#fef3c7/);
 assert.match(css,/\.rec-al-supply\s*\{[^}]*#fee2e2/);
});

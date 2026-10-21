import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPickingReportViewModel } from '../src/modules/picking-delivery-report-model.js';
test('report view separates deliveries and missing historical lines',()=>{
 const view=buildPickingReportViewModel([{id_entrega:5,id_programacion:10,produccion:'PROD 1',sistema:'ES-EL400',reserva:'100',parte:'1.1',completa:false,faltantes:[{perfil:'PANEL',cantidad:2}]}],{shift:'Turno 1'});
 assert.equal(view.totals.movimientos,1);
 assert.equal(view.deliveries[0].estado,'PARCIAL');
 assert.equal(view.missing[0].perfil,'PANEL');
 assert.equal(view.filters.shift,'Turno 1');
 assert.match(view.notice,/no representan cantidades físicas/);
});

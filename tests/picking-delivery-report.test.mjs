import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeReportFilters,summarizeDeliveryEvents,flattenDeliveryDetails} from '../src/domain/picking-delivery-report.js';
test('turno operativo y rango de fechas explícitos',()=>{
 assert.deepEqual(normalizeReportFilters({from:'2026-10-20',to:'2026-10-21',shift:'TURNO 2'}),{from:'2026-10-20',to:'2026-10-21',shift:'TURNO 2',system:''});
 assert.throws(()=>normalizeReportFilters({from:'2026-10-21',to:'2026-10-20'}));
 assert.throws(()=>normalizeReportFilters({from:'2026-10-20',to:'2026-10-21',shift:'NOCHE'}));
});
test('movimientos duplicados no duplican producciones únicas',()=>{
 const events=[{id_entrega:'a',id_programacion:'1',produccion:'PROD 1',sistema:'A',completa:false,faltantes:[{cantidad:2,perfil:'PANEL'}]},{id_entrega:'b',id_programacion:'1',produccion:'PROD 1',sistema:'A',completa:true,faltantes:[]},{id_entrega:'c',id_programacion:'1',produccion:'PROD 1',sistema:'B',completa:true,faltantes:[]}];
 const result=summarizeDeliveryEvents(events);
 assert.equal(result.movimientos,3);assert.equal(result.produccionesUnicas,2);
 assert.equal(result.completas,2);assert.equal(result.parciales,1);
 assert.equal(result.filasFaltantes,1);assert.equal(result.cantidadPiezasFaltantes,2);
 assert.equal(flattenDeliveryDetails(events)[0].id_entrega,'a');
});

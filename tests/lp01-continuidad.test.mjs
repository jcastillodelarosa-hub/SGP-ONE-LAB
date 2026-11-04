import test from 'node:test';import assert from 'node:assert/strict';
import {operationalRows,salePendingReason} from '../src/domain/lp01-operation.js';
const row=(key,extra)=>({key,parte:key,linea:'PANELES_2',etapa:'EMPAQUE',fecha:'2026-11-03',turno:1,prioridad:1,sale:1,abierta:true,...extra});
test('antigüedad original prevalece sobre arrastres recientes y prioridad, sin mutar entradas',()=>{
 const rows=[row('newer',{antiguedad_fecha:'2026-11-02',antiguedad_turno:1,prioridad:1}),row('old-night',{antiguedad_fecha:'2026-11-01',antiguedad_turno:2,prioridad:1}),row('old-day',{antiguedad_fecha:'2026-11-01',antiguedad_turno:1,origen_fecha:'2026-11-02',prioridad:9}),row('zero',{sale:0,antiguedad_fecha:'2026-10-20'})];
 const copy=structuredClone(rows);assert.deepEqual(operationalRows({contract:'LP-OPERACION-1',orders:rows}).map(r=>r.key),['old-day','old-night','newer','zero']);assert.deepEqual(rows,copy);
});
test('pendiente de reparto/capacidad/afectaciones nunca se presenta como SALE inicializado',()=>{
 assert.match(salePendingReason({sale:null,sale_estado:'REPARTO_COORDINADOR_REQUERIDO'}),/reparto/);
 assert.match(salePendingReason({sale:null,sale_estado:'CAPACIDAD_TURNO_PENDIENTE'}),/capacidad/);
 assert.match(salePendingReason({sale:20,sale_estado:'AFECTACIONES_REQUIEREN_COORDINADOR'}),/antes de aumentar/);
 assert.match(salePendingReason({sale:0,sale_fuente:'COORDINADOR'}),/conservada/);
 assert.match(salePendingReason({sale:20,sale_fuente:'OFICIAL_ELEGIBLE'}),/saldo oficial elegible/);
});

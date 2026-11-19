import test from 'node:test';
import assert from 'node:assert/strict';
import {sgpPickingCurrentShift,sgpPickingFutureShift} from '../src/domain/picking-shifts.js';
import {pickingPdtHistoryDate,pickingPdtMoveContract,isDefinitivePdtRejection} from '../src/ui/picking-pdt-flow.js';
test('recepción usa calendario local y el día de inicio del nocturno',()=>{
 for(const [t,expected] of [
  ['2026-11-16T09:59:00Z',{fecha:'2026-11-15',turno:'TURNO 2'}],['2026-11-16T10:00:00Z',null],
  ['2026-11-16T12:00:00Z',{fecha:'2026-11-16',turno:'TURNO 1'}],
  ['2026-11-15T23:00:00Z',{fecha:'2026-11-15',turno:'TURNO 2'}],
  ['2026-11-19T09:00:00Z',{fecha:'2026-11-18',turno:'TURNO 2'}]
 ])assert.deepEqual(sgpPickingCurrentShift(new Date(t)),expected);
 assert.equal(sgpPickingFutureShift('2026-11-15','TURNO 2',new Date('2026-11-15T22:59:00Z')),true);
 assert.equal(sgpPickingFutureShift('2026-11-15','TURNO 2',new Date('2026-11-15T23:00:00Z')),false);
 assert.equal(sgpPickingFutureShift('2026-11-31','TURNO 1'),true);
});
test('la entrega y el journal antiguo siguen usando v1; recepción operativa conserva datos en v2',()=>{
 const base={p_id:'detalle',p_request_id:'clave',p_tipo:'reception',p_cantidad:2,p_observacion:null};
 assert.equal(pickingPdtMoveContract(base,'sesión')[0],'sgp_pdt_picking_movimiento_v1');
 const withDate={...base,p_fecha_recepcion:'2026-11-18',p_turno_recepcion:'TURNO 2'};
 const [name,p]=pickingPdtMoveContract(withDate,'sesión');
 assert.equal(name,'sgp_pdt_picking_recepcion_v2');
 assert.equal(p.p_idempotency_key,'clave');
 assert.equal(p.p_fecha_recepcion,'2026-11-18');assert.equal(p.p_turno_recepcion,'TURNO 2');
 assert.equal(pickingPdtMoveContract({...withDate,p_tipo:'delivery'},'sesión')[0],'sgp_pdt_picking_movimiento_v1');
});
test('historial no infiere fecha operativa ni turno de una recepción antigua',()=>{
 assert.equal(pickingPdtHistoryDate({tipo:'ENTREGA',fecha:'real'}),'real');
 assert.match(pickingPdtHistoryDate({tipo:'RECEPCION',fecha:'real'}),/no registrados · Registro: real/);
 assert.equal(pickingPdtHistoryDate({tipo:'RECEPCION',fecha:'real',fecha_recepcion:'2026-11-18',turno_recepcion:'TURNO 2'}),'18/11/2026 · Turno 2');
 assert.equal(isDefinitivePdtRejection({code:'P0001',message:'PDT_FLOW_RECEPCION_SIN_SALDO_EN_TURNO'}),true);
});

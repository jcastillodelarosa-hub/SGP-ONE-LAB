import test from 'node:test';import assert from 'node:assert/strict';
import {auditOperationalTime,auditDecisions} from '../../src/domain/picking-audit.js';
const config={lunes_sabado:{turno1:{inicio:'07:00',fin:'19:00'},turno2:{inicio:'19:00',fin:'07:00'}},domingo:{turno1:{inicio:'07:00',fin:'18:00'},turno2:{inicio:'18:00',fin:'05:00'}}};
test('medianoche usa día anterior y horario del domingo',()=>assert.deepEqual(auditOperationalTime(new Date('2026-11-02T07:00:00Z'),config),{fecha:'2026-11-01',turno:'TURNO 2'}));
test('domingo de día usa su configuración',()=>assert.deepEqual(auditOperationalTime(new Date('2026-11-01T23:30:00Z'),config),{fecha:'2026-11-01',turno:'TURNO 2'}));
test('hueco tras turno dominical requiere selección explícita',()=>assert.deepEqual(auditOperationalTime(new Date('2026-11-02T11:00:00Z'),config),{fecha:'2026-11-02',turno:''}));
test('sin configuración vigente no inventa turno',()=>assert.throws(()=>auditOperationalTime(new Date(),{})));
test('no aceptar implícitamente, motivo obligatorio y cantidad válida',()=>{assert.throws(()=>auditDecisions([{}]));assert.throws(()=>auditDecisions([{accion:'ELIMINAR'}]));assert.equal(auditDecisions([{accion:'ACEPTAR'}]).length,1);assert.throws(()=>auditDecisions([{accion:'MODIFICAR',motivo:'x',cantidad:-1}]));});

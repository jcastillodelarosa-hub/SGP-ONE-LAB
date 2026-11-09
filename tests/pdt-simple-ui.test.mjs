import test from 'node:test';
import assert from 'node:assert/strict';
import {pdtOperationalContext,advancesForm} from '../src/modules/pdt-v2-presentation.js';
test('Colombia date and shift boundaries include overnight and month rollover',()=>{
 for(const [instant,date,shift] of [
 ['2026-11-09T11:59:00Z','2026-11-08','T2'],['2026-11-09T12:00:00Z','2026-11-09','T1'],
 ['2026-11-09T23:59:00Z','2026-11-09','T1'],['2026-11-10T00:00:00Z','2026-11-09','T2'],
 ['2027-01-01T05:00:00Z','2026-12-31','T2']])assert.deepEqual(pdtOperationalContext(new Date(instant)),{date,shift});
});
test('simple controls show quantities, prefilled date, no sequential state form',()=>{
 const html=advancesForm([{fabricacion:'A',saldo:5,en_proceso:2,avance_neto:3}],[],{},String);
 assert.match(html,/data-operation="start"/);assert.match(html,/data-operation="advance"/);
 assert.match(html,/data-date type="date" value="\d{4}-\d{2}-\d{2}"/);
 assert.match(html,/<td>3<\/td><td>2<\/td><td>3<\/td>/);
 assert.match(html,/<details data-pdt-advanced>/);assert.doesNotMatch(html,/data-stage|Guardar estado|CORTE|MECANIZADO/);
});

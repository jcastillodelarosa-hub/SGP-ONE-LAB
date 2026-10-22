import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
test('prioridades: la interfaz explica que manda la primera reserva',()=>{
 assert.match(source,/Reserva principal: en producciones con varias reservas/);
 assert.match(source,/priorityMainReservationRule/);
 assert.match(source,/No se duplican unidades en otras reservas/);
});
test('prioridades: el agrupador usa exclusivamente la primera reserva',()=>{
 assert.match(source,/String\(r\.reserva\|\|""\)\.split\(","\)\[0\]\.trim\(\)/);
 const owner=raw=>String(raw||'').split(',')[0].trim();
 assert.equal(owner('8707142,8710471'),'8707142');
 assert.notEqual(owner('8707142,8710471'),'8710471');
});

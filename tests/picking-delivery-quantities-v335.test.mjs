import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeDeliveredWindows} from '../src/domain/picking-delivery-report.js';
const event=(id,system,quantity,missing=[],production='A')=>({id_programacion:id,produccion:production,sistema:system,cantidad_programada:quantity,faltantes:missing.map(cantidad=>({cantidad}))});
test('count windows once per order even with repeated delivery movements',()=>{const s=summarizeDeliveredWindows([event('1','MX',10,[2]),event('1','MX',10,[1]),event('2','MX',5),event('3','SG',4,[1])]);assert.equal(s.cantidad_orden,19);assert.equal(s.cantidad_efectiva,15);assert.deepEqual(s.porSistema.find(x=>x.sistema==='MX'),{sistema:'MX',cantidad_orden:15,cantidad_efectiva:12,ordenes_sin_cantidad:0});});
test('different systems and productions remain distinct; no negative effective windows',()=>{const s=summarizeDeliveredWindows([event('1','MX',2,[5]),event('1','SG',3,[]),event('1','MX',4,[],'B')]);assert.equal(s.cantidad_orden,9);assert.equal(s.cantidad_efectiva,7);});
test('unknown quantity is not silently treated as delivered',()=>{const s=summarizeDeliveredWindows([event('1','MX',null,[1])]);assert.equal(s.ordenes_sin_cantidad,1);});
test('controller displays columns, branded header and PDF quantities',()=>{const s=readFileSync(new URL('../src/modules/picking-delivery-report-controller.js',import.meta.url),'utf8');assert.match(s,/Ventanas programadas/);assert.match(s,/Ventanas estimadas/);assert.match(s,/favicon-sgp[.]svg/);assert.match(s,/quantitySummary/);});

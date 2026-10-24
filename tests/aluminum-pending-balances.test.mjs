import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNcNumbers, validateFabricationDistribution, calculateFabricationBalances, ncAvailability } from '../src/domain/aluminum-pending-balances.js';

test('NC multiples se normalizan', () => {
  assert.deepEqual(normalizeNcNumbers('1006163,1006164,1006163'), ['1006163','1006164']);
});

test('9 piezas repartidas en dos fabricaciones', () => {
  const rows = [
    {fabricacion:'E17',longitud:109.9375,acabado:'DS',cantidad:5},
    {fabricacion:'E17-1',longitud:109.9375,acabado:'DS',cantidad:4}
  ];
  assert.equal(validateFabricationDistribution(rows,9).total,9);
  assert.throws(() => validateFabricationDistribution(rows,8));
  assert.equal(validateFabricationDistribution([{...rows[0],cantidad:8}],8).total,8);
});

test('avance parcial 2 piezas deja saldo 7', () => {
  const rows = [
    {id_detalle:'a',fabricacion:'E17',cantidad_validada:5},
    {id_detalle:'b',fabricacion:'E17-1',cantidad_validada:4}
  ];
  const moves = [{id_movimiento:'m1',id_detalle:'a',tipo:'AVANCE',cantidad:2}];
  assert.equal(calculateFabricationBalances(rows,moves).saldo,7);
  assert.deepEqual(calculateFabricationBalances(rows,moves).details.map(x=>x.saldo),[3,4]);
  assert.equal(calculateFabricationBalances(rows,[...moves,{tipo:'REVERSO',id_movimiento_revertido:'m1'}]).saldo,9);
});

test('NC parcial y REPO OK automatico', () => {
  const ncs=[{estado:'Finalizada'},{estado:'Finalizada'},{estado:'Consultada'}];
  assert.equal(ncAvailability(ncs).estado,'PARCIAL');
  assert.equal(ncAvailability(ncs.map(x=>({...x,estado:'Finalizada'}))).estado,'REPO_OK');
  assert.equal(ncAvailability([]).estado,'SIN_NC');
});

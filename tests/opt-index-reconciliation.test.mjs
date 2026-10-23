import test from 'node:test';
import assert from 'node:assert/strict';
import { primaryReservation, reconcileOptIndex } from '../src/domain/opt-index-reconciliation.js';

test('multiple reservations use only the first as owner', () => {
  assert.equal(primaryReservation('8707142,8710471'), '8707142');
  const result = reconcileOptIndex([{ reserva_al: '8707142,8710471', sistema: 'ES-EL400' }], [
    { reservation: '8707142', system: 'ES-EL400', opt: 'OPT-A' },
    { reservation: '8710471', system: 'ES-EL400', opt: 'OPT-B' }
  ]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].opts, ['OPT-A']);
  assert.equal(result[0].pdfStatus, 'NO_VERIFICADO');
});
test('requires system match and flags conflicting OPTs', () => {
  const production = [{ reserva_al: '8696742', sistema: 'ES-EL400' }];
  const index = [
    { reservation: '8696742', system: 'ES-MX4000', opt: 'WRONG' },
    { reservation: '8696742', system: 'ES-EL400', opt: 'ONE' },
    { reservation: '8696742', system: 'ES-EL400', opt: 'TWO' }
  ];
  const result = reconcileOptIndex(production, index);
  assert.equal(result[0].status, 'CONFLICTO');
  assert.deepEqual(result[0].opts, ['ONE', 'TWO']);
});
test('unmatched reservation remains unresolved, not falsely missing PDF', () => {
  const result = reconcileOptIndex([{ reserva_al: '8558585', sistema: 'ES-EL400' }], []);
  assert.equal(result[0].status, 'SIN_CORRESPONDENCIA');
  assert.equal(result[0].pdfStatus, 'NO_VERIFICADO');
});

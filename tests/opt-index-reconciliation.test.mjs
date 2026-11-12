// Synthetic fixture labels and identifiers; no private source records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { primaryReservation, reconcileOptIndex } from '../src/domain/opt-index-reconciliation.js';

test('multiple reservations use only the first as owner', () => {
  assert.equal(primaryReservation('9000001,9000002'), '9000001');
  const result = reconcileOptIndex([{ reserva_al: '9000001,9000002', sistema: 'ES-EL400' }], [
    { reservation: '9000001', system: 'ES-EL400', opt: 'OPT-A' },
    { reservation: '9000002', system: 'ES-EL400', opt: 'OPT-B' }
  ]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].opts, ['OPT-A']);
  assert.equal(result[0].pdfStatus, 'NO_VERIFICADO');
});
test('requires system match and flags conflicting OPTs', () => {
  const production = [{ reserva_al: '9000003', sistema: 'ES-EL400' }];
  const index = [
    { reservation: '9000003', system: 'ES-MX4000', opt: 'WRONG' },
    { reservation: '9000003', system: 'ES-EL400', opt: 'ONE' },
    { reservation: '9000003', system: 'ES-EL400', opt: 'TWO' }
  ];
  const result = reconcileOptIndex(production, index);
  assert.equal(result[0].status, 'CONFLICTO');
  assert.deepEqual(result[0].opts, ['ONE', 'TWO']);
});
test('unmatched reservation remains unresolved, not falsely missing PDF', () => {
  const result = reconcileOptIndex([{ reserva_al: '9000004', sistema: 'ES-EL400' }], []);
  assert.equal(result[0].status, 'SIN_CORRESPONDENCIA');
  assert.equal(result[0].pdfStatus, 'NO_VERIFICADO');
});

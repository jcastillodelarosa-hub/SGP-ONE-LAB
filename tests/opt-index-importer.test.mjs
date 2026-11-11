// Synthetic fixture labels and identifiers; no private source records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOptRows, validateOptColumns } from '../src/domain/opt-index-importer.js';
import { reconcileOptIndex } from '../src/domain/opt-index-reconciliation.js';

test('Retail rows preserve origin and first reservation', () => {
  const rows = [{ Consecutivo: 'PLI-132', '# Reserva': '9000001,9000002', Sistema: 'ES-EL400', Proyecto: 'Example' }];
  assert.equal(validateOptColumns(rows, 'RETAIL').valid, true);
  const [entry] = normalizeOptRows(rows, 'RETAIL');
  assert.equal(entry.reservation, '9000001');
  assert.equal(entry.origin, 'RETAIL');
  assert.equal(entry.opt, 'PLI-132');
});
test('Proyecto rows accept accented optimization identifier', () => {
  const rows = [{ 'ID Optimización': 'OPT2099-44-4-SYNTH-66', 'N. Reserva': '9000003', Sistema: 'ES-EL400', 'Descripción': 'SYNTHETIC BUILDING' }];
  assert.equal(validateOptColumns(rows, 'PROYECTO').valid, true);
  const entries = normalizeOptRows(rows, 'PROYECTO');
  const result = reconcileOptIndex([{ reserva_al: '9000003', sistema: 'ES-EL400' }], entries);
  assert.deepEqual(result[0].opts, ['OPT2099-44-4-SYNTH-66']);
  assert.equal(result[0].status, 'CONFIRMADO_INDICE');
});
test('rejects invalid structure and unknown source', () => {
  assert.equal(validateOptColumns([{ foo: 1 }], 'RETAIL').valid, false);
  assert.throws(() => normalizeOptRows([], 'OTHER'), /Origen no admitido/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOptRows, validateOptColumns } from '../src/domain/opt-index-importer.js';
import { reconcileOptIndex } from '../src/domain/opt-index-reconciliation.js';

test('Retail rows preserve origin and first reservation', () => {
  const rows = [{ Consecutivo: 'PLI-132', '# Reserva': '8707142,8710471', Sistema: 'ES-EL400', Proyecto: 'Example' }];
  assert.equal(validateOptColumns(rows, 'RETAIL').valid, true);
  const [entry] = normalizeOptRows(rows, 'RETAIL');
  assert.equal(entry.reservation, '8707142');
  assert.equal(entry.origin, 'RETAIL');
  assert.equal(entry.opt, 'PLI-132');
});
test('Proyecto rows accept accented optimization identifier', () => {
  const rows = [{ 'ID Optimización': 'OPT2026-44-4-PINI-66', 'N. Reserva': '8696742', Sistema: 'ES-EL400', 'Descripción': 'PLANTATION' }];
  assert.equal(validateOptColumns(rows, 'PROYECTO').valid, true);
  const entries = normalizeOptRows(rows, 'PROYECTO');
  const result = reconcileOptIndex([{ reserva_al: '8696742', sistema: 'ES-EL400' }], entries);
  assert.deepEqual(result[0].opts, ['OPT2026-44-4-PINI-66']);
  assert.equal(result[0].status, 'CONFIRMADO_INDICE');
});
test('rejects invalid structure and unknown source', () => {
  assert.equal(validateOptColumns([{ foo: 1 }], 'RETAIL').valid, false);
  assert.throws(() => normalizeOptRows([], 'OTHER'), /Origen no admitido/);
});

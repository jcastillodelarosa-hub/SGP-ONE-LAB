import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOptRows, validateOptColumns } from '../src/domain/opt-index-importer.js';

test('real Optima Optimizaciones header names', () => {
 const rows = [{ consecutive:'OPT2026-44-4-PINI-66', reserva:'8696742', sistemas:'ES-EL400', 'Nombre Produccion':'PLANTATION', total_barras:12, total_cortes:16 }];
 assert.equal(validateOptColumns(rows,'PROYECTO').valid,true);
 const [item] = normalizeOptRows(rows,'PROYECTO');
 assert.equal(item.opt,'OPT2026-44-4-PINI-66');
 assert.equal(item.reservation,'8696742');
 assert.equal(item.system,'ES-EL400');
 assert.equal(item.production,'PLANTATION');
});

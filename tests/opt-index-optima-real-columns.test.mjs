// Synthetic fixture labels and identifiers; no private source records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOptRows, validateOptColumns } from '../src/domain/opt-index-importer.js';

test('real Optima Optimizaciones header names', () => {
 const rows = [{ consecutive:'OPT2099-44-4-SYNTH-66', reserva:'9000003', sistemas:'ES-EL400', 'Nombre Produccion':'SYNTHETIC BUILDING', total_barras:12, total_cortes:16 }];
 assert.equal(validateOptColumns(rows,'PROYECTO').valid,true);
 const [item] = normalizeOptRows(rows,'PROYECTO');
 assert.equal(item.opt,'OPT2099-44-4-SYNTH-66');
 assert.equal(item.reservation,'9000003');
 assert.equal(item.system,'ES-EL400');
 assert.equal(item.production,'SYNTHETIC BUILDING');
});

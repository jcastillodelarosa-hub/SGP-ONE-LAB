import {loadPdtPickingSimple} from './pdt-picking-simple.js';

/** Read only. Quantity coverage comes from the existing delivery ledger, never from machining. */
export async function loadProductionPdtDeliveries(client, token, rows, capabilities) {
  const summaries = new Map();
  let cursor = 0;
  async function readNext() {
    while (cursor < rows.length) {
      const row = rows[cursor++], id = String(row.id_pendiente);
      if (row.contrato_pdt !== 'V2' || row.validacion_estado !== 'VALIDADO' ||
          !capabilities?.picking_cuantitativo || !Array.isArray(row.detalles) || !row.detalles.length) {
        summaries.set(id, {status: 'unknown'});
        continue;
      }
      try {
        const state = await loadPdtPickingSimple(client, token, row.id_pendiente, row.detalles);
        if (state.legacy) summaries.set(id, {status: 'legacy'});
        else {
          const sum = key => state.detalles.reduce((total, detail) => total + detail[key], 0);
          summaries.set(id, {status: 'verified', delivered: sum('entregada'), total: sum('cantidad_validada'),
            pending: sum('saldo_entrega'), available: sum('disponible_entrega'), finished: state.finalizado});
        }
      } catch {
        summaries.set(id, {status: 'unavailable'});
      }
    }
  }
  await Promise.all(Array.from({length: Math.min(rows.length, 4)}, readNext));
  return summaries;
}

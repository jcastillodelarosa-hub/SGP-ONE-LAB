// Normalize rows already extracted from Retail and Optima workbooks.
// Parsing XLSX bytes and persisting PDF files are deliberately out of scope.
import { primaryReservation } from './opt-index-reconciliation.js';

const canonical = text => String(text ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const pick = (row, aliases) => {
  const columns = Object.keys(row ?? {});
  const col = columns.find(name => aliases.some(alias => canonical(name) === canonical(alias)));
  return col === undefined ? '' : row[col];
};
const asText = value => String(value ?? '').trim();

export function normalizeOptRows(rows, origin) {
  if (!Array.isArray(rows)) throw new TypeError('Las filas deben ser un arreglo');
  if (!['RETAIL', 'PROYECTO'].includes(origin)) throw new Error('Origen no admitido');
  return rows.map((row, index) => {
    const opt = asText(pick(row, ['Consecutivo', 'Consecutivo OPT', 'consecutive', 'ID Optimización', 'Id Optimizacion', 'OPT']));
    return {
      origin, sourceRow: index + 2, opt,
      reservation: primaryReservation(pick(row, ['# Reserva', 'N. Reserva', 'No Reserva', 'Reserva', 'Numero reserva'])),
      system: asText(pick(row, ['Sistema', 'sistemas'])),
      production: asText(pick(row, ['Producción', 'Produccion', 'Descripción', 'Descripcion', 'Nombre Produccion'])),
      project: asText(pick(row, ['Proyecto'])),
      finish: asText(pick(row, ['Acabado']))
    };
  }).filter(row => row.opt);
}

export function validateOptColumns(rows, origin) {
  if (!Array.isArray(rows) || !rows.length) return { valid: false, reason: 'ARCHIVO_VACIO' };
  const sample = rows[0];
  const keys = Object.keys(sample ?? {}).map(canonical);
  const has = aliases => aliases.some(alias => keys.includes(canonical(alias)));
  const optColumn = has(['Consecutivo', 'Consecutivo OPT', 'consecutive', 'ID Optimización', 'Id Optimizacion', 'OPT']);
  const reservationColumn = has(['# Reserva', 'N. Reserva', 'No Reserva', 'Reserva', 'Numero reserva']);
  const systemColumn = has(['Sistema', 'sistemas']);
  return { valid: optColumn && reservationColumn && systemColumn,
    reason: optColumn && reservationColumn && systemColumn ? null : 'COLUMNAS_REQUERIDAS_AUSENTES',
    origin };
}

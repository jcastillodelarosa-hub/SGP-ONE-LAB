// Normalize rows already extracted from Retail and Optima workbooks.
// Parsing XLSX bytes and persisting PDF files are deliberately out of scope.
import { primaryReservation } from './opt-index-reconciliation.js';

const canonical = text => String(text ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const aliases = Object.fromEntries(Object.entries({
  opt:['Consecutivo','Consecutivo OPT','consecutive','ID Optimización','Id Optimizacion','OPT'],
  reservation:['# Reserva','N. Reserva','No Reserva','Reserva','Numero reserva'],
  system:['Sistema','sistemas'],
  production:['Producción','Produccion','Descripción','Descripcion','Nombre Produccion'],
  project:['Proyecto'],finish:['Acabado']
}).map(([field,names])=>[field,new Set(names.map(canonical))]));
// Canonicalize each column once per row, preserving original first-column priority.
// Rows may have different key order/schema; never reuse the first row's mapping.
const rowPicker = row => {
  const columns=Object.keys(row??{}).map(name=>({name,canonical:canonical(name)}));
  return field=>{const column=columns.find(column=>aliases[field].has(column.canonical));return column===undefined?'':row[column.name];};
};
const asText = value => String(value ?? '').trim();

export function normalizeOptRows(rows, origin, {exactReservations=false}={}) {
  if (!Array.isArray(rows)) throw new TypeError('Las filas deben ser un arreglo');
  if (!['RETAIL', 'PROYECTO'].includes(origin)) throw new Error('Origen no admitido');
  return rows.map((row, index) => {
    const pick=rowPicker(row),opt=asText(pick('opt'));
    return {
      origin, sourceRow: index + 2, opt,
      // PROYECTO cells are documentary selectors, not SGP primary-reservation lists.
      // Preserve all text so a multi-reservation cell cannot silently choose one.
      reservation: (origin === 'PROYECTO' || exactReservations ? asText : primaryReservation)(pick('reservation')),
      system: asText(pick('system')),
      production: asText(pick('production')),
      project: asText(pick('project')),
      finish: asText(pick('finish'))
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

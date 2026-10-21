/**
 * Glass counts on carried orders come from their original programming, never from
 * the carry RPC (which deliberately reports only pending production/status data).
 * Match by production + line key, not the visible order name.
 */
export function glassCountLabel(value) {
 if(value === null || value === undefined || value === '') return '—';
 const count = Number(value);
 return Number.isInteger(count) && count >= 0 ? String(count) : '—';
}

export function mergeCarryOrdersWithGlass(carryOrders, originalOrders) {
 const originalByKey = new Map(), ambiguousKeys = new Set();
 for(const order of Array.isArray(originalOrders) ? originalOrders : []) {
  const key = String(order?.key_produccion ?? '').trim();
  if(!key) continue;
  if(originalByKey.has(key)) ambiguousKeys.add(key);
  else originalByKey.set(key, order);
 }
 return (Array.isArray(carryOrders) ? carryOrders : []).map(order => {
  const key = String(order?.key_produccion ?? '').trim();
  const original = key && !ambiguousKeys.has(key) ? originalByKey.get(key) : null;
  return {
   ...order,
   vidrio_preparado: original && glassCountLabel(original.vidrio_preparado) !== '—' ? Number(original.vidrio_preparado) : null,
   vidrio_novedad: original && glassCountLabel(original.vidrio_novedad) !== '—' ? Number(original.vidrio_novedad) : null,
   vidrio_traslado: original && glassCountLabel(original.vidrio_traslado) !== '—' ? Number(original.vidrio_traslado) : null
  };
 });
}

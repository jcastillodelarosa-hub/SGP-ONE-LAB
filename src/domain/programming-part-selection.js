// Selection of existing weekly parts, not the partial-production editor.
const value = x => String(x ?? '').trim();
export function programmingPartState(reserva, part, coverage = []) {
  const fail = reason => ({ready: false, reason, quantity: 0, orders: []});
  if (!value(part?.prioridad) || !Array.isArray(part?.ordenes) || !part.ordenes.length) return fail('Parte sin composición verificable.');
  const rows = coverage.filter(c => value(c.reserva) === value(reserva) && value(c.prioridad_semanal) === value(part.prioridad));
  if (rows.some(c => c.estado_orden === 'REVISAR')) return fail('Identifica primero las órdenes del histórico.');
  const keys = new Set(), pending = [];
  for (const order of part.ordenes) {
    const key = value(order.key_produccion), quantity = Number(order.cantidad);
    if (!key || keys.has(key) || !Number.isSafeInteger(quantity) || quantity <= 0) return fail('Identidad o cantidad de orden por verificar.');
    keys.add(key);
    const matches = rows.filter(c => value(c.key_produccion) === key);
    if (matches.length !== 1) return fail('Actualiza para comprobar la cobertura de todas las órdenes.');
    const c = matches[0], assigned = Number(c.cantidad_programada ?? (c.estado_orden === 'PROGRAMADA' ? c.cantidad : 0));
    if (!['PENDIENTE', 'PROGRAMADA', 'PARCIAL'].includes(c.estado_orden) || Number(c.cantidad) !== quantity || !Number.isSafeInteger(assigned) || assigned < 0 || assigned > quantity) return fail('Cobertura por conciliar; revisa las órdenes.');
    if (c.estado_orden === 'PARCIAL' || (assigned > 0 && assigned < quantity) || (c.origen_cobertura === 'PARCIAL_AGREGADA' && assigned < quantity)) return fail('Completa la cantidad parcial desde «Programar esta orden».');
    if ((c.estado_orden === 'PROGRAMADA') !== (assigned === quantity)) return fail('Estado y cantidad no coinciden; actualiza Programación.');
    if (!assigned) pending.push({key, production: value(order.produccion), quantity});
  }
  if (!pending.length) return fail('Esta parte ya está programada.');
  if (part.ordenes.reduce((n, o) => n + Number(o.cantidad), 0) !== Number(part.cantidad)) return fail('La cantidad de la parte no coincide con sus órdenes.');
  return {ready: true, reason: '', quantity: pending.reduce((n, o) => n + o.quantity, 0), orders: pending};
}
export function programmingPartsPlan(reserva, parts, priorities, coverage) {
  if (!Array.isArray(priorities) || !priorities.length) throw Error('Selecciona al menos una parte pendiente.');
  if (new Set(priorities.map(value)).size !== priorities.length) throw Error('Hay partes repetidas en la selección.');
  const keys = new Set();
  return priorities.map(priority => {
    const matches = parts.filter(p => value(p.prioridad) === value(priority));
    if (matches.length !== 1) throw Error('No se pudo identificar la parte ' + priority + '. Actualiza Programación.');
    const state = programmingPartState(reserva, matches[0], coverage);
    if (!state.ready) throw Error('Parte ' + priority + ': ' + state.reason);
    for (const order of state.orders) {
      if (keys.has(order.key)) throw Error('Una orden aparece en varias partes. Revisa la composición antes de programar.');
      keys.add(order.key);
    }
    return {priority: value(priority), quantity: state.quantity, orders: state.orders};
  });
}
export function programmingPlanSignature(plan) {
  return JSON.stringify(plan.map(p => [p.priority, p.quantity, p.orders.map(o => [o.key, o.production, o.quantity]).sort((a,b) => a[0].localeCompare(b[0]))]));
}
export function validateProgrammingDestination({date, shift, priority}, count = 1) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + 'T12:00:00Z')) || new Date(date + 'T12:00:00Z').toISOString().slice(0,10) !== date) throw Error('Selecciona una fecha válida.');
  if (!['TURNO 1', 'TURNO 2'].includes(shift)) throw Error('Selecciona un turno válido.');
  if (!Number.isSafeInteger(priority) || priority < 1 || priority + count - 1 > 2147483647) throw Error('La prioridad inicial debe ser un entero positivo válido.');
}

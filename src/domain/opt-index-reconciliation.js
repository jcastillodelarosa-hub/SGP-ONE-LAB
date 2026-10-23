// OPT Digital: pure index matching; no database or PDF writes.
export function primaryReservation(value) {
  return String(value ?? '').split(',')[0].trim();
}
export function reconcileOptIndex(productions, entries) {
  const norm = value => String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  const groups = new Map();
  for (const p of productions) {
    const reservation = primaryReservation(p.reserva_al);
    if (!reservation) continue;
    const id = reservation + '|' + norm(p.sistema);
    if (!groups.has(id)) groups.set(id, { reservation, system: p.sistema, productions: [] });
    groups.get(id).productions.push(p);
  }
  return [...groups.values()].map(group => {
    const matched = entries.filter(e => primaryReservation(e.reservation) === group.reservation && norm(e.system) === norm(group.system));
    const opts = [...new Set(matched.map(e => String(e.opt ?? '').trim()).filter(Boolean))];
    return { reservation: group.reservation, system: group.system, opts,
      status: opts.length === 1 ? 'CONFIRMADO_INDICE' : opts.length > 1 ? 'CONFLICTO' : 'SIN_CORRESPONDENCIA',
      pdfStatus: 'NO_VERIFICADO' };
  });
}

/**
 * PDT aluminum pure business rules.
 * No persistence or RPC calls. Input from backend must be authenticated/validated.
 */
export function normalizeNcNumbers(input) {
  const items = Array.isArray(input) ? input : String(input ?? '').split(/[,;\n]+/);
  const seen = new Set();
  return items.flatMap(value => String(value ?? '').split(/[,;\n]+/))
    .map(value => value.trim()).filter(value => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}
function positiveInt(value, label) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0 || n > 2147483647) throw new Error(label + ' debe ser entero positivo');
  return n;
}
export function validateFabricationDistribution(details, expectedTotal = null) {
  if (!Array.isArray(details) || !details.length) throw new Error('Se requiere al menos una fabricación');
  const seen = new Set();
  const normalized = details.map((item, index) => {
    const fabricacion = String(item.fabricacion ?? '').trim();
    const acabado = String(item.acabado ?? '').trim();
    const longitud = Number(item.longitud);
    const cantidad = positiveInt(item.cantidad, 'Cantidad de fabricación ' + (index + 1));
    if (!fabricacion || !acabado || !Number.isFinite(longitud) || longitud <= 0) {
      throw new Error('Fabricación, longitud y acabado son obligatorios');
    }
    const key = item.id_pieza ? JSON.stringify(['source',String(item.id_pieza)]) : JSON.stringify([fabricacion.toLowerCase(),longitud,acabado.toUpperCase()]);
    if (seen.has(key)) throw new Error('Fabricación duplicada');
    seen.add(key);
    return { id_pieza: item.id_pieza ?? null, fabricacion, longitud, acabado, cantidad };
  });
  const total = normalized.reduce((sum, row) => sum + row.cantidad, 0);
  if (!Number.isSafeInteger(total) || total > 2147483647) throw new Error('Cantidad total fuera de rango');
  if (expectedTotal !== null && total !== positiveInt(expectedTotal, 'Total validado')) {
    throw new Error('La distribución no coincide con el total validado');
  }
  return { total, details: normalized };
}
export function calculateFabricationBalances(details, movements = []) {
  if (!Array.isArray(details) || !Array.isArray(movements)) throw new Error('Datos inválidos');
  if (new Set(details.map(d => String(d.id_detalle))).size !== details.length) throw new Error('Detalle duplicado');
  const rows = new Map(details.map(d => [String(d.id_detalle), {
    id_detalle: String(d.id_detalle), fabricacion: d.fabricacion,
    validada: positiveInt(d.cantidad_validada, 'Cantidad validada'), solucionada: 0, saldo: 0
  }]));
  const advances = new Map();
  const reversed = new Set();
  for (const m of movements) {
    if (m.tipo === 'AVANCE') {
      if (advances.has(String(m.id_movimiento))) throw new Error('Movimiento duplicado');
      advances.set(String(m.id_movimiento), m);
    } else if (m.tipo === 'REVERSO') {
      const target = String(m.id_movimiento_revertido ?? '');
      if (reversed.has(target)) throw new Error('Reverso duplicado');
      reversed.add(target);
    } else throw new Error('Tipo de movimiento inválido');
  }
  for (const m of movements.filter(x => x.tipo === 'REVERSO')) {
    const original = advances.get(String(m.id_movimiento_revertido));
    if (!original) throw new Error('Reverso sin avance original');
    if (String(m.id_detalle ?? original.id_detalle) !== String(original.id_detalle)
        || Number(m.cantidad ?? original.cantidad) !== Number(original.cantidad)) {
      throw new Error('Reverso no coincide con el avance original');
    }
  }
  for (const [id, m] of advances) {
    const row = rows.get(String(m.id_detalle));
    if (!row) throw new Error('Movimiento de fabricación desconocida');
    if (!reversed.has(id)) row.solucionada += positiveInt(m.cantidad, 'Cantidad de avance');
  }
  for (const row of rows.values()) {
    row.saldo = row.validada - row.solucionada;
    if (row.saldo < 0) throw new Error('Avances superan cantidad validada');
  }
  const list = [...rows.values()];
  return { details: list, validada: list.reduce((s,r)=>s+r.validada,0),
    solucionada: list.reduce((s,r)=>s+r.solucionada,0),
    saldo: list.reduce((s,r)=>s+r.saldo,0) };
}
export function ncAvailability(ncs) {
  const seen=new Set();
  const rows = (Array.isArray(ncs) ? ncs : []).filter(x=>{
    const key=x.consecutivo||x.cod_nc||x.referencia;
    if(!key)return true;
    if(seen.has(key))return false;seen.add(key);return true;
  });
  const completed = rows.filter(x => x.activo !== false &&
    !['INACTIVA','NO_ENCONTRADA','AMBIGUA'].includes(x.resolucion) &&
    ['FINALIZADA','FINALIZADO'].includes(String(x.estado ?? '').trim().toUpperCase())).length;
  const total = rows.length;
  return { total, finalizadas: completed,
    estado: total === 0 ? 'SIN_NC' : completed === total ? 'REPO_OK' : completed > 0 ? 'PARCIAL' : 'PENDIENTE',
    posibleSolucion: total > 0 && completed === total };
}

/**
 * Business-level pending closure: machining completion is NOT delivery.
 * Advisory only. Closure stays disabled until server evidence is implemented.
 * A browser boolean (or any client-supplied evidence object) is never certification.
 */
export function pendingClosureState(balances) {
  const saldo = Number(balances?.saldo);
  if (!Number.isSafeInteger(saldo) || saldo < 0) throw new Error('Saldo inválido');
  if (saldo > 0) return { closed: false, stage: 'MECANIZADO_PENDIENTE' };
  return { closed: false, stage: 'PROCESADO_PENDIENTE_ENTREGA' };
}

/**
 * Pure, conservative NC indicator for a single pending item.
 * NC finalization is a potential solution, never proof of physical stock.
 */
export function pendingNcAlert(ncs, readySince = null, now = new Date()) {
  const availability = ncAvailability(ncs);
  const start = readySince ? new Date(readySince) : null;
  const end = now instanceof Date ? now : new Date(now);
  const validDates = start && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime());
  const elapsedHours = validDates ? Math.max(0, Math.floor((end.getTime() - start.getTime()) / 3600000)) : null;
  return { ...availability, elapsedHours, requiresAction: availability.finalizadas > 0,
    physicallyAvailable: null };
}

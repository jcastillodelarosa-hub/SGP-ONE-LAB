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
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(label + ' debe ser entero positivo');
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
    const key = [String(item.id_pieza ?? ''), fabricacion, longitud, acabado].join('|');
    if (seen.has(key)) throw new Error('Fabricación duplicada');
    seen.add(key);
    return { id_pieza: item.id_pieza ?? null, fabricacion, longitud, acabado, cantidad };
  });
  const total = normalized.reduce((sum, row) => sum + row.cantidad, 0);
  if (!Number.isSafeInteger(total)) throw new Error('Cantidad total fuera de rango');
  if (expectedTotal !== null && total !== positiveInt(expectedTotal, 'Total validado')) {
    throw new Error('La distribución no coincide con el total validado');
  }
  return { total, details: normalized };
}
export function calculateFabricationBalances(details, movements = []) {
  if (!Array.isArray(details) || !Array.isArray(movements)) throw new Error('Datos inválidos');
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
  for (const target of reversed) if (!advances.has(target)) throw new Error('Reverso sin avance original');
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
  const rows = Array.isArray(ncs) ? ncs : [];
  const completed = rows.filter(x => ['FINALIZADA','FINALIZADO'].includes(String(x.estado ?? '').trim().toUpperCase())).length;
  const total = rows.length;
  return { total, finalizadas: completed,
    estado: total === 0 ? 'SIN_NC' : completed === total ? 'REPO_OK' : completed > 0 ? 'PARCIAL' : 'PENDIENTE',
    posibleSolucion: total > 0 && completed === total };
}

/**
 * LAB v308 · Vista de referencias consolidadas para los detalles de piezas.
 * Esta transformación es local y de solo lectura: agrupa únicamente por perfil
 * dentro del conjunto de piezas que ya autorizó y filtró la RPC del módulo.
 */
export function consolidatePieceReferences(rows = []) {
  const totals = new Map();
  for (const row of rows || []) {
    const profile = String(row?.perfil ?? row?.codigo_sap ?? '').trim();
    if (!profile) continue;
    const value = Number(row?.cantidad ?? 0);
    if (!Number.isFinite(value)) continue;
    const previous = totals.get(profile) || 0;
    totals.set(profile, previous + value);
  }
  return [...totals].map(([perfil,cantidad])=>({perfil,cantidad}))
    .sort((a,b)=>a.perfil.localeCompare(b.perfil,undefined,{numeric:true}));
}
export function totalPieceQuantity(rows = []) {
  return (rows || []).reduce((total, row) => {
    const value=Number(row?.cantidad??0);
    return Number.isFinite(value)?total+value:total;
  },0);
}

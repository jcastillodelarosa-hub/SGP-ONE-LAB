/**
 * Filtro de semana de programación para ubicaciones de vidrio.
 * Usa exclusivamente key_produccion: nunca infiere la semana por reserva o parte.
 */
export function glassWeekKey(year, week) {
  const y=Number(year), w=Number(week);
  return Number.isInteger(y)&&y>=2020&&y<=2100&&Number.isInteger(w)&&w>=1&&w<=53 ? y+'-'+w : null;
}

export function indexGlassProductionWeeks(productions) {
  const map=new Map();
  for(const p of productions||[]) {
    const key=String(p?.key_produccion??'').trim();
    const week=glassWeekKey(p?.anio,p?.semana_actual??p?.semana_base);
    if(key&&week) map.set(key,week);
  }
  return map;
}

export function weeksWithGlass(rows, weekByProduction) {
  return [...new Set((rows||[]).map(r=>weekByProduction.get(String(r.key_produccion))).filter(Boolean))]
    .sort((a,b)=>{const [ay,aw]=a.split('-').map(Number),[by,bw]=b.split('-').map(Number);return by-ay||bw-aw});
}

export function filterGlassRowsByWeek(rows, weekByProduction, selected='all') {
  if(!selected||selected==='all') return rows||[];
  return (rows||[]).filter(r=>weekByProduction.get(String(r.key_produccion))===selected);
}

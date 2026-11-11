// Reject incomplete PDF extraction before counting physical pieces.
// A plan can continue on another page; source page is evidence, not a pattern identity.
export function auditOptPatterns(patterns, expected = {}) {
  if (!Array.isArray(patterns)) throw new TypeError('Patrones inválidos');
  const issues = [];
  let bars = 0, cuts = 0;
  const seen = new Set();
  for (const [index, p] of patterns.entries()) {
    const row = index + 1;
    const count = Number(p.perf);
    if (!Number.isSafeInteger(count) || count <= 0) { issues.push({row,code:'PERF_INVALIDO'}); continue; }
    if (p.continues || p.incomplete) issues.push({row,code:'PATRON_INCOMPLETO'});
    if (!Array.isArray(p.cuts) || !p.cuts.length) { issues.push({row,code:'SIN_CORTES'}); continue; }
    let perBar = 0;
    for (const cut of p.cuts) {
      const qty = Number(cut.quantity);
      if (!Number.isSafeInteger(qty) || qty <= 0 || !cut.length || !cut.reference) {
        issues.push({row,code:'CORTE_INCOMPLETO'}); continue;
      }
      perBar += qty;
    }
    const id = String(p.patternId ?? '');
    if (!id) issues.push({row,code:'SIN_IDENTIFICADOR_PATRON'});
    else if (seen.has(id)) issues.push({row,code:'PATRON_DUPLICADO'});
    seen.add(id);
    bars += count;
    cuts += count * perBar;
  }
  if (expected.bars != null && bars !== expected.bars) issues.push({code:'TOTAL_BARRAS_DIFIERE',expected:expected.bars,actual:bars});
  if (expected.cuts != null && cuts !== expected.cuts) issues.push({code:'TOTAL_CORTES_DIFIERE',expected:expected.cuts,actual:cuts});
  return {bars,cuts,issues,verified:issues.length===0};
}

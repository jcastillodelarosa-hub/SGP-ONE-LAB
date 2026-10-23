// Pure physical cutting model. One row-pattern may repeat over multiple physical bars.
// Never silently assume that an unverified PDF extraction is complete.
export function expandPhysicalCuts(patterns) {
  if (!Array.isArray(patterns)) throw new TypeError('Patrones inválidos');
  const bars = [];
  for (const [rowIndex, pattern] of patterns.entries()) {
    const barCount = Number(pattern.perf);
    if (!Number.isSafeInteger(barCount) || barCount < 1) throw new Error('Cantidad #perf inválida en fila ' + (rowIndex + 1));
    if (!Array.isArray(pattern.cuts) || !pattern.cuts.length) throw new Error('Fila sin cortes ' + (rowIndex + 1));
    for (let bar = 1; bar <= barCount; bar++) {
      const cuts = [];
      for (const [column, cut] of pattern.cuts.entries()) {
        const quantity = Number(cut.quantity);
        if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Cant. inválida en fila ' + (rowIndex + 1));
        for (let piece = 1; piece <= quantity; piece++) {
          cuts.push({
            id: [pattern.opt, pattern.page, pattern.profile, pattern.code, rowIndex + 1, bar, column + 1, piece].join('|'),
            length: cut.length, reference: cut.reference, production: cut.production,
            row: rowIndex + 1, bar, column: column + 1, piece, completed: false
          });
        }
      }
      bars.push({
        id: [pattern.opt, pattern.page, pattern.profile, pattern.code, rowIndex + 1, bar].join('|'),
        profile: pattern.profile, finish: pattern.finish, stockLength: pattern.stockLength,
        page: pattern.page, sourceRow: rowIndex + 1, bar, rest: pattern.rest,
        cuts
      });
    }
  }
  return bars;
}
export function summarizePhysicalCuts(bars) {
  return { bars: bars.length, cuts: bars.reduce((sum, bar) => sum + bar.cuts.length, 0),
    completed: bars.reduce((sum, bar) => sum + bar.cuts.filter(cut => cut.completed).length, 0) };
}

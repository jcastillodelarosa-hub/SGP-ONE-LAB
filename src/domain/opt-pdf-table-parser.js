// Optima PDF 15-column table adapter. Input is a structured table extracted
// from PDF; no OCR guesses, database writes or completion-state mutation.
const cellPattern = /^(\d+(?:\s+\d+\/\d+)?"?)\s+(.+?)\s+(\d+)$/;
export function parseOptimaCutCell(cell) {
  if (cell == null || !String(cell).trim()) return null;
  const lines = String(cell).trim().split(/\r?\n/);
  const match = lines[0].trim().match(cellPattern);
  if (!match) throw new Error('Celda de corte no reconocida');
  return {length:match[1], reference:[match[2],...lines.slice(1)].join(' ').trim(),quantity:Number(match[3])};
}
export function parseOptimaWideTable(table, metadata={}) {
  if (!Array.isArray(table) || !table.length || table[0].length !== 15 || table[0][0] !== '#perf') throw new Error('Tabla OPT no compatible');
  return table.slice(1).filter(row => String(row?.[0] ?? '').trim()).map((row,i)=>{
    const perf=Number(row[0]);
    if (!Number.isSafeInteger(perf) || perf < 1) throw new Error('Cantidad #perf inválida');
    const cuts=[1,4,7,10].map(index=>parseOptimaCutCell(row[index])).filter(Boolean);
    if (!cuts.length) throw new Error('Patrón sin cortes');
    return {...metadata,patternId:[metadata.opt,metadata.page,i+1].join('|'),perf,cuts,rest:row[13]};
  });
}

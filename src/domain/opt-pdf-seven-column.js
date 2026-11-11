// Seven-column Optima tables may begin with an unfinished row from a prior page.
// Return unresolved fragments explicitly: never mark the plan verified by inference.
import { parseOptimaCutCell } from './opt-pdf-table-parser.js';
export function parseOptimaSevenColumnTable(table, metadata={}) {
  if (!Array.isArray(table) || !table.every(row=>Array.isArray(row)&&row.length===7)) throw new Error('Tabla de 7 columnas inválida');
  const patterns=[], issues=[];
  table.forEach((row,index)=>{
    const raw=String(row[0]??'').trim();
    if (!raw) {
      if (row.slice(1).some(value=>String(value??'').trim())) issues.push({row:index,code:'CONTINUACION_PENDIENTE'});
      return;
    }
    const perf=Number(raw);
    if (!Number.isSafeInteger(perf)||perf<1) {issues.push({row:index,code:'PERF_INVALIDO'});return;}
    const cuts=[];
    for (const col of [1,2,3,4]) {
      if (!String(row[col]??'').trim())continue;
      try { const cut=parseOptimaCutCell(row[col]);if(cut)cuts.push(cut); }
      catch {issues.push({row:index,column:col,code:'CELDA_INCOMPLETA'}); }
    }
    if (!cuts.length) issues.push({row:index,code:'SIN_CORTES'});
    patterns.push({...metadata,patternId:[metadata.opt,metadata.page,metadata.table,index].join('|'),perf,cuts,rest:row[5],incomplete:!cuts.length});
  });
  return {patterns,issues,verified:issues.length===0};
}

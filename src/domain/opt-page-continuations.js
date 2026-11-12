// Join split text cells at PDF page boundaries before parsing cutting patterns.
// Only merge into an explicitly open row, never into the next numbered pattern.
export function joinPageContinuations(pages) {
  if (!Array.isArray(pages)) throw new TypeError('Páginas inválidas');
  const rows=[],issues=[];
  let pending=null;
  for (const page of pages) {
    if (!Array.isArray(page.rows)) throw new TypeError('Filas inválidas');
    for (const [index, raw] of page.rows.entries()) {
      const row={...raw, page:page.page};
      if (row.kind==='continuation') {
        if (!pending) {issues.push({page:page.page,row:index,code:'CONTINUACION_HUERFANA'});continue;}
        if (row.column != null && !Number.isSafeInteger(row.column)) {issues.push({page:page.page,row:index,code:'COLUMNA_INVALIDA'});continue;}
        const column=row.column ?? pending.openColumn;
        if (!Number.isSafeInteger(column) || column<0 || column>=pending.cells.length) {
          issues.push({page:page.page,row:index,code:'SIN_COLUMNA_CONTINUACION'});continue;
        }
        pending.cells[column]=[pending.cells[column],row.text].filter(Boolean).join('\n');
        pending.sourcePages.push(page.page);
        if (row.endsRow) {pending.incomplete=false;pending=null;}
        continue;
      }
      if (pending) {issues.push({page:page.page,row:index,code:'PATRON_ANTERIOR_SIN_CERRAR'});pending=null;}
      if (row.kind!=='pattern' || !Array.isArray(row.cells)) {issues.push({page:page.page,row:index,code:'FILA_DESCONOCIDA'});continue;}
      const record={...row,sourcePages:[page.page],incomplete:!!row.continues};
      rows.push(record);
      if (record.incomplete) pending=record;
    }
  }
  if (pending) issues.push({page:pending.page,code:'CONTINUACION_FALTANTE'});
  return {rows,issues,verified:issues.length===0 && rows.every(row=>!row.incomplete)};
}

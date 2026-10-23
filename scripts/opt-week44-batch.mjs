#!/usr/bin/env node
// OPT week-44 inventory and fail-closed batch gate. Offline, read-only, no credentials.
// Input: CSV export of the Drive inventory with columns opt,file_path (local PDF),origin.
// Requires only Node built-ins; does not parse or approve PDF cuts.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function parseCsv(text) {
  const rows=[]; let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}
    else if(c==='"')quoted=true;
    else if(c===','){row.push(cell);cell='';}
    else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new Error('CSV con comillas sin cerrar');
  if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
  return rows;
}
export function auditInventory(indexCsv,inventoryCsv){
  const index=parseCsv(indexCsv), inventory=parseCsv(inventoryCsv);
  const indexHeader=index.shift().map(x=>x.trim().toLowerCase());
  const invHeader=inventory.shift().map(x=>x.trim().toLowerCase());
  const indexCol=indexHeader.indexOf('opt'),invCol=invHeader.indexOf('opt');
  if(indexCol<0||invCol<0)throw new Error('Ambos CSV requieren columna opt');
  const names=rows=>rows.map(r=>String(r[0]??'').trim());
  const expected=index.map(r=>String(r[indexCol]??'').trim()).filter(Boolean);
  const actual=inventory.map(r=>String(r[invCol]??'').trim()).filter(Boolean);
  const duplicates=actual.filter((x,i)=>actual.indexOf(x)!==i);
  const exp=new Set(expected),got=new Set(actual);
  return {expected:exp.size,found:got.size,missing:[...exp].filter(x=>!got.has(x)).sort(),unexpected:[...got].filter(x=>!exp.has(x)).sort(),duplicates:[...new Set(duplicates)].sort()};
}
export function inspectPdf(filename){
  const bytes=fs.readFileSync(filename);
  const name=path.basename(filename);
  const match=name.match(/^(OPT\d{4}-\d{1,2}-\d+-[A-Z0-9]+-\d+)\.pdf$/i);
  return {opt:match?.[1]??null,file:name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
    pdfHeader:bytes.subarray(0,5).toString('ascii')==='%PDF-',status:'PENDIENTE_AUDITORIA_FISICA'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
  const [indexFile,inventoryFile,folder]=process.argv.slice(2);
  if(!indexFile||!inventoryFile||!folder){console.error('Uso: node scripts/opt-week44-batch.mjs indice.csv inventario.csv carpeta_pdf');process.exitCode=2;}
  else {
    const audit=auditInventory(fs.readFileSync(indexFile,'utf8'),fs.readFileSync(inventoryFile,'utf8'));
    const pdfs=fs.readdirSync(folder).filter(f=>f.toLowerCase().endsWith('.pdf')).map(f=>inspectPdf(path.join(folder,f)));
    const report={schema:'sgp.opt.week44.inventory.v1',...audit,localPdfs:pdfs,fullyVerified:0,
      note:'El inventario y la cabecera PDF NO validan barras, cortes, longitudes, planos ni referencias'};
    console.log(JSON.stringify(report,null,2));
    if(audit.missing.length||audit.unexpected.length||audit.duplicates.length||pdfs.some(p=>!p.pdfHeader))process.exitCode=2;
  }
}

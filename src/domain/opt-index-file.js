import {readWorksheetGrid} from './powerbi/xlsx-reader.js';
import {normalizeOptRows,validateOptColumns} from './opt-index-importer.js';
// Import preparation only. These groups are index claims, never validated SGP identities.
export function parseIndex(text,format,origin){
 let rows;
 if(format==='json')rows=JSON.parse(text);
 else {
  const delimiter=text.split(/\r?\n/,1)[0].includes(';')?';':',';const grid=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))grid.push(row);row=[];cell='';}else cell+=c;}
  if(quoted)throw Error('Comillas incompletas en índice');row.push(cell);if(row.some(Boolean))grid.push(row);
  const headers=grid.shift()||[];if(new Set(headers).size!==headers.length)throw Error('Columnas duplicadas');rows=grid.map(values=>Object.fromEntries(headers.map((key,i)=>[key,values[i]||''])));
 }
 if(!Array.isArray(rows)||rows.length>20000||!validateOptColumns(rows,origin).valid)throw Error('Índice inválido: requiere OPT, Reserva y Sistema');
 return normalizeOptRows(rows,origin);
}
export async function parseIndexWorkbook(bytes,origin,{sheetName=origin==='PROYECTO'?'Optimizaciones':'ARCHIVOS',DOMParser=globalThis.DOMParser,readWorksheetXML}={}){
 const grid=await readWorksheetGrid(bytes,{sheetName,DOMParser,readWorksheetXML,allowOtherSheets:true,allowUnusedMacroDefault:true,allowStringCells:true,maxFileBytes:5*1024*1024});
 const [header,...data]=grid.rows;if(!header)throw Error('Índice vacío');
 const keys=header.values.map(v=>String(v??'').trim());if(keys.some(k=>!k)||new Set(keys).size!==keys.length)throw Error('Cabecera vacía o duplicada');
 const rows=data.map(row=>Object.fromEntries(keys.map((key,i)=>[key,row.values[i]??''])));
 if(!validateOptColumns(rows,origin).valid)throw Error('La hoja no contiene OPT, Reserva y Sistema');
 return {sheet:grid.sheet,entries:normalizeOptRows(rows,origin),sourceRows:data.length};
}

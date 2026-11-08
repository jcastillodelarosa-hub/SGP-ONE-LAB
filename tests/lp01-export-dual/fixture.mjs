import {storeZip} from '../lp01-powerbi/zip-fixture.mjs';
const esc = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function packingXlsx(records=[['A',7,1],['B',5,1]],date='2026-11-07') {
 const header = ['Año Prog','Semana','Tipo Orden','Proyecto','Produccion','Sistema','Cant. Procesada','Linea PDA','Estación','dia_trabajo','turno_trabajo_extra'];
 const data = records.map(([name,quantity,shift=1,system='QA'])=>[2026,45,'QA','QA',name,system,quantity,'PANELES 2','Empaque',date,shift===1?'1. 07:00 am - 07:00 pm':'2. 07:00 pm - 07:00 am']);
 const rows = [header,...data,['Total',null,null,null,null,null,records.reduce((n,r)=>n+r[1],0)],['Filtros aplicados:\nlinea_pda es PANELES 2\nIncluido (1) noviembre (mes) + 7 (dia)']];
 const xml = rows.map((row,i)=>`<row r="${i+1}">${row.map(value=>value===null?'<c/>':typeof value==='number'?`<c><v>${value}</v></c>`:`<c t="inlineStr"><is><t>${esc(value)}</t></is></c>`).join('')}</row>`).join('');
 const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 return storeZip(new Map([
  ['[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'],
  ['xl/workbook.xml',`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Export" sheetId="1" r:id="rId1"/></sheets></workbook>`],
  ['xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
  ['xl/worksheets/sheet1.xml',`<worksheet xmlns="${ns}"><sheetData>${xml}</sheetData></worksheet>`]
 ]));
}
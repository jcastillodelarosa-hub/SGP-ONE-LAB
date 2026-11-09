// Minimal OOXML workbook writer. No network, packages, formulas or external relationships.
const encoder=new TextEncoder();
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function zip(entries){
 const local=[],central=[];let offset=0;
 for(const[name,content]of entries){const n=encoder.encode(name),bytes=encoder.encode(content),crc=crc32(bytes),header=new Uint8Array(30+n.length),record=new Uint8Array(46+n.length),h=new DataView(header.buffer),c=new DataView(record.buffer);
  h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(12,33,true);h.setUint32(14,crc,true);h.setUint32(18,bytes.length,true);h.setUint32(22,bytes.length,true);h.setUint16(26,n.length,true);header.set(n,30);local.push(header,bytes);
  c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);c.setUint32(16,crc,true);c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);c.setUint16(28,n.length,true);c.setUint32(42,offset,true);record.set(n,46);central.push(record);offset+=header.length+bytes.length;
 }
 const size=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);
 const out=new Uint8Array(offset+size+22);let position=0;for(const bytes of[...local,...central,end]){out.set(bytes,position);position+=bytes.length;}return out;
}
function xml(value){const text=String(value??'');if(text.length>32767)throw new Error('Un campo excede el límite de texto de Excel.');return Array.from(text).filter(c=>{const n=c.codePointAt(0);return n===9||n===10||n===13||(n>=32&&n<=0xd7ff)||(n>=0xe000&&n<=0xfffd)||(n>=0x10000&&n<=0x10ffff);}).join('').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
const columns=['Prioridad','Reserva','Producción','Sistema','Acabado','Ventanas','Fecha preparación','Lote mecanizado','Lote vidrio','OVES'];
export function preparationWorkbook(rows){
 if(!Array.isArray(rows)||!rows.length)throw new Error('No hay producciones para exportar.');
 if(rows.length>1048575)throw new Error('El reporte supera el límite de filas de Excel.');
 const matrix=[columns,...rows.map(row=>columns.map(k=>row[k]??''))];
 const cells=matrix.map((row,index)=>'<row r="'+(index+1)+'">'+row.map((value,col)=>{const ref=String.fromCharCode(65+col)+(index+1);return typeof value==='number'&&Number.isFinite(value)?`<c r="${ref}" t="n"><v>${value}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;}).join('')+'</row>').join('');
 const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
 return zip([
 ['[Content_Types].xml',declaration+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
 ['_rels/.rels',declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
 ['xl/workbook.xml',declaration+'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Preparacion vidrio" sheetId="1" r:id="rId1"/></sheets></workbook>'],
 ['xl/_rels/workbook.xml.rels',declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
 ['xl/worksheets/sheet1.xml',declaration+`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:J${matrix.length}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="2" width="16" customWidth="1"/><col min="3" max="5" width="24" customWidth="1"/><col min="6" max="6" width="12" customWidth="1"/><col min="7" max="10" width="22" customWidth="1"/></cols><sheetData>${cells}</sheetData><autoFilter ref="A1:J${matrix.length}"/></worksheet>`]
 ]);
}

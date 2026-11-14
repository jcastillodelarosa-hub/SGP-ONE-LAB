/** Bounded OOXML reader shared by browser and server. Never evaluates formulas. */
const MAX_FILE=2*1024*1024,MAX_XML=16*1024*1024,MAX_ENTRIES=64;
const decode=new TextDecoder('utf-8',{fatal:true});
const fail=message=>{throw Error(message);};
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export const crc32=data=>{let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
async function inflate(bytes,limit){
 const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),parts=[];let size=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit)fail('XLSX descomprimido excede el límite');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const out=new Uint8Array(size);let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;
}
export async function unzipXlsx(input,{maxFileBytes=MAX_FILE}={}){
 if(!Number.isSafeInteger(maxFileBytes)||maxFileBytes<1||maxFileBytes>5*1024*1024)fail('Límite XLSX inválido');
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 if(bytes.length<22||bytes.length>maxFileBytes)fail('Archivo XLSX inválido o mayor del límite permitido');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u16=p=>view.getUint16(p,true),u32=p=>view.getUint32(p,true);
 let end=-1;for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(u32(p)===0x06054b50&&p+22+u16(p+20)===bytes.length){end=p;break;}
 if(end<0||u16(end+4)||u16(end+6)||u16(end+8)!==u16(end+10))fail('ZIP incompatible, segmentado o corrupto');
 const count=u16(end+10),start=u32(end+16),centralSize=u32(end+12);if(!count||count>MAX_ENTRIES||start+centralSize!==end)fail('Directorio ZIP incompatible');
 const entries=[];let at=start,total=0;const names=new Set(),ranges=[];
 for(let i=0;i<count;i++){
  if(at+46>end||u32(at)!==0x02014b50)fail('Directorio ZIP corrupto');
  const flags=u16(at+8),method=u16(at+10),crc=u32(at+16),packed=u32(at+20),size=u32(at+24),nameLength=u16(at+28),extra=u16(at+30),comment=u16(at+32),local=u32(at+42);
  if(at+46+nameLength+extra+comment>end)fail('Entrada ZIP incompleta');
  const name=decode.decode(bytes.subarray(at+46,at+46+nameLength));
  if(!name||name.includes('..')||name.includes('\\')||name.startsWith('/')||name.includes('\0')||names.has(name)||flags&1||![0,8].includes(method))fail('Entrada ZIP duplicada, cifrada o incompatible');
  names.add(name);total+=size;if(size>MAX_XML||total>MAX_XML||packed>maxFileBytes)fail('XLSX descomprimido excede el límite');
  if(local+30>start||u32(local)!==0x04034b50||u16(local+6)!==flags||u16(local+8)!==method)fail('Cabecera ZIP inconsistente');
  const localName=u16(local+26),localExtra=u16(local+28),from=local+30+localName+localExtra;
  if(from+packed>start||decode.decode(bytes.subarray(local+30,local+30+localName))!==name)fail('Contenido ZIP incompleto');
  if(ranges.some(([a,b])=>local<b&&from+packed>a))fail('Entradas ZIP superpuestas');ranges.push([local,from+packed]);
  entries.push({name,method,crc,packed,size,from});at+=46+nameLength+extra+comment;
 }
 if(at!==end)fail('Directorio ZIP inconsistente');
 const out=new Map();for(const e of entries){const packed=bytes.subarray(e.from,e.from+e.packed),raw=e.method===0?packed:await inflate(packed,Math.min(e.size,MAX_XML));if(raw.length!==e.size||crc32(raw)!==e.crc)fail('XLSX corrupto (tamaño/CRC)');out.set(e.name,raw);}
 return out;
}
const MAIN='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
function xml(bytes,DOM){
 if(!bytes)fail('Falta una parte obligatoria del XLSX');const value=decode.decode(bytes);
 if(/<!DOCTYPE|<!ENTITY/i.test(value))fail('DTD y entidades no admitidos');
 let invalid=false;const parser=new DOM({onError:()=>{invalid=true;}}),doc=parser.parseFromString(value,'application/xml');
 if(invalid||!doc?.documentElement||doc.getElementsByTagName('parsererror').length)fail('XML inválido');return doc;
}
const children=(node,name,ns=MAIN)=>Array.from(node.childNodes||[]).filter(n=>n.nodeType===1&&n.localName===name&&n.namespaceURI===ns);
const one=(node,name)=>{const nodes=children(node,name);if(nodes.length!==1)fail('Estructura XLSX ambigua: '+name);return nodes[0];};
function textNodes(node){return Array.from(node.getElementsByTagNameNS(MAIN,'t')).map(x=>x.textContent).join('');}
/** Reads the real Export worksheet, including sparse cells and shared strings. */
export async function readExportGrid(input,{DOMParser=globalThis.DOMParser}={}){
 return readWorksheetGrid(input,{DOMParser,sheetName:'Export'});
}
// OPT uses an explicit sheet selector; Export keeps its original single-sheet policy.
export async function readWorksheetGrid(input,{DOMParser=globalThis.DOMParser,sheetName='Export',allowOtherSheets=false,allowUnusedMacroDefault=false,allowStringCells=false,maxFileBytes=MAX_FILE,readWorksheetXML}={}){
 if(!DOMParser)fail('Parser XML no disponible');const zip=await unzipXlsx(input,{maxFileBytes});
 for(const name of zip.keys())if(/vbaProject|externalLinks|embeddings/i.test(name))fail('Contenido activo/externo no admitido');
 const types=xml(zip.get('[Content_Types].xml'),DOMParser);if(Array.from(types.getElementsByTagName('*')).some(n=>{if(!/macroEnabled/i.test(n.getAttribute?.('ContentType')||''))return false;const ext=n.getAttribute('Extension');return !(allowUnusedMacroDefault&&n.localName==='Default'&&ext&&!Array.from(zip.keys()).some(name=>name.toLowerCase().endsWith('.'+ext.toLowerCase())));}))fail('Macros no admitidas');
 const workbook=xml(zip.get('xl/workbook.xml'),DOMParser),root=workbook.documentElement;
 if(root.localName!=='workbook'||root.namespaceURI!==MAIN||children(root,'workbookPr').some(n=>n.getAttribute('date1904')==='1'))fail('Libro o calendario XLSX incompatible');
 const allSheets=children(one(root,'sheets'),'sheet'),sheets=allSheets.filter(s=>s.getAttribute('name')===sheetName);if((!allowOtherSheets&&allSheets.length!==1)||sheets.length!==1||['hidden','veryHidden'].includes(sheets[0].getAttribute('state')))fail('Se requiere la hoja visible única '+sheetName);
 const rels=xml(zip.get('xl/_rels/workbook.xml.rels'),DOMParser),allRels=Array.from(rels.getElementsByTagName('*')).filter(n=>n.localName==='Relationship');
 if(allRels.some(n=>n.getAttribute('TargetMode')==='External'))fail('Relaciones externas no admitidas');
 const id=sheets[0].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
 const matches=allRels.filter(n=>n.getAttribute('Id')===id&&n.getAttribute('Type')==='http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet');
 if(matches.length!==1)fail('Relación de hoja ambigua');let path=matches[0].getAttribute('Target');path=path.startsWith('/')?path.slice(1):'xl/'+path;
 if(path.includes('..')||!/^xl\/worksheets\/[^/]+\.xml$/.test(path))fail('Ruta de hoja incompatible');
 const shared=zip.has('xl/sharedStrings.xml')?Array.from(xml(zip.get('xl/sharedStrings.xml'),DOMParser).getElementsByTagNameNS(MAIN,'si')).map(textNodes):[];
 if(readWorksheetXML)return {sheet:sheetName,rows:readWorksheetXML(zip.get(path),{shared,allowStringCells})};
 const doc=xml(zip.get(path),DOMParser),sheet=doc.documentElement;if(sheet.localName!=='worksheet'||sheet.namespaceURI!==MAIN)fail('Hoja inválida');
 if(sheet.getElementsByTagNameNS(MAIN,'f').length||sheet.getElementsByTagNameNS(MAIN,'mergeCell').length)fail('Fórmulas o celdas combinadas no admitidas');
 let last=0;const rows=[];for(const row of children(one(sheet,'sheetData'),'row')){
  const parsed=readWorksheetRow(row,last,{shared,allowStringCells});rows.push(parsed);last=parsed.row;
 }
 return {sheet:sheetName,rows};
}
// The DOM and incremental readers share every row/cell semantic check.
export function readWorksheetRow(row,last,{shared,allowStringCells}){
  const rn=row.getAttribute('r'),rowNumber=rn?Number(rn):last+1;if(!Number.isInteger(rowNumber)||rowNumber<=last||rowNumber>20000||['1','true'].includes(row.getAttribute('hidden')))fail('Filas ocultas, repetidas o excesivas');
  let previous=-1;const values=[];for(const cell of children(row,'c')){
   const ref=cell.getAttribute('r');let column=previous+1;
   if(ref){const m=/^([A-Z]+)([1-9]\d*)$/.exec(ref);if(!m||Number(m[2])!==rowNumber)fail('Referencia de celda inválida');column=0;for(const ch of m[1])column=column*26+ch.charCodeAt(0)-64;column--;}
   if(column<=previous||column>=32)fail('Columnas repetidas o excesivas');previous=column;
   const type=cell.getAttribute('t')||'n',v=children(cell,'v'),is=children(cell,'is');if(v.length>1||is.length>1)fail('Celda ambigua');
   let value=null;
   if(type==='inlineStr'){if(v.length||is.length!==1)fail('Texto XLSX inválido');value=textNodes(is[0]);}
   else if(type==='str'&&allowStringCells){if(is.length||v.length!==1)fail('Texto XLSX ambiguo');value=v[0].textContent;}
   else if(type==='s'){if(v.length!==1||!/^\d+$/.test(v[0].textContent)||Number(v[0].textContent)>=shared.length)fail('Índice de texto inválido');value=shared[Number(v[0].textContent)];}
   else if(type==='n'){if(is.length)fail('Celda numérica inválida');if(v.length&&v[0].textContent!==''){value=Number(v[0].textContent);if(!Number.isFinite(value))fail('Número XLSX inválido');}}
   else fail('Tipo de celda no admitido: '+type);
   values[column]=value;
  }
 return {row:rowNumber,values:Array.from({length:values.length},(_,i)=>values[i]??null)};
}

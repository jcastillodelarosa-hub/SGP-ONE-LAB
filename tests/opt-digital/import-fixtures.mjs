// Synthetic valid PDF with complete project detail, patterns and final summaries.
export const scope={linea:'PANELES_2',anio:2026,semana:46,modo:'BASE'};
export const program='00000000-0000-0000-0000-000000000001';
export const binding={documentProduction:'123456',reserva:'SYNTH-R',sistema:'SYNTH-SYS',key_produccion:'123456|PANELES_2',id_programacion:program,id_linea:'PANELES_2',anio:2026,semana_base:46,activa:'SI',excluida_export:false,reserva_principal:'SYNTH-R',programacion_reserva:'SYNTH-R',reserva_snapshot:'SYNTH-R',estado_programacion:'SIN INICIAR',cantidad_snapshot:1};
const reference='123456 - Synthetic';
const item=(str,x,y)=>({str,width:0,transform:[1,0,0,1,x,y]});
const row=(values,centers,y)=>values.flatMap((value,index)=>value?[item(value,centers[index],y)]:[]);
export function pages(){
 const project=[25,100,200,300,520,740],pattern=[25,70,140,205,245,315,380,420,490,555,595,665,730,770,810],material=[25,100,200,300,420,500,600,740];
 const source=[[
  item('Optimizador de corte - OPT-SYNTH',20,590),...row(['Item','Pipe','Code','Length','Reference','Qty'],project,580),
  ...row(['1','R1','FINISH','10 1/32"',reference,'4'],project,560)
 ],[
  item('Optimizador de corte - OPT-SYNTH',20,590),item('R1 FINISH',300,500),item('Longitud del perfil: 30", Perfiles usados: 2 UBICACION: X CODIGO: C',16,480),
  ...row(['#perf','Long.','Referencia','Cant.','Long.','Referencia','Cant.','Long.','Referencia','Cant.','Long.','Referencia','Cant.','Rest','Disp.'],pattern,460),
  ...row(['2','10 1/32"',reference,'2','','','','','','','','','','9"'],pattern,440),item('Resumen',16,400),
  item('Longitud de los cortes: 40 1/8", Longitud de los perfiles usados: 60", Length of reused stubs: 18", Longitud del desperdicio: 1 7/8"',16,380)
 ],[
  item('Requerimientos de material:',16,580),...row(['Item','Referencia','CODE','Longitud','Qty','UBICACION','CODIGO','OBSERVACION'],material,560),
  ...row(['1','R1','FINISH','30"','2','X','C',''],material,540)
 ]];
 const rules=[{x1:10,y1:570,x2:800,y2:570},{x1:10,y1:550,x2:800,y2:550},{x1:350,y1:550,x2:350,y2:570},{x1:700,y1:550,x2:700,y2:570}];
 return source.map((items,index)=>({page:index+1,width:842,height:595,rotation:0,items,rules:index===0?rules:[]}));
}
export function fullPdf(){
 const source=pages(),objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [4 0 R 6 0 R 8 0 R] /Count 3 >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 for(let i=0;i<source.length;i++){
  const p=source[i],content=p.items.map(t=>`BT /F1 2 Tf 1 0 0 1 ${t.transform[4]} ${t.transform[5]} Tm (${t.str.replace(/[\\()]/g,'\\$&')}) Tj ET`).join('\n')+'\n'+p.rules.map(r=>`${r.x1} ${r.y1} m ${r.x2} ${r.y2} l S`).join('\n')+'\n';
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5+i*2} 0 R >>`);
  objects.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
 }
 let body='%PDF-1.7\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(body.length);body+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
 const start=body.length;body+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
 return new TextEncoder().encode(body);
}
export const base64=bytes=>btoa(Array.from(bytes,v=>String.fromCharCode(v)).join(''));
export function body(){return {p_token:'synthetic-token',scope:{...scope},source:{origin:'RETAIL',opt:'OPT-SYNTH',mode:'INDICE'},pdf:{name:'OPT-SYNTH.pdf',base64:base64(fullPdf())},index:{name:'index.csv',format:'csv',base64:base64(new TextEncoder().encode('OPT,Reserva,Sistema\nOPT-SYNTH,SYNTH-R,SYNTH-SYS\n'))}};}
export async function indexWorkbook(){
 const {storeZip}=await import('../lp01-powerbi/zip-fixture.mjs');
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 return storeZip(new Map([
  ['[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'],
  ['xl/workbook.xml',`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="ARCHIVOS" sheetId="1" r:id="rId1"/></sheets></workbook>`],
  ['xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
  ['xl/worksheets/sheet1.xml',`<worksheet xmlns="${ns}"><sheetData><row r="1"><c r="A1" t="str"><v>OPT</v></c><c r="B1" t="str"><v>Reserva</v></c><c r="C1" t="str"><v>Sistema</v></c></row><row r="2"><c r="A2" t="str"><v>OPT-SYNTH</v></c><c r="B2" t="str"><v>SYNTH-R</v></c><c r="C2" t="str"><v>SYNTH-SYS</v></c></row></sheetData></worksheet>`]
 ]));
}

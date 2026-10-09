function clean(v){if(v===null||v===undefined||v==="")return null;return typeof v==="string"?v.trim():v;}
function pick(row,names){for(const n of names){const v=row[n];if(v!==undefined&&v!==null&&String(v).trim()!=="")return v;}return null;}
function num(v){if(v===null||v===undefined||v==="")return null;const n=Number(String(v).replace(",", "."));return Number.isFinite(n)?n:null;}
function normOve(v){return String(v??"").trim().toUpperCase();}

export async function readGlassLocationWorkbook(file){
  const XLSX=await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
  const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:false});
  const sheet=wb.Sheets[wb.SheetNames.includes("ReporteConsumo")?"ReporteConsumo":wb.SheetNames[0]];
  if(!sheet)throw new Error("El reporte no contiene una hoja legible.");
  const source=XLSX.utils.sheet_to_json(sheet,{defval:null,raw:true});
  const required=["Orden","Disponible","Posicion","Estado Orden"];
  const headers=source.length?Object.keys(source[0]):[];
  const missing=required.filter(h=>!headers.includes(h));
  if(missing.length)throw new Error("Faltan columnas requeridas: "+missing.join(", "));
  const rows=[];
  source.forEach((r,i)=>{
    const orden=normOve(pick(r,["Orden"]));
    if(!orden){invalid++;return;}
    const disponible=num(pick(r,["Disponible"]))??0;
    const ordenSap=clean(pick(r,["Orden Sap"]));
    const item=clean(pick(r,["Item"]));
    const posicion=clean(pick(r,["Posicion"]));
    const estado=clean(pick(r,["Estado Orden"]));
    const dimensiones=clean(pick(r,["Dimensiones"]));
    const composicion=clean(pick(r,["Composiciòn","Composición","Composicion"]));
    const clave=[orden,ordenSap,item,dimensiones,composicion].map(x=>String(x??"")).join("|");
    rows.push({
      fila_origen:i+2,orden,orden_sap:ordenSap===null?null:String(ordenSap),proyecto:clean(pick(r,["Proyecto"])),
      item:item===null?null:String(item),disponible,posicion,posicion_anterior:clean(pick(r,["Posicion Anterior"])),
      estado_orden:estado,po:clean(pick(r,["P.O","PO"])),fecha:clean(pick(r,["Fecha"])),
      dias_bodega:num(pick(r,["Dias en Bodega","Días en Bodega"])),dimensiones,composicion,
      mt2:num(pick(r,["MT2"])),linea_reporte:clean(pick(r,["LINEA","Linea"])),clave_origen:clave
    });
  });
  return {rows,received:source.length,validRows:rows.length,invalid,sheetName:wb.SheetNames.includes("ReporteConsumo")?"ReporteConsumo":wb.SheetNames[0]};
}

export function filterGlassLocationRows(rows,relations){
  const active=new Map();
  for(const rel of relations||[]){
    const ove=normOve(rel.ove);if(!ove)continue;
    if(!active.has(ove))active.set(ove,[]);
    active.get(ove).push(rel);
  }
  const matched=rows.filter(r=>active.has(normOve(r.orden)));
  const found=new Set(matched.map(r=>normOve(r.orden)));
  const missing=[...active.keys()].filter(x=>!found.has(x));
  const productionKeys=new Set();
  matched.forEach(r=>(active.get(normOve(r.orden))||[]).forEach(p=>productionKeys.add(p.key_produccion)));
  return {matched,activeOves:active.size,foundOves:found.size,missingOves:missing,matchedProductions:productionKeys.size,outside:Math.max(0,rows.length-matched.length)};
}

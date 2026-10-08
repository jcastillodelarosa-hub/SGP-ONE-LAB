function clean(v){if(v===null||v===undefined||v==="")return null;return typeof v==="string"?v.trim():v;}
function value(row,names){for(const name of names)if(row[name]!==undefined&&row[name]!==null&&String(row[name]).trim()!=="")return row[name];return null;}
function controlRow(row){const t=Object.values(row||{}).map(v=>String(v??"").trim()).join(" ").toLowerCase();return !t||t.startsWith("total ")||t.includes("filtros aplicados");}

export function transformGlassRows(sourceRows,fileName=""){
  const rows=[],errors=[],skipped=[];
  for(let i=0;i<sourceRows.length;i++){
    const src=sourceRows[i];
    if(controlRow(src)){skipped.push(i+2);continue;}
    const id=clean(value(src,["ID Export","id","ID"]));
    if(!id){skipped.push(i+2);continue;}
    rows.push({id_export:String(id),produccion:clean(value(src,["Producción","Produccion"])),sistema:clean(value(src,["Sistema"])),fuente:fileName,raw:src});
  }
  return {rows,errors,skipped};
}
export async function readGlassWorkbook(file){
  const XLSX=await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
  const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:false});
  const sheet=wb.Sheets[wb.SheetNames[0]];
  if(!sheet)throw new Error("El archivo de Vidrio no contiene una hoja legible.");
  return transformGlassRows(XLSX.utils.sheet_to_json(sheet,{defval:null,raw:true}),file.name);
}
export function relateGlass(rows,productions){
  const panelIds=new Map();
  for(const p of productions||[]){
    if(p.id_linea!=="PANELES_2")continue;
    const id=String(p.id??"").trim();
    if(!panelIds.has(id))panelIds.set(id,[]);
    panelIds.get(id).push(p);
  }
  let related=0,noMatch=0,conflicts=0;
  for(const row of rows){
    const matches=panelIds.get(row.id_export)||[];
    if(matches.length===1)related++;else if(matches.length===0)noMatch++;else conflicts++;
  }
  return {related,noMatch,conflicts};
}

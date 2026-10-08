function clean(v) {
  if (v === null || v === undefined || v === "") return null;
  return typeof v === "string" ? v.trim() : v;
}
function num(v) {
  const x = clean(v);
  if (x === null) return null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  const s = String(x).replace(/\s/g, "");
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
function value(row, names) {
  for (const name of names) if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== "") return row[name];
  return null;
}
function controlRow(row) {
  const text = Object.values(row || {}).map(v => String(v ?? "").trim()).join(" ").toLowerCase();
  return !text || text.startsWith("total ") || text.includes("filtros aplicados");
}

export function transformAccessoryRows(sourceRows, fileName = "") {
  const rows = [], errors = [];
  for (let i=0;i<sourceRows.length;i++) {
    const src=sourceRows[i];
    if (controlRow(src)) continue;
    const codigoSap=clean(value(src,["Código sap","Codigo sap","Código SAP","Codigo SAP"]));
    const produccion=clean(value(src,["Producción","Produccion"]));
    const sistema=clean(value(src,["Sistema"]));
    const idOrden=clean(value(src,["ID Orden","ID orden"]));
    const linea=clean(value(src,["Línea","Linea"]));
    const semana=num(value(src,["Semana"]));
    const anio=num(value(src,["Año","Ano"]));
    if (!codigoSap || !produccion || !sistema || !idOrden || !linea || !semana || !anio) {
      errors.push({row:i+2,reason:"Falta Código SAP, Producción, Sistema, ID Orden, Línea, Semana o Año"});
      continue;
    }
    rows.push({
      codigo_sap:String(codigoSap), descripcion:clean(value(src,["Descripción","Descripcion"])),
      cantidad:num(value(src,["Cantidad"])), unidad:clean(value(src,["Unidad"])),
      sistema:String(sistema), produccion:String(produccion), id_orden:String(idOrden),
      orden_co:clean(value(src,["Orden CO"])), linea:String(linea), semana, anio, fuente:fileName
    });
  }
  return {rows,errors};
}
export async function readAccessoriesWorkbook(file) {
  const XLSX=await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
  const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:false});
  const sheet=wb.Sheets[wb.SheetNames[0]];
  if(!sheet) throw new Error("El archivo de Accesorios no contiene una hoja legible.");
  return transformAccessoryRows(XLSX.utils.sheet_to_json(sheet,{defval:null,raw:true}),file.name);
}
export function relateAccessories(rows, productions) {
  const index=new Map();
  for(const p of productions||[]) {
    const key=`${String(p.produccion??"").trim()}|${String(p.sistema??"").trim()}`;
    if(!index.has(key)) index.set(key,[]);
    index.get(key).push(p);
  }
  let related=0,noMatch=0,conflicts=0;
  for(const row of rows) {
    const matches=index.get(`${row.produccion}|${row.sistema}`)||[];
    if(matches.length===1) related++; else if(matches.length===0) noMatch++; else conflicts++;
  }
  return {related,noMatch,conflicts};
}

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
  const normalize = value => String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  const preparedIndex = new Map();
  for (const p of productions || []) {
    const relationKey = `${normalize(p.produccion)}|${normalize(p.sistema)}`;
    if (!preparedIndex.has(relationKey)) preparedIndex.set(relationKey, new Map());
    const byId = preparedIndex.get(relationKey);
    const id = String(p.id ?? "").trim();
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, { id, lines:new Set(), keys:new Set() });
    const candidate = byId.get(id);
    candidate.lines.add(p.id_linea);
    candidate.keys.add(p.key_produccion);
  }

  // El contrato histórico diagnostica producciones únicas del archivo de Accesorios,
  // no cada fila física. PANELES_2 + FRAMES_2 del mismo ID NO son conflicto.
  const sourceGroups = new Map();
  for (const row of rows || []) {
    const relationKey = `${normalize(row.produccion)}|${normalize(row.sistema)}`;
    if (!sourceGroups.has(relationKey)) sourceGroups.set(relationKey, { ...row, filas:0 });
    sourceGroups.get(relationKey).filas++;
  }

  let related=0, noMatch=0, conflicts=0;
  const relatedRows=[], noMatchRows=[], conflictRows=[];
  for (const [relationKey, source] of sourceGroups) {
    const byId = preparedIndex.get(relationKey) || new Map();
    const ids = [...byId.keys()];
    if (ids.length === 0) {
      noMatch++;
      noMatchRows.push(source);
    } else if (ids.length > 1) {
      conflicts++;
      conflictRows.push({ source, ids });
    } else {
      related++;
      const match=byId.get(ids[0]);
      relatedRows.push({ source, id:ids[0], lines:[...match.lines], keys:[...match.keys] });
    }
  }
  return {
    related, noMatch, conflicts,
    sourceGroups:sourceGroups.size,
    relatedRows, noMatchRows, conflictRows
  };
}


export function prepareAccessoryPayload(rows, productions) {
  const normalize = value => String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  const index = new Map();
  for (const p of productions || []) {
    const k = `${normalize(p.produccion)}|${normalize(p.sistema)}`;
    if (!index.has(k)) index.set(k, new Map());
    const byId = index.get(k), id = String(p.id ?? "").trim();
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(p);
  }
  return (rows || []).map((row, i) => {
    const byId = index.get(`${normalize(row.produccion)}|${normalize(row.sistema)}`) || new Map();
    const ids = [...byId.keys()];
    const id = ids.length === 1 ? ids[0] : null;
    const matches = id ? byId.get(id) : [];
    // Accesorios pertenece a la producción subyacente. Solo asignamos key si existe una única línea.
    const keys = [...new Set((matches || []).map(x => x.key_produccion).filter(Boolean))];
    return {
      ...row, fila_origen: i + 2, id,
      key_produccion: keys.length === 1 ? keys[0] : null,
      estado_relacion_produccion: id ? "RELACIONADO" : "SIN_RELACION"
    };
  });
}

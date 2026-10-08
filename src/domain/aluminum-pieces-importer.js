import { ALUMINUM_CONTROL_LINES } from "../config/domain.js";

function clean(v) {
  if (v === null || v === undefined || v === "") return null;
  return typeof v === "string" ? v.trim() : v;
}
function number(v) {
  const x = clean(v);
  if (x === null) return null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  const s = String(x).replace(/\s/g, "");
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
function canonicalLine(v) {
  const x = String(v ?? "").trim().toUpperCase().replace(/\s+/g, "_");
  return ALUMINUM_CONTROL_LINES.includes(x) ? x : null;
}

export function transformAluminumPieceRows(sourceRows, fileName = "") {
  const rows = [], errors = [];
  for (let i = 0; i < sourceRows.length; i++) {
    const src = sourceRows[i];
    const codigoSap = String(src["Código SAP"] ?? "").trim();
    const idOrden = String(src["ID orden de producción"] ?? "").trim();
    const linea = canonicalLine(src.Linea);
    const semana = number(src.Semana);
    const anio = number(src["Año"]);
    if (!codigoSap && !idOrden) continue;
    if (!codigoSap || !idOrden || !linea || !semana || !anio) {
      errors.push({ row: i + 2, codigoSap, idOrden, reason: "Código SAP, ID orden, línea, semana o año inválido", fileName });
      continue;
    }
    rows.push({
      id_orden_produccion: idOrden,
      linea,
      semana,
      anio,
      codigo_sap: codigoSap,
      descripcion: clean(src["Descripción"]),
      acabado: clean(src.Acabado),
      longitud: number(src.Longitud),
      marca: clean(src.Marca),
      fabricacion: clean(src["Fabricación"]),
      order_co: clean(src["Order co"]),
      produccion: clean(src["Producción"]),
      proyecto: clean(src.Proyecto),
      cantidad: number(src.Cantidad),
      sistema: clean(src.Sistema),
      id_sistema: clean(src["ID sistema"]),
      unidades: clean(src.Unidades),
      uso: clean(src.Uso),
      fuente: fileName || "LISTADO_PIEZAS_ALUMINIO"
    });
  }
  return { rows, errors };
}

export async function readAluminumPiecesWorkbook(file) {
  const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("El listado de piezas no contiene una hoja legible.");
  return transformAluminumPieceRows(XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true }), file.name);
}

export function summarizeAluminumPieces(rows) {
  const lines = {};
  for (const row of rows) lines[row.linea] = (lines[row.linea] || 0) + 1;
  return {
    total: rows.length,
    productionOrders: new Set(rows.map(r => r.id_orden_produccion)).size,
    sapCodes: new Set(rows.map(r => r.codigo_sap)).size,
    lines
  };
}

export function classifyAluminumPieces(rows, masterRows) {
  const master = new Map((masterRows || []).map(row => [String(row.codigo_sap ?? "").trim(), row]));
  const classified = [], unclassified = [];
  for (const row of rows) {
    const match = master.get(String(row.codigo_sap ?? "").trim());
    if (!match) {
      unclassified.push(row);
      classified.push({ ...row, tipo_pieza: null, destino_productivo: null, estado_clasificacion: "SAP_NO_CLASIFICADO" });
      continue;
    }
    classified.push({
      ...row,
      tipo_pieza: match.tipo_pieza,
      destino_productivo: match.destino_productivo,
      observacion_maestro: match.observacion ?? null,
      estado_clasificacion: "CLASIFICADO"
    });
  }
  const byType = {}, byDestination = {};
  for (const row of classified) {
    const type = row.tipo_pieza || "SIN_CLASIFICAR";
    const dest = row.destino_productivo || "SIN_CLASIFICAR";
    byType[type] = (byType[type] || 0) + 1;
    byDestination[dest] = (byDestination[dest] || 0) + 1;
  }
  return { rows: classified, unclassified, byType, byDestination };
}

export function relateAluminumPieces(rows, productions) {
  const norm = value => String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  const key = (production, system) => norm(production) + "||" + norm(system);
  const sourceGroups = new Map();
  for (const row of rows || []) {
    if (!row.produccion || !row.sistema) continue;
    const k = key(row.produccion, row.sistema);
    if (!sourceGroups.has(k)) sourceGroups.set(k,{produccion:row.produccion,sistema:row.sistema,order_co:row.order_co,filas:0,codigos:new Set()});
    const g=sourceGroups.get(k); g.filas++; if(row.codigo_sap)g.codigos.add(row.codigo_sap);
  }
  const programGroups = new Map();
  for (const row of productions || []) {
    if (row.id_linea !== "PANELES_2") continue;
    const k=key(row.produccion,row.sistema);
    if (!programGroups.has(k)) programGroups.set(k,[]);
    programGroups.get(k).push(row);
  }
  let related=0,noMatch=0,conflicts=0;
  const noMatchRows=[],conflictRows=[];
  for (const [k,source] of sourceGroups) {
    const matches=programGroups.get(k)||[];
    const ids=[...new Set(matches.map(r=>String(r.id??"").trim()).filter(Boolean))];
    if (!matches.length) {
      noMatch++;
      noMatchRows.push({...source,codigos_sap:source.codigos.size,motivo:"Producción + Sistema no existe en PANELES_2 de la programación validada"});
    } else if (ids.length>1) {
      conflicts++;
      conflictRows.push({source,matches});
    } else related++;
  }
  return {sourceGroups:sourceGroups.size,related,noMatch,conflicts,noMatchRows,conflictRows};
}


export function prepareAluminumPiecePayload(rows, productions) {
  const norm = value => String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  const key = (production, system) => norm(production) + "||" + norm(system);
  const panels = new Map();
  for (const p of productions || []) {
    if (p.id_linea !== "PANELES_2") continue;
    const k = key(p.produccion, p.sistema);
    if (!panels.has(k)) panels.set(k, []);
    panels.get(k).push(p);
  }
  return (rows || []).map((row, index) => {
    const matches = panels.get(key(row.produccion, row.sistema)) || [];
    const ids = [...new Set(matches.map(x => String(x.id ?? "").trim()).filter(Boolean))];
    const match = ids.length === 1 ? matches.find(x => String(x.id) === ids[0]) : null;
    return {
      ...row,
      fila_origen: index + 2,
      id: match?.id ?? null,
      key_produccion: match?.key_produccion ?? null,
      id_linea_origen: row.linea ?? null,
      id_linea_destino: match?.id_linea ?? null,
      estado_relacion_produccion: match ? "RELACIONADO" : "SIN_RELACION",
      unidades: number(row.unidades)
    };
  });
}

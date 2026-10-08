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

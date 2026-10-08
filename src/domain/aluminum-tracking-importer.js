import { SGP } from "../config/domain.js";

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
function isControlRow(row) {
  const id = String(row.id ?? "").trim();
  return !id || /^total$/i.test(id) || /^filtros aplicados/i.test(id);
}
function normalizeState(v) {
  const x = String(v ?? "").trim().toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (x.includes("ENTREGADO")) return "ALUMINIO_ENTREGADO";
  if (x.includes("BODEGA")) return "PENDIENTE_BODEGA";
  if (x.includes("ABASTEC")) return "PENDIENTE_ABASTECIMIENTO";
  return null;
}

export function transformAluminumTrackingRows(sourceRows, fileName = "") {
  const rows = [], errors = [], keys = new Set(), reservationStates = new Map();
  let skipped = 0;
  for (let i = 0; i < sourceRows.length; i++) {
    const src = sourceRows[i];
    if (isControlRow(src)) { skipped++; continue; }
    const id = String(src.id ?? "").trim();
    const reserva = String(src.Reserva ?? "").trim();
    const estado = normalizeState(src.Estado);
    if (!id || !reserva || !estado || !SGP.reservationStates.includes(estado)) {
      errors.push({ row: i + 2, id, reserva, reason: "ID, reserva o Estado inválido", fileName });
      continue;
    }
    const key = id + "|" + reserva;
    if (keys.has(key)) {
      errors.push({ row: i + 2, id, reserva, reason: "ID|RESERVA duplicado", fileName });
      continue;
    }
    keys.add(key);
    const previous = reservationStates.get(reserva);
    if (previous && previous !== estado) {
      errors.push({ row: i + 2, id, reserva, reason: "Conflicto de Estado para la misma reserva", fileName });
    } else {
      reservationStates.set(reserva, estado);
    }
    rows.push({
      key_seguimiento: key,
      id,
      anio: number(src["Año Prog."]),
      semana: number(src["Semana Prog."]),
      tipo_orden: clean(src["Tipo Orden"]),
      reserva,
      peso_reserva_sap: number(src["Peso Reserva SAP"]),
      estado_entrega_corte: clean(src["Estado Entrega Corte"]),
      estado,
      proyecto: clean(src.Proyecto),
      produccion: clean(src["Producción"]),
      sistema: clean(src.Sistema),
      bodega: clean(src.Bodega),
      cant_vent: number(src["Cant. Vent"]),
      porcentaje_vidrio: number(src.porcentaje_vidrio),
      vent_cant_vidrio: number(src["Vent cant Vidrio"]),
      cant_pz: number(src["Cant. Pz"]),
      acabado: clean(src.Acabado),
      quote: clean(src.Quote),
      sistema_pvc: clean(src["Sistema PVC?"]),
      is_service: clean(src.is_service),
      fuente: fileName || "SEGUIMIENTO_ALUMINIO"
    });
  }
  return { rows, errors, skipped, reservations: reservationStates.size };
}

export async function readAluminumTrackingWorkbook(file) {
  const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  const sheet = wb.Sheets.Export || wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("El archivo de seguimiento no contiene una hoja legible.");
  return transformAluminumTrackingRows(XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true }), file.name);
}

export function summarizeAluminumTracking(rows) {
  const states = Object.fromEntries(SGP.reservationStates.map(s => [s, 0]));
  for (const row of rows) states[row.estado] = (states[row.estado] || 0) + 1;
  return { total: rows.length, reservations: new Set(rows.map(r => r.reserva)).size, states };
}

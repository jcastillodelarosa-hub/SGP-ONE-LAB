import { ALUMINUM_CONTROL_LINES } from "../config/domain.js";

const SOURCE_MAP = Object.freeze({
  "Prioridad Prog.": "prioridad_programacion",
  "Año prog.": "anio",
  "Sem prog.": "semana_actual",
  "Tipo": "tipo",
  "gral_market_txt": "mercado",
  "Proyecto": "proyecto",
  "Produccion": "produccion",
  "Sistema": "sistema",
  "Cant.": "cantidad",
  "Cliente": "cliente",
  "Mercado Detalle": "mercado_detalle",
  "Ens.": "ensamblado",
  "Emp.": "empacado",
  "Cant. PT": "cantidad_pt",
  "Cargue": "cargue",
  "Desp.": "despacho",
  "Saldo Ens.": "saldo_ensamble",
  "Saldo Emp.": "saldo_empaque",
  "Saldo Cargue": "saldo_cargue",
  "Saldo Desp.": "saldo_despacho",
  "Cod. Prog. Abierto": "codigo_programacion_abierto",
  "Estado Destino Fussion": "estado_destino_fussion",
  "Acabado": "acabado",
  "Reserva Al": "reserva_al",
  "% aluminio": "porc_aluminio",
  "Estado Reserva Al": "estado_reserva_al",
  "Orden Oves": "orden_oves",
  "% Vidrio": "porc_vidrio",
  "Grupo Vidrio": "grupo_vidrio",
  "Reservas Acc.": "reservas_accesorios",
  "Obs Acc.": "obs_accesorios",
  "Muntin": "muntin",
  "Cant. Muntin": "cantidad_muntin",
  "Flush Frame": "flush_frame",
  "Cant. Flush Frame": "cantidad_flush_frame",
  "Sistema Curvo": "sistema_curvo",
  "Screen requiere frame?": "screen_requiere_frame",
  "Es SMI?": "es_smi",
  "Es LMI?": "es_lmi",
  "Es Two Tone?": "es_two_tone",
  "id_op_fussion": "id_op_fussion",
  "id_sistema_fk": "id_sistema_fk",
  "Fecha Recibido": "fecha_recibido",
  "Pedido SAP": "pedido_sap",
  "Orden CO": "orden_co",
  "Es Service": "es_service",
  "Solo panel lleva cover?": "solo_panel_lleva_cover",
  "Sistema PVC?": "sistema_pvc",
  "tipo_sellado": "tipo_sellado",
  "Mecanizado": "mecanizado",
  "Es sistema modificado?": "es_sistema_modificado",
  "lotes": "lotes"
});

const NUMERIC = new Set(["anio","semana_actual","cantidad","ensamblado","empacado","cantidad_pt","cargue","despacho","saldo_ensamble","saldo_empaque","saldo_cargue","saldo_despacho","porc_aluminio","porc_vidrio","cantidad_muntin","cantidad_flush_frame"]);

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
function isControlRow(row) {
  const id = String(row.id ?? "").trim();
  return !id || /^total$/i.test(id) || /^filtros aplicados/i.test(id);
}
function productionState(row) {
  const qty = number(row.cantidad) ?? 0;
  const se = number(row.saldo_ensamble) ?? 0;
  const sp = number(row.saldo_empaque) ?? 0;
  if (se === qty) return "CERRADA";
  if (se > 0 && se < qty) return "ABIERTA";
  if (se === 0 && sp > 0) return "ENSAMBLADA";
  if (se === 0 && sp === 0) return "FINALIZADA";
  return null;
}

export function transformProgrammingRows(sourceRows, fileName = "") {
  const rows = [];
  const errors = [];
  for (let i = 0; i < sourceRows.length; i++) {
    const src = sourceRows[i];
    if (isControlRow(src)) continue;
    const id = String(src.id ?? "").trim();
    const idLinea = canonicalLine(src["Línea Programada"]);
    const semana = number(src["Sem prog."]);
    const anio = number(src["Año prog."]);
    if (!id || !idLinea || !semana || !anio) {
      errors.push({ row: i + 2, id, reason: "Identidad, línea, año o semana inválidos", fileName });
      continue;
    }
    const out = {
      key_produccion: id + "|" + idLinea,
      id,
      id_linea: idLinea,
      semana_base: semana,
      activa: "SI",
      fuente: fileName || "IMPORTADOR_XLSX"
    };
    for (const [source, target] of Object.entries(SOURCE_MAP)) {
      out[target] = NUMERIC.has(target) ? number(src[source]) : clean(src[source]);
    }
    out.estado_produccion = productionState(out);
    rows.push(out);
  }
  const keys = new Set();
  for (const row of rows) {
    if (keys.has(row.key_produccion)) errors.push({ id: row.id, reason: "KEY_PRODUCCION duplicada", fileName });
    keys.add(row.key_produccion);
  }
  return { rows, errors };
}

export async function readProgrammingWorkbook(file) {
  const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array", cellDates: false });
  const sheet = wb.Sheets.Export || wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("El archivo no contiene una hoja legible.");
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
  return transformProgrammingRows(raw, file.name);
}

export function summarizeProgramming(rows) {
  const byWeekLine = {};
  for (const row of rows) {
    const key = row.semana_base + "|" + row.id_linea;
    byWeekLine[key] = (byWeekLine[key] || 0) + 1;
  }
  return { total: rows.length, byWeekLine, uniqueKeys: new Set(rows.map(r => r.key_produccion)).size };
}

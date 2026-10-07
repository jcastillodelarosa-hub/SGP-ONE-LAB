export function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeIdentifier(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function normalizeDecimal(value) {
  if (value === null || value === undefined || value === "") return "";

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : "";
  }

  let text = String(value).trim();
  if (!text) return "";

  if (text.includes(",")) {
    text = text.replace(/\./g, "").replace(",", ".");
  }

  text = text.replace(/\s/g, "");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : "";
}

export function normalizeReservationState(value) {
  const raw = String(value ?? "").trim().toUpperCase();

  if (raw === "ALUMINIO ENTREGADO") return "ALUMINIO_ENTREGADO";
  if (raw === "PEND POR BODEGA" || raw === "PENDIENTE POR BODEGA") {
    return "PENDIENTE_BODEGA";
  }
  if (raw === "PEND POR ABASTECIMIENTO" || raw === "PENDIENTE POR ABASTECIMIENTO") {
    return "PENDIENTE_ABASTECIMIENTO";
  }

  return "";
}

export function isControlRow(idValue) {
  const id = String(idValue ?? "").trim().toUpperCase();
  return !id || id === "TOTAL" || id.startsWith("FILTROS APLICADOS:");
}

export function buildTrackingKey(id, reserva) {
  return normalizeIdentifier(id) + "|" + normalizeIdentifier(reserva);
}

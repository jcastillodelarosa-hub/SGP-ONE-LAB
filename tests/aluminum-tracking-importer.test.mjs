import test from "node:test";
import assert from "node:assert/strict";
import { transformAluminumTrackingRows, summarizeAluminumTracking } from "../src/domain/aluminum-tracking-importer.js";

test("seguimiento usa ID|RESERVA y Estado, no Ultimo Estado", () => {
  const result = transformAluminumTrackingRows([{
    id: 1305055, Reserva: "R-10", Estado: "Pendiente Bodega", "Último Estado": "ALUMINIO ENTREGADO",
    "Peso Reserva SAP": "1471,041", "Año Prog.": 2026, "Semana Prog.": 41, "Línea Prog.": "OTRA LINEA"
  }]);
  assert.equal(result.errors.length, 0);
  assert.equal(result.rows[0].key_seguimiento, "1305055|R-10");
  assert.equal(result.rows[0].estado, "PENDIENTE_BODEGA");
  assert.equal(result.rows[0].peso_reserva_sap, 1471.041);
  assert.equal("linea" in result.rows[0], false);
});

test("detecta conflicto logistico de una reserva", () => {
  const result = transformAluminumTrackingRows([
    { id: 1, Reserva: "R1", Estado: "Aluminio Entregado" },
    { id: 2, Reserva: "R1", Estado: "Pendiente Abastecimiento" }
  ]);
  assert.equal(result.errors.length, 1);
});

test("resume estados y reservas", () => {
  const result = transformAluminumTrackingRows([
    { id: 1, Reserva: "R1", Estado: "Aluminio Entregado" },
    { id: 2, Reserva: "R2", Estado: "Pendiente Abastecimiento" }
  ]);
  const s = summarizeAluminumTracking(result.rows);
  assert.equal(s.total, 2);
  assert.equal(s.reservations, 2);
  assert.equal(s.states.ALUMINIO_ENTREGADO, 1);
});

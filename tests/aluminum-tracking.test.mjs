import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDecimal,
  normalizeReservationState,
  isControlRow,
  buildTrackingKey
} from "../src/domain/aluminum-tracking.js";

test("normaliza coma decimal de Peso Reserva", () => {
  assert.equal(normalizeDecimal("1471,041"), 1471.041);
  assert.equal(normalizeDecimal("1398,55"), 1398.55);
  assert.equal(normalizeDecimal("124,5308571"), 124.5308571);
  assert.equal(normalizeDecimal("75,66012821"), 75.66012821);
});

test("conserva numeros ya numericos", () => {
  assert.equal(normalizeDecimal(357.745), 357.745);
});

test("normaliza estados logisticos de reserva", () => {
  assert.equal(normalizeReservationState("Aluminio Entregado"), "ALUMINIO_ENTREGADO");
  assert.equal(normalizeReservationState("Pend por Bodega"), "PENDIENTE_BODEGA");
  assert.equal(normalizeReservationState("Pend por Abastecimiento"), "PENDIENTE_ABASTECIMIENTO");
});

test("descarta filas de control del reporte", () => {
  assert.equal(isControlRow("Total"), true);
  assert.equal(isControlRow(""), true);
  assert.equal(isControlRow("Filtros aplicados: semana 40"), true);
  assert.equal(isControlRow("1254941"), false);
});

test("clave Seguimiento Aluminio es ID|RESERVA", () => {
  assert.equal(buildTrackingKey("1254941", "8558678"), "1254941|8558678");
});

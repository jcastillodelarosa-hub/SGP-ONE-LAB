import test from "node:test";
import assert from "node:assert/strict";
import { transformAluminumPieceRows, summarizeAluminumPieces } from "../src/domain/aluminum-pieces-importer.js";

test("listado de piezas conserva codigo SAP e identidad de orden", () => {
  const result = transformAluminumPieceRows([{
    "Descripción":"PANEL B BOTTOM RAIL", Linea:"PANELES 2", Semana:41, "Año":2026,
    "ID orden de producción":437557, "Código SAP":"ES4004", Cantidad:1, Longitud:36.6875, Unidades:"Kg"
  }]);
  assert.equal(result.errors.length, 0);
  assert.equal(result.rows[0].linea, "PANELES_2");
  assert.equal(result.rows[0].codigo_sap, "ES4004");
  assert.equal(result.rows[0].id_orden_produccion, "437557");
});

test("listado de piezas rechaza linea fuera del alcance", () => {
  const result = transformAluminumPieceRows([{
    Linea:"PANELES", Semana:41, "Año":2026, "ID orden de producción":1, "Código SAP":"X"
  }]);
  assert.equal(result.rows.length, 0);
  assert.equal(result.errors.length, 1);
});

test("resumen cuenta ordenes y codigos unicos", () => {
  const rows=[
    {id_orden_produccion:"1",codigo_sap:"A",linea:"PANELES_2"},
    {id_orden_produccion:"1",codigo_sap:"B",linea:"PANELES_2"}
  ];
  const s=summarizeAluminumPieces(rows);
  assert.equal(s.total,2); assert.equal(s.productionOrders,1); assert.equal(s.sapCodes,2);
});

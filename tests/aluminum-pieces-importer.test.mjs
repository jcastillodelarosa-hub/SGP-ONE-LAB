import test from "node:test";
import assert from "node:assert/strict";
import { transformAluminumPieceRows, summarizeAluminumPieces, relateAluminumPieces } from "../src/domain/aluminum-pieces-importer.js";

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

test("relaciona listado de piezas por Produccion + Sistema contra PANELES_2", () => {
  const rows=[
    {produccion:"P100",sistema:"S1",order_co:"CO1",codigo_sap:"A"},
    {produccion:"P100",sistema:"S1",order_co:"CO1",codigo_sap:"B"},
    {produccion:"P999",sistema:"S9",order_co:"CO9",codigo_sap:"C"}
  ];
  const productions=[
    {id:"100",id_linea:"PANELES_2",produccion:"P100",sistema:"S1"},
    {id:"900",id_linea:"FRAMES_2",produccion:"P999",sistema:"S9"}
  ];
  const rel=relateAluminumPieces(rows,productions);
  assert.equal(rel.sourceGroups,2);
  assert.equal(rel.related,1);
  assert.equal(rel.noMatch,1);
  assert.equal(rel.conflicts,0);
  assert.equal(rel.noMatchRows[0].order_co,"CO9");
});

import test from "node:test";
import assert from "node:assert/strict";
import { classifyAluminumPieces } from "../src/domain/aluminum-pieces-importer.js";

test("clasifica por codigo SAP usando Maestro de Piezas", () => {
  const result = classifyAluminumPieces(
    [{ codigo_sap:"A", linea:"PANELES_2" }, { codigo_sap:"X", linea:"PANELES_2" }],
    [{ codigo_sap:"A", tipo_pieza:"PANEL", destino_productivo:"PANEL", observacion:null }]
  );
  assert.equal(result.rows[0].tipo_pieza,"PANEL");
  assert.equal(result.rows[0].destino_productivo,"PANEL");
  assert.equal(result.rows[0].estado_clasificacion,"CLASIFICADO");
  assert.equal(result.rows[1].estado_clasificacion,"SAP_NO_CLASIFICADO");
  assert.equal(result.unclassified.length,1);
});

test("respeta literalmente destino del maestro", () => {
  const result = classifyAluminumPieces(
    [{ codigo_sap:"ES-SGD2020-098", linea:"PANELES_2" }],
    [{ codigo_sap:"ES-SGD2020-098", tipo_pieza:"REFUERZO", destino_productivo:"PANEL", observacion:"PERTENECE A FRAME PERO NO DEBE LISTARSE EN LA LISTA DE PIEZAS" }]
  );
  assert.equal(result.rows[0].tipo_pieza,"REFUERZO");
  assert.equal(result.rows[0].destino_productivo,"PANEL");
});

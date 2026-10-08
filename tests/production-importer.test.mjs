import test from "node:test";
import assert from "node:assert/strict";
import { transformProgrammingRows, summarizeProgramming } from "../src/domain/production-importer.js";

test("programacion crea identidad PANELES_2 y semana base", () => {
  const src = [{
    id: 1305353, "Año prog.": 2026, "Sem prog.": 41, "Línea Programada": "PANELES 2",
    "Cant.": 33, "Saldo Ens.": 33, "Saldo Emp.": 0
  }];
  const result = transformProgrammingRows(src, "sem41.xlsx");
  assert.equal(result.errors.length, 0);
  assert.equal(result.rows[0].key_produccion, "1305353|PANELES_2");
  assert.equal(result.rows[0].semana_base, 41);
  assert.equal(result.rows[0].semana_actual, 41);
  assert.equal(result.rows[0].estado_produccion, "CERRADA");
});

test("programacion rechaza lineas fuera de PANELES_2 FRAMES_2", () => {
  const result = transformProgrammingRows([{id: 1, "Año prog.": 2026, "Sem prog.": 41, "Línea Programada": "PANELES"}]);
  assert.equal(result.rows.length, 0);
  assert.equal(result.errors.length, 1);
});

test("resumen separa semana y linea", () => {
  const rows = [
    { key_produccion: "1|PANELES_2", semana_base: 41, id_linea: "PANELES_2" },
    { key_produccion: "2|FRAMES_2", semana_base: 42, id_linea: "FRAMES_2" }
  ];
  const s = summarizeProgramming(rows);
  assert.equal(s.total, 2);
  assert.equal(s.byWeekLine["41|PANELES_2"], 1);
  assert.equal(s.byWeekLine["42|FRAMES_2"], 1);
});

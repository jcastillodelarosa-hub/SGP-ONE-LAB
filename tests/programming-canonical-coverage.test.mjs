import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("v283 carga cobertura canónica junto con disponibles y programación", () => {
  assert.match(app, /sgp_mecanizado_cobertura_programacion/);
  assert.match(app, /progCoverage=cv\.data\|\|\[\]/);
});

test("v283 usa cantidad_cubierta para el saldo visual de reserva y parte", () => {
  assert.match(app, /reserveCoverage=res=>/);
  assert.match(app, /cantidad_cubierta/);
  assert.match(app, /const done=reserveCoverage\(r\.reserva\)/);
  assert.match(app, /const partStats=p=>/);
});

test("v283 conserva cantidad_programada para snapshots históricos, no como única cobertura vigente", () => {
  assert.match(app, /cantidad_programada/);
  assert.match(app, /progCoverage\.filter/);
});

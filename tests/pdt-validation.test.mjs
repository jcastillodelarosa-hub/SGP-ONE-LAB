import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261018_pdt_validation_workflow.sql", import.meta.url), "utf8");

test("LAB v279 expone validación PDT en interfaz", () => {
  assert.match(html, /LAB v279/);
  assert.match(html, /app\.js\?v=279/);
  assert.match(html, /styles\.css\?v=279/);
  assert.equal((html.match(/<th>Validación<\/th>/g) || []).length, 2);
  assert.match(app, /sgp_aluminio_pendiente_editar/);
  assert.match(app, /sgp_aluminio_pendiente_validar/);
  assert.match(app, /BLOQUEADO PARA MECANIZADO/);
  assert.match(app, /pdt_por_validar/);
});

test("Patinador queda limitado a edición previa y acabado compartido", () => {
  assert.match(migration, /array\['ADMINISTRADOR', 'PATINADOR'\]|array\['ADMINISTRADOR','PATINADOR'\]/);
  assert.match(migration, /ya fue validado y no puede ser modificado por Patinador/);
  assert.match(migration, /solo puede modificar el acabado cuando la orden es RESERVA COMPARTIDA/);
  assert.match(app, /Acabado · reserva compartida/);
  assert.match(app, /Solo editable por Patinador cuando es RESERVA COMPARTIDA/);
});

test("Validación y estado físico permanecen separados", () => {
  assert.match(migration, /validacion_estado='VALIDADO'/);
  assert.match(migration, /PDT POR VALIDAR: debe ser validado antes de avanzar/);
  assert.match(migration, /'PENDIENTE','REPO_OK','CORTE','MECANIZADO','PROCESADO','PICKING'/);
  assert.doesNotMatch(migration, /update public\.sgp_aluminio_pendientes p set estado_repo='REPO_OK'/i);
  assert.match(app, /La validación no cambia automáticamente el estado a REPO OK/);
});

test("Reserva solución de NC y manual conservan fuentes separadas", () => {
  assert.match(migration, /reserva_solucion_nc/);
  assert.match(migration, /reserva_solucion_manual/);
  assert.match(migration, /origen_reserva_solucion/);
  assert.match(migration, /La reserva solución proviene de la NC enlazada/);
});

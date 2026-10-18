import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const migration279 = readFileSync(new URL("../supabase/migrations/20261018_pdt_validation_workflow.sql", import.meta.url), "utf8");
const migration280 = readFileSync(new URL("../supabase/migrations/20261018_pdt_compact_actions.sql", import.meta.url), "utf8");

test("LAB v281 restaura columnas históricas y conserva menú Acciones", () => {
  assert.match(html, /LAB v281/);
  assert.match(html, /app\.js\?v=281/);
  assert.match(html, /styles\.css\?v=281/);
  assert.equal((html.match(/<th>Acciones<\/th>/g) || []).length, 2);
  assert.equal((html.match(/data-repo-week-sort/g) || []).length, 2);
  assert.match(html, /data-repo-week-sort>Sem\. ↑<\/button><\/th><th>OP<\/th><th>Reserva<\/th><th>Referencia<\/th><th>Acabado<\/th><th>Marca<\/th><th>Fabricación<\/th><th>Longitud<\/th><th>Cant\.<\/th><th>NC<\/th><th>Enlace NC<\/th><th>Estado NC<\/th><th>Validación<\/th><th>Observación<\/th><th>Estado PDT<\/th><th>Acciones<\/th>/);
  assert.match(app, /repoWeekSort='asc'/);
  assert.match(app, /repoOpenActionPortal/);
  assert.match(app, /document\.body\.appendChild\(portal\)/);
  assert.match(app, /function repoStateControlHtml/);
  assert.match(app, /data-repo-window-state/);
  assert.match(app, /colspan="16"/);
  assert.match(app, /data-repo-action="modify"/);
  assert.match(app, /data-repo-action="validate"/);
  assert.match(app, /data-repo-action="detail"/);
  assert.match(app, /data-repo-action="history"/);
});

test("Modificar PDT reutiliza piezas PANEL reales de la orden", () => {
  assert.match(app, /sgp_aluminio_pendiente_piezas/);
  assert.match(app, /Piezas de la orden/);
  assert.match(app, /Fabricación/);
  assert.match(app, /Longitud \(in\)/);
  assert.match(migration280, /from public\.sgp_aluminio a/i);
  assert.match(migration280, /a\.tipo_pieza='PANEL'/);
  assert.match(migration280, /La fabricación\/longitud seleccionada no corresponde/);
});

test("Patinador mantiene alcance previo y acabado solo compartido", () => {
  assert.match(migration280, /array\['ADMINISTRADOR','PATINADOR'\]/);
  assert.match(migration280, /ya fue validado y no puede ser modificado por Patinador/);
  assert.match(migration280, /solo puede modificar el acabado cuando la orden es RESERVA COMPARTIDA/);
  assert.match(app, /Reserva \+ acabado · RESERVA COMPARTIDA/);
  assert.match(app, /sgp_aluminio_pendiente_editar_v2/);
});

test("NC, reserva solución e historial permanecen trazables", () => {
  assert.match(app, /sgp_aluminio_nc_buscar/);
  assert.match(app, /sgp_aluminio_pendiente_historial/);
  assert.match(app, /Reserva solución · Coordinación/);
  assert.match(migration279, /reserva_solucion_manual/);
  assert.match(migration280, /tipo_evento='EDICION_PDT'/);
  assert.match(migration280, /'CREACION'::text tipo_evento/);
});

test("Validación y estado físico permanecen separados", () => {
  assert.match(migration279, /validacion_estado='VALIDADO'/);
  assert.match(migration279, /PDT POR VALIDAR: debe ser validado antes de avanzar/);
  assert.match(migration279, /'PENDIENTE','REPO_OK','CORTE','MECANIZADO','PROCESADO','PICKING'/);
  assert.doesNotMatch(migration279, /update public\.sgp_aluminio_pendientes p set estado_repo='REPO_OK'/i);
  assert.match(app, /Actualizar estado/);
  assert.match(app, /Confirma la pieza correcta antes de mecanizado/);
});

test("Producción sigue mostrando bloqueo de mecanizado mientras el PDT no está validado", () => {
  assert.match(app, /BLOQUEADO PARA MECANIZADO/);
  assert.match(app, /pdt_por_validar/);
});

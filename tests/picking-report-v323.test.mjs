import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('index.html','utf8');
const controller=readFileSync('src/modules/picking-delivery-report-controller.js','utf8');
const css=readFileSync('picking-delivery-report.css','utf8');
test('LAB v323 report has branded header and no new data contract',()=>{
 assert.match(html,/LAB v348/);
 assert.match(html,/picking-delivery-report[.]css[?]v=348/);
 assert.match(controller,/pick-report-wordmark/);
 assert.match(controller,/Reporte de Entregas/);
 assert.match(controller,/Picking · Entrega de órdenes/);
 assert.match(controller,/sgp_picking_reporte_entregas_v1/);
 assert.match(controller,/pickReportPdf/);
 assert.match(controller,/pickReportImage/);
});
test('summary visual uses real data and accurate labels',()=>{
 for(const field of ['summary.movimientos','summary.producciones_unicas','summary.completas','summary.parciales'])assert.ok(controller.includes(field),field);
 assert.match(controller,/Cant. efectiva/);
 assert.match(controller,/Cant. orden/);
 assert.match(css,/pick-report-kpi/);
 assert.match(css,/pick-report-modal-header/);
 assert.match(css,/@media\(max-width:720px\)/);
});

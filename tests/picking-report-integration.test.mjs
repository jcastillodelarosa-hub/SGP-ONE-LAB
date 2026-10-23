import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('index.html','utf8');
const app=readFileSync('app.js','utf8');
const controller=readFileSync('src/modules/picking-delivery-report-controller.js','utf8');
test('LAB v321 report integrated with Picking tabs',()=>{
 for(const id of ['pickReportTab','pickReportPanel','pickReportFrom','pickReportTo','pickReportShift','pickReportSystem','pickReportRun','pickReportPdf','pickReportImage'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/LAB v331/);
 assert.match(html,/app\.js\?v=331/);
 assert.match(app,/initPickingDeliveryReport\(\{getSupabaseClient,getAppToken\}\)/);
});
test('historical report consumes authorized read-only RPC and complete pagination',()=>{
 assert.match(controller,/sgp_picking_reporte_entregas_v1/);
 assert.match(controller,/p_token:token/);
 assert.match(controller,/rows\.length!==total/);
 assert.match(controller,/fecha_operativa/);
 assert.match(html,/value="TURNO 1"/);
 assert.doesNotMatch(controller,/service_role/);
});

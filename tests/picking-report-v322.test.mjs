import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('index.html','utf8');
const controller=readFileSync('src/modules/picking-delivery-report-controller.js','utf8');
test('Picking order delivery offers direct report like Production',()=>{
 const start=html.indexOf('id="pickDeliveryPanel"');const end=html.indexOf('id="pickReceptionPanel"');
 assert.ok(start>=0&&end>start);assert.match(html.slice(start,end),/id="pickDirectReport"/);
 assert.match(controller,/pickDirectReport/);assert.match(controller,/aria-modal/);
 assert.match(controller,/closeOverlay/);
});
test('image and PDF replace Excel in report controls',()=>{
 assert.match(html,/id="pickReportImage"/);
 assert.match(html,/id="pickReportPdf"/);
 assert.doesNotMatch(html,/id="pickReportExcel"/);
 assert.match(controller,/html2canvas/);
 assert.match(controller,/\.png/);
 assert.match(controller,/\.pdf/);
 assert.doesNotMatch(controller,/pickReportExcel/);
});

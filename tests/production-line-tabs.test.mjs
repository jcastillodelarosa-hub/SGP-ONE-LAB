import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('index.html','utf8');
const tabs=readFileSync('production-line-tabs.js','utf8');
test('navigation renames Ensamble without changing view identity',()=>{
 assert.match(html,/<button data-view="ensamble">Línea de Producción<\/button>/);
 assert.match(html,/<section class="view" data-view-panel="ensamble"/);
 assert.match(html,/id="assemblySheetTab"/);
 assert.match(html,/id="assemblyLocationReportTab"/);
 assert.match(html,/id="assemblySheetPanel"/);
 assert.match(html,/id="assemblyLocationReportPanel"/);
});
test('Ensamble and Empaque have independent accessible tabs',()=>{
 for(const id of ['productionAssemblyTab','productionPackingTab','productionAssemblyPanel','productionPackingPanel'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(html,/production-line-tabs\.js\?v=1/);
 assert.match(tabs,/assemblyPanel.hidden=!isAssembly/);
 assert.match(tabs,/packingPanel.hidden=isAssembly/);
 assert.match(html,/id="packingPreviewBody"/);
 assert.match(html,/Saldo ensamble/);
 assert.doesNotMatch(html,/La pestaña de Empaque está disponible/);
});

test('Empaque reads authenticated existing RPC and excludes machining status',()=>{
 const app=readFileSync('app.js','utf8');
 assert.match(app,/async function loadPackingSheet\(\)/);
 assert.match(app,/client\.rpc\('sgp_consultar_ensamble'/);
 assert.match(app,/const token=getAppToken\(\)/);
 assert.match(app,/presente_ultimo_export!==false/);
 const panel=html.match(/id="productionPackingPanel"[\s\S]*?<\/table>/)?.[0]||'';
 assert.ok(panel.includes('Saldo ensamble'));
 assert.ok(!panel.includes('Estado Mec.'));
});
test('successful daily export refreshes active production-line sheet',()=>{
 const app=readFileSync('app.js','utf8');
 assert.match(app,/if\(document\.getElementById\('productionPackingTab'\)\?\.getAttribute\('aria-selected'\)==='true'\)void loadPackingSheet\(\)/);
 assert.match(app,/if\(document\.getElementById\('productionAssemblyTab'\)\?\.getAttribute\('aria-selected'\)==='true'\)void loadAssembly\(\)/);
});

test('Export success remains successful if optional event summary fails',()=>{
 const app=readFileSync('app.js','utf8');
 assert.match(app,/Export aplicado; resumen de eventos no disponible/);
 assert.match(app,/dailyExportPreview=null;dailyExportRows=\[\];\s*\/\/ The Export has already committed/);
 assert.match(app,/catch\(reportError\)/);
});
test('Empaque does not present stale or invalid balance as assembled',()=>{
 const app=readFileSync('app.js','utf8');
 assert.match(app,/const ready=r=>r\.presente_ultimo_export!==false&&validBalance\(r\)&&Number\(r\.saldo_ensamble\)===0/);
 assert.match(app,/const validBalance=r=>r\.saldos_inicializados===true/);
 assert.match(app,/packingRows=\[\];body\.innerHTML/);
});

test('packing priority is clearly identified as programming reference',()=>{
 assert.match(html,/Prioridad programación \(referencia\)/);
 assert.match(html,/La prioridad mostrada pertenece a Programación/);
});
test('packing refreshes for line and week changes and discards outdated responses',()=>{
 const app=readFileSync('app.js','utf8');
 assert.match(app,/for\(const id of \['assemblyWeek','assemblyLine'\]\)/);
 assert.match(app,/const requestSequence=\+\+packingRequestSequence/);
 assert.match(app,/if\(requestSequence!==packingRequestSequence\)return/);
});

test('packing ignores late responses from a previous authenticated session',()=>{
 const app=readFileSync('app.js','utf8');
 assert.match(app,/const requestedToken=getAppToken\(\)/);
 assert.match(app,/requestSequence!==packingRequestSequence\|\|getAppToken\(\)!==requestedToken/);
});

test('packing rejects empty and negative balances and exposes export freshness',()=>{
 const app=readFileSync('app.js','utf8');
 assert.match(app,/r\.saldo_ensamble!==''/);
 assert.match(app,/Number\(r\.saldo_ensamble\)>=0/);
 assert.match(app,/Export: '\+new Date\(r\.ultima_vez_export\)/);
});

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
 assert.match(html,/La pestaña de Empaque está disponible/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const report=app.slice(app.indexOf('function shiftReportError('),app.indexOf('\nasync function loadProductionBoard()'));
test('reporte permite seleccionar fecha y turno, sin campos bloqueados',()=>{
 assert.match(report,/data-shift-report-turno/);
 assert.match(report,/value="TURNO 1"/);
 assert.match(report,/value="TURNO 2"/);
 assert.match(report,/dateInput\.onchange=\(\)=>run\(updateFilters\)/);
 assert.match(report,/turnoInput\.onchange=\(\)=>run\(updateFilters\)/);
 assert.doesNotMatch(report,/data-shift-report-date[^>]*disabled/);
});
test('al cambiar de turno primero guarda el comentario de la selección anterior',()=>{
 assert.match(report,/await saveComment\(\);\s*const next=await buildShiftReportData\(nextDate,nextTurno\)/);
 assert.match(report,/if\(value===d\.comment\)return/);
 assert.match(report,/render\(\);/);
});
test('exportación usa la selección activa, captura válida y diagnóstico legible',()=>{
 assert.match(report,/shiftReportDownloadName\(d,'pdf'\)/);
 assert.match(report,/shiftReportDownloadName\(d,'png'\)/);
 assert.match(report,/shiftReportCapture\(preview\)/);
 assert.match(report,/window\.jspdf\?\.jsPDF/);
 assert.match(report,/typeof window\.html2canvas!=='function'/);
 assert.match(report,/errorBox\.textContent=shiftReportError\(e\)/);
});
test('controles evitan exportaciones concurrentes y recuperan estado tras fallar',()=>{
 assert.match(report,/if\(busy\)return/);
 assert.match(report,/finally\{setBusy\(false\)\}/);
 assert.match(css,/\.shift-report-actions button:disabled/);
});
test('LAB v317 identifica los recursos de la misma versión',()=>{
 assert.match(html,/LAB v339/);
 assert.match(html,/app\.js\?v=337/);
 assert.match(html,/styles\.css\?v=337/);
});

test('imagen no requiere biblioteca PDF y los scripts son locales',()=>{
 assert.match(report,/ensureReportExportLibs\(false\)/);
 assert.match(report,/No se pudo cargar la biblioteca de imágenes/);
 assert.match(report,/ensureReportExportLibs\(true\)/);
 assert.match(app,/async function ensureReportExportLibs\(needPdf=true\)/);
 assert.match(app,/\.\/vendor\/html2canvas\.min\.js/);
 assert.match(app,/\.\/vendor\/jspdf\.umd\.min\.js/);
 assert.doesNotMatch(app,/cdn\.jsdelivr\.net\/npm\/(html2canvas|jspdf)/);
});

test('el PDF o imagen puede generarse aunque falle guardar comentario, sin marcarlo guardado',()=>{
 assert.match(report,/catch\(error\)\{showError\(new Error\('No se pudo guardar el comentario/);
 assert.match(report,/shiftReportPreviewHtml\(\{\.\.\.d,comment:draft\}\)/);
 assert.match(report,/dateInput\.value=d\.date;turnoInput\.value=d\.turno/);
});

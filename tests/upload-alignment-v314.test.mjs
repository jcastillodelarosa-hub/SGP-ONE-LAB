import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

const dailyIds=['dailyExportFile','glassLocationFile','ncAlFile','ncGlassFile','aluminumTrackingFile'];
const weeklyIds=['programmingFiles','aluminumPiecesFile','accessoriesFile','glassFile'];

test('LAB v314: 5 pestañas diarias y 4 etapas semanales comparten la corrección',()=>{
 assert.match(html,/LAB v321/);
 assert.match(html,/app\.js\?v=320/);
 assert.match(html,/styles\.css\?v=320/);
 assert.equal((html.match(/class="daily-upload-row(?: daily-upload-simple)?"/g)||[]).length,5);
 assert.equal((html.match(/class="weekly-upload-row"/g)||[]).length,4);
 assert.equal((html.match(/class="daily-upload-row daily-upload-simple"/g)||[]).length,4);
 assert.equal((html.match(/class="sgp-file-picker"/g)||[]).length,9);
 for(const id of [...dailyIds,...weeklyIds]){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,'selector XLSX '+id);
  assert.match(html,new RegExp('id="'+id+'" type="file" accept="\\.xlsx"'));
 }
});

test('las cuatro pestañas diarias sin Línea usan el mismo layout de 3 controles',()=>{
 for(const id of dailyIds.slice(1)){
  const pattern=new RegExp('<div class="daily-upload-row daily-upload-simple">\\s*<div class="daily-file-field"><label for="'+id+'"');
  assert.match(html,pattern,'alineación de '+id);
 }
 assert.match(html,/<div class="daily-upload-row">\s*<label><span>Línea<\/span><select id="dailyExportLine"/);
 assert.match(html,/id="previewDailyExport" class="daily-outline-action"/);
 assert.match(html,/id="applyDailyExport" class="daily-primary-action" disabled/);
});

test('alineación común: etiquetas y botones comienzan a la misma altura',()=>{
 const fix=css.slice(css.indexOf('/* LAB v314 · alineación de los controles'));
 assert.ok(fix.length>400,'regla LAB v314 presente');
 assert.match(fix,/\.daily-upload-row,\s*\.daily-upload-row\.daily-upload-simple,\s*\.weekly-upload-row\{align-items:start\}/);
 assert.match(fix,/\.daily-upload-row > label,\s*\.weekly-upload-row > label,\s*\.daily-upload-row \.sgp-file-field-label,\s*\.weekly-upload-row \.sgp-file-field-label\{line-height:16px\}/);
 assert.match(fix,/\.daily-upload-row > button,\s*\.weekly-upload-row > button,\s*\.weekly-upload-row > \.weekly-status\{\s*align-self:start;\s*margin-top:23px;/);
 // El nuevo override debe ganar a las reglas heredadas de v50 y v55.
 assert.ok(css.lastIndexOf('.daily-upload-row.daily-upload-simple,')>css.lastIndexOf('.daily-upload-simple{grid-template-columns:'));
 assert.ok(fix.indexOf('.weekly-upload-row{align-items:start}')>=0);
});

test('breakpoints: sin separación artificial cuando los botones se apilan',()=>{
 const fix=css.slice(css.indexOf('/* LAB v314 · alineación de los controles'));
 assert.match(fix,/@media\(max-width:1100px\)\{\s*\.daily-upload-row:not\(\.daily-upload-simple\) > button\{margin-top:0\}/);
 assert.match(fix,/@media\(max-width:900px\)\{\s*\.weekly-upload-row > button,\s*\.weekly-upload-row > \.weekly-status\{margin-top:0\}/);
 assert.match(fix,/@media\(max-width:850px\)\{\s*\.daily-upload-row\.daily-upload-simple > button\{margin-top:0\}/);
 assert.match(fix,/@media\(max-width:700px\)\{\s*\.daily-upload-row > button\{margin-top:0\}/);
});

test('sin regresión: tarjetas Excel, selección múltiple y fotos permanecen',()=>{
 assert.match(css,/\.sgp-file-excel::after/);
 assert.match(css,/\.sgp-file-picker\[data-has-files="true"\] \.sgp-file-button/);
 assert.match(css,/\.sgp-file-picker \.sgp-file-remove/);
 assert.match(html,/id="programmingFiles" type="file" accept="\.xlsx" multiple/);
 assert.match(html,/id="recPhotos" type="file" accept="image\/\*" multiple hidden/);
 assert.match(html,/id="recCameraPhotos" type="file" accept="image\/\*" capture="environment" multiple hidden/);
});

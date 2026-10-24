import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileSelectionLabel,initFilePickers} from '../src/ui/file-picker.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const weekly=['programmingFiles','aluminumPiecesFile','accessoriesFile','glassFile'];
const daily=['dailyExportFile','glassLocationFile','ncAlFile','ncGlassFile','aluminumTrackingFile'];
const nativeIds=['recPhotos','recCameraPhotos'];

test('inventario completo: 9 archivos XLSX y 2 controles de fotos',()=>{
 const tags=[...html.matchAll(/<input\b[^>]*\btype="file"[^>]*>/g)].map(m=>m[0]);
 assert.equal(tags.length,11);
 assert.deepEqual(tags.map(tag=>tag.match(/\bid="([^"]+)"/)?.[1]).sort(),[...weekly,...daily,...nativeIds].sort());
 assert.equal((html.match(/class="sgp-file-picker"/g)||[]).length,9);
 for(const id of [...weekly,...daily]){
  const tag=tags.find(t=>t.includes('id="'+id+'"'));
  assert.ok(tag,'No existe '+id);
  assert.match(tag,/accept="\.xlsx"/);
  assert.match(tag,/aria-describedby="sgpFileSelection-/);
  assert.match(html,new RegExp('id="sgpFileSelection-'+id+'"'));
  assert.match(html,new RegExp('id="'+id+'"[^>]*>\\s*<span class="sgp-file-button"'));
 }
 assert.match(tags.find(t=>t.includes('id="programmingFiles"')),/\bmultiple\b/);
 for(const id of [...weekly.slice(1),...daily]){
  assert.doesNotMatch(tags.find(t=>t.includes('id="'+id+'"')),/\bmultiple\b/);
 }
 for(const id of nativeIds)assert.match(tags.find(t=>t.includes('id="'+id+'"')),/accept="image\/\*"/);
 assert.match(tags.find(t=>t.includes('id="recCameraPhotos"')),/capture="environment"/);
});

test('los 9 selectores usan el mismo botón y muestran nombre/ayuda',()=>{
 assert.equal((html.match(/↑<\/span> Seleccionar archivo(?:s)?/g)||[]).length,9);
 assert.equal((html.match(/class="sgp-file-selected" hidden/g)||[]).length,9);
 assert.equal((html.match(/class="sgp-file-selection" role="status" aria-live="polite"/g)||[]).length,9);
 assert.equal((html.match(/class="sgp-file-hint"/g)||[]).length,9);
 assert.match(css,/\.sgp-file-picker\s*\{/);
 assert.match(css,/\.sgp-file-button\s*\{/);
 assert.match(css,/\.sgp-file-picker:focus-within/);
 assert.match(css,/\.sgp-file-card\s*\{/);
 assert.doesNotMatch(css,/border:1px dashed #9db6d8/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(app,/import \{ initFilePickers \} from "\.\/src\/ui\/file-picker\.js";/);
 assert.match(app,/initFilePickers\(document\)/);
});

test('etiqueta segura de archivos: vacío, único, múltiple y nombres no confiables',()=>{
 assert.equal(fileSelectionLabel([]),'Sin archivos seleccionados');
 assert.equal(fileSelectionLabel([{name:'paneles.xlsx'}]),'paneles.xlsx');
 assert.equal(fileSelectionLabel([{name:'p2.xlsx'},{name:'f2.xlsx'}]),'2 archivos seleccionados: p2.xlsx · f2.xlsx');
 assert.equal(fileSelectionLabel([{name:'p2.xlsx'},{name:'f2.xlsx'},{name:'extra.xlsx'}]),'3 archivos seleccionados: p2.xlsx · f2.xlsx · y 1 más');
 assert.equal(fileSelectionLabel([{name:'<img src=x onerror=alert(1)>.xlsx'}]),'<img src=x onerror=alert(1)>.xlsx');
});

test('change actualiza solo texto sin modificar FileList ni duplicar listeners',()=>{
 const listeners=[];
 const status={textContent:'anterior'};
 const cards={hidden:true};
 const picker={dataset:{},querySelector(selector){
  if(selector==='.sgp-file-selection')return status;
  if(selector==='.sgp-file-selected')return cards;
  return null;
 }};
 const input={
  dataset:{},
  files:[{name:'inicial.xlsx'}],
  parentElement:picker,
  getAttribute(){return 'Seleccionar XLSX';},
  setAttribute(){},
  addEventListener(name,fn){listeners.push({name,fn});}
 };
 const root={querySelectorAll(selector){assert.equal(selector,'.sgp-file-picker input[type="file"]');return [input];}};
 initFilePickers(root);
 initFilePickers(root);
 assert.equal(listeners.length,1);
 assert.equal(listeners[0].name,'change');
 assert.equal(status.textContent,'✓ 1 archivo seleccionado');
 assert.equal(picker.dataset.hasFiles,'true');
 assert.equal(cards.hidden,false);
 const original=input.files;
 input.files=[{name:'nueva.xlsx'},{name:'otro.xlsx'}];
 listeners[0].fn();
 assert.equal(status.textContent,'✓ 2 archivos seleccionados');
 assert.notEqual(input.files,original);
 input.files=[];
 listeners[0].fn();
 assert.equal(status.textContent,'Sin archivos seleccionados');
 assert.equal(picker.dataset.hasFiles,'false');
 assert.equal(cards.hidden,true);
});

test('conserva flujos de validación, foto/cámara y versión consistente',()=>{
 for(const id of ['validateProgramming','validatePieces','validateAccessories','validateGlass','previewDailyExport','previewGlassLocation','previewNcAl','previewNcGlass','validateAluminum','recChoosePhotos','recTakePhoto']){
  assert.ok(html.includes('id="'+id+'"'),'Falta control existente '+id);
 }
 assert.match(app,/els\.files\.files/);
 assert.match(app,/els\.dailyExportFile\?\.files/);
 assert.match(app,/\#recChoosePhotos'\)\?\.addEventListener/);
 assert.match(app,/\#recTakePhoto'\)\?\.addEventListener/);
 assert.match(html,/LAB v348/);
 assert.match(html,/app\.js\?v=348/);
 assert.match(html,/styles\.css\?v=348/);
});

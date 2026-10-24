import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 fileSizeLabel,selectedFileCountLabel,removeSelectedFile,initFilePickers
} from '../src/ui/file-picker.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const ids=['programmingFiles','aluminumPiecesFile','accessoriesFile','glassFile','dailyExportFile','glassLocationFile','ncAlFile','ncGlassFile','aluminumTrackingFile'];

test('9 controles XLSX compactos, sin etiquetas anidadas ni cambios en entradas de fotos',()=>{
 assert.equal((html.match(/class="sgp-file-picker"/g)||[]).length,9);
 assert.equal((html.match(/class="sgp-file-selected" hidden/g)||[]).length,9);
 assert.equal((html.match(/class="sgp-file-field-label"/g)||[]).length,9);
 assert.equal((html.match(/type="file"/g)||[]).length,11);
 assert.equal((html.match(/class="sgp-file-icon">↑<\/span>/g)||[]).length,9);
 assert.doesNotMatch(html,/<label class="(?:weekly|daily)-file-field">/);
 for(const id of ids){
  assert.match(html,new RegExp('<label for="'+id+'" class="sgp-file-field-label">'));
  assert.match(html,new RegExp('id="'+id+'" type="file" accept="\\.xlsx"'));
 }
 assert.match(html,/id="programmingFiles"[^>]*multiple/);
 assert.match(html,/id="recPhotos" type="file" accept="image\/\*" multiple hidden/);
 assert.match(html,/id="recCameraPhotos" type="file" accept="image\/\*" capture="environment" multiple hidden/);
 assert.match(html,/LAB v353/);
 assert.match(html,/app\.js\?v=350/);
 assert.match(html,/styles\.css\?v=350/);
});

test('estados compactos: icono Excel, tarjetas proporcionales y quitar accesible',()=>{
 assert.match(css,/\.sgp-file-excel::after\s*\{/);
 assert.match(css,/content:"X"/);
 assert.match(css,/\.sgp-file-card\s*\{/);
 assert.match(css,/\.sgp-file-picker \.sgp-file-remove\s*\{/);
 assert.match(css,/\.sgp-file-selected\[hidden\]/);
 assert.match(css,/\.sgp-file-picker\[data-has-files="true"\] \.sgp-file-button/);
 assert.doesNotMatch(css,/border:1px dashed #9db6d8/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(app,/initFilePickers\(document\)/);
});

test('nombre, tamaño, cantidad y archivos no confiables se presentan como texto',()=>{
 assert.equal(fileSizeLabel(0),'0 B');
 assert.equal(fileSizeLabel(1024),'1 KB');
 assert.equal(fileSizeLabel(1258291),'1.2 MB');
 assert.equal(fileSizeLabel(undefined),'Tamaño no disponible');
 assert.equal(selectedFileCountLabel(0),'Sin archivos seleccionados');
 assert.equal(selectedFileCountLabel(1),'✓ 1 archivo seleccionado');
 assert.equal(selectedFileCountLabel(2),'✓ 2 archivos seleccionados');
});

function fakeDom(files){
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.attributes={};this.hidden=false;this.textContent='';this.dataset={};}
  setAttribute(name,value){this.attributes[name]=value}
  getAttribute(name){return this.attributes[name]||null}
  addEventListener(name,fn){this.listeners[name]=fn}
  append(...children){this.children.push(...children)}
  replaceChildren(...children){this.children=children}
 }
 const doc={createElement(tag){return new Element(tag)}};
 const status=new Element('small');
 const cards=new Element('span');
 const picker=new Element('span');
 picker.querySelector=selector=>selector==='.sgp-file-selection'?status:selector==='.sgp-file-selected'?cards:null;
 const input=new Element('input');
 input.ownerDocument=doc;
 input.parentElement=picker;
 input.files=files;
 input.multiple=files.length>1;
 input.setAttribute('aria-label','Seleccionar archivo');
 Object.defineProperty(input,'value',{set(value){if(value==='')input.files=[]},get(){return ''}});
 input.dispatchEvent=event=>{input.listeners[event.type]?.(event);input.onExternalChange?.(event);return true};
 const root={querySelectorAll(){return [input]}};
 return {root,input,picker,status,cards};
}

test('se muestra icono Excel verde, nombre real y tamaño; X limpia y notifica change',()=>{
 const ui=fakeDom([{name:'Export_Paneles_S42.xlsx',size:1258291}]);
 let changes=0;
 ui.input.onExternalChange=()=>changes++;
 initFilePickers(ui.root);
 assert.equal(ui.picker.dataset.hasFiles,'true');
 assert.equal(ui.status.textContent,'✓ 1 archivo seleccionado');
 assert.equal(ui.cards.hidden,false);
 assert.equal(ui.cards.children.length,1);
 const card=ui.cards.children[0];
 const [icon,details,remove]=card.children;
 assert.equal(icon.className,'sgp-file-excel');
 assert.equal(details.children[0].textContent,'Export_Paneles_S42.xlsx');
 assert.equal(details.children[1].textContent,'1.2 MB · XLSX');
 assert.equal(remove.type,'button');
 assert.equal(remove.attributes['aria-label'],'Quitar Export_Paneles_S42.xlsx');
 let stopped=false;
 remove.listeners.click({preventDefault(){},stopPropagation(){stopped=true}});
 assert.equal(stopped,true);
 assert.equal(changes,1);
 assert.equal(ui.input.files.length,0);
 assert.equal(ui.picker.dataset.hasFiles,'false');
 assert.equal(ui.cards.hidden,true);
 assert.equal(ui.status.textContent,'Sin archivos seleccionados');
});

test('el nombre se asigna con textContent, sin interpretar HTML de un XLSX',()=>{
 const malicious='<img src=x onerror=alert(1)>.xlsx';
 const ui=fakeDom([{name:malicious,size:4500}]);
 initFilePickers(ui.root);
 const name=ui.cards.children[0].children[1].children[0];
 assert.equal(name.textContent,malicious);
 assert.match(readFileSync(new URL('../src/ui/file-picker.js',import.meta.url),'utf8'),/name\.textContent=String\(file\?\.name/);
});

test('Programación conserva archivos múltiples y permite quitar uno por índice',()=>{
 class Transfer{
  constructor(){this.values=[];this.items={add:file=>this.values.push(file)}}
  get files(){return this.values}
 }
 const ui=fakeDom([{name:'paneles.xlsx',size:1},{name:'frames.xlsx',size:2}]);
 let changes=0;
 ui.input.onExternalChange=()=>changes++;
 initFilePickers(ui.root);
 assert.equal(ui.cards.children.length,2);
 assert.equal(ui.status.textContent,'✓ 2 archivos seleccionados');
 assert.equal(removeSelectedFile(ui.input,0,Transfer),true);
 assert.equal(changes,1);
 assert.deepEqual(ui.input.files.map(f=>f.name),['frames.xlsx']);
 assert.equal(ui.cards.children.length,1);
 assert.equal(ui.status.textContent,'✓ 1 archivo seleccionado');
 assert.equal(removeSelectedFile(ui.input,9,Transfer),false);
 assert.equal(changes,1);
});

test('quitar XLSX invalida la validación previa, incluso NC y seguimiento',()=>{
 assert.match(app,/els\.files\.addEventListener\("change", \(\) => \{ invalidateWeeklySource\("programming"\)/);
 assert.match(app,/els\.dailyExportFile\?\.addEventListener\("change",\(\)=>\{resetDailyExport\(\)/);
 assert.match(app,/els\.glassLocationFile\?\.addEventListener\("change",\(\)=>\{resetGlassLocation\(\)/);
 assert.match(app,/els\.aluminumFile\?\.addEventListener\("change"/);
 assert.match(app,/document\.querySelector\("#ncAlFile"\)\?\.addEventListener\("change"/);
 assert.match(app,/document\.querySelector\("#ncGlassFile"\)\?\.addEventListener\("change"/);
 assert.match(app,/if\(els\.aluminumFile\.files\?\.\[0\]!==file\)return/);
 assert.match(app,/if\(document\.querySelector\("#ncAlFile"\)\?\.files\?\.\[0\]!==file\)return/);
 assert.match(app,/if\(document\.querySelector\("#ncGlassFile"\)\?\.files\?\.\[0\]!==file\)return/);
});

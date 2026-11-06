import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=source.indexOf('const ncGlassCols=');
const end=source.indexOf('async function loadNcGlassOperational()',start);
assert.ok(start>=0&&end>start);
const block=source.slice(start,end);
function fixture({order=null,hidden=[]}={}){
 const elements={};
 for(const id of ['#ncGlassHead','#ncGlassBody','#ncGlassColumnPicker'])elements[id]={innerHTML:'',closest:()=>({}),querySelectorAll:()=>[]};
 const ctx=vm.createContext({
  document:{querySelector:s=>elements[s]},
  localStorage:{getItem:k=>k==='sgp_ncg_col_order'?JSON.stringify(order):JSON.stringify(hidden),setItem:()=>{}},
  escapeHtml:v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  bindSheetFilters:(_table,_rows,cols)=>{elements.filterColumns=cols;},
  enableDraggableColumns:()=>{}
 });
 vm.runInContext(block+'\nglobalThis.api={keys:()=>ncGlassCols.map(c=>c[0]),visible:()=>ncGlassCols.filter(([k])=>!ncGlassHidden.has(k)).map(c=>c[0]),rows:r=>{ncGlassViewRows=r;},filter:v=>{ncGlassFilters.orden=v;},sort:()=>{ncGlassSort={key:"orden",dir:1};},render:renderNcGlassView,picker:renderNcGlassPicker};',ctx);
 return {api:ctx.api,elements};
}

test('NC Vidrio muestra Producción (orden) junto a NC por defecto',()=>{
 const {api,elements}=fixture();
 const keys=Array.from(api.keys());assert.equal(keys[keys.indexOf('consecutivo')+1],'orden');
 assert.ok(api.visible().includes('orden'));api.picker();
 assert.match(elements['#ncGlassColumnPicker'].innerHTML,/data-ncgvis="orden" checked> Producción \(orden\)/);
});
test('preferencia anterior incorpora orden junto a NC sin reiniciar columnas',()=>{
 const old=['sistema','consecutivo','proyecto','semana_maestro','estado_nc'];
 const {api}=fixture({order:old,hidden:['proyecto']});
 const keys=Array.from(api.keys());assert.deepEqual(keys.slice(0,6),['sistema','consecutivo','orden','proyecto','semana_maestro','estado_nc']);
 assert.ok(!api.visible().includes('proyecto'));assert.ok(api.visible().includes('orden'));
});
test('respeta ubicación y ocultación de Producción elegidas después',()=>{
 const {api}=fixture({order:['orden','sistema','consecutivo'],hidden:['orden']});
 assert.deepEqual(Array.from(api.keys()).slice(0,3),['orden','sistema','consecutivo']);
 assert.ok(!api.visible().includes('orden'));assert.equal(api.keys().filter(k=>k==='orden').length,1);
});
test('muestra nombre de fuente escapado, no reemplaza orden por Orden SAP',()=>{
 const {api,elements}=fixture();api.rows([{consecutivo:'12615136',orden:'982383 - Murray <script>',orden_sap:'4501691027'}]);api.render();
 assert.match(elements['#ncGlassHead'].innerHTML,/Producción \(orden\)/);
 assert.match(elements['#ncGlassBody'].innerHTML,/<td>982383 - Murray &lt;script&gt;<\/td>/);
 assert.ok(!elements['#ncGlassBody'].innerHTML.includes('<script>'));
 api.rows([{consecutivo:'12615203',orden:null,orden_sap:'4501695600'}]);api.render();
 assert.match(elements['#ncGlassBody'].innerHTML,/<td>12615203<\/td><td><\/td>/);
});
test('el campo nuevo participa en filtro y ordenación existentes',()=>{
 const {api,elements}=fixture();api.rows([{consecutivo:'2',orden:'B'},{consecutivo:'1',orden:'A'}]);api.sort();api.render();
 assert.ok(elements['#ncGlassBody'].innerHTML.indexOf('<td>A</td>')<elements['#ncGlassBody'].innerHTML.indexOf('<td>B</td>'));
 assert.ok(elements.filterColumns.some(c=>c.key==='orden'));api.filter(['B']);api.render();
 assert.ok(!elements['#ncGlassBody'].innerHTML.includes('<td>A</td>'));assert.ok(elements['#ncGlassBody'].innerHTML.includes('<td>B</td>'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {ncGlassOrigin,ncGlassOriginSource} from '../src/domain/nc-glass-origin.js';

test('origen usa motivo o línea afectada explícitos y normaliza texto',()=>{
 for(const row of [{motivo:'PROVEEDOR'},{motivo:'',linea_afectada:'PROVEEDOR'},{motivo:' proveedor '}])assert.equal(ncGlassOrigin(row),'Proveedor');
 assert.equal(ncGlassOrigin({motivo:'PROCESO',linea_afectada:'PANELES 2'}),'Planta (proceso)');
 assert.equal(ncGlassOrigin({motivo:'PLANTA'}),'Planta');
 assert.equal(ncGlassOrigin({motivo:'BODEGA',linea_afectada:'BODEGA DE VIDRIO'}),'Bodega');
});
test('no inventa Planta por ausencia de proveedor ni por línea responsable',()=>{
 for(const row of [{},{motivo:'ROTURA'},{linea_afectada:'PANELES 2'},{linea_responsable:'PANELES 2'},{motivo:'NO PROVEEDOR'},{motivo:'REPROCESO'}])assert.equal(ncGlassOrigin(row),'Sin clasificar');
 assert.equal(ncGlassOrigin({motivo:'PROCESO',linea_afectada:'PROVEEDOR'}),'Por validar');
 assert.equal(ncGlassOrigin({motivo:'BODEGA',linea_afectada:'PROVEEDOR'}),'Por validar');
});
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=source.indexOf('function showNcGlassLoadDetail(k)');
const end=source.indexOf("document.querySelectorAll('[data-ncgload]')",start);
function fixture(){
 const elements=Object.fromEntries(['#ncNewTitle','#ncNewModal thead','#ncNewBody','#ncNewModal'].map(key=>[key,{hidden:true,innerHTML:'',textContent:''}]));
 const ctx=vm.createContext({document:{querySelector:key=>elements[key]},window:{},ncGlassOrigin,ncGlassOriginSource,escapeHtml:v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))});
 vm.runInContext(source.slice(start,end),ctx);
 return {ctx,elements};
}
test('nuevas, finalizadas y abiertas muestran origen sin alterar datos',()=>{
 const {ctx,elements}=fixture();
 const rows=[{consecutivo:'NC-1',motivo:'PROVEEDOR'},{consecutivo:'NC-2',motivo:'PROCESO'},{consecutivo:'NC-3',motivo:'BODEGA'}];
 const before=JSON.stringify(rows);
 for(const key of ['NUEVA','FINALIZADA','ABIERTA']){
  ctx.window.ncGlassLoadEvents={[key]:rows};ctx.showNcGlassLoadDetail(key);
  assert.match(elements['#ncNewModal thead'].innerHTML,/<th>ORIGEN NC<\/th>/);
  assert.equal((elements['#ncNewModal thead'].innerHTML.match(/<th>/g)||[]).length,8);
  assert.match(elements['#ncNewBody'].innerHTML,/>Proveedor<\/td>/);
  assert.match(elements['#ncNewBody'].innerHTML,/>Planta \(proceso\)<\/td>/);
  assert.match(elements['#ncNewBody'].innerHTML,/>Bodega<\/td>/);
  assert.equal(elements['#ncNewModal'].hidden,false);
 }
 assert.equal(JSON.stringify(rows),before);
});
test('escapa fuente y filas, reapertura sin resultados no conserva datos anteriores',()=>{
 const {ctx,elements}=fixture();ctx.window.ncGlassLoadEvents={NUEVA:[{motivo:'"><script>x</script>',orden:'<img>',linea_afectada:'PROVEEDOR'}]};ctx.showNcGlassLoadDetail('NUEVA');
 assert.ok(!elements['#ncNewBody'].innerHTML.includes('<script>'));
 assert.ok(!elements['#ncNewBody'].innerHTML.includes('<img>'));
 assert.match(elements['#ncNewBody'].innerHTML,/&quot;&gt;&lt;script&gt;/);
 ctx.window.ncGlassLoadEvents={};ctx.showNcGlassLoadDetail('ABIERTA');
 assert.equal(elements['#ncNewBody'].innerHTML,'');assert.match(elements['#ncNewTitle'].textContent,/ · 0$/);
});

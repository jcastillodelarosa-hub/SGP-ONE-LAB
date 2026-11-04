import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {indexGlassProductionWeeks, weeksWithGlass, filterGlassRowsByWeek} from '../src/domain/glass-week-filter.js';

// Exercise the actual loader without booting unrelated app modules or a backend.
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=app.indexOf('function visibleGlassEfficiencyRows(){');
const end=app.indexOf('\nfunction renderGlassEfficiency(){',start);
assert.ok(start>=0&&end>start);
const loader=app.slice(start,end);
const year=new Date().getFullYear();
const mapped={key_produccion:'active|PANELES_2',reserva:'shared',preparadas:5};
const missing={key_produccion:'unknown|PANELES_2',reserva:'shared',preparadas:3};
const productions=[{key_produccion:mapped.key_produccion,anio:year,semana_actual:45}];

function fixture(rows, {weekly=productions, error=null, explorerOpen=false}={}) {
 const picker={disabled:false,value:'all',innerHTML:''};
 const status={textContent:''};
 const nodes={'#glassEfficiencyWeek':picker,'#glassEfficiencyWeekStatus':status,'#glassExplorerModal':{hidden:!explorerOpen}};
 const calls=[],renders=[],explorerRenders=[];
 const context=vm.createContext({
  document:{querySelector:id=>nodes[id]},
  glassEfficiencyRows:rows,glassWeekByProduction:new Map(),locationReportRequest:1,
  indexGlassProductionWeeks,weeksWithGlass,filterGlassRowsByWeek,
  renderGlassEfficiency:()=>renders.push([...context.visibleGlassEfficiencyRows()]),
  renderGlassExplorer:()=>explorerRenders.push([...context.visibleGlassEfficiencyRows()]),
 });
 vm.runInContext(loader,context);
 const client={rpc:async(name,args)=>{
  calls.push({name,args});
  if(error)return {error};
  if(name==='sgp_picking_semanas')return {data:[45]};
  if(name==='sgp_consultar_programacion_semana')return {data:{producciones:weekly}};
  throw new Error('Unexpected RPC: '+name);
 }};
 return {picker,status,calls,renders,explorerRenders,context,
  load:(previous='all',request=1)=>context.loadGlassEfficiencyWeeks(client,'test-token',request,previous)};
}

test('partial mapping enables available week, counts unique missing orders and preserves general report',async()=>{
 const rows=[mapped,missing,{...missing,preparadas:2}];
 const f=fixture(rows);
 await f.load();
 assert.equal(f.picker.disabled,false);
 assert.match(f.picker.innerHTML,new RegExp('value="'+year+'-45"'));
 assert.equal(f.picker.value,'all');
 assert.equal(f.context.visibleGlassEfficiencyRows(),rows);
 assert.deepEqual(f.renders.at(-1),rows);
 assert.match(f.status.textContent,/1 órdenes sin correspondencia semanal/);
 assert.match(f.status.textContent,/se incluyen en «Todas las semanas» y se excluyen al seleccionar una semana/);
 assert.doesNotMatch(f.status.textContent,/archivad/i);
 assert.deepEqual(f.calls.map(c=>c.name),['sgp_picking_semanas','sgp_consultar_programacion_semana']);
 f.picker.value=year+'-45';
 assert.deepEqual([...f.context.visibleGlassEfficiencyRows()],[mapped]);
 f.picker.value='all';
 assert.equal(f.context.visibleGlassEfficiencyRows(),rows);
});

test('available previous week is retained for list and open explorer with partial coverage',async()=>{
 const f=fixture([mapped,missing],{explorerOpen:true});
 await f.load(year+'-45');
 assert.equal(f.picker.disabled,false);
 assert.equal(f.picker.value,year+'-45');
 assert.deepEqual(f.renders.at(-1),[mapped]);
 assert.deepEqual(f.explorerRenders.at(-1),[mapped]);
 assert.match(f.status.textContent,/sin correspondencia semanal/);
});

test('unavailable previous week falls back to general report including unmapped orders',async()=>{
 const rows=[mapped,missing],f=fixture(rows);
 await f.load(year+'-44');
 assert.equal(f.picker.value,'all');
 assert.deepEqual(f.renders.at(-1),rows);
});

test('full coverage retains existing success message and weekly filtering',async()=>{
 const f=fixture([mapped]);
 await f.load(year+'-45');
 assert.equal(f.picker.disabled,false);
 assert.equal(f.status.textContent,'1 semanas disponibles');
 assert.deepEqual(f.renders.at(-1),[mapped]);
});

test('no mapped orders keeps general report and explains unavailable weekly filtering',async()=>{
 const rows=[missing],f=fixture(rows);
 await f.load();
 assert.equal(f.picker.disabled,true);
 assert.match(f.status.textContent,/Filtro semanal no disponible:.*1 órdenes sin correspondencia semanal/);
 assert.match(f.status.textContent,/El reporte general continúa operativo/);
 assert.deepEqual(f.renders.at(-1),rows);
});

test('RPC failure still preserves general report with unavailable filter',async()=>{
 const rows=[mapped,missing],f=fixture(rows,{error:{message:'PERMISO_DENEGADO'}});
 await f.load();
 assert.equal(f.picker.disabled,true);
 assert.match(f.status.textContent,/Filtro semanal no disponible: PERMISO_DENEGADO/);
 assert.deepEqual(f.renders.at(-1),rows);
});

test('stale response does not populate weeks or render another report',async()=>{
 const f=fixture([mapped,missing]);
 await f.load('all',0);
 assert.equal(f.picker.innerHTML,'');
 assert.equal(f.context.glassWeekByProduction.size,0);
 assert.equal(f.renders.length,0);
});

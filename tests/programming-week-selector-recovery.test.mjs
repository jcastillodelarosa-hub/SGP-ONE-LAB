import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../programacion-subtabs-v350.js',import.meta.url),'utf8');
function harness(){
 let rows=[],schedule=[]; const listeners={}; const select={value:'',options:[{value:''}]};
 const context={console,Set,Map,Date,Number,String,Array,Math,Promise,document:{head:{appendChild(){}},createElement:()=>({}),readyState:'loading',addEventListener(){},querySelector:s=>s==='#progWeek'?select:null},window:{addEventListener:(e,f)=>listeners[e]=f,SGPWeeklyDemand:()=>rows,SGPWeeklySchedule:()=>schedule}};
 vm.runInNewContext(source.replace(/\}\)\(\);\s*$/,`window.testApi={syncWeekSelection,programmingWeekOptions,weeklyDashboard,state:()=>({selected:[...selectedWeeks],weeksReady,programmingLoading,programmingError}),clear:()=>selectedWeeks.clear()};})();`),context);
 return {api:context.window.testApi,select,listeners,rows:r=>rows=r,schedule:r=>schedule=r};
}
test('empty startup does not freeze selection; async rows initialize latest week',()=>{const h=harness();h.api.syncWeekSelection();assert.equal(h.api.state().weeksReady,false);h.rows([{semana:45},{semana:47}]);assert.deepEqual([...h.api.syncWeekSelection()],[45,47]);assert.deepEqual([...h.api.state().selected],[47]);});
test('available demand is read directly even if legacy select is stale',()=>{const h=harness();h.rows([{semana:46}]);assert.deepEqual([...h.api.programmingWeekOptions()],[46]);});
test('explicit no-selection is preserved on refresh',()=>{const h=harness();h.rows([{semana:47}]);h.api.syncWeekSelection();h.api.clear();h.api.syncWeekSelection();assert.deepEqual([...h.api.state().selected],[]);});
test('legacy chosen week is preserved; new weeks are discoverable',()=>{const h=harness();h.select.value='45';h.select.options.push({value:'45'});h.rows([{semana:47}]);h.api.syncWeekSelection();assert.deepEqual([...h.api.state().selected],[45]);h.rows([{semana:48}]);assert.deepEqual([...h.api.syncWeekSelection()],[45,48]);});
test('load failures are surfaced to Summary and reset on retry',()=>{const h=harness();h.listeners['sgp:programming-loading']();assert.equal(h.api.state().programmingLoading,true);h.listeners['sgp:programming-error']({detail:{message:'timeout'}});assert.equal(h.api.state().programmingError,'timeout');assert.equal(h.api.state().programmingLoading,false);h.listeners['sgp:programming-loading']();assert.equal(h.api.state().programmingError,'');});
test('invalid weeks do not create checkbox entries',()=>{const h=harness();h.rows([{semana:0},{semana:54},{semana:'47'},{semana:null}]);assert.deepEqual([...h.api.syncWeekSelection()],[47]);});

test('timeout retains confirmed week metadata without presenting zero totals',()=>{const h=harness();h.listeners['sgp:programming-error']({detail:{message:'canceling statement due to statement timeout',code:'57014',confirmedWeeks:[46,47,0,54]}});assert.deepEqual([...h.api.programmingWeekOptions()],[46,47]);assert.deepEqual([...h.api.state().selected],[47]);const html=h.api.weeklyDashboard();assert.match(html,/La consulta tardó demasiado/);assert.match(html,/Semana 47/);assert.match(html,/No se muestran totales/);assert.doesNotMatch(html,/Reservas disponibles|sgp351-cards|sgp351-board/);});
test('loading hides prior dashboard totals and offers no duplicate retry',()=>{const h=harness();h.rows([{semana:47}]);h.listeners['sgp:programming-loading']();const html=h.api.weeklyDashboard();assert.match(html,/Cargando Programación/);assert.match(html,/data-sgp351-refresh disabled/);assert.doesNotMatch(html,/Reservas disponibles/);});
test('permission failure is not hidden or turned into a successful empty view',()=>{const h=harness();h.listeners['sgp:programming-error']({detail:{message:'Acceso denegado',code:'42501'}});const html=h.api.weeklyDashboard();assert.match(html,/Acceso denegado/);assert.match(html,/Semanas pendientes/);assert.doesNotMatch(html,/La consulta tardó demasiado|Reservas disponibles/);});

test('loader emits timeout and confirmed weeks without applying partial operational data',async()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const fn=app.slice(app.indexOf('async function loadProgramming(options={})'),app.indexOf('\nfunction glassClass'));
 const events=[],oldRows=[{reserva:'synthetic-old'}],oldSchedule=[{semana:45}];
 const context={programmingRequestSeq:0,getAppToken:()=> 'synthetic-token',document:{querySelector:()=>null},window:{dispatchEvent:e=>events.push(e)},Event:class{constructor(type){this.type=type}},CustomEvent:class{constructor(type,options){this.type=type;Object.assign(this,options)}},machiningMetrics:{measure:(_a,_b,fn)=>fn()},getMecanizadoReadClient:async()=>({rpc:async name=>({data:name==='sgp_mecanizado_programacion_listar'?[{semana:47}]:[]})}),readWithAccessoryAlerts:async()=>({error:{code:'57014',message:'canceling statement due to statement timeout'}}),readReprogramming:async()=>({data:[]}),ensureSharedReservations:async()=>{},progRows:oldRows,progSchedule:oldSchedule};
 vm.createContext(context);vm.runInContext(fn,context);await context.loadProgramming();
 const failure=events.find(e=>e.type==='sgp:programming-error');assert.equal(failure.detail.code,'57014');assert.deepEqual([...failure.detail.confirmedWeeks],[47]);assert.equal(context.progRows,oldRows);assert.equal(context.progSchedule,oldSchedule);assert.ok(!events.some(e=>e.type==='sgp:programming-loaded'));
});

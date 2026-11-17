import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../programacion-subtabs-v350.js',import.meta.url),'utf8');
function harness(){
 let rows=[],schedule=[]; const listeners={}; const select={value:'',options:[{value:''}]};
 const context={console,Set,Map,Date,Number,String,Array,Math,Promise,document:{head:{appendChild(){}},createElement:()=>({}),readyState:'loading',addEventListener(){},querySelector:s=>s==='#progWeek'?select:null},window:{addEventListener:(e,f)=>listeners[e]=f,SGPWeeklyDemand:()=>rows,SGPWeeklySchedule:()=>schedule}};
 vm.runInNewContext(source.replace(/\}\)\(\);\s*$/,`window.testApi={syncWeekSelection,programmingWeekOptions,state:()=>({selected:[...selectedWeeks],weeksReady,programmingLoading,programmingError}),clear:()=>selectedWeeks.clear()};})();`),context);
 return {api:context.window.testApi,select,listeners,rows:r=>rows=r,schedule:r=>schedule=r};
}
test('empty startup does not freeze selection; async rows initialize latest week',()=>{const h=harness();h.api.syncWeekSelection();assert.equal(h.api.state().weeksReady,false);h.rows([{semana:45},{semana:47}]);assert.deepEqual([...h.api.syncWeekSelection()],[45,47]);assert.deepEqual([...h.api.state().selected],[47]);});
test('available demand is read directly even if legacy select is stale',()=>{const h=harness();h.rows([{semana:46}]);assert.deepEqual([...h.api.programmingWeekOptions()],[46]);});
test('explicit no-selection is preserved on refresh',()=>{const h=harness();h.rows([{semana:47}]);h.api.syncWeekSelection();h.api.clear();h.api.syncWeekSelection();assert.deepEqual([...h.api.state().selected],[]);});
test('legacy chosen week is preserved; new weeks are discoverable',()=>{const h=harness();h.select.value='45';h.select.options.push({value:'45'});h.rows([{semana:47}]);h.api.syncWeekSelection();assert.deepEqual([...h.api.state().selected],[45]);h.rows([{semana:48}]);assert.deepEqual([...h.api.syncWeekSelection()],[45,48]);});
test('load failures are surfaced to Summary and reset on retry',()=>{const h=harness();h.listeners['sgp:programming-loading']();assert.equal(h.api.state().programmingLoading,true);h.listeners['sgp:programming-error']({detail:{message:'timeout'}});assert.equal(h.api.state().programmingError,'timeout');assert.equal(h.api.state().programmingLoading,false);h.listeners['sgp:programming-loading']();assert.equal(h.api.state().programmingError,'');});
test('invalid weeks do not create checkbox entries',()=>{const h=harness();h.rows([{semana:0},{semana:54},{semana:'47'},{semana:null}]);assert.deepEqual([...h.api.syncWeekSelection()],[47]);});

import test from 'node:test';import assert from 'node:assert/strict';
import {physicalProgress} from '../src/domain/mecanizado-operational-load.js';
const row=(id,extra={})=>({id_programacion:id,reserva:'R',sistema:'ES-MX4000',produccion:'PANEL',cantidad_programada:10,semana_origen:44,estado:'PROGRAMADA',...extra});
const snapshot=(extra={})=>({schedule:[row('A')],executions:[],orderExecutions:[],moves:[],links:[],coverage:[],...extra});
const run=(s,w=[44],sys='')=>physicalProgress(s,w,sys);
test('no execution after successful reads means 0; zero denominator has no percentage',()=>{assert.deepEqual(run(snapshot()).total,{programmed:10,processed:0,pending:10,percent:0});assert.deepEqual(run(snapshot({schedule:[]})).total,{programmed:0,processed:0,pending:0,percent:null});});
test('real partial counts are bounded, PROCESADO uses operational quantity, not workload',()=>{for(const [estado,cantidad_procesada,expected] of [['CORTE',4,4],['MECANIZADO',99,10],['PROCESADO',0,10]])assert.equal(run(snapshot({executions:[{id_programacion:'A',estado,cantidad_procesada}]})).total.processed,expected);});
test('weeks and systems filter independently; multi-week percentage is weighted',()=>{const s=snapshot({schedule:[row('A'),row('B',{semana_origen:45,sistema:'ES-EL400',cantidad_programada:30})],executions:[{id_programacion:'A',estado:'PROCESADO'}]});assert.equal(run(s).total.programmed,10);assert.equal(run(s,[44,45]).total.percent,25);assert.equal(run(s,[44,45],'ES-EL400').total.programmed,30);assert.equal(run(s,[45]).total.processed,0);});
test('same schedule/execution repeated and carry on another day never add windows',()=>{const e={id_programacion:'A',estado:'CORTE',cantidad_procesada:2};const s=snapshot({schedule:[row('A'),row('A'),row('A',{tipo:'ARRASTRE',cantidad_programada:10,fecha_programacion:'2026-10-27'})],executions:[e,e]});assert.equal(run(s).total.programmed,10);assert.equal(run(s).total.processed,2);});
test('contradictory duplicate execution and failed payload never become zeros',()=>{assert.throws(()=>run(snapshot({executions:[{id_programacion:'A',cantidad_procesada:1},{id_programacion:'A',cantidad_procesada:2}]})));assert.throws(()=>run(snapshot({executions:null})));});
test('whole moves and chains preserve original week, not destination calendar date',()=>{const s=snapshot({schedule:[row('A'),row('B',{semana_origen:45}),row('C',{semana_origen:46})],moves:[{id_origen:'A',id_destino:'B',produccion:'PANEL'},{id_origen:'B',id_destino:'C',produccion:'PANEL'}],executions:[{id_programacion:'C',estado:'PROCESADO'}]});assert.equal(run(s).total.programmed,10);assert.equal(run(s).total.processed,10);assert.equal(run(s,[46]).total.programmed,0);});
test('partial move accepts original or already-adjusted source, never subtracts twice',()=>{
 for(const quantity of [10,6]){const s=snapshot({schedule:[row('A',{produccion:null,cantidad_programada:quantity,prioridad_semanal:1}),row('B',{produccion:'B',cantidad_programada:4,semana_origen:45,prioridad_semanal:1})],moves:[{id_origen:'A',id_destino:'B',produccion:'B'}],links:[{id_linea:'PANELES_2',reserva:'R',produccion:'A',key_produccion:'KA',semana_produccion:44},{id_linea:'PANELES_2',reserva:'R',produccion:'B',key_produccion:'KB',semana_produccion:44}],coverage:[{reserva:'R',prioridad_semanal:1,produccion:'A',cantidad:6,estado_orden:'PROGRAMADA'},{reserva:'R',prioridad_semanal:1,produccion:'B',cantidad:4,estado_orden:'PROGRAMADA'}],orderExecutions:[{id_programacion:'A',produccion:'A',estado:'PROCESADO'}]});const r=run(s);assert.equal(r.excluded,0);assert.equal(r.total.programmed,10);assert.equal(r.total.processed,6);}
});
test('unknown origin or unverifiable partial source warns and excludes, never guesses',()=>{const r=run(snapshot({schedule:[row('A',{semana_origen:null})]}));assert.equal(r.complete,false);assert.equal(r.excluded,1);assert.match(r.warnings[0],/semana/);});
test('conflicting origin weeks for a shared reservation cannot be inferred from selected filter',()=>{const links=[44,45].map(w=>({id_linea:'PANELES_2',reserva:'R',produccion:'PANEL',semana_produccion:w}));assert.equal(run(snapshot({schedule:[row('A',{semana_origen:null})],links})).excluded,1);assert.equal(run(snapshot({schedule:[row('A',{semana_origen:null})],links:[links[0],{...links[1],semana_produccion:null}]})).excluded,1);});
test('explicit order PROCESADO credits only that canonical allocation; header state alone is not evidence',()=>{assert.equal(run(snapshot({orderExecutions:[{id_programacion:'A',produccion:'PANEL',estado:'PROCESADO'}]})).total.processed,10);assert.equal(run(snapshot({schedule:[row('A',{estado:'PROCESADO'})]})).total.processed,0);});
test('cancelled allocations excluded; same production in another system is distinct',()=>{const r=run(snapshot({schedule:[row('A',{estado:'CANCELADA'}),row('B',{sistema:'FRAME',cantidad_programada:6})]}));assert.equal(r.total.programmed,6);});
test('cycles, missing destinations and changed reservation/system fail reconciliation',()=>{for(const extra of [{schedule:[row('A')],moves:[{id_origen:'A',id_destino:'MISSING',produccion:'PANEL'}]},{schedule:[row('A'),row('B',{sistema:'FRAME'})],moves:[{id_origen:'A',id_destino:'B',produccion:'PANEL'}]},{schedule:[row('A'),row('B')],moves:[{id_origen:'A',id_destino:'B',produccion:'PANEL'},{id_origen:'B',id_destino:'A',produccion:'PANEL'}]}])assert.ok(run(snapshot(extra)).excluded>0);});

import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const readSource=app.slice(app.indexOf('async function readPhysicalRows('),app.indexOf('window.SGPWeeklyPhysicalProgress='));
const readRows=new Function(readSource+';return readPhysicalRows;')();
test('actual read bridge paginates 501 rows rather than silently truncating to first page',async()=>{
 const ranges=[];const client={from:()=>{let start,end;const q={select:()=>q,in:()=>q,order:()=>q,range:(a,b)=>{start=a;end=b;return q;},then:resolve=>{ranges.push([start,end]);return Promise.resolve({data:Array.from({length:start===0?500:1},(_,i)=>({id_programacion:'P',i:start+i}))}).then(resolve);}};return q;}};
 const result=await readRows(client,'sgp_mecanizado_ejecucion','id_programacion',['P'],['id_programacion']);assert.equal(result.length,501);assert.deepEqual(ranges,[[0,499],[500,999]]);
});
test('actual read bridge propagates permission failure instead of returning zero or partial results',async()=>{
 const client={from:()=>{const q={select:()=>q,in:()=>q,order:()=>q,range:()=>q,then:resolve=>Promise.resolve({error:new Error('denied')}).then(resolve)};return q;}};
 await assert.rejects(readRows(client,'sgp_mecanizado_ejecucion','id_programacion',['P'],['id_programacion']),/denied/);
});
test('actual physical bridge rejects missing session before any client request',async()=>{
 const window=new EventTarget();let queries=0;
 const source=app.slice(app.indexOf('// Issue103:'),app.indexOf('window.SGPWeeklyAnchor='));
 new Function('window','getAppToken','getMecanizadoReadClient','progSchedule','progMoves','progMovesError','physicalProgress',source)(window,()=>null,()=>{queries++;throw Error('must not query');},[],[],'',physicalProgress);
 await assert.rejects(window.SGPWeeklyPhysicalProgress({weeks:[44]}),/sesión/);assert.equal(queries,0);
});

test('a partial aggregate on a partly moved group cannot be allocated to remaining orders by assumption',()=>{
 const s=snapshot({schedule:[row('A',{produccion:null,cantidad_programada:10,prioridad_semanal:1}),row('B',{produccion:'B',cantidad_programada:4})],moves:[{id_origen:'A',id_destino:'B',produccion:'B'}],links:[{id_linea:'PANELES_2',reserva:'R',produccion:'A',key_produccion:'KA'},{id_linea:'PANELES_2',reserva:'R',produccion:'B',key_produccion:'KB'}],coverage:[{reserva:'R',prioridad_semanal:1,produccion:'A',cantidad:6,estado_orden:'PROGRAMADA'},{reserva:'R',prioridad_semanal:1,produccion:'B',cantidad:4,estado_orden:'PROGRAMADA'}],executions:[{id_programacion:'A',estado:'MECANIZADO',cantidad_procesada:3}]});
 const result=run(s);assert.equal(result.complete,false);assert.equal(result.excluded,1);assert.match(result.warnings.join(' '),/parcialmente trasladado/);
});

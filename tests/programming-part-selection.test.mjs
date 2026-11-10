import test from 'node:test';
import assert from 'node:assert/strict';
import {programmingPartState,programmingPartsPlan,programmingPlanSignature,validateProgrammingDestination} from '../src/domain/programming-part-selection.js';
import {saveProgrammingParts} from '../src/services/programming-part-selection.js';
const reserva='QA-MULTIPART';
function fixture(){
 const parts=[{prioridad:'14.1',cantidad:8,ordenes:[{key_produccion:'A|PANELES_2',produccion:'A',cantidad:3},{key_produccion:'B|PANELES_2',produccion:'B',cantidad:5}]},{prioridad:'14.2.1',cantidad:7,ordenes:[{key_produccion:'C|PANELES_2',produccion:'C',cantidad:7}]}];
 const coverage=parts.flatMap(p=>p.ordenes.map(o=>({...o,reserva,prioridad_semanal:p.prioridad,estado_orden:'PENDIENTE',cantidad_programada:0})));
 return {parts,coverage};
}
function harness({fresh,write,readError}={}){
 const f=fixture(),calls=[],writes=[];
 const client={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='sgp_mecanizado_disponibles')return {data:[{reserva,partes:(fresh||f).parts}],error:readError};
  if(name==='sgp_mecanizado_cobertura_ordenes')return {data:(fresh||f).coverage};
  writes.push(args);return write?write(args,writes.length):{data:'qa-id-'+writes.length};
 }};
 const plan=programmingPartsPlan(reserva,f.parts,['14.1','14.2.1'],f.coverage);
 const options={client,token:'SYNTHETIC',reserva,plan,date:'2026-11-11',shift:'TURNO 2',priority:4,observation:'General',orderObservation:'Lote',notes:{'A|PANELES_2':'Nota A','C|PANELES_2':'Nota C'}};
 return {f,calls,writes,options};
}
test('multiple weekly parts retain identity, quantities, and hierarchy',()=>{
 const f=fixture(),plan=programmingPartsPlan(reserva,f.parts,['14.1','14.2.1'],f.coverage);
 assert.deepEqual(plan.map(p=>[p.priority,p.quantity]),[['14.1',8],['14.2.1',7]]);
 assert.equal(new Set(plan.flatMap(p=>p.orders.map(o=>o.key))).size,3);
 assert.ok(programmingPlanSignature(plan));
});
test('part with completed orders schedules only remaining whole orders',()=>{
 const f=fixture();f.coverage[0].estado_orden='PROGRAMADA';f.coverage[0].cantidad_programada=3;
 const state=programmingPartState(reserva,f.parts[0],f.coverage);assert.equal(state.quantity,5);assert.deepEqual(state.orders.map(o=>o.production),['B']);
});
test('history, partial-quantity orders, cancelled partial mode and complete parts cannot batch',()=>{
 for(const change of [{estado_orden:'REVISAR'},{estado_orden:'PARCIAL',cantidad_programada:1},{origen_cobertura:'PARCIAL_AGREGADA'}]){
  const f=fixture();Object.assign(f.coverage[0],change);assert.equal(programmingPartState(reserva,f.parts[0],f.coverage).ready,false);
 }
 const f=fixture();f.coverage.forEach(c=>{c.estado_orden='PROGRAMADA';c.cantidad_programada=c.cantidad});assert.equal(programmingPartState(reserva,f.parts[0],f.coverage).ready,false);
});
test('missing, ambiguous or inconsistent coverage fails closed',()=>{
 for(const mutate of [f=>f.coverage.shift(),f=>f.coverage.push({...f.coverage[0]}),f=>f.coverage[0].cantidad=9,f=>f.coverage[0].cantidad_programada=-1,f=>f.coverage[0].estado_orden='UNKNOWN',f=>f.parts[0].cantidad=99,f=>f.parts[0].ordenes[0].key_produccion='']){
  const f=fixture();mutate(f);assert.equal(programmingPartState(reserva,f.parts[0],f.coverage).ready,false);
 }
});
test('empty, repeated, absent parts and cross-part repeated production are rejected',()=>{
 const f=fixture();for(const selected of [[],['14.1','14.1'],['missing']])assert.throws(()=>programmingPartsPlan(reserva,f.parts,selected,f.coverage));
 f.parts[1]={...f.parts[0],prioridad:'14.2.1'};f.coverage.push(...f.coverage.slice(0,2).map(c=>({...c,prioridad_semanal:'14.2.1'})));
 assert.throws(()=>programmingPartsPlan(reserva,f.parts,['14.1','14.2.1'],f.coverage),/varias partes/);
});
test('common destination accepts valid date/shift/integer priority only',()=>{
 const base={date:'2026-11-11',shift:'TURNO 1',priority:1};validateProgrammingDestination(base,2);
 for(const delta of [{date:'2026-02-30'},{date:''},{shift:'TURNO 3'},{priority:.1},{priority:0},{priority:2147483647}])assert.throws(()=>validateProgrammingDestination({...base,...delta},2));
});
test('fresh read precedes separate writes; notes and priorities are isolated by part',async()=>{
 const h=harness(),r=await saveProgrammingParts(h.options);
 assert.equal(r.completed.length,2);assert.equal(r.failed,null);
 assert.deepEqual(h.calls.map(c=>c.name),['sgp_mecanizado_disponibles','sgp_mecanizado_cobertura_ordenes','sgp_mecanizado_programar','sgp_mecanizado_disponibles','sgp_mecanizado_cobertura_ordenes','sgp_mecanizado_programar']);
 assert.deepEqual(h.writes.map(w=>[w.p_prioridad_semanal,w.p_cantidad,w.p_prioridad,w.p_produccion]),[['14.1',8,4,null],['14.2.1',7,5,null]]);
 assert.equal(h.writes[0].p_observacion_orden,'Lote | A: Nota A');assert.equal(h.writes[1].p_observacion_orden,'Lote | C: Nota C');
 assert.ok(h.writes.every(w=>w.p_reserva===reserva&&w.p_fecha==='2026-11-11'&&w.p_turno==='TURNO 2'));
});
test('changed quantity, composition, coverage or failed preflight writes nothing',async()=>{
 for(const mutate of [f=>f.parts[0].cantidad++,f=>f.parts[0].ordenes[0].produccion='Changed',f=>{f.coverage[0].estado_orden='PROGRAMADA';f.coverage[0].cantidad_programada=3;}]){
  const fresh=fixture();mutate(fresh);const h=harness({fresh});await assert.rejects(saveProgrammingParts(h.options));assert.equal(h.writes.length,0);
 }
 const h=harness({readError:{message:'Read failed'}});await assert.rejects(saveProgrammingParts(h.options),/saldo/);assert.equal(h.writes.length,0);
});
test('partial failure preserves confirmed records and never retries failed part',async()=>{
 const h=harness({write:(a,n)=>n===2?{error:{code:'P0001',message:'Saldo cambió'}}:{data:'confirmed'}}),r=await saveProgrammingParts(h.options);
 assert.equal(r.completed.length,1);assert.equal(r.failed,'14.2.1');assert.equal(r.uncertain,false);assert.equal(h.writes.length,2);
});
test('network and empty response report uncertain outcome, stop and never retry',async()=>{
 for(const write of [()=>{throw Error('Timeout')},()=>({error:{message:'Fetch failed'}}),()=>({data:null})]){
  const h=harness({write}),r=await saveProgrammingParts(h.options);assert.equal(r.uncertain,true);assert.equal(r.completed.length,0);assert.equal(h.writes.length,1);
 }
});
test('session change before or during batch stops further writes',async()=>{
 const h=harness();await assert.rejects(saveProgrammingParts({...h.options,isCurrent:()=>false}),/sesión/);assert.equal(h.calls.length,0);
 const j=harness();let n=0;const r=await saveProgrammingParts({...j.options,isCurrent:()=>++n<3});assert.equal(j.writes.length,1);assert.equal(r.failed,'14.2.1');assert.equal(r.completed.length,1);
});

test('hung read ends before writing; hung write is uncertain and a late success cannot resume batch',async()=>{
 const never=new Promise(()=>{}), h=harness();h.options.timeoutMs=10;h.options.client={rpc:()=>never};
 await assert.rejects(saveProgrammingParts(h.options),/espera agotado/);assert.equal(h.writes.length,0);
 let release;const j=harness({write:()=>new Promise(r=>release=r)});j.options.timeoutMs=10;
 const result=await saveProgrammingParts(j.options);assert.equal(result.uncertain,true);assert.equal(j.writes.length,1);
 release({data:'late-confirmed'});await new Promise(r=>setTimeout(r,20));assert.equal(j.writes.length,1);assert.equal(result.completed.length,0);
});

test('a same-quantity composition change during an earlier write stops subsequent parts',async()=>{
 const h=harness({write:(a,n)=>{h.f.parts[1].ordenes[0].produccion='REPLACED';return {data:'confirmed'};}});
 const r=await saveProgrammingParts(h.options);assert.equal(r.completed.length,1);assert.equal(r.failed,'14.2.1');assert.equal(r.uncertain,false);assert.equal(h.writes.length,1);assert.match(r.message,/composición/);
});

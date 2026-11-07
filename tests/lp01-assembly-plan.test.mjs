import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assemblyPlanSnapshot,assemblyPlanComparison} from '../src/domain/lp01-assembly-plan.js';
const context={stage:'ENSAMBLE',line:'PANELES_2',date:'2026-11-07',shift:1};
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const row=(n,qty=3,patch={})=>({line:'PANELES_2',excluded:false,assignment:{id:id(n),key_produccion:'QA|PANELES_2',fecha:context.date,turno:context.shift,cantidad:qty,estado:'PROGRAMADA',prioridad:50},...patch});
function fixture(){
 const original=[row(1)],current=[row(1),row(2,4),row(3,9,{excluded:true}),row(4,8)];current[3].assignment.estado='CANCELADA';
 return {contract:'LP-ENSAMBLE-PLAN-1',status:'ACCREDITED_CURRENT',source:'PROGRAMACION_LINEA',...context,generation:1,versionId:id(12),version:1,capturedAt:'2026-11-07T12:01:00+00:00',fingerprint:'b'.repeat(64),sourceRows:current,targets:[{key:'QA|PANELES_2',quantity:7,assignmentIds:[id(1),id(2)]}],baseline:{versionId:id(11),kind:'OBSERVED_AT_ENROLLMENT',capturedAt:'2026-11-07T12:00:00+00:00',sourceRows:original,historyBefore:'UNKNOWN'},historyComplete:false,historySinceEnrollment:'COMPLETE',changes:[
  {versionId:id(11),version:0,previousVersionId:null,operation:'OBSERVED_AT_ENROLLMENT',actor:null,motive:null,at:'2026-11-07T12:00:00+00:00',requestId:null,fingerprint:'a'.repeat(64)},
  {versionId:id(12),version:1,previousVersionId:id(11),operation:'INCORPORAR',actor:'qa-leader',motive:'QA motivo',at:'2026-11-07T12:01:00+00:00',requestId:id(20),fingerprint:'b'.repeat(64)}]};
}
const invalid=change=>{const f=fixture();change(f);assert.throws(()=>assemblyPlanSnapshot(f,context),/incompatible/);};
test('plan targets come from exact active assignments, never Disponible, SALE or excluded/cancelled rows',()=>{
 const f=fixture();f.sourceRows[0].assignment.sale=999;const p=assemblyPlanSnapshot(f,context);
 assert.equal(p.targets[0].quantity,7);assert.equal(p.historyComplete,false);assert.equal(p.baseline.historyBefore,'UNKNOWN');
 assert.equal(p.changes[1].motive,'QA motivo');f.changes[1].motive='  QA motivo original  ';assert.equal(assemblyPlanSnapshot(f,context).changes[1].motive,'  QA motivo original  ');p.targets[0].assignmentIds.push('local');assert.equal(f.targets[0].assignmentIds.length,2);
});
test('foreign scope, malformed provenance and invented history fail closed',()=>{
 for(const patch of [{stage:'EMPAQUE'},{line:'FRAMES_2'},{date:'2026-02-29'},{shift:'1'}])assert.throws(()=>assemblyPlanSnapshot(fixture(),{...context,...patch}),/Contexto/);
 for(const change of [s=>s.date='2026-11-08',s=>s.source='DISPONIBLE',s=>s.status='STALE',s=>s.historyComplete=true,s=>s.baseline.historyBefore='COMPLETE',s=>s.generation=-1,s=>s.version='1',s=>s.fingerprint='missing',s=>s.capturedAt='2026-11-07 12:01:00',s=>s.changes[0].actor='invented',s=>s.changes[1].actor=null,s=>s.changes[1].motive='',s=>s.changes[1].requestId=null,s=>s.changes[1].previousVersionId=id(99),s=>s.changes[1].fingerprint='c'.repeat(64),s=>s.changes.pop()])invalid(change);
});
test('target coverage, amounts, duplicates and exclusion cannot disagree with source',()=>{
 for(const change of [s=>s.targets[0].quantity=999,s=>s.targets[0].quantity='7',s=>s.targets=[],s=>s.targets.push(s.targets[0]),s=>s.targets[0].assignmentIds=[id(1),id(1)],s=>s.targets[0].assignmentIds=[id(1),id(3)],s=>s.sourceRows[0].excluded=true,s=>s.sourceRows[0].excluded='false',s=>s.sourceRows[0].assignment.cantidad=0,s=>s.sourceRows[0].assignment.cantidad=null,s=>s.sourceRows[0].assignment.turno=2,s=>s.sourceRows[0].assignment.key_produccion='QA|FRAMES_2',s=>s.sourceRows.push(s.sourceRows[0]),s=>s.sourceRows[0].assignment.cantidad=Number.MAX_SAFE_INTEGER])invalid(change);
});
test('baseline-only snapshot is honest about unknown earlier history and must match its current source',()=>{
 const f=fixture();f.version=0;f.versionId=f.baseline.versionId;f.capturedAt=f.baseline.capturedAt;f.fingerprint=f.changes[0].fingerprint;f.changes.length=1;f.sourceRows=structuredClone(f.baseline.sourceRows);f.targets=[{key:'QA|PANELES_2',quantity:3,assignmentIds:[id(1)]}];
 assert.equal(assemblyPlanSnapshot(f,context).version,0);
 f.baseline.sourceRows[0].assignment.cantidad=8;assert.throws(()=>assemblyPlanSnapshot(f,context),/incompatible/);
});
test('comparison preserves unknown actual, exact differences and explicit zero unplanned target',()=>{
 const c={contract:'LP-ENSAMBLE-PLAN-COMPARISON-1',planSnapshot:fixture(),planComparison:'ACCREDITED_CURRENT',comparisonComplete:true,rows:[
  {key:'QA|PANELES_2',plan:7,planStatus:'ACCREDITED_CURRENT',realized:5,difference:-2,pendingAgainstPlan:2},
  {key:'OTHER|PANELES_2',plan:0,planStatus:'ACCREDITED_CURRENT',realized:2,difference:2,pendingAgainstPlan:0}]};
 assert.equal(assemblyPlanComparison(c,context).comparisonComplete,true);
 c.comparisonComplete=false;Object.assign(c.rows[0],{realized:null,difference:null,pendingAgainstPlan:null});
 assert.equal(assemblyPlanComparison(c,context).rows[0].realized,null);
 for(const mutate of [x=>x.comparisonComplete=true,x=>x.rows.shift(),x=>x.rows[0].difference=0,x=>x.rows[1].plan=2,x=>x.rows.push(x.rows[0]),x=>x.rows[1].realized='2']){
  const bad=structuredClone(c);mutate(bad);assert.throws(()=>assemblyPlanComparison(bad,context),/incompatible/);
 }
});
test('recorded SQL-produced snapshots and comparison use the same reader without rerunning the database',()=>{
 const read=name=>JSON.parse(readFileSync(new URL('./lp01-ensamble-plan/'+name,import.meta.url),'utf8'));
 const snapshot=read('snapshot-sql.json'),comparison=read('comparison-sql.json');
 const scope={stage:snapshot.stage,line:snapshot.line,date:snapshot.date,shift:snapshot.shift};
 const plan=assemblyPlanSnapshot(snapshot,scope),result=assemblyPlanComparison(comparison,scope);
 assert.equal(plan.version,2);assert.equal(plan.targets[0].quantity,3);assert.equal(plan.historyComplete,false);
 assert.deepEqual(result.rows.map(r=>[r.plan,r.realized,r.difference]),[[3,4,1],[0,2,2]]);
});

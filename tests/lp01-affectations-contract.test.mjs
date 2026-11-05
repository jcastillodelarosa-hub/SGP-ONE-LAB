import test from 'node:test';import assert from 'node:assert/strict';
import {emptyAffectations,affectationCommand as run,readAffectations as read} from '../src/server/lp01-affectations-contract.js';
import {progressEvidence} from '../src/domain/lp01-progress-evidence.js';
const a={active:true,user:'leader',role:'LIDER',key:'P|PANELES_2',line:'PANELES_2',stages:['ENSAMBLE'],capabilities:['READ','REPORT','SOLVE','CONFIRM'],balance:20,date:'2026-11-05',shift:1,now:'2026-11-05T12:00:00Z'};
const empty=()=>emptyAffectations(a.key,a.line,'ENSAMBLE');
const cmd=(s,id,action,quantity,extra={})=>({id,action,quantity,revision:s.revision,observation:'motivo',...extra});
const create=s=>run(s,cmd(s,'r1','CREATE',5,{cause:'NC_AL'}),a);
test('individual identity survives turn change; solution alone never credits physical availability',()=>{
 let s=create(empty());const original=structuredClone(s);
 s=run(s,cmd(s,'s1','SOLVE',3,{reportId:'r1'}),{...a,date:'2026-11-06',shift:2});
 assert.equal(s.reports.length,1);assert.equal(s.reports[0].originDate,'2026-11-05');assert.equal(s.reports[0].id,'r1');assert.equal(s.reports[0].confirmed,0);assert.equal(read(s,a).available,null);assert.deepEqual(original,create(empty()));
 assert.throws(()=>run(s,cmd(s,'c1','CONFIRM',4,{reportId:'r1'}),a),/CONFIRMACION/);
 s=run(s,cmd(s,'c1','CONFIRM',2,{reportId:'r1'}),a);assert.equal(s.reports[0].confirmed,2);
 assert.throws(()=>run(s,cmd(s,'v1','VALIDATE',3),a),/NO_AUTORIZADO/);
 const co={...a,user:'co',role:'COORDINADOR',capabilities:['READ','VALIDATE']};
 s=run(s,cmd(s,'v1','VALIDATE',3),co);assert.equal(read(s,co).available,17);assert.equal(read(s,{...co,balance:19}).available,null);
 s=run(s,cmd(s,'s2','SOLVE',1,{reportId:'r1'}),a);assert.equal(read(s,co).available,null);
});
test('overlap requires coordinator union and never sums reports automatically',()=>{
 let s=create(empty());s=run(s,cmd(s,'r2','CREATE',4,{cause:'NC_V'}),a);
 const co={...a,role:'COORDINADOR',capabilities:['READ','VALIDATE']};
 assert.equal(read(s,a).available,null);assert.throws(()=>run(s,cmd(s,'v','VALIDATE',3),co),/CONSOLIDADO/);
 s=run(s,cmd(s,'v','VALIDATE',6),co);assert.equal(read(s,a).available,14);
});
test('idempotency, CAS, session revocation, scope and role are checked before retries',()=>{
 const s=empty(),c=cmd(s,'r1','CREATE',5,{cause:'NC_AL'}),next=run(s,c,a);
 assert.deepEqual(run(next,c,a),next);assert.throws(()=>run(next,{...c,quantity:4},a),/IDEMPOTENCIA/);
 assert.throws(()=>run(next,c,{...a,active:false}),/NO_AUTORIZADO/);
 assert.throws(()=>run(next,c,{...a,stages:['EMPAQUE']}),/NO_AUTORIZADO/);
 assert.throws(()=>run(next,{...c,id:'r2'},a),/REVISION/);
 assert.throws(()=>run(s,{...c,user:'forged'},a),/CAMPO/);
 assert.throws(()=>run(s,c,{...a,role:'CONSULTA'}),/NO_AUTORIZADO/);
 assert.throws(()=>read(next,{...a,key:'other'}),/NO_AUTORIZADO/);
 assert.throws(()=>read(next,{...a,role:'SUPERVISOR EMPAQUE'}),/NO_AUTORIZADO/);
});
test('correction preserves author/history and cannot erase confirmed quantities',()=>{
 let s=create(empty());s=run(s,cmd(s,'s','SOLVE',3,{reportId:'r1'}),a);
 assert.throws(()=>run(s,cmd(s,'x','CORRECT',2,{reportId:'r1'}),a),/CORRECCION/);
 s=run(s,cmd(s,'x','CORRECT',4,{reportId:'r1'}),{...a,user:'co',role:'COORDINADOR'});
 assert.equal(s.reports[0].createdBy,'leader');assert.equal(s.events.at(-1).user,'co');assert.equal(s.reports[0].quantity,4);
});
const e={id:'e1',key:a.key,line:a.line,stage:'ENSAMBLE',assignment:'part',date:a.date,shift:1,quantity:2,before:0,at:a.now};
test('opening requires accredited origin coverage in both stages; histories retain corrections',()=>{
 const scope={key:a.key,line:a.line,stage:'ENSAMBLE',events:[e]};
 assert.equal(progressEvidence(scope).opening,null);
 assert.equal(progressEvidence({...scope,coverage:'FROM_ORIGIN'}).opening.eventId,'e1');
 assert.equal(progressEvidence({...scope,coverage:'FROM_ORIGIN',events:[{...e,before:1}]}).opening,null);
 const correction={...e,id:'e2',quantity:0,before:2,at:'2026-11-05T13:00:00Z'};
 assert.equal(progressEvidence({...scope,coverage:'FROM_ORIGIN',events:[e,correction]}).opening.eventId,'e1');
 assert.equal(progressEvidence({...scope,stage:'EMPAQUE',coverage:'FROM_ORIGIN',events:[{...e,stage:'EMPAQUE'}]}).opening.eventId,'e1');
 assert.throws(()=>progressEvidence({...scope,events:[{...e,key:'other'}]}),/INVALIDA/);
});

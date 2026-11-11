import test from 'node:test';
import assert from 'node:assert/strict';
import {fileIdentity,serialQueue,validatePlans} from '../opt-digital/library.js';
const sample=()=>({plans:[{id:'p1',ref:'R1',barqty:1,cuts:[{length:'10"'}]}]});
test('file content identity ignores names and changes with bytes',async()=>{
 const first=new File(['first'],'same.json'),other=new File(['second'],'same.json');
 assert.notEqual(await fileIdentity(first),await fileIdentity(other));
 assert.equal(await fileIdentity(first),await fileIdentity(new File(['first'],'renamed.json')));
});
test('serialized imports isolate results and recover after an error',async()=>{
 const q=serialQueue(),events=[];let release;const gate=new Promise(r=>release=r);
 const a=q(async()=>{events.push('A start');await gate;events.push('A end');return 'A';});
 const b=q(()=>{events.push('B');throw Error('invalid file');});
 const failed=assert.rejects(b,/invalid file/);
 const c=q(()=>{events.push('C');return 'C';});
 await Promise.resolve();assert.deepEqual(events,['A start']);release();
 assert.equal(await a,'A');await failed;assert.equal(await c,'C');assert.deepEqual(events,['A start','A end','B','C']);
});
test('imported certification and executable fields are never trusted',()=>{
 const data=sample();Object.assign(data,{productionEnabled:true,verified:true});Object.assign(data.plans[0],{multiplicityVerified:true,html:'<img onerror=alert(1)>'});
 const clean=validatePlans(data);assert.equal(clean.productionEnabled,false);assert.equal(clean.verified,undefined);assert.equal(clean.plans[0].multiplicityVerified,undefined);assert.equal(clean.plans[0].html,undefined);
});
test('ambiguous plan identities and malformed quantities fail closed',()=>{
 const data=sample();data.plans.push({...data.plans[0]});assert.throws(()=>validatePlans(data),/duplicada/);
 data.plans.pop();data.plans[0].barqty=-1;assert.throws(()=>validatePlans(data),/Cantidad/);
 assert.throws(()=>validatePlans({plans:[{}]}),/inválido/);
});

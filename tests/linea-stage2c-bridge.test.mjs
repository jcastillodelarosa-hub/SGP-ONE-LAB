import test from 'node:test';import assert from 'node:assert/strict';
import {createLineaSourceBridge} from '../src/server/linea-source-bridge.js';
function fixture(status='SIN_CONCILIAR'){
 const calls=[];let released=false;
 const client={async query(sql,params=[]){calls.push({sql,params});if(sql.includes('preparar'))return {rows:[{data:{status,reason:'INCLUSION_NO_DEMOSTRADA'}}]};return {rows:[]};},release(){released=true;}};
 return {api:createLineaSourceBridge({connect:async()=>client}),calls,released:()=>released};
}
test('missing evidence commits only fail-closed invalidation, never native consumption',async()=>{
 const f=fixture();const r=await f.api.consume('session',{id:'a1234567-1234-1234-1234-123456789abc',production:'P'});
 assert.equal(r.status,'SIN_CONCILIAR');assert.equal(r.available,null);
 assert.ok(!f.calls.some(c=>c.sql.includes('sgp_linea_motor_b2')));
 assert.equal(f.calls.at(-1).sql,'COMMIT');assert.equal(f.released(),true);
});
test('UUID lock precedes preparation, session and production are bound',async()=>{
 const f=fixture();await f.api.consume("handle'",{id:'a1234567-1234-1234-1234-123456789abc',production:"P'"});
 assert.ok(f.calls.findIndex(c=>c.sql.includes('advisory'))<f.calls.findIndex(c=>c.sql.includes('preparar')));
 assert.deepEqual(f.calls.find(c=>c.sql.includes('preparar')).params,["handle'","P'",'EMPAQUE']);
});
test('assembly correction prepares ENSAMBLE scope, not implicit packing scope',async()=>{
 const f=fixture();await f.api.correctAssembly('handle',{id:'a1234567-1234-1234-1234-123456789abc',production:'P'});
 assert.equal(f.calls.find(c=>c.sql.includes('preparar')).params[2],'ENSAMBLE');
});
test('invalid UUID rejected without acquiring a database connection',async()=>{
 let connects=0;const api=createLineaSourceBridge({connect:()=>{connects++;throw Error('not expected');}});
 await assert.rejects(api.consume('session',{id:'bad',production:'P'}),/INVALID_REQUEST_ID/);assert.equal(connects,0);
});
test('database denial rolls back outer transaction and releases connection',async()=>{
 const calls=[];let released=false;
 const client={async query(sql){calls.push(sql);if(sql.includes('preparar'))throw Error('AUTH_DENIED');return {rows:[]};},release(){released=true;}};
 const api=createLineaSourceBridge({connect:async()=>client});
 await assert.rejects(api.resolve('denied','P'),/AUTH_DENIED/);
 assert.equal(calls.at(-1),'ROLLBACK');assert.equal(calls.includes('COMMIT'),false);assert.equal(released,true);
});

test('mixed-case UUID uses canonical lock/signature identity without mutating caller',async()=>{
 const f=fixture(),request={id:'A1234567-1234-1234-1234-123456789ABC',production:'P'};
 await f.api.consume('session',request);
 assert.equal(f.calls.find(c=>c.sql.includes('advisory')).params[0],request.id.toLowerCase());
 assert.equal(request.id,'A1234567-1234-1234-1234-123456789ABC');
});

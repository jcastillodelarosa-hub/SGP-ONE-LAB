import test from 'node:test';
import assert from 'node:assert/strict';
import {createLineaPostgresRepository} from '../src/server/linea-postgres-repository.js';
function fixture(fail=false){
 const calls=[];let released=false;
 const client={async query(sql,params=[]){calls.push({sql,params});if(sql.includes('contexto')){if(fail)throw Error('SESSION_DENIED');return {rows:[{data:{active:true}}]};}return {rows:[]};},release(){released=true;}};
 return {repo:createLineaPostgresRepository({connect:async()=>client}),calls,released:()=>released};
}
test('isolated adapter binds session and production, commits and releases',async()=>{
 const f=fixture();const result=await f.repo.transaction("production'input",async tx=>tx.session("handle'input"));
 assert.equal(result.active,true);
 assert.deepEqual(f.calls.find(c=>c.sql.includes('contexto')).params,["handle'input","production'input"]);
 assert.equal(f.calls.at(-1).sql,'COMMIT');assert.equal(f.released(),true);
});
test('denied session rolls back and releases without commit',async()=>{
 const f=fixture(true);await assert.rejects(f.repo.transaction('P',tx=>tx.session('denied')),/SESSION_DENIED/);
 assert.equal(f.calls.at(-1).sql,'ROLLBACK');assert.equal(f.released(),true);
 assert.equal(f.calls.some(c=>c.sql==='COMMIT'),false);
});
test('request UUID lock precedes request ledger and production lock',async()=>{
 const f=fixture();await f.repo.transaction('P',async tx=>{await tx.request('request');await tx.snapshot();});
 const queries=f.calls.map(c=>c.sql);
 assert.ok(queries.findIndex(x=>x.includes('pg_advisory_xact_lock'))<queries.findIndex(x=>x.includes('adaptador_solicitudes')));
 assert.ok(queries.findIndex(x=>x.includes('adaptador_solicitudes'))<queries.findIndex(x=>x.includes('FOR UPDATE')));
});
test('event identity mismatch aborts before native write',async()=>{
 const f=fixture();await assert.rejects(f.repo.transaction('P',tx=>tx.commit({expectedRevision:0,event:{production:'OTHER',id:'a'},request:{id:'a'}})),/IDENTITY_MISMATCH/);
 assert.equal(f.calls.some(c=>c.sql.includes('sgp_linea_motor_b2')),false);
 assert.equal(f.calls.at(-1).sql,'ROLLBACK');
});

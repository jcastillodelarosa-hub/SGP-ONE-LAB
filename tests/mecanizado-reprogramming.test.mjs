import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readReprogramming} from '../src/services/mecanizado-reprogramming.js';
test('reprogramming uses only authenticated RPC and preserves all four audited links',async()=>{
 const rows=Array.from({length:4},(_,i)=>({id_origen:'origin'+i,id_destino:'target'+i,produccion:'QA'+i}));let calls=0;
 const result=await readReprogramming({rpc:async(name,args)=>{assert.equal(name,'sgp_mecanizado_reprogramaciones_listar');assert.deepEqual(args,{p_token:'SYNTHETIC'});calls++;return {data:rows}},from:()=>{throw new Error('Direct table access prohibited')}},'SYNTHETIC');
 assert.equal(calls,1);assert.equal(result.error,null);assert.deepEqual(result.data,rows);
});
test('missing or denied RPC never falls back to table or an empty successful list',async()=>{
 for(const code of ['PGRST202','42501']){let calls=0;const error={code,message:'Denied fixture'};const result=await readReprogramming({rpc:async()=>{calls++;return {error}},from:()=>{throw new Error('must not access table')}},'QA');assert.equal(result.data,null);assert.equal(result.error,error);assert.equal(calls,1);}
});
test('absent session, malformed payload or missing destination fail closed',async()=>{
 let calls=0;const client={rpc:async()=>{calls++;return {data:[]}}};assert.ok((await readReprogramming(client,null)).error);assert.equal(calls,0);
 for(const data of [null,{},[null],[{id_origen:'a',id_destino:null}],[{id_origen:'',id_destino:'b'}]])assert.ok((await readReprogramming({rpc:async()=>({data})},'QA')).error);
 assert.deepEqual(await readReprogramming(client,'QA'),{data:[],error:null});
});
test('both production and programming consume RPC adapter without direct-table queries',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');assert.doesNotMatch(app,/\.from\(['"]sgp_mecanizado_reprogramaciones['"]\)/);assert.match(app,/readReprogramming\(c,token\)/);assert.match(app,/readReprogramming\(db,getAppToken\(\)\)/);
});

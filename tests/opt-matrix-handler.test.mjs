import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createOptMatrixHandler,MATRIX_IMAGE_LIMIT} from '../src/server/opt-matrix-handler.js';
const origin='https://example.test';
const bytes=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0]);
const hash=createHash('sha256').update(bytes).digest('hex');
const request=(body={p_token:'synthetic-session',sistema:'TEST-SYSTEM',referencia:'TEST-REF'},headers={},method='POST')=>new Request(origin,{method,headers:{origin,'content-type':'application/json',...headers},...(method==='POST'?{body:JSON.stringify(body)}:{})});
const asset=()=>({id:'00000000-0000-4000-8000-000000000001',revision:'A',page:1,sourceSha256:'a'.repeat(64),imageSha256:hash,mimeType:'image/png',byteLength:bytes.length,bucket:'opt-matrices-private',objectPath:`images/${hash}.png`,source_locator:'PRIVATE_SOURCE'});
const response=(status='available',matrix=asset())=>({data:{contract:'OPT-MATRIX-1',status,sistema:'TEST-SYSTEM',referencia:'TEST-REF',matrix}});
const handler=(result=response(),download=async()=>bytes)=>createOptMatrixHandler({allowedOrigins:[origin],rpc:async()=>result,download});
test('matrix exact authorized response projects only safe fields, PNG hash and bytes',async()=>{
 let called=[];const h=createOptMatrixHandler({allowedOrigins:[origin],rpc:async(name,args)=>{called.push([name,args]);return response();},download:async(bucket,path,max)=>{assert.equal(max,MATRIX_IMAGE_LIMIT);called.push([bucket,path]);return bytes;}});
 const r=await h(request());assert.equal(r.status,200);const body=await r.json();assert.equal(body.status,'available');assert.equal(Buffer.from(body.matrix.imageBase64,'base64').compare(bytes),0);assert.equal(body.matrix.sourceSha256,'a'.repeat(64));assert.equal(JSON.stringify(body).includes('PRIVATE_SOURCE'),false);assert.equal('objectPath' in body.matrix,false);assert.equal('bucket' in body.matrix,false);assert.equal(called[0][0],'sgp_opt_matriz_resolver_v1');assert.equal(r.headers.get('cache-control'),'no-store');
});
test('unavailable and ambiguous never fetch or leak candidate paths',async()=>{
 for(const status of ['unavailable','ambiguous']){const r=await handler(response(status,null),()=>assert.fail('download forbidden'))(request());assert.equal(r.status,200);assert.equal((await r.json()).matrix,null);}
});
test('origin, method, request fields and bounds fail before RPC',async()=>{
 const h=createOptMatrixHandler({allowedOrigins:[origin],rpc:()=>assert.fail('rpc forbidden'),download:()=>assert.fail('download forbidden')});
 assert.equal((await h(request(undefined,{origin:'https://bad.test'}))).status,403);
 assert.equal((await h(request(undefined,{},'GET'))).status,405);
 assert.equal((await h(request({p_token:'x',sistema:'TEST-SYSTEM',referencia:'TEST-REF',path:'evil'}))).status,422);
 assert.equal((await h(request({p_token:'x'.repeat(9000),sistema:'X',referencia:'Y'}))).status,413);
 assert.equal((await h(request({p_token:'',sistema:'X',referencia:'Y'}))).status,422);
 assert.equal((await h(request({p_token:'x',sistema:' X',referencia:'Y'}))).status,422);
});
test('SQL denials fail closed and do not download',async()=>{
 for(const [message,status] of [['OPT_NO_AUTORIZADO',403],['OPT_NO_HABILITADO',409],['MATRIX_NO_HABILITADO',409],['PRIVATE SQL ERROR',503]]){const r=await handler({error:{message}},()=>assert.fail('download forbidden'))(request());assert.equal(r.status,status);assert.equal((await r.text()).includes('PRIVATE SQL ERROR'),false);}
});
test('mismatched scope, path, MIME, size and ambiguous payload fail before download',async()=>{
 for(const mutate of [d=>d.sistema='OTHER',d=>d.matrix.objectPath='../../secret',d=>d.matrix.bucket='public',d=>d.matrix.mimeType='image/svg+xml',d=>d.matrix.byteLength=MATRIX_IMAGE_LIMIT+1,d=>d.status='ambiguous']){const r=response();mutate(r.data);assert.equal((await handler(r,()=>assert.fail('download forbidden'))(request())).status,503);}
});
test('corrupted or oversized image never leaves server',async()=>{
 for(const value of [new Uint8Array(30),new Uint8Array(MATRIX_IMAGE_LIMIT+1),Uint8Array.from([...bytes.slice(0,-1),1])]){assert.equal((await handler(response(),async()=>value)(request())).status,503);}
});

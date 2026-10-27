import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
import {createLineaPostgresRepository} from '../../src/server/linea-postgres-repository.js';
import {createPackingResolver} from '../../src/server/packing-resolver.js';
import {connectPsql} from './psql-client.mjs';
const db=(await readFile(new URL('./evidence/database.txt',import.meta.url),'utf8')).trim();assert.ok(/^sgp_linea_b2_qa_\d+$/.test(db));
const owner=connectPsql(db);const key='QA-NODE',cut=randomUUID();
try{
 await owner.query("INSERT INTO public.sgp_producciones VALUES($1)",[key]);
 await owner.query("INSERT INTO sgp_linea_b2.producciones(key,pdt_completo,pdt_prueba) VALUES($1,true,'{\"QA\":true}')",[key]);
 await owner.query("INSERT INTO sgp_linea_b2.cortes(id,key,id_carga_diaria,ensamblado,empacado,inclusion_completa,prueba) VALUES($1::uuid,$2,'QA-node-load',10,0,true,'{\"QA\":true}')",[cut,key]);
 await owner.query('UPDATE sgp_linea_b2.producciones SET corte=$1::uuid WHERE key=$2',[cut,key]);
 await owner.query("INSERT INTO sgp_linea_b2.permisos SELECT u,e,$1 FROM unnest(ARRAY['COORDINADOR','LIDER','CONSULTA']) u CROSS JOIN unnest(ARRAY['ENSAMBLE','EMPAQUE']) e",[key]);
 await owner.query('SELECT public.sgp_linea_motor_b2($1,$2::jsonb) AS data',['COORDINADOR',JSON.stringify({op:'SALE',key,stage:'EMPAQUE',date:'2026-10-27',shift:1,id:randomUUID(),revision:0,quantity:10,observation:'QA Node adapter'})]);
 const repository=createLineaPostgresRepository({connect:async()=>connectPsql(db)});const api=createPackingResolver(repository);
 const r=await api.resolve('LIDER',key);assert.equal(r.available,10);
 const request={id:randomUUID(),production:key,revision:r.revision,quantity:3,date:'2026-10-27',shift:1};
 const results=await Promise.all([api.consume('LIDER',request),api.consume('LIDER',request)]);
 assert.equal(results.filter(r=>r.duplicate).length,1);assert.equal((await api.resolve('LIDER',key)).available,7);
 await assert.rejects(()=>api.consume('CONSULTA',{...request,id:randomUUID(),revision:1}),/SCOPE_DENIED/);
 await assert.rejects(()=>api.consume('LIDER',{...request,id:randomUUID(),revision:1,quantity:99}),/INSUFFICIENT/);
 assert.equal((await api.resolve('LIDER',key)).available,7);
 const q=await owner.query("SELECT jsonb_build_object('events',count(*)) AS data FROM sgp_linea_b2.eventos WHERE key=$1",[key]);assert.equal(q.rows[0].data.events,1);
 const evidence={status:'PASS',database:db,real_persistent_pg_sessions:true,checks:['approved JS121 resolver reads real PG normalized snapshot through new repository','two concurrent adapter retries commit one real SQL event','functional CONSULTA role cannot consume','unsafe quantity rolls back without event','SQL and JS availability/revision checked after native cumulative RPC'],limitations:['Test driver only; production driver/pool not configured','Normalized source data and scope are synthetic; no Supabase installation']};
 await writeFile(new URL('./evidence/adapter.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
}finally{owner.release();}

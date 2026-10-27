import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
import {connectPsql} from '../linea-stage2b/psql-client.mjs';
import {createLineaSourceBridge} from '../../src/server/linea-source-bridge.js';
const root=new URL('./evidence/',import.meta.url),db=(await readFile(new URL('database.txt',root),'utf8')).trim();
assert.match(db,/^sgp_linea_b2_qa_\d+$/);
const owner=connectPsql(db);const key='C2-NODE-'+randomUUID();
try{
 await owner.query('INSERT INTO public.sgp_producciones VALUES($1)',[key]);
 await owner.query('INSERT INTO sgp_linea_b2.producciones(key) VALUES($1)',[key]);
 // Clone only SYNTHETIC QA templates; rewrite every production/source identity.
 const identity={production:key,line:'PANELES_2',part:'QA-PART-NODE',reserves:['QA-SHARED']};
 const base={production:key,revision:'1',generation:1,complete:true,identity,sourceRef:'QA/'+key};
 const sources={EXPORT:{...base,applied:true,historyId:'QA-NODE-HISTORY',loadId:'QA-NODE-LOAD',assembled:10,packed:0,events:[]},PDT:{...base,items:[]},PERMISOS:{...base,grants:['COORDINADOR','LIDER','CONSULTA'].flatMap(user=>['ENSAMBLE','EMPAQUE'].map(stage=>({user,stage,sourceRef:'QA-scope-node',sourceVersion:'1'})))}};
 for(const [component,data]of Object.entries(sources))await owner.query('INSERT INTO qa_c2.fuentes VALUES($1,$2,$3::jsonb)',[key,component,JSON.stringify(data)]);
 const api=createLineaSourceBridge({connect:async()=>connectPsql(db)});
 const start=await api.resolve('LIDER',key);assert.equal(start.available,10);
 await owner.query('SELECT public.sgp_linea_motor_b2($1,$2::jsonb) AS data',['COORDINADOR',JSON.stringify({op:'SALE',key,stage:'EMPAQUE',date:'2026-10-27',shift:1,id:randomUUID(),revision:0,quantity:10,observation:'QA C2 Node'})]);
 const request={production:key,id:randomUUID(),revision:start.revision,quantity:3,date:'2026-10-27',shift:1};
 const rs=await Promise.all([api.consume('LIDER',request),api.consume('LIDER',{...request,id:request.id.toUpperCase()})]);
 assert.equal(rs.filter(x=>x.duplicate).length,1);assert.equal((await api.resolve('LIDER',key)).available,7);
 // Reconciliation permission data always originates in the server reader.
 await assert.rejects(api.consume('CONSULTA',{...request,id:randomUUID()}),/SCOPE_DENIED/);
 await assert.rejects(api.consume('RECEPCION',{...request,id:randomUUID()}));
 await assert.rejects(api.consume('LIDER',{...request,id:randomUUID(),actor:{role:'ADMINISTRADOR'}}),/INVALID_REQUEST/);
 assert.equal((await api.resolve('LIDER',key)).available,7);
 // Missing event inclusion in a successive cut cannot be supplied by caller.
 sources.EXPORT={...sources.EXPORT,revision:'2',generation:2,historyId:'QA-NODE-H2',loadId:'QA-NODE-L2',packed:3};
 await owner.query('BEGIN');await owner.query('SELECT sgp_linea_c2.notificar($1,$2) AS data',[key,'EXPORT']);
 await owner.query('UPDATE qa_c2.fuentes SET data=$1::jsonb WHERE key=$2 AND component=$3',[JSON.stringify(sources.EXPORT),key,'EXPORT']);await owner.query('COMMIT');
 const blocked=await api.consume('LIDER',{...request,id:randomUUID(),revision:2});assert.equal(blocked.status,'SIN_CONCILIAR');assert.equal(blocked.available,null);
 const record=await owner.query("SELECT jsonb_build_object('events',(SELECT count(*) FROM sgp_linea_b2.eventos WHERE key=$1),'status',(SELECT status FROM sgp_linea_c2.estado WHERE key=$1)) AS data",[key]);
 assert.equal(record.rows[0].data.events,1);assert.equal(record.rows[0].data.status,'SIN_CONCILIAR');
 const output={status:'PASS',database:db,production:key,real_persistent_pg_sessions:true,checks:['C2 private reader preparation + approved JS121 resolver + SQL B2 share SAME outer PG transaction/savepoint','Two real concurrent mixed-case UUID C2 retries create exactly one packing event','CONSULTA/RECEPCION and caller actor flags cannot acquire operation permissions','Changed Export without explicit event inclusion commits SIN_CONCILIAR invalidation and no consumption'],limitations:['Sources and scopes are synthetic QA; production pool not configured','No productive reader, source writer coordination or PDT unit relation verified']};
 await writeFile(new URL('adapter.json',root),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output,null,2));
}finally{owner.release();}

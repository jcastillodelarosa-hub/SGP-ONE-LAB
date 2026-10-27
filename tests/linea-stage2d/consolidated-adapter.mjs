import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
import {connectPsql} from '../linea-stage2b/psql-client.mjs';
import {createConsolidatedPdtSource} from '../../src/server/consolidated-pdt-source.js';
import {createLineaSourceBridge} from '../../src/server/linea-source-bridge.js';
const E=new URL('./evidence/',import.meta.url),db=(await readFile(new URL('consolidated-database.txt',E),'utf8')).trim();assert.match(db,/^sgp_linea_d2q_qa_\d+$/);
const connect=async()=>connectPsql(db),source=createConsolidatedPdtSource({connect}),engine=createLineaSourceBridge({connect}),owner=await connect();
try{
 const h=(await owner.query("SELECT sgp_linea_d2q.fuente($1) AS data",['Q-NET'])).rows[0].data.hash;
 const v={id:randomUUID(),production:'Q-NET',stage:'ENSAMBLE',quantity:3,revision:1,sourceHash:h,date:'2026-11-01',shift:1,reason:'QA verified NET, same consolidated count'};
 assert.equal((await source.validate('QA-PICK',v)).revision,2);
 assert.equal((await source.validate('QA-PICK',v)).duplicate,true);
 await assert.rejects(source.validate('QA-RECEP',{...v,id:randomUUID(),revision:2}),/CONSOLIDATED_OPERATION_REJECTED/);
 const s=await engine.resolve('LIDER','Q-NET');assert.equal(s.available,12);assert.equal(s.eligibleUnitIds,null);assert.equal(s.deduction,0);
 await owner.query('SELECT public.sgp_linea_motor_b2($1,$2::jsonb) AS data',['COORDINADOR',JSON.stringify({op:'SALE',id:randomUUID(),key:'Q-NET',stage:'EMPAQUE',date:'2026-11-01',shift:1,revision:0,quantity:12,observation:'QA adapter'})]);
 const request={id:randomUUID(),production:'Q-NET',revision:s.revision,quantity:3,date:'2026-11-01',shift:1};
 const rs=await Promise.all([engine.consume('LIDER',request),engine.consume('LIDER',request)]);assert.equal(rs.filter(x=>x.duplicate).length,1);
 assert.equal((await engine.resolve('LIDER','Q-NET')).available,9);
 const blocked=await engine.resolve('LIDER','Q-CORR');assert.equal(blocked.available,null);
 const out={status:'PASS',database:db,checks:['Real captured authentication + synthetic leader grant validates global quantity; duplicate once; Reception denied','Approved C2/2A/B2 adapter resolves NET without unit IDs or double deduction','REAL PostgreSQL duplicate requests concurrently consume once,12 ->9','Stale Export source blocks increment/availability, no fabricated zero'],scope:'Real PG sessions with synthetic captures/roles, not production integration'};
 await writeFile(new URL('consolidated-adapter.json',E),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
}finally{owner.release();}

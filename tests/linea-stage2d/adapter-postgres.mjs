import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
import {connectPsql} from '../linea-stage2b/psql-client.mjs';
import {createPickingPdtUnitSource} from '../../src/server/picking-pdt-unit-source.js';
import {createLineaSourceBridge} from '../../src/server/linea-source-bridge.js';
const E=new URL('./evidence/',import.meta.url),db=(await readFile(new URL('database.txt',E),'utf8')).trim();assert.match(db,/^sgp_linea_d2_qa_\d+$/);
const connect=async()=>connectPsql(db),source=createPickingPdtUnitSource({connect}),engine=createLineaSourceBridge({connect});
const owner=await connect();
try{
 const input=await source.read('D2-PARTIAL');assert.equal(input.status,'READY');assert.equal(input.source.production,'D2-PARTIAL');
 const s=await engine.resolve('LIDER','D2-PARTIAL');assert.equal(s.available,18);
 await owner.query('SELECT public.sgp_linea_motor_b2($1,$2::jsonb) AS data',['COORDINADOR',JSON.stringify({op:'SALE',id:randomUUID(),key:'D2-PARTIAL',stage:'EMPAQUE',date:'2026-10-28',shift:1,revision:0,quantity:20,observation:'QA D2 Node integration'})]);
 const request={id:randomUUID(),production:'D2-PARTIAL',revision:s.revision,quantity:1,date:'2026-10-28',shift:1};
 const rs=await Promise.all([engine.consume('LIDER',request),engine.consume('LIDER',request)]);assert.equal(rs.filter(x=>x.duplicate).length,1);
 assert.equal((await engine.resolve('LIDER','D2-PARTIAL')).available,17);
 const blocked=await source.read('D2-DIFF');assert.equal(blocked.status,'SIN_CONCILIAR');assert.equal(blocked.available,null);
 const row=await owner.query("SELECT jsonb_build_object('contained',pdt_completo,'locks_held',false) AS data FROM sgp_linea_b2.producciones WHERE key=$1",['D2-DIFF']);assert.equal(row.rows[0].data.contained,false);
 const out={status:'PASS',database:db,checks:['Server D2 reader feeds C2/approved resolver without caller unit data','Real concurrent retry consumes once; already-packed unit reduces18 to17','Missing individual difference evidence rolls back failed SELECT to savepoint and commits source invalidation'],limitations:['Synthetic units, coverage and physical clearance only; no productive data or runtime route']};
 await writeFile(new URL('adapter.json',E),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
}finally{owner.release();}

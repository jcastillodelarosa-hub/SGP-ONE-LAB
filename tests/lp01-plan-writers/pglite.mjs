import {PGlite} from '@electric-sql/pglite';import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
const root=new URL('../../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8'),db=new PGlite({extensions:{pgcrypto}});await db.waitReady;
const sql=s=>db.exec(s),value=async s=>(await db.query(s)).rows[0]?.v,lit=s=>"'"+s.replaceAll("'","''")+"'";
const call=(id,q=4,token='coordinator')=>`SELECT public.sgp_linea_plan_programar('${token}','QA-A|PANELES_2','2026-11-12',1,${q},2,'Prioridad requerida','${id}') AS v`;
const reject=async(s,re)=>{let e;try{await sql(s)}catch(x){e=x}assert(e);assert.match(e.message,re);await sql('ROLLBACK;RESET ROLE;');};
try{
 await sql(await read('tests/lp01-incorporar/concurrency/fixture.sql'));await sql('ALTER TABLE public.sgp_producciones ADD COLUMN excluida_export boolean NOT NULL DEFAULT false');
 const old=await value("SELECT jsonb_agg(jsonb_build_object('oid',oid,'body',prosrc,'acl',proacl::text)) AS v FROM pg_proc WHERE oid IN('public.sgp_linea_plan_programar(text,text,date,integer,integer,integer)'::regprocedure,'public.sgp_linea_plan_mover(text,uuid,date,integer,integer,integer)'::regprocedure)");
 await sql(await read('docs/sql-proposals/lp01-ensamble-plan/01_plan_REVIEW.sql'));await sql(await read('docs/sql-proposals/lp01-plan-writers/01_facades_REVIEW.sql'));
 assert.equal(await value('SELECT enabled AS v FROM sgp_lp_operacion.plan_control'),false);
 await reject('SET ROLE anon;'+call(randomUUID()),/PLAN_DISABLED/);
 await sql('UPDATE sgp_lp_operacion.plan_control SET enabled=true');
 const id=randomUUID();await sql('BEGIN;SET ROLE anon;');const first=await value(call(id));await sql('COMMIT;RESET ROLE;');
 await sql('SET ROLE anon;');assert.deepEqual(await value(call(id)),first);await sql('RESET ROLE');
 await reject('SET ROLE anon;'+call(id,3),/PLAN_REQUEST_REUSED/);
 await reject('SET ROLE anon;'+call(randomUUID(),1,'unknown'),/PERMISO_DENEGADO/);
 const mid=randomUUID();await sql('BEGIN;SET ROLE authenticated;');const moved=await value(`SELECT public.sgp_linea_plan_mover('coordinator','${first.result.assignmentId}','2026-11-12',2,1,3,'Cambio acordado','${mid}') AS v`);await sql('COMMIT;RESET ROLE;');assert.equal(moved.planVersions.length,2);
 const snap=await value("SELECT sgp_lp_operacion.plan_snapshot('2026-11-12',2) AS v");assert.equal(snap.targets[0].quantity,1);assert.equal(snap.baseline.historyBefore,'UNKNOWN');assert.equal(snap.changes.at(-1).motive,'Cambio acordado');
 assert.equal(await value("SELECT bool_or(has_function_privilege('anon',oid,'EXECUTE')) AS v FROM pg_proc WHERE pronamespace='sgp_lp_operacion'::regnamespace AND proname LIKE 'plan_%'"),false);
 const after=await value("SELECT jsonb_agg(jsonb_build_object('oid',oid,'body',prosrc,'acl',proacl::text)) AS v FROM pg_proc WHERE oid IN('public.sgp_linea_plan_programar(text,text,date,integer,integer,integer)'::regprocedure,'public.sgp_linea_plan_mover(text,uuid,date,integer,integer,integer)'::regprocedure)");assert.deepEqual(old,after);
 console.log('PASS: public8arg program/move, anon/auth COMMIT, replay/conflict/role, private ACL, old6 unchanged, actual snapshot and no invented history');
}finally{await db.close();}

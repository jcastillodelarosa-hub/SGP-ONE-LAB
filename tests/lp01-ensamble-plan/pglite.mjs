import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
const ROOT=new URL('../../',import.meta.url),read=p=>readFile(new URL(p,ROOT),'utf8');
const db=new PGlite({extensions:{pgcrypto}});await db.waitReady;
const sql=q=>db.exec(q),value=async q=>(await db.query(q)).rows[0]?.v;
const lit=x=>"'"+String(x).replaceAll("'","''")+"'",j=x=>lit(JSON.stringify(x))+'::jsonb';
const checks=[];
async function rejects(q,re){let error;try{await sql(q)}catch(e){error=e}assert(error,'Expected SQL rejection');assert.match(error.message,re);await sql('ROLLBACK;RESET ROLE;');}
const snap=(d='2026-11-12',t=1)=>value(`SELECT sgp_lp_operacion.plan_snapshot(${lit(d)},${t}) AS v`);
const schedule=(rid=randomUUID(),quantity=4,reason='Prioridad acordada',token='coordinator',date='2026-11-12',shift=1)=>`SELECT sgp_lp_operacion.plan_programar(${lit(token)},'QA-A|PANELES_2',${lit(date)},${shift},${quantity},2,${lit(reason)},${lit(rid)}) AS v`;
const versions=()=>value('SELECT count(*)::int AS v FROM sgp_lp_operacion.plan_versiones');
const metadata=()=>value(`SELECT jsonb_agg(jsonb_build_object('oid',oid,'src',prosrc,'owner',proowner,'acl',proacl::text,'config',proconfig,'definer',prosecdef) ORDER BY oid) AS v FROM pg_proc WHERE oid IN('public.sgp_linea_plan_programar(text,text,date,integer,integer,integer)'::regprocedure,'public.sgp_linea_plan_mover(text,uuid,date,integer,integer,integer)'::regprocedure,'public.sgp_lp_operacion_comando(text,jsonb)'::regprocedure)`);
try{
 const fixture=await read('tests/lp01-incorporar/concurrency/fixture.sql'),pins=JSON.parse(await read('tests/lp01-incorporar/concurrency/fixture-manifest.json'));
 assert.equal(createHash('sha256').update(fixture).digest('hex'),pins.fixture_sha256);
 await sql(fixture);const beforeMeta=await metadata();
 const install=await read('docs/sql-proposals/lp01-ensamble-plan/01_plan_REVIEW.sql');
 await rejects(install,/PLAN_EXPORT_APPROVAL_REQUIRED/);
 await sql('ALTER TABLE public.sgp_producciones ADD COLUMN excluida_export boolean NOT NULL DEFAULT false');
 await rejects(install.replace('COMMIT;','SELECT 1/0;COMMIT;'),/division by zero/);
 assert.equal(await value("SELECT to_regclass('sgp_lp_operacion.plan_control')::text AS v"),null);
 await sql(install);assert.deepEqual(await metadata(),beforeMeta);
 assert.equal(await value('SELECT enabled AS v FROM sgp_lp_operacion.plan_control'),false);
 await sql("SET ROLE anon;SELECT public.sgp_linea_plan_programar('coordinator','QA-B|PANELES_2','2026-11-10',1,1,2);RESET ROLE;");
 assert.equal(await versions(),0);assert.equal(await value('SELECT count(*)::int AS v FROM sgp_lp_operacion.plan_mutaciones'),0);
 await rejects("SELECT sgp_lp_operacion.plan_snapshot('2026-11-10',1)",/PLAN_DISABLED/);
 checks.push('Transactional installer requires v406 exclusion column; native source/body/OID/owner/ACL unchanged; false gate leaves the real legacy planner working without new inputs or history claims');
 for(const role of ['anon','authenticated','service_role']){
  await rejects(`SET ROLE ${role};SELECT sgp_lp_operacion.plan_programar('coordinator','QA-A|PANELES_2','2026-11-12',1,1,1,'Forged',${lit(randomUUID())});`,/permission denied/);
  assert.equal(await value(`SELECT bool_or(has_function_privilege(${lit(role)},p.oid,'EXECUTE')) AS v FROM pg_proc p WHERE p.pronamespace='sgp_lp_operacion'::regnamespace AND p.proname LIKE 'plan_%'`),false);
 }
 checks.push('All new helpers and journal tables stay private; no endpoint, technical grant, credential or new role; supplied actor/GUC cannot reach a writer');
 await sql('UPDATE sgp_lp_operacion.plan_control SET enabled=true');
 await rejects(schedule(randomUUID(),1,' ','coordinator'),/PLAN_CHANGE_INVALID/);
 await rejects(schedule(randomUUID(),1,'Reason','leader'),/PERMISO_DENEGADO/);
 await rejects(schedule(randomUUID(),1,'Reason','unknown'),/PERMISO_DENEGADO/);
 const request=randomUUID(),first=await value(schedule(request));assert.deepEqual(await value(schedule(request)),first);
 await rejects(schedule(request,3),/PLAN_REQUEST_REUSED/);
 const assignment=first.result.assignmentId;let current=await snap();
 assert.equal(current.contract,'LP-ENSAMBLE-PLAN-1');assert.equal(current.targets[0].quantity,4);assert.equal(current.version,1);assert.equal(current.changes[1].actor,'coordinator');assert.equal(current.changes[1].motive,'Prioridad acordada');
 assert.equal(current.baseline.kind,'OBSERVED_AT_ENROLLMENT');assert.equal(current.baseline.historyBefore,'UNKNOWN');assert.equal(current.historyComplete,false);assert.equal(current.historySinceEnrollment,'COMPLETE');assert.equal(current.changes[0].actor,null);assert.equal(current.changes[0].motive,null);assert.deepEqual(current.baseline.sourceRows,[]);
 const firstStored=await value(`SELECT to_jsonb(v) AS v FROM sgp_lp_operacion.plan_versiones v WHERE id=${lit(current.versionId)}`);
 checks.push('Real authenticated planner mutation atomically records observed baseline and current target, server actor/reason/time, request replay and unchanged native metadata; no invented prior history or SALE');
 const moveId=randomUUID(),move=`SELECT sgp_lp_operacion.plan_mover('coordinator',${lit(assignment)},'2026-11-12',2,1,3,'Cambio de prioridad',${lit(moveId)}) AS v`;
 const moved=await value(move);assert.deepEqual(await value(move),moved);
 const from=await snap(),to=await snap('2026-11-12',2);
 assert.equal(from.targets[0].quantity,3);assert.equal(to.targets[0].quantity,1);assert.equal(from.version,2);assert.equal(to.version,1);assert.equal(to.sourceRows[0].assignment.origen_id,assignment);
 assert.deepEqual(await value(`SELECT to_jsonb(v) AS v FROM sgp_lp_operacion.plan_versiones v WHERE id=${lit(firstStored.id)}`),firstStored);
 assert.equal(await value('SELECT count(*)::int AS v FROM sgp_lp_operacion.plan_contexto'),0);
 checks.push('Captured native move/split versions both periods, preserves origin IDs and all earlier snapshots; current targets follow quantities per turn rather than SALE');
 await rejects(`UPDATE sgp_lp_operacion.plan_versiones SET motivo='rewrite' WHERE id=${lit(firstStored.id)}`,/PLAN_IMMUTABLE_HISTORY/);
 await sql('BEGIN;');const count=await versions();await value(schedule(randomUUID(),1));await sql('ROLLBACK;');assert.equal(await versions(),count);
 await rejects(`BEGIN;SELECT sgp_lp_operacion.plan_iniciar_cambio('coordinator','INCORPORAR','Real reason',${lit(randomUUID())},'[{"date":"2026-11-12","shift":1}]','{}');COMMIT;`,/PLAN_UNFINISHED_CHANGE/);
 checks.push('Versions/events/receipts are immutable; rollback removes mutation+versions together; unfinished trusted contexts cannot commit');
 // Actual legacy RPC outside instrumented routes, then restore the same source values.
 await sql(`SET ROLE anon;SELECT public.sgp_linea_plan_mover('coordinator',${lit(assignment)},'2026-11-12',1,3,9);SELECT public.sgp_linea_plan_mover('coordinator',${lit(assignment)},'2026-11-12',1,3,2);RESET ROLE;`);
 await rejects("SELECT sgp_lp_operacion.plan_snapshot('2026-11-12',1)",/PLAN_UNTRACKED_CHANGE/);
 assert.equal(await value("SELECT count(*)::int AS v FROM sgp_lp_operacion.plan_mutaciones WHERE NOT acreditada AND source='ASSIGNMENTS'"),2);
 // Cancel through an uninstrumented source also invalidates an existing head, not an invented cancellation authorization.
 await sql(`UPDATE public.sgp_linea_plan_asignaciones SET estado='CANCELADA' WHERE id=${lit(moved.result.assignmentId)}`);
 await rejects("SELECT sgp_lp_operacion.plan_snapshot('2026-11-12',2)",/PLAN_UNTRACKED_CHANGE/);
 checks.push('Out-of-route real planner changes and uninstrumented cancellation are retained as unattributed evidence and invalidate close, including a change followed by undo');
 // Re-enrollment on a new generation explicitly admits no history before this fresh observation.
 await sql('UPDATE sgp_lp_operacion.plan_control SET enabled=false;UPDATE sgp_lp_operacion.plan_control SET enabled=true;');
 await rejects("SELECT sgp_lp_operacion.plan_snapshot('2026-11-12',1)",/PLAN_ENROLLMENT_REQUIRED/);
 await sql(`BEGIN;SELECT sgp_lp_operacion.plan_iniciar_cambio('coordinator','ACREDITAR_BASE','Acreditación desde este instante',${lit(randomUUID())},'[{"date":"2026-11-12","shift":1}]','{}');SELECT sgp_lp_operacion.plan_finalizar_cambio('{}');COMMIT;`);
 current=await snap();assert.equal(current.version,0);assert.equal(current.baseline.sourceRows.length,1);assert.equal(current.targets[0].quantity,3);assert.equal(current.historyComplete,false);
 await sql("UPDATE public.sgp_producciones SET presente_ultimo_export=false WHERE key_produccion='QA-A|PANELES_2'");assert.equal((await snap()).targets[0].quantity,3);
 await sql("UPDATE public.sgp_producciones SET excluida_export=true WHERE key_produccion='QA-A|PANELES_2'");
 await rejects("SELECT sgp_lp_operacion.plan_snapshot('2026-11-12',1)",/PLAN_UNTRACKED_CHANGE/);
 await sql('UPDATE sgp_lp_operacion.plan_control SET enabled=false;UPDATE sgp_lp_operacion.plan_control SET enabled=true;');
 await sql(`BEGIN;SELECT sgp_lp_operacion.plan_iniciar_cambio('coordinator','ACREDITAR_BASE','Observar exclusión aprobada',${lit(randomUUID())},'[{"date":"2026-11-12","shift":1}]','{}');SELECT sgp_lp_operacion.plan_finalizar_cambio('{}');COMMIT;`);
 const excluded=await snap();assert.deepEqual(excluded.targets,[]);assert.equal(excluded.sourceRows.length,1);assert.equal(excluded.sourceRows[0].excluded,true);assert.deepEqual(await value(`SELECT to_jsonb(v) AS v FROM sgp_lp_operacion.plan_versiones v WHERE id=${lit(firstStored.id)}`),firstStored);
 await rejects(schedule(randomUUID(),1),/PLAN_PRODUCTION_UNAVAILABLE/);
 checks.push('Approval exclusion changes invalidate current source but never erase history; fresh observed baseline filters excluded targets, not absence from Export; every disable/re-enable requires a new generation');
 // Fingerprint is re-read, not just trusted because a latest version exists.
 await sql(`ALTER TABLE public.sgp_linea_plan_asignaciones DISABLE TRIGGER lp_plan_observar;UPDATE public.sgp_linea_plan_asignaciones SET prioridad=7 WHERE id=${lit(assignment)};ALTER TABLE public.sgp_linea_plan_asignaciones ENABLE TRIGGER lp_plan_observar;`);
 await rejects("SELECT sgp_lp_operacion.plan_snapshot('2026-11-12',1)",/PLAN_SOURCE_CHANGED/);
 assert.deepEqual(await metadata(),beforeMeta);
 checks.push('Close helper rereads canonical source under SHARE NOWAIT locks and detects stale fingerprint independently of dirty tracking; command/import/close bodies unchanged');
 const report={status:'PASS',groups:checks.length,results:checks,engine:await value('SELECT version() AS v'),limits:['Synthetic PGlite single connection only; no PostgreSQL17 multi-session proof or production SQL.','Private helpers only. No public RPC, frontend, import/close integration, grant or activation.','Baseline history before enrollment is explicitly UNKNOWN; original historical plan is not reconstructed.']};
 await writeFile(new URL('tests/lp01-ensamble-plan/results.json',ROOT),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(error){console.error(error.message,error.where??'',error.stack?.split('\n').filter(x=>x.includes('lp01-ensamble-plan')).join('\n'));process.exitCode=1;}finally{await db.close()}

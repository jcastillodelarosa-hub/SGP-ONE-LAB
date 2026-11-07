import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {bootstrap} from './bootstrap.mjs';
import {parsePowerBI,bytesBase64} from '../../src/domain/powerbi/adapter.js';
import {closureExportRealizedV2} from '../../src/domain/lp01-closure-export-v2.js';
import {assemblyPlanSnapshot} from '../../src/domain/lp01-assembly-plan.js';
import {xlsx,id} from '../lp01-cierre-export-v2/fixture.mjs';
const ROOT=new URL('../../',import.meta.url),read=p=>readFile(new URL(p,ROOT),'utf8'),lit=v=>"'"+String(v).replaceAll("'","''")+"'",j=v=>lit(JSON.stringify(v))+'::jsonb';
const D='docs/sql-proposals/lp01-export-plan-v4/',ctx={stage:'ENSAMBLE',line:'PANELES_2',date:'2026-11-07',shift:1};
const db=await bootstrap(),sql=q=>db.exec(q),value=async q=>(await db.query(q)).rows[0]?.v,checks=[];let seq=3000;
const revision=()=>value("SELECT revision AS v FROM sgp_lp_operacion.turnos WHERE etapa='ENSAMBLE' AND linea='PANELES_2' AND fecha='2026-11-07' AND turno=1");
const metadata=()=>value("SELECT jsonb_agg(jsonb_build_object('oid',oid,'owner',proowner,'acl',proacl::text,'config',proconfig,'definer',prosecdef) ORDER BY oid) AS v FROM pg_proc WHERE oid IN('public.sgp_lp_operacion_comando(text,jsonb)'::regprocedure,'public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb)'::regprocedure,'public.sgp_lp_operacion_consultar(text,text,text,date,integer)'::regprocedure,'public.sgp_lp_operacion_resultado(text,uuid)'::regprocedure)");
const hash=()=>value("SELECT md5(prosrc) AS v FROM pg_proc WHERE oid='public.sgp_lp_operacion_comando(text,jsonb)'::regprocedure");
const state=()=>value("SELECT jsonb_build_object('turns',(SELECT jsonb_agg(to_jsonb(t) ORDER BY etapa,fecha,turno) FROM sgp_lp_operacion.turnos t),'audit',(SELECT count(*) FROM sgp_lp_operacion.auditoria),'files',(SELECT count(*) FROM sgp_lp_operacion.archivos),'closes',(SELECT jsonb_agg(to_jsonb(c) ORDER BY version) FROM sgp_lp_operacion.cierres c),'planVersions',(SELECT count(*) FROM sgp_lp_operacion.plan_versiones),'planReceipts',(SELECT count(*) FROM sgp_lp_operacion.plan_recibos)) AS v");
const business=()=>value("SELECT jsonb_build_object('productions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p),'orders',(SELECT jsonb_agg(to_jsonb(o) ORDER BY key,parte) FROM sgp_lp_operacion.ordenes o),'assignments',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.sgp_linea_plan_asignaciones a),'budgets',(SELECT jsonb_agg(to_jsonb(b) ORDER BY key,etapa) FROM sgp_lp_operacion.presupuestos b)) AS v");
async function call(cmd,token='leader'){await sql('SET ROLE anon');let cause;try{return await value(`SELECT public.sgp_lp_operacion_comando(${lit(token)},${j(cmd)}) AS v`)}catch(error){cause=error;throw error}finally{try{await sql('RESET ROLE')}catch(error){if(!cause)throw error}}}
async function reject(fn,re){const before=await state();let e;try{await fn()}catch(error){e=error}assert(e,'Expected rejection');assert.match(e.message,re);await sql('ROLLBACK;RESET ROLE;');assert.deepEqual(await state(),before)}
async function upload(records=[['PLAN',7],['OPEN',5]],token='leader'){
 const bytes=xlsx(records),parsed=await parsePowerBI(bytes,{DOMParser}),context={...ctx,id:id(seq++),revision:await revision(),authority:'EXPORT_PRODUCTION_V2'};
 await sql('SET ROLE service_role');let cause;try{return await value(`SELECT public.sgp_lp_operacion_importar_xlsx(${lit(token)},${j(context)},'Export.xlsx',${lit(bytesBase64(bytes))},${j(parsed)}) AS v`)}catch(error){cause=error;throw error}finally{try{await sql('RESET ROLE')}catch(error){if(!cause)throw error}}
}
async function closing(batch,extra={}){return {op:'CERRAR',id:id(seq++),...ctx,revision:await revision(),close_authority:'EXPORT_PRODUCTION_V2',close_contract:'LP-EXPORT-CLOSE-4',import_id:batch.importId,file_id:batch.fileId,observation:'Cierre sintético con plan vigente',reasons:{'PLAN|PANELES_2':'Pendiente de programación','OTHER|PANELES_2':'No informado en el filtro'},...extra}}
async function consult(){return value("SELECT public.sgp_lp_operacion_consultar('leader','ENSAMBLE','PANELES_2','2026-11-07',1) AS v")}
async function enroll(){await sql(`BEGIN;SELECT sgp_lp_operacion.plan_iniciar_cambio('coordinator','ACREDITAR_BASE','Observación sintética del plan actual',${lit(id(seq++))},'[{"date":"2026-11-07","shift":1}]','{}');SELECT sgp_lp_operacion.plan_finalizar_cambio('{}');COMMIT;`)}
async function reopen(){return call({op:'REABRIR',id:id(seq++),...ctx,revision:await revision(),observation:'Corrección acreditada'},'coordinator')}
try{
 const manifest=JSON.parse(await read(D+'manifest.json')),meta=await metadata(),readerHash=await value("SELECT md5(prosrc) AS v FROM pg_proc WHERE oid='public.sgp_lp_operacion_consultar(text,text,text,date,integer)'::regprocedure");
 const installI=await read(D+'01_import_plan_REVIEW.sql'),installC=await read(D+'02_close_v4_REVIEW.sql'),restoreC=await read(D+'03_restore_close_without_history_REVIEW.sql'),restoreI=await read(D+'04_restore_import_without_history_REVIEW.sql');
 assert.equal(await hash(),manifest.functions.command.post_incorporar);
 await reject(()=>sql(installI.replace('COMMIT;','SELECT 1/0;COMMIT;')),/division by zero/);assert.equal(await hash(),manifest.functions.command.post_incorporar);
 await sql(installI);assert.equal(await hash(),manifest.functions.command.post_import);assert.deepEqual(await metadata(),meta);
 await sql('BEGIN;');await sql(restoreI.replace('BEGIN;','').replace(/COMMIT;\s*$/,''));assert.equal(await hash(),manifest.functions.command.post_incorporar);await sql('ROLLBACK');
 await sql(installC);assert.equal(await hash(),manifest.functions.command.post_close);assert.deepEqual(await metadata(),meta);
 await sql('BEGIN;');await sql(restoreC.replace('BEGIN;','').replace(/COMMIT;\s*$/,''));assert.equal(await hash(),manifest.functions.command.post_import);await sql('ROLLBACK');
 assert.equal(await value('SELECT export_production_v2 OR export_close_v4 AS v FROM sgp_lp_operacion.config WHERE id'),false);assert.equal(await value('SELECT enabled AS v FROM sgp_lp_operacion.plan_control'),false);
 checks.push('Exact post-v406 chain installs transactionally over ee5acef with independent false gates, unchanged ACL/metadata, narrowed V4 history visibility and exact no-history inverses; old proposal files remain unchanged');
 await sql('UPDATE sgp_lp_operacion.config SET export_production_v2=true WHERE id');let batch=await upload();
 await reject(async()=>call(await closing(batch)),/CIERRE_NO_HABILITADO/);
 await sql('UPDATE sgp_lp_operacion.config SET export_close_v4=true WHERE id');
 await reject(async()=>call(await closing(batch,{close_contract:undefined})),/CLOSE_CONTRACT_REQUIRED/);
 await reject(async()=>call(await closing(batch,{close_contract:'LP-EXPORT-CLOSE-3'})),/CLOSE_CONTRACT_REQUIRED/);
 await reject(async()=>call(await closing(batch)),/PLAN_DISABLED/);
 await sql('UPDATE sgp_lp_operacion.plan_control SET enabled=true');await reject(async()=>call(await closing(batch)),/PLAN_ENROLLMENT_REQUIRED/);await enroll();
 await reject(async()=>call(await closing(batch,{reasons:{}})),/DIFERENCIA_O_PENDIENTE_SIN_JUSTIFICAR/);
 checks.push('V4 must be selected explicitly and have an accredited enabled plan; V3 selector/unknown baseline cannot silently become plan authority; existing pending reason remains required');
 // Synthetic INCORPORAR activation only. The new installed plan hook versions its real server actor/motive.
 await sql('UPDATE sgp_lp_operacion.config SET incorporar_ensamble=true WHERE id');
 await sql("UPDATE public.sgp_producciones SET excluida_export=true WHERE key_produccion='OTHER|PANELES_2'");
 const incorporation={op:'INCORPORAR',id:id(seq++),...ctx,key:'OTHER|PANELES_2',quantity:2,revision:await revision(),observation:'Cambio aprobado de programación'};
 await reject(()=>call(incorporation),/PRODUCCION_NO_DISPONIBLE/);
 await sql("UPDATE public.sgp_producciones SET excluida_export=false WHERE key_produccion='OTHER|PANELES_2'");
 const added=await call(incorporation);assert.equal(added.quantity,2);assert.equal(added.planVersions.length,1);assert.equal((await call(incorporation)).duplicate,true);
 const plan=await value("SELECT sgp_lp_operacion.plan_snapshot('2026-11-07',1) AS v");assert.equal(plan.version,1);assert.equal(plan.changes[1].actor,'leader');assert.equal(plan.changes[1].motive,incorporation.observation);assert.equal(plan.targets.find(r=>r.key==='OTHER|PANELES_2').quantity,2);
 await reject(async()=>call(await closing(batch)),/IMPORTACION_VIGENTE|UNIVERSO_CAMBIO/);batch=await upload();
 checks.push('Actual post-Export INCORPORAR rejects excluded production, captures before/after plan under existing locks with authenticated actor/motive, replays once and invalidates the older import');
 // Real deferred revocation guard must still roll back close+revision+receipt with the new snapshot.
 await sql("CREATE FUNCTION public.qa_revoke_close_v4() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario=NEW.usuario);RETURN NEW;END $$;CREATE TRIGGER qa_revoke_close_v4 BEFORE INSERT ON sgp_lp_operacion.auditoria FOR EACH ROW WHEN(NEW.operacion='CERRAR') EXECUTE FUNCTION public.qa_revoke_close_v4();");
 await reject(async()=>call(await closing(batch)),/AMBITO|ETAPA/);await sql('DROP TRIGGER qa_revoke_close_v4 ON sgp_lp_operacion.auditoria;DROP FUNCTION public.qa_revoke_close_v4()');
 // Revoke a key found only in cancelled baseline/source metadata at final audit.
 await sql("CREATE FUNCTION public.qa_revoke_plan_key() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN UPDATE public.sgp_producciones SET id_linea='FRAMES_2' WHERE key_produccion='MISSING|PANELES_2';RETURN NEW;END $$;CREATE TRIGGER qa_revoke_plan_key BEFORE INSERT ON sgp_lp_operacion.auditoria FOR EACH ROW WHEN(NEW.operacion='CERRAR') EXECUTE FUNCTION public.qa_revoke_plan_key();");
 const beforePlanRevocation=await business();await reject(async()=>call(await closing(batch)),/PLAN_HISTORY_OUTSIDE_SCOPE/);assert.deepEqual(await business(),beforePlanRevocation);
 await sql('DROP TRIGGER qa_revoke_plan_key ON sgp_lp_operacion.auditoria;DROP FUNCTION public.qa_revoke_plan_key()');
 const before=await business(),cmd=await closing(batch),first=await call(cmd),rows=new Map(first.rows.map(r=>[r.key,r]));
 assert.equal(first.contract,'LP-EXPORT-CLOSE-4');assert.equal(first.planComparison,'ACCREDITED_CURRENT');assert.equal(first.comparisonComplete,false);
 assert.equal(rows.get('PLAN|PANELES_2').plan,10);assert.equal(rows.get('PLAN|PANELES_2').realized,7);assert.equal(rows.get('PLAN|PANELES_2').difference,-3);assert.equal(rows.get('PLAN|PANELES_2').pendingAgainstPlan,3);
 assert.equal(rows.get('OTHER|PANELES_2').plan,2);assert.equal(rows.get('OTHER|PANELES_2').realized,null);assert.equal(rows.get('OTHER|PANELES_2').pendingAgainstPlan,null);
 assert.equal(first.planSnapshot.versionId,plan.versionId);assert.equal(assemblyPlanSnapshot(first.planSnapshot,ctx).status,'VALIDATED_SNAPSHOT');assert.equal(first.planSnapshot.historyComplete,false);
 assert.deepEqual(first.initialReference,{status:'EXPORT_CUT_REFERENCE_REQUIRED',cut:null,includedClosureVersions:null});assert.equal(first.canContinue,false);assert.equal(first.operationalReady,false);
 for(const row of first.rows){assert.equal(row.budget.available,null);assert.equal(row.continuity.quantity,null);assert.equal(row.continuity.allocation,'NONE')}
 assert.deepEqual(await business(),before);assert.equal((await call(cmd)).duplicate,true);
 const readback=await consult();assert.equal(closureExportRealizedV2(readback,ctx).status,'INCOMPATIBLE_CLOSE');assert.equal(readback.closeAuthority,undefined);
 await writeFile(new URL('tests/lp01-export-plan-v4/sql-readback.json',ROOT),JSON.stringify({provenance:'SYNTHETIC_SQL_V4_NOT_PRODUCTION',context:ctx,readback},null,2)+'\n');
 checks.push('CERRAR4 persists immutable current plan plus actual Export comparison, not SALE/manual999; missing actual stays null; commit revocation rolls back; strict V3 rejects V4; initial cut/budget/carry remain specifically blocked');
 // Revoke only a cancelled baseline key, not any key in the close's active rows.
 await sql("BEGIN;UPDATE public.sgp_producciones SET id_linea='FRAMES_2' WHERE key_produccion='MISSING|PANELES_2'");
 const redacted=await consult();assert(!redacted.reports.some(r=>r.id===first.id));assert(!redacted.history.some(a=>a.id===first.id));await sql('ROLLBACK');
 for(const mode of ['receipt','replay']){
  await sql("BEGIN;UPDATE public.sgp_producciones SET id_linea='FRAMES_2' WHERE key_produccion='MISSING|PANELES_2'");
  let error;try{if(mode==='replay')await call(cmd);else await value(`SELECT public.sgp_lp_operacion_resultado('leader',${lit(first.id)}) AS v`)}catch(e){error=e}assert.match(error?.message??'',/PLAN_HISTORY_OUTSIDE_SCOPE/);await sql('ROLLBACK;RESET ROLE');
 }
 checks.push('V4 scope covers active rows plus cancelled/excluded baseline/source keys: final-audit revocation rolls back, and subsequent revocation hides report/history and denies receipt/replay without changing V3 rules');
 await reopen();const partial=await upload([['OPEN',2]],'coordinator');
 const corrected=await call(await closing(partial,{reasons:{'PLAN|PANELES_2':'Conservada del archivo anterior','OPEN|PANELES_2':'Pendiente del objetivo vigente','OTHER|PANELES_2':'Sigue ausente'}}),'coordinator');
 assert.equal(corrected.rows.find(r=>r.key==='PLAN|PANELES_2').realized,7);assert.equal(corrected.rows.find(r=>r.key==='PLAN|PANELES_2').valueStatus,'PRESERVED');assert.equal(corrected.rows.find(r=>r.key==='OPEN|PANELES_2').realized,2);assert.deepEqual(await value(`SELECT snapshot AS v FROM sgp_lp_operacion.cierres WHERE id=${lit(first.id)}`),first);
 checks.push('Partial reimport after a V4 close accepts its explicit history, replaces only PRESENT, preserves prior original-file provenance and plan snapshot without rewriting any earlier close');
 await reopen();await sql("UPDATE public.sgp_producciones SET excluida_export=true WHERE key_produccion='OPEN|PANELES_2'");
 await reject(()=>upload([['OPEN',1]],'coordinator'),/PRODUCTION_EXCLUDED/);
 batch=await upload([['PLAN',10],['OTHER',2]],'coordinator');assert.deepEqual(batch.rows.map(r=>r.key),['OTHER|PANELES_2','PLAN|PANELES_2']);
 await reject(async()=>call(await closing(batch,{reasons:{}}),'coordinator'),/PLAN_UNTRACKED_CHANGE/);
 // Explicit fixture-only re-enrollment, not a production reset/correction endpoint.
 await sql('UPDATE sgp_lp_operacion.plan_control SET enabled=false;UPDATE sgp_lp_operacion.plan_control SET enabled=true');await enroll();
 const excludedClose=await call(await closing(batch,{reasons:{}}),'coordinator');assert.equal(excludedClose.comparisonComplete,true);assert.equal(excludedClose.rows.length,2);assert(!excludedClose.planSnapshot.targets.some(r=>r.key==='OPEN|PANELES_2'));assert(excludedClose.planSnapshot.sourceRows.some(r=>r.assignment.key_produccion==='OPEN|PANELES_2'&&r.excluded===true));
 assert.deepEqual(await value(`SELECT snapshot AS v FROM sgp_lp_operacion.cierres WHERE id=${lit(first.id)}`),first);
 checks.push('Approved exclusions are refused as file rows and removed from active import/close/plan together; dirty history blocks stale comparison; explicit fresh baseline keeps old excluded snapshots intact');
 await reopen();await sql('BEGIN');
 await value(`SELECT sgp_lp_operacion.plan_programar('coordinator','MISSING|PANELES_2','2026-11-07',1,1,8,'Objetivo sin materializar',${lit(id(seq++))}) AS v`);
 let e;try{await upload([['PLAN',10]],'coordinator')}catch(error){e=error}assert.match(e?.message??'',/INCORPORACION_EXPLICITA_REQUERIDA/);await sql('ROLLBACK;RESET ROLE;');
 await sql('UPDATE sgp_lp_operacion.config SET export_production_v2=false,export_close_v4=false,incorporar_ensamble=false WHERE id;UPDATE sgp_lp_operacion.plan_control SET enabled=false');
 await reject(()=>sql(restoreC),/HISTORY_REQUIRES_FORWARD_RECOVERY/);
 await reject(()=>call({op:'ABRIR',id:id(seq++),...ctx,shift:2,revision:0,observation:'No inferir carry'},'coordinator'),/RECONCILIATION_REQUIRED/);
 assert.equal(await value("SELECT md5(prosrc) AS v FROM pg_proc WHERE oid='public.sgp_lp_operacion_consultar(text,text,text,date,integer)'::regprocedure"),manifest.functions.consultar.after);assert.notEqual(readerHash,manifest.functions.consultar.after);assert.deepEqual(await metadata(),meta);
 checks.push('Unmaterialized active targets fail explicitly instead of disappearing; history prevents unsafe rollback and legacy carry interpretation even after containment; v406 active orders/catalog filters and all existing ACLs remain exact; V4 history reads are narrowed');
 const report={status:'PASS',groups:checks.length,results:checks,functions:manifest.functions,limits:['Synthetic single-connection PostgreSQL18/PGlite, not PostgreSQL17 concurrency or production.','No remote SQL, activation, new grants, endpoint, UI or strict V4 runtime reader.','Unknown first Export cut keeps budget/continuity/operationalReady blocked. New-turn scheduling is a separate authorized integration, not implicit close/carry.']};
 await writeFile(new URL('tests/lp01-export-plan-v4/results.json',ROOT),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(error){console.error(error.message,error.where??'',error.stack?.split('\n').filter(x=>x.includes('lp01-export-plan-v4')).join('\n'));process.exitCode=1}finally{await db.close()}

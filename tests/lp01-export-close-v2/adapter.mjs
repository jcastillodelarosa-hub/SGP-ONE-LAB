import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {bootstrap} from '../lp01-export-import-v2/bootstrap.mjs';
import {parsePowerBI,bytesBase64} from '../../src/domain/powerbi/adapter.js';
import {closureExportRealized} from '../../src/domain/lp01-closure-export.js';
import {xlsx,id} from '../lp01-cierre-export-v2/fixture.mjs';
const ROOT=new URL('../../',import.meta.url),read=p=>readFile(new URL(p,ROOT),'utf8'),lit=v=>"'"+String(v).replaceAll("'","''")+"'";
const db=await bootstrap(),sql=q=>db.exec(q),value=async q=>(await db.query(q)).rows[0]?.v,checks=[];
const identity='public.sgp_lp_operacion_comando(text,jsonb)',hash=()=>value(`SELECT md5(prosrc) AS v FROM pg_proc WHERE oid=${lit(identity)}::regprocedure`);
const metadata=()=>value(`SELECT jsonb_build_object('owner',proowner,'acl',proacl::text,'config',proconfig,'definer',prosecdef) AS v FROM pg_proc WHERE oid=${lit(identity)}::regprocedure`);
const state=()=>value(`SELECT jsonb_build_object('turn',(SELECT jsonb_agg(to_jsonb(t) ORDER BY etapa,fecha,turno) FROM sgp_lp_operacion.turnos t),'files',(SELECT count(*) FROM sgp_lp_operacion.archivos),'audit',(SELECT count(*) FROM sgp_lp_operacion.auditoria),'closes',(SELECT jsonb_agg(to_jsonb(c) ORDER BY version) FROM sgp_lp_operacion.cierres c)) AS v`);
const sources=()=>value(`SELECT jsonb_build_object('orders',(SELECT jsonb_agg(to_jsonb(t) ORDER BY key,parte) FROM sgp_lp_operacion.ordenes t),'plans',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.sgp_linea_plan_asignaciones t),'productions',(SELECT jsonb_agg(to_jsonb(t) ORDER BY key_produccion) FROM public.sgp_producciones t),'budgets',(SELECT jsonb_agg(to_jsonb(t) ORDER BY key,etapa) FROM sgp_lp_operacion.presupuestos t)) AS v`);
const ctx={stage:'ENSAMBLE',line:'PANELES_2',date:'2026-11-07',shift:1};let sequence=600;
const revision=()=>value("SELECT revision AS v FROM sgp_lp_operacion.turnos WHERE etapa='ENSAMBLE' AND linea='PANELES_2' AND fecha='2026-11-07' AND turno=1");
async function call(command,token='leader'){await sql('SET ROLE anon;');try{return await value(`SELECT public.sgp_lp_operacion_comando(${lit(token)},${lit(JSON.stringify(command))}::jsonb) AS v`);}finally{await sql('RESET ROLE;');}}
async function command(extra={}){return {op:'CERRAR',id:id(sequence++),...ctx,revision:await revision(),observation:'Synthetic close test',...extra};}
async function upload(records=[['PLAN',7]],token='leader'){
 const bytes=xlsx(records),parsed=await parsePowerBI(bytes,{DOMParser}),context={...ctx,id:id(sequence++),revision:await revision(),authority:'EXPORT_PRODUCTION_V2'};
 await sql('SET ROLE service_role;');try{return await value(`SELECT public.sgp_lp_operacion_importar_xlsx(${lit(token)},${lit(JSON.stringify(context))}::jsonb,'Export.xlsx',${lit(bytesBase64(bytes))},${lit(JSON.stringify(parsed))}::jsonb) AS v`);}finally{await sql('RESET ROLE;');}
}
async function closing(batch,extra={}){return command({close_authority:'EXPORT_PRODUCTION_V2',import_id:batch.importId,file_id:batch.fileId,reasons:{'PLAN|PANELES_2':'Bajo plan','OPEN|PANELES_2':'No incluido en el filtro'},...extra});}
async function rejected(cmd,pattern,token='leader'){const before=await state();let e;try{await call(cmd,token);}catch(x){e=x;}assert(e,'Expected reject');assert.match(e.message,pattern);await sql('ROLLBACK;RESET ROLE;');assert.deepEqual(await state(),before);}
async function rejectSQL(q,pattern){let e;try{await sql(q);}catch(x){e=x;}assert(e);assert.match(e.message,pattern);await sql('ROLLBACK;RESET ROLE;');}
try{
 await sql(await read('docs/sql-proposals/lp01-export-import-v2/01_import_adapter_REVIEW.sql'));
 // Null is historical source data, not a label to fill from a future catalog.
 await sql("UPDATE public.sgp_producciones SET sistema=NULL WHERE key_produccion='OPEN|PANELES_2';");
 const before=await sources(),meta=await metadata(),install=await read('docs/sql-proposals/lp01-export-close-v2/01_close_adapter_REVIEW.sql'),restore=await read('docs/sql-proposals/lp01-export-close-v2/02_restore_without_closures_REVIEW.sql'),manifest=JSON.parse(await read('docs/sql-proposals/lp01-export-close-v2/manifest.json'));
 const pin=manifest.functions[identity];assert.equal(await hash(),pin.before_source_md5);
 await rejectSQL(install.replace('COMMIT;','SELECT 1/0;COMMIT;'),/division by zero/);assert.equal(await value("SELECT count(*)::int AS v FROM information_schema.columns WHERE table_schema='sgp_lp_operacion' AND table_name='config' AND column_name='export_close_v2'"),0);
 await sql(install);assert.equal(await hash(),pin.candidate_source_md5);assert.deepEqual(await metadata(),meta);assert.equal(await value('SELECT export_close_v2 AS v FROM sgp_lp_operacion.config WHERE id'),false);
 await rejectSQL(install,/ALREADY_INSTALLED/);
 // Exact inverse succeeds only before V2 close history; roll back this test transaction.
 await sql('BEGIN;');await sql(restore.replace('BEGIN;','').replace(/COMMIT;\s*$/,''));assert.equal(await hash(),pin.before_source_md5);await sql('ROLLBACK;');assert.equal(await hash(),pin.candidate_source_md5);
 await rejected(await command({close_authority:'EXPORT_PRODUCTION_V2',import_id:id(1),file_id:id(1),reasons:{}}),/CIERRE_NO_HABILITADO/);
 await sql('UPDATE sgp_lp_operacion.config SET export_production_v2=true WHERE id;');
 const importOnly=await upload();await rejected(await closing(importOnly),/CIERRE_NO_HABILITADO/);
 // Only this isolated fixture enables the provisional writer to test persistence.
 await sql('UPDATE sgp_lp_operacion.config SET export_close_v2=true WHERE id;');
 checks.push('Command patch preserves source/ACL/metadata; independent default-false close gate stays closed when import alone is enabled; atomic install/exact empty-history rollback pass');
 let batch=await upload();await rejected(await closing(batch,{reasons:{}}),/AUSENCIA_SIN_MOTIVO/);
 await rejected(await closing(batch,{revision:0}),/CONFLICTO_REVISION/);
 await rejected(await closing(batch,{turn_revision:(await revision())+1}),/CONFLICTO_REVISION_TURNO/);
 for(const turn_revision of [null,'1',1.5,-1,9007199254740992])await rejected(await closing(batch,{turn_revision}),/REVISION_TURNO_INVALIDA/);
 await rejected(await closing(batch,{stage:'EMPAQUE'}),/PILOTO|AMBITO|ETAPA/,'empaque');
 await rejected(await closing(batch,{reasons:{'PLAN|PANELES_2':'x'}}),/AUSENCIA_SIN_MOTIVO/);
 await rejected(await closing(batch,{quantity:999}),/CAMPOS_NO_PERMITIDOS/);
 await rejected(await command({file_id:batch.fileId,reasons:{}}),/AUTORIDAD_REQUERIDA/);
 await rejected(await closing(batch,{import_id:id(999)}),/IMPORTACION_VIGENTE/);
 await rejected(await closing(batch,{reasons:{'PLAN|PANELES_2':'x','OPEN|PANELES_2':'x','OTHER|PANELES_2':'x'}}),/MOTIVOS_INVALIDOS/);
 await sql("UPDATE sgp_lp_operacion.ordenes SET sale=7 WHERE parte='00000000-0000-0000-0000-000000000001';");await rejected(await closing(batch),/UNIVERSO_CAMBIO/);await sql("UPDATE sgp_lp_operacion.ordenes SET sale=6 WHERE parte='00000000-0000-0000-0000-000000000001';");
 // Force a final scope revocation: real deferred trigger must roll back close+audit+turn.
 await sql("CREATE FUNCTION public.qa_revoke_close() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario=NEW.usuario);RETURN NEW;END $$;CREATE TRIGGER qa_revoke_close BEFORE INSERT ON sgp_lp_operacion.auditoria FOR EACH ROW WHEN(NEW.operacion='CERRAR') EXECUTE FUNCTION public.qa_revoke_close();");
 await rejected(await closing(batch),/AMBITO|ETAPA/);await sql('DROP TRIGGER qa_revoke_close ON sgp_lp_operacion.auditoria;DROP FUNCTION public.qa_revoke_close();');
 await sql("UPDATE sgp_lp_operacion.ordenes SET sale=NULL WHERE parte='00000000-0000-0000-0000-000000000001';");batch=await upload();await sql("UPDATE sgp_lp_operacion.ordenes SET sale=6 WHERE parte='00000000-0000-0000-0000-000000000001';");batch=await upload();
 const cmd=await closing(batch,{turn_revision:await revision()}),first=await call(cmd);assert.equal(first.contract,'LP-EXPORT-CLOSE-3');assert.equal(first.authority,'EXPORT_PRODUCTION_V2');assert.equal(first.canContinue,false);
 const rows=new Map(first.rows.map(r=>[r.key,r])),plan=rows.get('PLAN|PANELES_2'),absent=rows.get('OPEN|PANELES_2');
 assert.equal(plan.realized,7);assert.equal(plan.plan,null);assert.equal(plan.planStatus,'PLAN_SOURCE_REQUIRED');assert.equal(plan.difference,null);assert.equal(plan.pendingAgainstPlan,null);assert.equal(plan.scheduledReference.quantity,null);assert.equal(plan.scheduledReference.authority,'HISTORICAL_REFERENCE_ONLY');assert.equal(first.comparisonComplete,false);assert.equal(plan.assignmentRefs.length,2);assert.equal(plan.manualHistory.assignments[0].ejecutado,999);assert.equal(plan.ejecutado,undefined);
 assert.equal(absent.realized,null);assert.equal(absent.pendingAgainstPlan,null);assert.equal(absent.preserve,true);
 for(const row of first.rows){assert.deepEqual(row.budget,{status:'RECONCILIATION_REQUIRED',available:null});assert.deepEqual(row.continuity,{status:'RECONCILIATION_REQUIRED',quantity:null,allocation:'NONE'});}
 assert.deepEqual(await sources(),before);assert.equal((await call(cmd)).duplicate,true);assert.equal(await value('SELECT count(*)::int AS v FROM sgp_lp_operacion.cierres'),1);
 await rejected({...cmd,reasons:{'PLAN|PANELES_2':'changed','OPEN|PANELES_2':'changed'}},/IDEMPOTENCIA_REUTILIZADA/);
 checks.push('CERRAR persists production-level Export and absence reasons; approved plan rule awaits complete technical version history, no SALE sum or required per-UUID manual validation; prior snapshots and sources stay unchanged');
 const readback=await value("SELECT public.sgp_lp_operacion_consultar('leader','ENSAMBLE','PANELES_2','2026-11-07',1) AS v");assert.equal(readback.closeAuthority,undefined);assert.equal(readback.turn.estado,'CERRADO');assert.equal(readback.turn.revision,first.version);assert.equal(readback.reports[0].snapshot.authority,'EXPORT_PRODUCTION_V2');assert.equal(closureExportRealized(readback,ctx).status,'INCOMPATIBLE_CLOSE');assert(first.rows.every(r=>r.power_bi===undefined));
 // Identity comes from the source at close time, for PRESENT and ABSENT alike.
 assert.deepEqual(plan.identity,{key:'PLAN|PANELES_2',line:'PANELES_2',production:'PLAN',system:'QA SYSTEM'});
 assert.deepEqual(absent.identity,{key:'OPEN|PANELES_2',line:'PANELES_2',production:'OPEN',system:null});
 // A later catalog rename/reclassification cannot rewrite the immutable snapshot.
 await sql('BEGIN;');
 await sql("UPDATE public.sgp_producciones SET produccion='RENAMED LATER',sistema='OTHER SYSTEM' WHERE key_produccion='PLAN|PANELES_2';UPDATE public.sgp_producciones SET sistema='FILLED LATER' WHERE key_produccion='OPEN|PANELES_2';");
 assert.equal(await value("SELECT produccion AS v FROM public.sgp_producciones WHERE key_produccion='PLAN|PANELES_2'"),'RENAMED LATER');
 const historical=await value("SELECT public.sgp_lp_operacion_consultar('leader','ENSAMBLE','PANELES_2','2026-11-07',1) AS v");
 assert.deepEqual(historical.reports[0].snapshot,first);
 assert.deepEqual(await value(`SELECT snapshot AS v FROM sgp_lp_operacion.cierres WHERE id=${lit(first.id)}`),first);
 await sql('ROLLBACK;');
 checks.push('Snapshot persists source identity per production, including null system; later catalog name/system changes leave historical reads unchanged; optional transport turn_revision must be a matching safe JSON integer');
 // Technical version fence prevents legacy materialization before turn insertion.
 await rejected(await command({op:'ABRIR',id:id(920),date:'2026-11-07',shift:2,revision:0,observation:'Try legacy carry'}),/RECONCILIATION_REQUIRED/,'coordinator');
 assert.equal(await value("SELECT count(*)::int AS v FROM sgp_lp_operacion.turnos WHERE fecha='2026-11-07' AND turno=2"),0);
 await rejected(await command({op:'REABRIR',observation:'Correction'}),/REQUIERE_COORDINADOR|ETAPA/);
 await call(await command({op:'REABRIR',observation:'Correction'}),'coordinator');
 await rejected(await closing(batch),/CORRECCION_REQUIERE_COORDINADOR/);
 await rejected(await closing(batch),/IMPORTACION_VIGENTE/,'coordinator');
 for(const op of ['SALE','EJECUTAR','LIBERAR'])await rejected(await command({op,key:'PLAN|PANELES_2',part:id(1),revision:0,turn_revision:await revision(),quantity:1,observation:'Forbidden legacy budget',release_id:id(42)}),/RECONCILIATION_REQUIRED/,'coordinator');
 await sql("UPDATE sgp_lp_operacion.ordenes SET sale=NULL WHERE parte='00000000-0000-0000-0000-000000000001';");const beforeUnknownPlan=await sources();batch=await upload([['PLAN',0],['OPEN',5]],'coordinator');const second=await call(await closing(batch, {reasons:{'PLAN|PANELES_2':'Cero explícito'}}),'coordinator');
 assert.equal(second.rows.find(r=>r.key==='PLAN|PANELES_2').realized,0);assert.equal(second.rows.find(r=>r.key==='PLAN|PANELES_2').pendingAgainstPlan,null);assert.equal(second.rows.find(r=>r.key==='PLAN|PANELES_2').plan,null);assert.equal(second.rows.find(r=>r.key==='OPEN|PANELES_2').realized,5);
 const fullRead=await value("SELECT public.sgp_lp_operacion_consultar('leader','ENSAMBLE','PANELES_2','2026-11-07',1) AS v");assert.equal(closureExportRealized(fullRead,ctx).status,'INCOMPATIBLE_CLOSE');
 assert.equal(await value('SELECT count(*)::int AS v FROM sgp_lp_operacion.cierres'),2);assert.deepEqual(await value(`SELECT snapshot AS v FROM sgp_lp_operacion.cierres WHERE id=${lit(first.id)}`),first);assert.deepEqual(await sources(),beforeUnknownPlan);
 checks.push('Reopen keeps prior snapshot, requires coordinator and fresh import; explicit zero and null legacy SALE are accepted without claiming plan comparison; no closeAuthority discovery is advertised');
 await rejectSQL(restore,/CONTAIN_FIRST/);await sql('UPDATE sgp_lp_operacion.config SET export_production_v2=false,export_close_v2=false WHERE id;');await rejectSQL(restore,/HISTORY_REQUIRES_FORWARD_RECOVERY/);
 await rejected(await command({op:'ABRIR',date:'2026-11-07',shift:2,revision:0}),/RECONCILIATION_REQUIRED/,'coordinator');
 checks.push('Legacy ABRIR creates no destination/carry after V2 history; legacy numeric operations on affected keys are fenced even when flags turn off; rollback refuses to restore unsafe consumers after V2 closes');
 // Fixture-only pre-opened successor verifies the key-scoped budget fence;
 // no ABRIR call is used to create or authorize this synthetic period.
 await sql("INSERT INTO sgp_lp_operacion.turnos(linea,etapa,fecha,turno) VALUES('PANELES_2','ENSAMBLE','2026-11-07',2);UPDATE sgp_lp_operacion.config SET incorporar_ensamble=true WHERE id;");
 const inc={op:'INCORPORAR',id:id(940),...ctx,shift:2,key:'OTHER|PANELES_2',quantity:2,revision:0,observation:'Synthetic unaffected key'};
 const added=await call(inc);assert.equal(added.quantity,2);
 await rejected({...inc,id:id(941),revision:1,key:'PLAN|PANELES_2'},/RECONCILIATION_REQUIRED/);
 checks.push('Existing INCORPORAR still works for an unrelated key in a fixture-only pre-opened turn; affected V2 production stays fenced without modifying its original proposal');
 const report={status:'PASS',engine:await value('SELECT version() AS v'),checks:checks.length,results:checks,limits:['Isolated synthetic PostgreSQL only; no live SQL, public endpoints, feature activation or UI change.','No multi-session lock test. Official cut-to-closure inclusion metadata absent, so budget/continuity remain unknown.','SIN ACTIVIDAD remains the existing legacy route when no V2 import exists; explicit V2 variant supports CON_ACTIVIDAD only.','Opening an unclosed predecessor remains a separate undecided business question; technical V2 fences do not settle it.']};
 await writeFile(new URL('tests/lp01-export-close-v2/results.json',ROOT),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await db.close();}

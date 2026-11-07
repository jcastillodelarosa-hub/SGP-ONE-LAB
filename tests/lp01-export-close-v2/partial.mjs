// Focused contract3 sequence in a disposable PGlite database. No external writes.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {bootstrap} from '../lp01-export-import-v2/bootstrap.mjs';
import {parsePowerBI,bytesBase64} from '../../src/domain/powerbi/adapter.js';
import {currentClosureExportRealized} from '../../src/domain/lp01-closure-export-v2.js';
import {closureExportRealized} from '../../src/domain/lp01-closure-export.js';
import {xlsx,id} from '../lp01-cierre-export-v2/fixture.mjs';
const ROOT=new URL('../../',import.meta.url),read=p=>readFile(new URL(p,ROOT),'utf8'),lit=v=>"'"+String(v).replaceAll("'","''")+"'";
const context={stage:'ENSAMBLE',line:'PANELES_2',date:'2026-11-07',shift:1},A='PLAN|PANELES_2',B='OPEN|PANELES_2',C='OTHER|PANELES_2';
const db=await bootstrap(),sql=q=>db.exec(q),value=async q=>(await db.query(q)).rows[0]?.v,checks=[];let seq=2000;
const revision=()=>value("SELECT revision AS v FROM sgp_lp_operacion.turnos WHERE etapa='ENSAMBLE' AND linea='PANELES_2' AND fecha='2026-11-07' AND turno=1");
const state=()=>value("SELECT jsonb_build_object('turn',(SELECT jsonb_agg(t ORDER BY etapa,fecha,turno) FROM sgp_lp_operacion.turnos t),'audit',(SELECT count(*) FROM sgp_lp_operacion.auditoria),'files',(SELECT count(*) FROM sgp_lp_operacion.archivos),'closes',(SELECT jsonb_agg(c ORDER BY version) FROM sgp_lp_operacion.cierres c)) AS v");
const untouched=()=>value("SELECT jsonb_build_object('productions',(SELECT jsonb_agg(p ORDER BY key_produccion) FROM public.sgp_producciones p),'budgets',(SELECT jsonb_agg(b ORDER BY key,etapa) FROM sgp_lp_operacion.presupuestos b)) AS v");
async function call(command,token='coordinator'){await sql('SET ROLE anon;');try{return await value(`SELECT public.sgp_lp_operacion_comando(${lit(token)},${lit(JSON.stringify(command))}::jsonb) AS v`);}finally{await sql('RESET ROLE;').catch(()=>{});}}
async function request(records,token='coordinator'){const bytes=xlsx(records);return {context:{...context,id:id(seq++),revision:await revision(),authority:'EXPORT_PRODUCTION_V2'},token,bytes,parsed:await parsePowerBI(bytes,{DOMParser})};}
async function importRequest(req){await sql('SET ROLE service_role;');try{return await value(`SELECT public.sgp_lp_operacion_importar_xlsx(${lit(req.token)},${lit(JSON.stringify(req.context))}::jsonb,'Export.xlsx',${lit(bytesBase64(req.bytes))},${lit(JSON.stringify(req.parsed))}::jsonb) AS v`);}finally{await sql('RESET ROLE;').catch(()=>{});}}
async function upload(records,token){const req=await request(records,token);return {req,result:await importRequest(req)};}
async function closeCommand(batch){return {op:'CERRAR',id:id(seq++),...context,revision:await revision(),turn_revision:await revision(),close_authority:'EXPORT_PRODUCTION_V2',import_id:batch.importId,file_id:batch.fileId,reasons:{[A]:'Archivo filtrado/corrección sintética',[B]:'Ausente en el archivo actual, conservar fuente',[C]:'Nunca informada en este contexto'},observation:'Contrato parcial3 sintético'};}
async function reopen(){return call({op:'REABRIR',id:id(seq++),...context,revision:await revision(),observation:'Corrección sintética de Export'});}
async function consult(){await sql('SET ROLE anon;');try{return await value("SELECT public.sgp_lp_operacion_consultar('leader','ENSAMBLE','PANELES_2','2026-11-07',1) AS v");}finally{await sql('RESET ROLE;').catch(()=>{});}}
async function rejected(fn,pattern){const before=await state();await assert.rejects(fn,pattern);await sql('ROLLBACK;RESET ROLE;');assert.deepEqual(await state(),before);}
async function corrupted(statement,fn,pattern){const before=await state();await sql('BEGIN;'+statement);let failure;try{await fn();}catch(error){failure=error;}await sql('ROLLBACK;RESET ROLE;');assert(failure);assert.match(failure.message,pattern);assert.deepEqual(await state(),before);}
const rows=items=>new Map(items.map(row=>[row.key,row]));
function assertValues(data,a,b,c){const m=rows(data);assert.equal(m.get(A).quantity??m.get(A).realized,a);assert.equal(m.get(B).quantity??m.get(B).realized,b);const unknown=m.get(C);assert.equal(Object.hasOwn(unknown,'quantity')?unknown.quantity:unknown.realized,c);return m;}
try{
 await sql(await read('docs/sql-proposals/lp01-export-import-v2/01_import_adapter_REVIEW.sql'));
 await sql(await read('docs/sql-proposals/lp01-export-close-v2/01_close_adapter_REVIEW.sql'));
 const before=await untouched();assert.equal(await value('SELECT export_close_v2 AS v FROM sgp_lp_operacion.config WHERE id'),false);
 // Fixture-only third production and activation. No new plan rule or real flag change.
 await sql("INSERT INTO public.sgp_linea_plan_asignaciones(id,key_produccion,fecha,turno,cantidad,prioridad,estado) VALUES('00000000-0000-0000-0000-000000000044','OTHER|PANELES_2','2026-11-07',1,2,4,'PROGRAMADA');INSERT INTO sgp_lp_operacion.ordenes(linea,etapa,fecha,turno,key,parte,sale,ejecutado) VALUES('PANELES_2','ENSAMBLE','2026-11-07',1,'OTHER|PANELES_2','00000000-0000-0000-0000-000000000044',NULL,777);UPDATE sgp_lp_operacion.config SET export_production_v2=true,export_close_v2=true WHERE id;");
 const first=await upload([['PLAN',7],['OPEN',5]]),second=await upload([['PLAN',3]]);
 assert.equal(first.result.contract,'LP-EXPORT-IMPORT-3');assert.equal(second.result.updateMode,'REPLACE_PRESENT_PRESERVE_ABSENT');
 assertValues(first.result.rows,7,5,null);const imported=assertValues(second.result.rows,3,5,null);
 assert.deepEqual([second.result.reported,second.result.absent,second.result.preserved,second.result.neverReported],[1,2,1,1]);
 assert.equal(imported.get(A).valueStatus,'CURRENT_FILE');assert.equal(imported.get(A).valueSource.importId,second.result.importId);
 assert.equal(imported.get(B).valueStatus,'PRESERVED');assert.equal(imported.get(B).coverage,'ABSENT');assert.deepEqual(imported.get(B).sourceRows,[]);assert.equal(imported.get(B).valueSource.importId,first.result.importId);assert.equal(imported.get(B).valueSource.file.id,first.result.fileId);assert.notEqual(imported.get(B).valueSource.file.sha256,second.result.sha256);
 assert.equal(imported.get(C).valueStatus,'NEVER_REPORTED');assert.equal(imported.get(C).valueSource,null);
 const afterTwo=await state(),replay=await importRequest(second.req);assert.equal(replay.duplicate,true);assert.deepEqual(await state(),afterTwo);
 await rejected(()=>importRequest({...second.req,bytes:xlsx([['PLAN',10]]),parsed:second.req.parsed}),/EVIDENCIA_XLSX_INCOMPATIBLE/);
 const different=await request([['PLAN',9]]);different.context.id=second.req.context.id;await rejected(()=>importRequest(different),/IDEMPOTENCIA_REUTILIZADA/);
 checks.push('A7/B5 then A3-only yields A3, B5 preserved from its original file/import, never-reported C null; scoped current/preserved/never counts and exact idempotency pass');
 // Fixture-only disappearance/reappearance: no historical source is deleted.
 const oldBOrders=await value(`SELECT jsonb_agg(o) AS v FROM sgp_lp_operacion.ordenes o WHERE key=${lit(B)}`),oldBPlans=await value(`SELECT jsonb_agg(p) AS v FROM public.sgp_linea_plan_asignaciones p WHERE key_produccion=${lit(B)}`);
 await sql('BEGIN;');await sql(`DELETE FROM sgp_lp_operacion.ordenes WHERE key=${lit(B)};DELETE FROM public.sgp_linea_plan_asignaciones WHERE key_produccion=${lit(B)};`);
 const withoutB=await upload([['PLAN',3]]);assert.equal(withoutB.result.rows.some(row=>row.key===B),false);
 await sql(`INSERT INTO public.sgp_linea_plan_asignaciones SELECT * FROM jsonb_populate_recordset(NULL::public.sgp_linea_plan_asignaciones,${lit(JSON.stringify(oldBPlans))}::jsonb);INSERT INTO sgp_lp_operacion.ordenes SELECT * FROM jsonb_populate_recordset(NULL::sgp_lp_operacion.ordenes,${lit(JSON.stringify(oldBOrders))}::jsonb);`);
 const backB=await upload([['PLAN',3]]);assertValues(backB.result.rows,3,5,null);assert.equal(rows(backB.result.rows).get(B).valueSource.importId,first.result.importId);
 await sql('ROLLBACK;');assert.deepEqual(await state(),afterTwo);
 // A real fixture import in another shift cannot populate never-reported C here.
 await sql("BEGIN;INSERT INTO sgp_lp_operacion.turnos(linea,etapa,fecha,turno) VALUES('PANELES_2','ENSAMBLE','2026-11-07',2);INSERT INTO sgp_lp_operacion.ordenes(linea,etapa,fecha,turno,key,parte,sale,ejecutado) VALUES('PANELES_2','ENSAMBLE','2026-11-07',2,'OTHER|PANELES_2','00000000-0000-0000-0000-000000000044',NULL,0);");
 const other=await request([['OTHER',99,2]]);other.context.shift=2;other.context.revision=0;const otherResult=await importRequest(other);assert.equal(otherResult.rows[0].quantity,99);
 const sameContext=await upload([['PLAN',3]]);assertValues(sameContext.result.rows,3,5,null);assert.equal(rows(sameContext.result.rows).get(C).valueSource,null);
 await sql('ROLLBACK;');assert.deepEqual(await state(),afterTwo);
 checks.push('Removing and re-including a production restores its last same-context source without addition; an actual import from another shift does not populate a never-reported value here');
 let closing=await closeCommand(second.result);
 await corrupted(`UPDATE sgp_lp_operacion.archivos SET contenido_binario=decode('0000','hex') WHERE id=${lit(first.result.fileId)};`,()=>call(closing),/PROCEDENCIA_NO_ACREDITADA/);
 await corrupted(`UPDATE sgp_lp_operacion.auditoria SET respuesta=jsonb_set(respuesta,'{rows,0,valueSource,context,shift}','2'::jsonb) WHERE id=${lit(first.result.importId)};`,()=>call(closing),/PROCEDENCIA_NO_ACREDITADA/);
 await corrupted(`UPDATE sgp_lp_operacion.auditoria SET respuesta=jsonb_set(respuesta,'{contract}','"LP-EXPORT-IMPORT-2"'::jsonb) WHERE id=${lit(first.result.importId)};`,()=>call(closing),/HISTORIAL_INCOMPATIBLE/);
 // A changed universe requires a fresh server import, without losing a prior value.
 await sql("UPDATE sgp_lp_operacion.ordenes SET observacion='new source revision' WHERE key='PLAN|PANELES_2';");
 await rejected(()=>call(closing),/UNIVERSO_CAMBIO_REIMPORTAR/);
 const latest=await upload([['PLAN',3]]);assertValues(latest.result.rows,3,5,null);assert.equal(latest.result.fileId,second.result.fileId);assert.notEqual(latest.result.importId,second.result.importId);
 closing=await closeCommand(latest.result);const closed=await call(closing);assertValues(closed.rows,3,5,null);assert.equal(closed.contract,'LP-EXPORT-CLOSE-3');
 const readback=await consult(),projection=currentClosureExportRealized(readback,context);assert.equal(projection.status,'CONFIRMED');assertValues(projection.rows,3,5,null);assert.equal(closureExportRealized(readback,context).status,'INCOMPATIBLE_CLOSE');
 for(const row of projection.rows){assert.equal(row.plan,null);assert.equal(row.planStatus,'PLAN_SOURCE_REQUIRED');assert.equal(row.budget.available,null);assert.equal(row.continuity.quantity,null);}
 assert.equal(rows(projection.rows).get(B).fileId,first.result.fileId);assert.equal(rows(projection.rows).get(C).fileId,null);
 await writeFile(new URL('tests/fixtures/lp01-export-partial-v3-sql-readback.json',ROOT),JSON.stringify({provenance:'SYNTHETIC_SQL_READBACK_CONTRACT3; not production evidence',context,readback},null,2)+'\n');
 checks.push('CERRAR reconstructs provenance against original bytes/hash/receipt and rejects corruption, cross-context source and contract2; universe change requires reimport; real consultar readback validates through reader3 without touching balances');
 await reopen();assert.equal(currentClosureExportRealized(await consult(),context).status,'NO_CONFIRMED_CLOSE');
 const denied=await request([['PLAN',0]],'leader');await rejected(()=>importRequest(denied),/CORRECCION_REQUIERE_COORDINADOR/);
 const zero=await upload([['PLAN',0]]);assertValues(zero.result.rows,0,5,null);const zeroClose=await call(await closeCommand(zero.result));assertValues(zeroClose.rows,0,5,null);
 assert.deepEqual(await value(`SELECT snapshot AS v FROM sgp_lp_operacion.cierres WHERE id=${lit(closed.id)}`),closed);
 await reopen();const last=await upload([['OPEN',2]]);const final=await call(await closeCommand(last.result));const finalRows=assertValues(final.rows,0,2,null);
 assert.equal(finalRows.get(A).valueStatus,'PRESERVED');assert.equal(finalRows.get(A).valueSource.importId,zero.result.importId);assert.equal(finalRows.get(B).valueStatus,'CURRENT_FILE');assert.equal(finalRows.get(C).valueSource,null);
 const corrected=await consult();assert.equal(currentClosureExportRealized(corrected,context).status,'CONFIRMED');
 await writeFile(new URL('tests/fixtures/lp01-export-partial-v3-corrected-readback.json',ROOT),JSON.stringify({provenance:'SYNTHETIC_SQL_READBACK_CONTRACT3_CORRECTION; not production evidence',context,readback:corrected},null,2)+'\n');
 assert.deepEqual(await untouched(),before);
 checks.push('Coordinator reopen/correction keeps all earlier snapshots and absent B5; explicit A0 later remains preserved zero when only B changes to2; never-reported C stays null and sources/budgets are untouched');
 await sql('UPDATE sgp_lp_operacion.config SET export_production_v2=false,export_close_v2=false WHERE id;');
 // Source/version guard and history fence are unchanged in purpose; exercise the
 // real final rollback body once after contract3 history, without deleting it.
 const restore=await read('docs/sql-proposals/lp01-export-close-v2/02_restore_without_closures_REVIEW.sql');await rejected(()=>sql(restore),/HISTORY_REQUIRES_FORWARD_RECOVERY/);
 checks.push('Both gates remain contained after tests; exact rollback refuses history-destroying legacy restoration after contract3 closes');
 const manifest=JSON.parse(await read('docs/sql-proposals/lp01-export-close-v2/manifest.json'));
 const fixtures={};for(const name of ['lp01-export-partial-v3-sql-readback.json','lp01-export-partial-v3-corrected-readback.json'])fixtures[name]=createHash('sha256').update(await readFile(new URL('tests/fixtures/'+name,ROOT))).digest('hex');
 const evidence={status:'PASS',engine:await value('SELECT version() AS v'),command:manifest.functions['public.sgp_lp_operacion_comando(text,jsonb)'],checks:checks.length,results:checks,fixtures,limits:['Disposable synthetic single-connection PostgreSQL only. No production changes, source re-audit or activation.','Plan source history and initial Export reconciliation remain unimplemented; budget and plan comparison are null.','B15/CSV integration belongs to the parent; this test imports only the production domain readers.']};
 await writeFile(new URL('tests/lp01-export-close-v2/partial-results.json',ROOT),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
}finally{await db.close();}

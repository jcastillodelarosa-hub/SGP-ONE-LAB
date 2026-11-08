import assert from'node:assert/strict';import{readFile,writeFile}from'node:fs/promises';import{bootstrap}from'../lp01-export-plan-v4/bootstrap.mjs';import{DOMParser}from'../lp01-export-plan-v4/node_modules/@xmldom/xmldom/lib/index.js';import{parsePowerBI,bytesBase64}from'../../src/domain/powerbi/adapter.js';import{id}from'../lp01-cierre-export-v2/fixture.mjs';import{historicalXlsx}from'./fixture.mjs';import{assemble}from'../../docs/sql-proposals/lp01-export-dual/assemble.mjs';
const db=await bootstrap({installPlan:false,prepareHorario:true}),sql=s=>db.exec(s),v=async s=>(await db.query(s)).rows[0]?.v,read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8'),lit=s=>"'"+String(s).replaceAll("'","''")+"'",j=x=>lit(JSON.stringify(x))+'::jsonb';let seq=13000;
try{
 await sql((await read('tests/lp01-incorporar/post-export/export-reader-candidate.sql')).split('$definition$')[1]);
 await sql('CREATE TABLE public.sgp_prioridades(key_produccion text,anio int,semana int,id_linea text,prioridad text)');
 await sql(await read('docs/linea-produccion/hoja-vidrio-v408/sql/prioridad-install.sql'));
 await sql(await read('docs/sql-proposals/lp01-incorporar-post-v408/03_discovery_REVIEW.sql'));
 await sql(await assemble());
 await sql(await read('docs/sql-proposals/lp01-historical-turn/01_prepare_REVIEW.sql'));
 for(const file of ['01_sources_REVIEW.sql','02_adapters_REVIEW.sql'])await sql(await read('docs/sql-proposals/lp01-export-historical/'+file));
 await sql(`UPDATE sgp_lp_operacion.config SET preparar_historico=true,export_production_v2=true,export_close_v4=true;
 INSERT INTO public.sgp_rol_accesos SELECT rol,'empaque',true FROM public.sgp_usuarios ON CONFLICT DO NOTHING;
 INSERT INTO public.sgp_usuario_accesos SELECT id_usuario,'empaque',true FROM public.sgp_usuarios ON CONFLICT DO NOTHING;`);
 const original=()=>v("SELECT jsonb_build_object('productions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p),'orders',(SELECT jsonb_agg(to_jsonb(o) ORDER BY key,parte) FROM sgp_lp_operacion.ordenes o),'inclusions',(SELECT jsonb_agg(to_jsonb(i)) FROM sgp_lp_operacion.inclusiones_empaque i),'plan',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.sgp_linea_plan_asignaciones a)) v");const before=await original(),outputs=[];
 for(const stage of ['ENSAMBLE','EMPAQUE']){
  const ctx={stage,line:'PANELES_2',date:'2026-11-06',shift:1};
  const revision=()=>v(`SELECT revision v FROM sgp_lp_operacion.turnos WHERE etapa=${lit(stage)} AND linea='PANELES_2' AND fecha='2026-11-06' AND turno=1`);
  await sql('SET ROLE anon');try{const prepared=await v(`SELECT public.sgp_lp_turno_historico_preparar('coordinator',${lit(id(seq++))},${lit(stage)},'PANELES_2','2026-11-06',1,'Registrar Export histórico factual') v`);assert.equal(prepared.ordersCreated,0)}finally{await sql('RESET ROLE')}
  async function upload(rows){const bytes=historicalXlsx(stage,rows,ctx.date),parsed=await parsePowerBI(bytes,{DOMParser}),revision0=await revision();await sql('SET ROLE service_role');try{return await v(`SELECT public.sgp_lp_operacion_importar_xlsx('coordinator',${j({...ctx,id:id(seq++),revision:revision0,authority:'EXPORT_PRODUCTION_V2'})},'Synthetic.xlsx',${lit(bytesBase64(bytes))},${j(parsed)}) v`)}finally{await sql('RESET ROLE')}}
  const beforeBad=await revision();await assert.rejects(()=>upload([['UNKNOWN',3]]),/PRODUCCION_XLSX_NO_UNIVOCA/);assert.equal(await revision(),beforeBad);
  await sql('UPDATE sgp_lp_operacion.config SET preparar_historico=false');await assert.rejects(()=>upload([['OPEN',3]]),/HISTORICAL_EXPORT_DISABLED/);await sql('UPDATE sgp_lp_operacion.config SET preparar_historico=true');
  assert.equal(await v(`SELECT count(*)::int v FROM sgp_lp_operacion.export_historical_keys WHERE etapa=${lit(stage)}`),0);
  let receipt=await upload([['OPEN',3],['OTHER',2]]);assert.equal(receipt.writerScope,'LP-EXPORT-HISTORICAL-1');assert.deepEqual(receipt.universe.orders,[]);assert.equal(receipt.universe.historicalKeys.length,2);
  receipt=await upload([['OPEN',4],['PLAN',1]]);assert.equal(receipt.rows.find(x=>x.key==='OTHER|PANELES_2').quantity,2);assert.equal(receipt.rows.find(x=>x.key==='OTHER|PANELES_2').valueStatus,'PRESERVED');assert.equal(receipt.universe.historicalKeys.length,3);
  assert.ok(receipt.rows.every(x=>x.plan===null&&x.pendingAgainstPlan===null));
  const cmd={op:'CERRAR',id:id(seq++),...ctx,revision:await revision(),close_authority:'EXPORT_PRODUCTION_V2',close_contract:'LP-EXPORT-CLOSE-4',import_id:receipt.importId,file_id:receipt.fileId,observation:'Cierre factual sin plan acreditado',reasons:{'OTHER|PANELES_2':'Archivo filtrado conserva dato anterior'}};
  await sql('SET ROLE anon');let result;try{result=await v(`SELECT public.sgp_lp_operacion_comando('coordinator',${j(cmd)}) v`)}finally{await sql('RESET ROLE')}
  assert.equal(result.writerScope,'LP-EXPORT-HISTORICAL-1');assert.equal(result.planComparison,'HISTORICAL_UNAVAILABLE');assert.equal(result.comparisonComplete,false);assert.equal(result.planSnapshot.contract,'LP-HISTORICAL-UNAVAILABLE-1');assert.ok(result.rows.every(r=>r.plan===null&&r.difference===null&&r.pendingAgainstPlan===null&&r.assignmentRefs.length===0));assert.equal(result.operationalReady,false);
  const replay=await v(`SELECT public.sgp_lp_operacion_comando('coordinator',${j(cmd)}) v`);assert.equal(replay.duplicate,true);
  const readback=await v(`SELECT public.sgp_lp_operacion_consultar('coordinator',${lit(stage)},'PANELES_2','2026-11-06',1) v`);assert.equal(readback.reports[0].snapshot.writerScope,'LP-EXPORT-HISTORICAL-1');outputs.push({receipt,snapshot:result});
 }
 assert.deepEqual(await original(),before);await writeFile(new URL('./readback.json',import.meta.url),JSON.stringify(outputs,null,2));console.log('PASS historical prepare/import partial/import/close both stages; real RPCs; no plan/orders/inclusions/official changes');
}catch(e){console.error(e.message,e.where);process.exitCode=1}finally{await db.close()}

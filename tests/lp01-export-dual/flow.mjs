import assert from'node:assert/strict';import{readFile,writeFile}from'node:fs/promises';import{bootstrap}from'../lp01-export-plan-v4/bootstrap.mjs';import{DOMParser}from'../lp01-export-plan-v4/node_modules/@xmldom/xmldom/lib/index.js';import{parsePowerBI,bytesBase64}from'../../src/domain/powerbi/adapter.js';import{xlsx,id}from'../lp01-cierre-export-v2/fixture.mjs';
import{packingXlsx}from'./fixture.mjs';import{assemble}from'../../docs/sql-proposals/lp01-export-dual/assemble.mjs';
const full=process.argv.includes('--full-chain');const db=await bootstrap({installPlan:!full,prepareHorario:full}),sql=s=>db.exec(s),v=async s=>(await db.query(s)).rows[0]?.v,read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8'),lit=s=>"'"+String(s).replaceAll("'","''")+"'",j=x=>lit(JSON.stringify(x))+'::jsonb';let seq=9000;
try{
 if(!full){
 await sql(`CREATE TABLE sgp_lp_operacion.inclusiones_empaque(id uuid PRIMARY KEY,linea text,fecha date,turno int,key text,cantidad int,prioridad int,motivo text,usuario text,creado_en timestamptz,UNIQUE(linea,fecha,turno,key));
 INSERT INTO sgp_lp_operacion.turnos(etapa,linea,fecha,turno) VALUES('EMPAQUE','PANELES_2','2026-11-07',1);
 INSERT INTO sgp_lp_operacion.inclusiones_empaque VALUES('00000000-0000-0000-0000-000000000101','PANELES_2','2026-11-07',1,'OPEN|PANELES_2',4,1,'Prioridad','coordinator','2026-11-07 13:00Z'),('00000000-0000-0000-0000-000000000102','PANELES_2','2026-11-07',1,'OTHER|PANELES_2',6,2,'Trabajo','coordinator','2026-11-07 13:01Z');
 INSERT INTO public.sgp_rol_accesos SELECT rol,'empaque',true FROM public.sgp_usuarios ON CONFLICT DO NOTHING;
 INSERT INTO public.sgp_usuario_accesos SELECT id_usuario,'empaque',true FROM public.sgp_usuarios ON CONFLICT DO NOTHING;`);
 }else{
 await sql(`INSERT INTO public.sgp_rol_accesos SELECT rol,'empaque',true FROM public.sgp_usuarios ON CONFLICT DO NOTHING;
 INSERT INTO public.sgp_usuario_accesos SELECT id_usuario,'empaque',true FROM public.sgp_usuarios ON CONFLICT DO NOTHING;
 UPDATE public.sgp_configuracion_general SET valor=jsonb_set(valor,'{domingo}',valor->'lunes_sabado') WHERE clave='HORARIOS_TURNOS';`);
 }
 await sql((await read('tests/lp01-incorporar/post-export/export-reader-candidate.sql')).split('$definition$')[1]);
 await sql('CREATE TABLE public.sgp_prioridades(key_produccion text,anio int,semana int,id_linea text,prioridad text)');
 await sql(await read('docs/linea-produccion/hoja-vidrio-v408/sql/prioridad-install.sql'));
 await sql(await read('docs/sql-proposals/lp01-incorporar-post-v408/03_discovery_REVIEW.sql'));
 if(!full){
 await sql('ALTER TABLE sgp_lp_operacion.config ADD COLUMN incorporar_empaque boolean DEFAULT false, ADD COLUMN turno_horario_empaque boolean DEFAULT false');
 for(const f of ['00_scope_helpers_REVIEW.sql','visibility-fragment.sql','01_import_close_REVIEW.sql'])await sql(await read('docs/sql-proposals/lp01-export-dual/'+f));
 await sql(await read('docs/sql-proposals/lp01-export-dual/02_reader_REVIEW.sql'));
 }else{
 const metadata=()=>v("SELECT jsonb_agg(jsonb_build_object('oid',oid,'owner',proowner,'acl',proacl::text,'config',proconfig,'definer',prosecdef) ORDER BY oid) v FROM pg_proc WHERE oid IN('public.sgp_lp_operacion_comando(text,jsonb)'::regprocedure,'public.sgp_lp_operacion_consultar(text,text,text,date,integer)'::regprocedure,'public.sgp_lp_operacion_resultado(text,uuid)'::regprocedure,'public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb)'::regprocedure)");const beforeMetadata=await metadata();
 assert.equal(await v('SELECT incorporar_ensamble v FROM sgp_lp_operacion.config WHERE id'),false);
 await sql(await assemble());
 assert.deepEqual(await metadata(),beforeMetadata);
 const flags=await v('SELECT to_jsonb(c) v FROM sgp_lp_operacion.config c WHERE id');
 for(const name of ['turno_horario_empaque','incorporar_empaque','export_production_v2','export_close_v4'])assert.equal(flags[name],false);
 assert.equal(await v('SELECT enabled v FROM sgp_lp_operacion.plan_control WHERE id'),false);
 }
 let packingContext={date:'2026-11-07',shift:1};
 if(full){
 await sql('UPDATE sgp_lp_operacion.config SET turno_horario_empaque=true,incorporar_empaque=true');
 await sql('SET ROLE anon');let opened;try{opened=await v("SELECT public.sgp_lp_empaque_turno_actual('coordinator') v")}finally{await sql('RESET ROLE')}
 assert.equal(opened.state,'MATERIALIZED');packingContext={date:opened.currentPeriod.date,shift:opened.currentPeriod.shift};
 for(const [key,quantity]of [['OPEN|PANELES_2',4],['OTHER|PANELES_2',6]]){
 const rev=await v(`SELECT revision v FROM sgp_lp_operacion.turnos WHERE etapa='EMPAQUE' AND fecha=${lit(packingContext.date)} AND turno=${packingContext.shift}`);
 await sql('SET ROLE anon');try{const receipt=await v(`SELECT public.sgp_lp_empaque_incorporar('coordinator',${j({id:id(seq++),...packingContext,key,quantity,revision:rev,observation:'Prioridad explícita'})}) v`);assert.equal(receipt.quantity,quantity)}finally{await sql('RESET ROLE')}
 }
 }
 await sql('UPDATE sgp_lp_operacion.plan_control SET enabled=true;UPDATE sgp_lp_operacion.config SET export_production_v2=true,export_close_v4=true;');
 const officialBefore=await v("SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) v FROM public.sgp_producciones p");const all=[];
 for(const stage of ['ENSAMBLE','EMPAQUE']){
  const ctx={stage,line:'PANELES_2',...(stage==='EMPAQUE'?packingContext:{date:'2026-11-07',shift:1})};const revision=()=>v(`SELECT revision v FROM sgp_lp_operacion.turnos WHERE etapa=${lit(stage)} AND linea='PANELES_2' AND fecha=${lit(ctx.date)} AND turno=${ctx.shift}`);
  async function upload(records){let bytes=stage==='EMPAQUE'?packingXlsx(records.map(r=>[r[0],r[1],ctx.shift]),ctx.date):xlsx(records),parsed=await parsePowerBI(bytes,{DOMParser}),rev=await revision();await sql('SET ROLE service_role');try{return await v(`SELECT public.sgp_lp_operacion_importar_xlsx('coordinator',${j({...ctx,id:id(seq++),revision:rev,authority:'EXPORT_PRODUCTION_V2'})},'Export.xlsx',${lit(bytesBase64(bytes))},${j(parsed)}) v`)}finally{await sql('RESET ROLE')}}
  // revision must be captured before role switch in restricted fixture.
  let batch=await upload(stage==='ENSAMBLE'?[['PLAN',7],['OPEN',5]]:[['OPEN',3]]);
  if(stage==='ENSAMBLE'){batch=await upload([['PLAN',8]]);assert.equal(batch.rows.find(r=>r.key==='OPEN|PANELES_2').quantity,5);assert.equal(batch.rows.find(r=>r.key==='OPEN|PANELES_2').valueStatus,'PRESERVED');}
  assert.equal(batch.writerScope,'LP-EXPORT-DUAL-1');assert.ok(batch.rows.every(r=>'reasonRequired'in r));
  const reasons=Object.fromEntries(batch.rows.filter(r=>r.reasonRequired).map(r=>[r.key,'Pendiente por material']));
  let cmd={op:'CERRAR',id:id(seq++),...ctx,revision:await revision(),close_authority:'EXPORT_PRODUCTION_V2',close_contract:'LP-EXPORT-CLOSE-4',import_id:batch.importId,file_id:batch.fileId,observation:'Cierre real del archivo',reasons};
  await sql('SET ROLE anon');let result;try{result=await v(`SELECT public.sgp_lp_operacion_comando('coordinator',${j(cmd)}) v`)}finally{await sql('RESET ROLE')}
  assert.equal(result.writerScope,'LP-EXPORT-DUAL-1');assert.equal(result.initialReference.cut,null);assert.equal(result.operationalReady,false);assert.equal(result.reconciliation,'RECONCILIATION_REQUIRED');
  if(stage==='EMPAQUE'){assert.equal(result.planSnapshot.contract,'LP-EMPAQUE-PLAN-1');assert.equal(result.rows.find(r=>r.key==='OTHER|PANELES_2').realized,null);assert.deepEqual(result.rows[0].assignmentRefs,[])}
  let replay=await v(`SELECT public.sgp_lp_operacion_comando('coordinator',${j(cmd)}) v`);assert.equal(replay.duplicate,true);
  let data=await v(`SELECT public.sgp_lp_operacion_consultar('coordinator',${lit(stage)},'PANELES_2',${lit(ctx.date)},${ctx.shift}) v`);assert.equal(data.exportClose.writerScope,'LP-EXPORT-DUAL-1');assert.ok(data.turnoHorario);assert.equal(data.reports[0].snapshot.writerScope,'LP-EXPORT-DUAL-1');all.push(result);await writeFile(new URL(`./receipt-${stage}.json`,import.meta.url),JSON.stringify(batch,null,2));
 }
 assert.deepEqual(await v("SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) v FROM public.sgp_producciones p"),officialBefore);
 await writeFile(new URL('./readback.json',import.meta.url),JSON.stringify(all,null,2));console.log((full?'FULL CHAIN: real horario/inclusion RPC, initial flags false and metadata preserved. ':'')+'PASS dual stage import+close, persisted plan comparison, null absence and no inferred reconciliation');
}catch(e){console.error(e.message,e.where,e.query);process.exitCode=1}finally{await db.close()}

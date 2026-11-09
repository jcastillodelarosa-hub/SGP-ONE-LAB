import assert from'node:assert/strict';import{readFile,writeFile}from'node:fs/promises';import{bootstrap}from'../lp01-export-plan-v4/bootstrap.mjs';import{DOMParser}from'../lp01-export-plan-v4/node_modules/@xmldom/xmldom/lib/index.js';import{parsePowerBI,bytesBase64}from'../../src/domain/powerbi/adapter.js';import{id}from'../lp01-cierre-export-v2/fixture.mjs';import{historicalXlsx}from'../lp01-export-historical/fixture.mjs';import{assemble}from'../../docs/sql-proposals/lp01-export-dual/assemble.mjs';
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
 const saleDDL=await read('docs/sql-proposals/lp01-order-sale/01_definition_REVIEW.sql');await sql(saleDDL.slice(saleDDL.indexOf('CREATE SCHEMA sgp_lp_sale_orden;'),saleDDL.indexOf('-- Re-check wall-clock')));
 for(const file of ['01_binding_REVIEW.sql','02_close_REVIEW.sql'])await sql(await read('docs/sql-proposals/lp01-turn-report-binding/'+file));
 assert.equal(await v('SELECT report_turn_binding v FROM sgp_lp_operacion.config'),false);assert.equal(await v('SELECT count(*)::int v FROM sgp_lp_operacion.report_turn_bindings'),0);
 await sql("UPDATE sgp_lp_operacion.config SET report_turn_binding=true,turno_horario_ensamble=true,turno_horario_empaque=true,incorporar_empaque=true;UPDATE public.sgp_configuracion_general SET valor=jsonb_set(valor,'{domingo}',valor->'lunes_sabado') WHERE clave='HORARIOS_TURNOS';");
 const define=async(stage,key,q)=>{const event=id(seq++);await sql(`BEGIN;INSERT INTO sgp_lp_sale_orden.definiciones VALUES(${lit(key)},${lit(stage)},1,${q},'coordinator',clock_timestamp()) ON CONFLICT(key,etapa) DO UPDATE SET revision=sgp_lp_sale_orden.definiciones.revision+1,cantidad=EXCLUDED.cantidad,registrado_en=clock_timestamp();INSERT INTO sgp_lp_sale_orden.eventos SELECT ${lit(event)},key,etapa,revision,cantidad,NULL,'{}'::jsonb,'Ajuste coordinador',usuario,registrado_en,'{}'::jsonb,'{}'::jsonb FROM sgp_lp_sale_orden.definiciones WHERE key=${lit(key)} AND etapa=${lit(stage)};COMMIT;`);return event;};
 const current=await v("SELECT x v FROM (SELECT sgp_lp_operacion.periodo((clock_timestamp() AT TIME ZONE 'America/Bogota')::date+offset_day,shift) x FROM generate_series(-1,0)offset_day,generate_series(1,2)shift) periods WHERE clock_timestamp()>=(x->>'start')::timestamptz AND clock_timestamp()<(x->>'end')::timestamptz");
 const date=current.date,shift=current.shift,latest=stage=>v(`SELECT to_jsonb(r) v FROM sgp_lp_operacion.report_available_revisions r WHERE etapa=${lit(stage)} AND fecha=${lit(date)} AND turno=${shift} ORDER BY source_revision DESC LIMIT 1`);
 await define('ENSAMBLE','OTHER|PANELES_2',5);await define('EMPAQUE','OPEN|PANELES_2',7);
 await sql(`INSERT INTO public.sgp_linea_plan_asignaciones(id,key_produccion,fecha,turno,cantidad,prioridad,estado) VALUES(${lit(id(seq++))},'OTHER|PANELES_2',${lit(date)},${shift},5,1,'PROGRAMADA')`);
 for(const stage of ['ENSAMBLE','EMPAQUE']){await sql('SET ROLE anon');try{const r=await v(`SELECT public.sgp_lp_${stage.toLowerCase()}_turno_actual('coordinator') v`);assert.equal(r.state,'MATERIALIZED')}finally{await sql('RESET ROLE')}}
 assert.equal((await latest('ENSAMBLE')).quantity,5);await define('ENSAMBLE','OTHER|PANELES_2',3);assert.equal((await latest('ENSAMBLE')).quantity,3);
 const ctx={stage:'EMPAQUE',line:'PANELES_2',date,shift},revision=()=>v(`SELECT revision v FROM sgp_lp_operacion.turnos WHERE etapa='EMPAQUE' AND fecha=${lit(date)} AND turno=${shift}`);
 await sql('SET ROLE anon');try{await v(`SELECT public.sgp_lp_empaque_incorporar('coordinator',${j({id:id(seq++),date,shift,key:'OPEN|PANELES_2',quantity:4,revision:0,observation:'Empaque del turno'})}) v`)}finally{await sql('RESET ROLE')}
 assert.equal((await latest('EMPAQUE')).quantity,7);await define('EMPAQUE','OPEN|PANELES_2',6);assert.equal((await latest('EMPAQUE')).quantity,6);
 const bytes=historicalXlsx('EMPAQUE',[['OPEN',4,shift]],date),parsed=await parsePowerBI(bytes,{DOMParser}),rv=await revision();await sql('SET ROLE service_role');let receipt;try{receipt=await v(`SELECT public.sgp_lp_operacion_importar_xlsx('coordinator',${j({...ctx,id:id(seq++),revision:rv,authority:'EXPORT_PRODUCTION_V2'})},'Synthetic.xlsx',${lit(bytesBase64(bytes))},${j(parsed)}) v`)}finally{await sql('RESET ROLE')}
 const command={op:'CERRAR',id:id(seq++),...ctx,revision:await revision(),close_authority:'EXPORT_PRODUCTION_V2',close_contract:'LP-EXPORT-CLOSE-4',import_id:receipt.importId,file_id:receipt.fileId,observation:'Observación congelada',reasons:{}};
 await assert.rejects(()=>v(`SELECT public.sgp_lp_operacion_comando('coordinator',${j({...command,observation:''})}) v`),/OBSERVACION_GENERAL_REQUERIDA/);
 await sql('SET ROLE anon');let closed;try{closed=await v(`SELECT public.sgp_lp_operacion_comando('coordinator',${j(command)}) v`)}finally{await sql('RESET ROLE')}
 const ref=closed.reportEvidence.rows[0].available;assert.equal(ref.quantity,6);assert.equal(ref.mechanism,'AUTOMATIC_TURN_BINDING');assert.equal(ref.capturedRole,'SYSTEM');assert.equal(closed.observation,'Observación congelada');assert.ok(!closed.reportEvidence.rows[0].initial);
 await define('EMPAQUE','OPEN|PANELES_2',9);assert.equal((await latest('EMPAQUE')).quantity,6);assert.deepEqual(await v(`SELECT snapshot->'reportEvidence' v FROM sgp_lp_operacion.cierres WHERE id=${lit(command.id)}`),closed.reportEvidence);
 const none=await v(`SELECT sgp_lp_operacion.report_evidence('ENSAMBLE','PANELES_2','2026-11-06',1,${lit(id(seq++))},'[{"key":"OTHER|PANELES_2"}]'::jsonb) v`);assert.equal(none.rows[0].available.status,'UNAVAILABLE');
 await sql('UPDATE sgp_lp_operacion.config SET report_turn_binding=false;UPDATE sgp_lp_operacion.config SET report_turn_binding=true');
 const stale=await v(`SELECT sgp_lp_operacion.report_evidence('ENSAMBLE','PANELES_2',${lit(date)},${shift},${lit(id(seq++))},'[{"key":"OTHER|PANELES_2"}]'::jsonb) v`);assert.equal(stale.rows[0].available.status,'UNAVAILABLE');
 await writeFile(new URL('./readback.json',import.meta.url),JSON.stringify(closed,null,2));console.log('PASS materialized/planned and packing automatic binding; edits versioned; close freezes; historic unknown; observation; epoch');
}catch(e){console.error(e.message,e.where);process.exitCode=1}finally{await db.close()}

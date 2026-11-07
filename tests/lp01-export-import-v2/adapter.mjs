import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {bootstrap} from './bootstrap.mjs';
import {createPowerBIHandler} from '../../src/server/lp-powerbi-handler.js';
import {xlsx,id} from '../lp01-cierre-export-v2/fixture.mjs';
import {bytesBase64} from '../../src/domain/powerbi/adapter.js';
const ROOT=new URL('../../',import.meta.url),read=p=>readFile(new URL(p,ROOT),'utf8');
const lit=v=>"'"+String(v).replaceAll("'","''")+"'";
const db=await bootstrap(),sql=q=>db.exec(q),value=async q=>(await db.query(q)).rows[0]?.v,checks=[];
const signatures=['public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb)','public.sgp_lp_operacion_comando(text,jsonb)'];
const metadata=()=>value(`SELECT jsonb_agg(jsonb_build_object('oid',oid,'owner',proowner,'acl',proacl::text,'config',proconfig,'definer',prosecdef) ORDER BY oid) AS v FROM pg_proc WHERE oid IN(${signatures.map(s=>lit(s)+'::regprocedure').join(',')})`);
const hash=s=>value(`SELECT md5(prosrc) AS v FROM pg_proc WHERE oid=${lit(s)}::regprocedure`);
const dataState=()=>value(`SELECT jsonb_build_object('orders',(SELECT jsonb_agg(to_jsonb(t) ORDER BY key,parte) FROM sgp_lp_operacion.ordenes t),'plans',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.sgp_linea_plan_asignaciones t),'productions',(SELECT jsonb_agg(to_jsonb(t) ORDER BY key_produccion) FROM public.sgp_producciones t)) AS v`);
let rpcCalls=[];
async function rpc(name,args){rpcCalls.push(name);await sql('SET ROLE service_role;');try{
 if(name==='sgp_sesion_actual')return {data:await value(`SELECT public.sgp_sesion_actual(${lit(args.p_token)}) AS v`),error:null};
 assert.equal(name,'sgp_lp_operacion_importar_xlsx');
 return {data:await value(`SELECT public.sgp_lp_operacion_importar_xlsx(${lit(args.p_token)},${lit(JSON.stringify(args.p_contexto))}::jsonb,${lit(args.p_nombre)},${lit(args.p_base64)},${lit(JSON.stringify(args.p_documento))}::jsonb) AS v`),error:null};
 }catch(e){await sql('ROLLBACK;');return {data:null,error:{message:e.message,code:e.code}};}finally{await sql('RESET ROLE;');}}
const options={rpc,DOMParser,allowedOrigins:['https://qa.invalid']},activeHandler=createPowerBIHandler({...options,exportProductionV2:true}),defaultHandler=createPowerBIHandler(options);
let next=100;
async function request(records=[['PLAN',7]],{token='leader',authority=true,revision,command={},filename='Export.xlsx',extra={}}={}){
 return {p_token:token,filename,base64:bytesBase64(xlsx(records)),command:{id:id(next++),stage:'ENSAMBLE',line:'PANELES_2',date:'2026-11-07',shift:1,revision:revision??await value("SELECT revision AS v FROM sgp_lp_operacion.turnos WHERE etapa='ENSAMBLE' AND linea='PANELES_2' AND fecha='2026-11-07' AND turno=1"),...(authority?{authority:'EXPORT_PRODUCTION_V2'}:{}),...command},...extra};
}
async function send(body,handler=activeHandler){const res=await handler(new Request('https://qa.invalid/lp-powerbi',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://qa.invalid'},body:JSON.stringify(body)}));return {status:res.status,body:await res.json()};}
async function rejectSQL(query,pattern){let e;try{await sql(query);}catch(x){e=x;}assert(e,'Expected SQL rejection');assert.match(e.message,pattern);await sql('ROLLBACK;RESET ROLE;');}
async function rejected(body,pattern,handler=activeHandler){const before=await value('SELECT jsonb_build_array((SELECT count(*) FROM sgp_lp_operacion.archivos),(SELECT count(*) FROM sgp_lp_operacion.auditoria),(SELECT jsonb_agg(to_jsonb(t)) FROM sgp_lp_operacion.turnos t)) AS v');const response=await send(body,handler);assert.notEqual(response.status,200);assert.match(response.body.error,pattern);assert.deepEqual(await value('SELECT jsonb_build_array((SELECT count(*) FROM sgp_lp_operacion.archivos),(SELECT count(*) FROM sgp_lp_operacion.auditoria),(SELECT jsonb_agg(to_jsonb(t)) FROM sgp_lp_operacion.turnos t)) AS v'),before);return response;}
try{
 const beforeMetadata=await metadata(),beforeData=await dataState(),install=await read('docs/sql-proposals/lp01-export-import-v2/01_import_adapter_REVIEW.sql'),restore=await read('docs/sql-proposals/lp01-export-import-v2/02_restore_adapter_REVIEW.sql'),manifest=JSON.parse(await read('docs/sql-proposals/lp01-export-import-v2/manifest.json'));
 for(const [signature,pin] of Object.entries(manifest.functions))assert.equal(await hash(signature),pin.before_source_md5);
 await rejectSQL(install.replace('COMMIT;','SELECT 1/0;COMMIT;'),/division by zero/);assert.equal(await value("SELECT count(*)::int AS v FROM information_schema.columns WHERE table_schema='sgp_lp_operacion' AND table_name='config' AND column_name='export_production_v2'"),0);
 await sql(install);assert.deepEqual(await metadata(),beforeMetadata);assert.deepEqual(await dataState(),beforeData);
 for(const [signature,pin] of Object.entries(manifest.functions))assert.equal(await hash(signature),pin.candidate_source_md5);
 assert.equal(await value('SELECT export_production_v2 AS v FROM sgp_lp_operacion.config WHERE id'),false);
 await rejectSQL(install,/INSTALACION_EXISTENTE/);
 const initial=await request();rpcCalls=[];await rejected(initial,/no habilitada/,defaultHandler);assert.equal(rpcCalls.length,0);
 await rejected(initial,/NO_HABILITADO/);
 checks.push('Guarded real-function delta preserves owner/ACL/SECURITY/search_path/RLS; atomic rollback and default-disabled HTTP+SQL paths pass');
 await sql('UPDATE sgp_lp_operacion.config SET export_production_v2=true WHERE id;');
 const first=await send(initial);assert.equal(first.status,200,JSON.stringify(first));const data=first.body.data;
 assert.equal(data.contract,'LP-EXPORT-IMPORT-3');assert.equal(data.canClose,false);assert.equal(data.reported,1);assert.equal(data.absent,1);assert.equal(data.rows.length,2);
 const byKey=new Map(data.rows.map(r=>[r.key,r]));assert.equal(byKey.get('PLAN|PANELES_2').quantity,7);assert.equal(byKey.get('OPEN|PANELES_2').quantity,null);assert.equal(byKey.get('OPEN|PANELES_2').preserve,true);
 assert.match(data.universeRevision,/^[a-f0-9]{64}$/);assert.equal(data.universe.orders.length,3);assert.deepEqual(await dataState(),beforeData);
 assert.equal(await value(`SELECT replace(encode(contenido_binario,'base64'),E'\n','') AS v FROM sgp_lp_operacion.archivos WHERE id=${lit(data.fileId)}`),initial.base64);
 const retry=await send(initial);assert.equal(retry.body.data.duplicate,true);assert.equal(await value('SELECT count(*)::int AS v FROM sgp_lp_operacion.archivos'),1);
 await rejected({...initial,filename:'different.xlsx'},/IDEMPOTENCIA/);
 checks.push('Actual shared handler parses original XLSX into service_role RPC; scoped transaction persists original/SHA/coverage/universe and receipt; two UUIDs remain untouched');
 const second=await send(await request([['PLAN',0],['OPEN',5]]));assert.equal(second.status,200,JSON.stringify(second));assert.equal(second.body.data.absent,0);assert.equal(second.body.data.rows.find(r=>r.key==='PLAN|PANELES_2').quantity,0);
 const third=await send(await request([['PLAN',3]]));assert.equal(third.status,200,JSON.stringify(third));assert.equal(third.body.data.rows.find(r=>r.key==='PLAN|PANELES_2').quantity,3);assert.equal(third.body.data.rows.find(r=>r.key==='OPEN|PANELES_2').quantity,5);
 assert.equal(await value('SELECT count(*)::int AS v FROM sgp_lp_operacion.archivos'),3);assert.equal(await value("SELECT count(*)::int AS v FROM sgp_lp_operacion.auditoria WHERE operacion='IMPORTAR_XLSX'"),3);
 const same=await send(await request([['PLAN',3]]));assert.equal(same.status,200);assert.equal(await value('SELECT count(*)::int AS v FROM sgp_lp_operacion.archivos'),3);assert.equal(await value("SELECT count(*)::int AS v FROM sgp_lp_operacion.auditoria WHERE operacion='IMPORTAR_XLSX'"),4);
 checks.push('Zero is explicit; never-reported stays null, reimport preserves absent prior values with original provenance; only PRESENT replaces, never adds; same original deduplicates bytes only');
 const revision=await value("SELECT revision AS v FROM sgp_lp_operacion.turnos WHERE etapa='ENSAMBLE' AND fecha='2026-11-07' AND turno=1");
 const close={op:'CERRAR',id:id(900),stage:'ENSAMBLE',line:'PANELES_2',date:'2026-11-07',shift:1,revision,file_id:third.body.data.fileId,observation:'synthetic close',reasons:{}};
 await rejectSQL(`SET ROLE anon;SELECT public.sgp_lp_operacion_comando('leader',${lit(JSON.stringify(close))}::jsonb);`,/CIERRE_TRANSACCIONAL_PENDIENTE/);
 assert.equal(await value('SELECT count(*)::int AS v FROM sgp_lp_operacion.cierres'),0);
 checks.push('Existing CERRAR cannot reinterpret V2 import as manual/UUID evidence; no closure, ABRIR, budget or realized write is introduced');
 for(const [token,pattern] of [['invalid',/Sesión SGP inválida/],['viewer',/Rol SGP/],['empaque',/AMBITO|ETAPA/]])await rejected(await request(undefined,{token}),pattern);
 await sql("UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='leader');");await rejected(initial,/AMBITO|SESION/);await sql('UPDATE public.sgp_usuario_accesos SET permitido=true;');
 await sql("UPDATE public.sgp_sesiones_app SET expira_en=now()-interval '1 second' WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='leader');");await rejected(await request(),/Sesión SGP inválida/);await sql("UPDATE public.sgp_sesiones_app SET expira_en=now()+interval '1 day';");
 const stale=await request(undefined,{revision:0});await rejected(stale,/CONFLICTO_REVISION/);
 await rejected(await request([['OTHER',1]]),/SIN_ASIGNACION/);await rejected(await request([['PLAN',1,2]]),/SIN_PERIODO/);await rejected(await request([['PLAN',1],['PLAN',1]]),/duplicada/);
 await rejected(await request(undefined,{extra:{document:{quantity:999}}}),/Campos/);await rejected(await request(undefined,{command:{stage:'EMPAQUE'}}),/no habilitada/);
 await sql("UPDATE sgp_lp_operacion.turnos SET estado='EN_REVISION' WHERE etapa='ENSAMBLE' AND fecha='2026-11-07' AND turno=1;");await rejected(await request(),/CORRECCION_REQUIERE/);const corrected=await send(await request([['PLAN',4]],{token:'coordinator'}));assert.equal(corrected.status,200,JSON.stringify(corrected));await sql("UPDATE sgp_lp_operacion.turnos SET estado='ABIERTO' WHERE etapa='ENSAMBLE' AND fecha='2026-11-07' AND turno=1;");
 await rejectSQL(`SET ROLE anon;SELECT public.sgp_lp_operacion_importar_xlsx('leader','{}','x.xlsx','','{}');`,/permission denied/);
 checks.push('Real captured session/profile/temporal guards reject expired/invalid/revoked/other-stage/direct-browser requests; CAS, duplicate rows, unknown incorporation and coordinator-only corrections pass');
 await sql("INSERT INTO public.sgp_linea_plan_asignaciones(id,key_produccion,fecha,turno,cantidad,prioridad,estado) VALUES('00000000-0000-0000-0000-000000000011','OTHER|PANELES_2','2026-11-07',1,2,4,'PROGRAMADA');");await rejected(await request(),/INCORPORACION_EXPLICITA/);await sql("DELETE FROM public.sgp_linea_plan_asignaciones WHERE id='00000000-0000-0000-0000-000000000011';");
 // Actual deferred authorization trigger aborts file + revision + audit at COMMIT.
 await sql("CREATE FUNCTION public.qa_revoke_import() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario=NEW.usuario);RETURN NEW;END $$;CREATE TRIGGER qa_revoke BEFORE INSERT ON sgp_lp_operacion.auditoria FOR EACH ROW WHEN(NEW.operacion='IMPORTAR_XLSX') EXECUTE FUNCTION public.qa_revoke_import();");
 await rejected(await request([['PLAN',6]]),/AMBITO|ETAPA/);await sql('DROP TRIGGER qa_revoke ON sgp_lp_operacion.auditoria;DROP FUNCTION public.qa_revoke_import();');assert.equal(await value("SELECT permitido AS v FROM public.sgp_usuario_accesos WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='leader')"),true);
 checks.push('Missing scheduled roots cannot be omitted; real deferred scope trigger rejects revocation at commit and rolls back file, audit, revision and revocation atomically');
 // An ordinary legacy upload is still the old complete-coverage contract.
 await rejected(await request([['PLAN',3]],{authority:false}),/INCOMPLETO_AUSENCIA/);const legacy=await send(await request([['PLAN',3],['OPEN',5]],{authority:false}));assert.equal(legacy.status,200);assert.equal(legacy.body.data.contract,undefined);
 const afterLegacyClose={...close,id:id(901),revision:await value("SELECT revision AS v FROM sgp_lp_operacion.turnos WHERE etapa='ENSAMBLE' AND fecha='2026-11-07' AND turno=1"),file_id:legacy.body.data.fileId};
 await rejectSQL(`SET ROLE anon;SELECT public.sgp_lp_operacion_comando('leader',${lit(JSON.stringify(afterLegacyClose))}::jsonb);`,/CIERRE_TRANSACCIONAL_PENDIENTE/);
 await rejectSQL(restore,/CONTAIN_FIRST/);await sql('UPDATE sgp_lp_operacion.config SET export_production_v2=false WHERE id;');
 const keptFiles=await value('SELECT count(*)::int AS v FROM sgp_lp_operacion.archivos'),keptAudit=await value('SELECT count(*)::int AS v FROM sgp_lp_operacion.auditoria');
 await sql(restore);assert.deepEqual(await metadata(),beforeMetadata);for(const [signature,pin] of Object.entries(manifest.functions))assert.equal(await hash(signature),pin.before_source_md5);
 assert.equal(await value('SELECT count(*)::int AS v FROM sgp_lp_operacion.archivos'),keptFiles);assert.equal(await value('SELECT count(*)::int AS v FROM sgp_lp_operacion.auditoria'),keptAudit);await rejectSQL(restore,/SOURCE_CHANGED/);
 checks.push('Legacy complete-coverage path unchanged; containment-required exact rollback restores post-INCORPORAR bodies and preserves all new evidence; stale rollback rejected');
 const report={status:'PASS',engine:await value('SELECT version() AS v'),checks:checks.length,results:checks,limits:['Synthetic in-process PostgreSQL and local HTTP Request handler only. No production connection or deployment.','Production Deno entry point stays disabled; no actual edge network or service credential used.','No multi-session PostgreSQL lock/concurrency proof; Operational activation and plan/budget history remain pending; the separate close3 adapter is tested in its own package.']};
 await writeFile(new URL('tests/lp01-export-import-v2/results.json',ROOT),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await db.close();}

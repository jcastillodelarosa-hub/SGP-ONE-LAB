import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const ROOT=new URL('../../',import.meta.url);
const read=p=>readFile(new URL(p,ROOT),'utf8');
const db=new PGlite({extensions:{pgcrypto}});await db.waitReady;
const checks=[],sql=q=>db.exec(q),value=async q=>(await db.query(q)).rows[0]?.v;
const lit=v=>"'"+String(v).replaceAll("'","''")+"'";
const identity='public.sgp_lp_operacion_consultar(text,text,text,date,integer)';
async function deny(q,message){let e;try{await sql(q)}catch(x){e=x;}assert.ok(e,'Expected rejection');assert.match(e.message,new RegExp(message));await sql('ROLLBACK;RESET ROLE;');}
async function snapshot(token='leader',stage='ENSAMBLE',line='PANELES_2',date='2026-11-07',shift=1){await sql('SET ROLE anon;');try{return await value(`SELECT public.sgp_lp_operacion_consultar(${lit(token)},${lit(stage)},${lit(line)},${lit(date)},${shift}) AS v`);}finally{await sql('RESET ROLE;');}}
async function hash(){return value(`SELECT md5(prosrc) AS v FROM pg_proc WHERE oid=${lit(identity)}::regprocedure`);}
try{
 await sql(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
 CREATE TABLE public.sgp_usuarios(id_usuario uuid PRIMARY KEY DEFAULT gen_random_uuid(),usuario text UNIQUE,nombre text,rol text,activo boolean DEFAULT true);
 CREATE TABLE public.sgp_sesiones_app(id_usuario uuid,token_hash text,revocado_en timestamptz,expira_en timestamptz);
 CREATE TABLE public.sgp_rol_accesos(rol text,ventana text,permitido boolean,PRIMARY KEY(rol,ventana));
 CREATE TABLE public.sgp_usuario_accesos(id_usuario uuid,ventana text,permitido boolean,PRIMARY KEY(id_usuario,ventana));
 CREATE TABLE public.sgp_producciones(key_produccion text PRIMARY KEY,produccion text,id_linea text,sistema text,reserva_al text,cantidad numeric,activa text DEFAULT 'SI',estado_produccion text DEFAULT 'QA',anio integer,semana_base integer,semana_actual integer,saldos_inicializados boolean,presente_ultimo_export boolean,saldo_ensamble numeric,saldo_empaque numeric,ensamblado numeric,empacado numeric,ultima_carga_diaria uuid,ultima_vez_export timestamptz);
 CREATE TABLE public.sgp_linea_plan_asignaciones(id uuid PRIMARY KEY,key_produccion text REFERENCES public.sgp_producciones,fecha date,turno int,cantidad int,prioridad int,estado text,origen_id uuid,observacion text);
 CREATE TABLE public.sgp_configuracion_general(clave text PRIMARY KEY,valor jsonb);
 INSERT INTO public.sgp_configuracion_general VALUES('HORARIOS_TURNOS','{"lunes_sabado":{"turno1":{"inicio":"07:00","fin":"19:00"},"turno2":{"inicio":"19:00","fin":"07:00"}},"domingo":{"turno1":{"inicio":"07:00","fin":"18:00"},"turno2":{"inicio":"18:00","fin":"05:00"}}}');`);
 await sql(await read('tests/lp01-hoja/base-fixture.sql'));
 await sql(`ALTER TABLE sgp_lp_operacion.permisos ADD COLUMN valid_from timestamptz,ADD COLUMN valid_until timestamptz,ADD COLUMN duty text,ADD COLUMN revoked_at timestamptz;
 CREATE TABLE sgp_lp_operacion.perfil_roles(id boolean PRIMARY KEY,habilitado boolean);INSERT INTO sgp_lp_operacion.perfil_roles VALUES(true,true);`);
 for(const f of ['sgp_sesion_actual','periodo','siguiente','ambito_vigente','operaciones_rol','acceso_rol','puede_operar','permisos_en_periodo','contener_ambitos','sesion','verificar_temporal','continuidad','cierre_valido','apertura_preparada','turno_vacio','sgp_lp_operacion_consultar'])await sql(await read('tests/lp01-hoja/production-readonly/'+f+'.sql'));
 await sql(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_lp_operacion FROM PUBLIC,anon,authenticated,service_role;
 REVOKE ALL ON FUNCTION ${identity} FROM PUBLIC;GRANT EXECUTE ON FUNCTION ${identity} TO anon,authenticated,service_role;
 ALTER TABLE public.sgp_rol_accesos ENABLE ROW LEVEL SECURITY;ALTER TABLE public.sgp_usuario_accesos ENABLE ROW LEVEL SECURITY;
 DO $$DECLARE t record;BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='sgp_lp_operacion' LOOP EXECUTE format('ALTER TABLE sgp_lp_operacion.%I ENABLE ROW LEVEL SECURITY',t.tablename);END LOOP;END $$;
 INSERT INTO public.sgp_usuarios(usuario,nombre,rol) VALUES('leader','QA leader','LIDER LINEA'),('ensamble','QA assembly','SUPERVISOR ENSAMBLE'),('empaque','QA packing','SUPERVISOR EMPAQUE'),('viewer','QA viewer','CONSULTA'),('receiver','QA receiver','RECEPCION');
 INSERT INTO public.sgp_sesiones_app SELECT id_usuario,encode(extensions.digest(usuario,'sha256'),'hex'),NULL,now()+interval '1 day' FROM public.sgp_usuarios;
 INSERT INTO public.sgp_rol_accesos SELECT rol,'ensamble',true FROM public.sgp_usuarios;
 INSERT INTO public.sgp_usuario_accesos SELECT id_usuario,'ensamble',true FROM public.sgp_usuarios;
 INSERT INTO public.sgp_producciones(key_produccion,produccion,id_linea,sistema,reserva_al,cantidad,anio,semana_base,semana_actual,saldos_inicializados,presente_ultimo_export,saldo_ensamble,saldo_empaque,ensamblado,empacado,ultima_carga_diaria,ultima_vez_export)
 SELECT key,'QA SAME NAME',ln,'QA SYSTEM','QA RESERVE',10,2026,44,45,true,true,balance,10,10-balance,0,gen_random_uuid(),'2026-11-07 10:00Z' FROM (VALUES ('OPEN|PANELES_2','PANELES_2',5),('PLAN|PANELES_2','PANELES_2',10),('OTHER|PANELES_2','PANELES_2',10),('DONE|PANELES_2','PANELES_2',0),('MISSING|PANELES_2','PANELES_2',7),('OTHER|FRAMES_2','FRAMES_2',10)) x(key,ln,balance);
 UPDATE public.sgp_producciones SET presente_ultimo_export=false WHERE key_produccion='MISSING|PANELES_2';
 INSERT INTO public.sgp_linea_plan_asignaciones VALUES
 ('00000000-0000-0000-0000-000000000001','PLAN|PANELES_2','2026-11-07',1,6,1,'PROGRAMADA',NULL,'QA split1'),
 ('00000000-0000-0000-0000-000000000002','PLAN|PANELES_2','2026-11-07',1,4,2,'PROGRAMADA',NULL,'QA split2'),
 ('00000000-0000-0000-0000-000000000003','OTHER|PANELES_2','2026-11-07',1,2,3,'CANCELADA',NULL,'QA cancelled'),
 ('00000000-0000-0000-0000-000000000004','OTHER|PANELES_2','2026-11-07',2,3,1,'PROGRAMADA',NULL,'QA other shift'),
 ('00000000-0000-0000-0000-000000000005','OTHER|FRAMES_2','2026-11-07',1,10,1,'PROGRAMADA',NULL,'QA other line');`);
 const tables=(await db.query(`SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN('public','sgp_lp_operacion') ORDER BY 1,2`)).rows;
 const tableState=async()=>Object.fromEntries(await Promise.all(tables.map(async t=>[t.schemaname+'.'+t.tablename,await value(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') AS v FROM ${t.schemaname}.${t.tablename} t`)])));
 const metadata=async()=>value(`SELECT jsonb_agg(jsonb_build_object('id',oid,'acl',proacl::text,'owner',proowner,'config',proconfig,'definer',prosecdef) ORDER BY oid) AS v FROM pg_proc WHERE pronamespace IN('public'::regnamespace,'sgp_lp_operacion'::regnamespace)`);
 const baseline=await snapshot(),beforeTables=await tableState(),beforeMetadata=await metadata();
 assert.equal(baseline.catalog,undefined);assert.equal(baseline.orders.length,0);
 const install=await read('docs/sql-proposals/lp01-hoja/01_catalog_REVIEW.sql'),restore=await read('docs/sql-proposals/lp01-hoja/02_restore_REVIEW.sql');
 const manifest=JSON.parse(await read('docs/sql-proposals/lp01-hoja/manifest.json'));
 await deny(install.replace('COMMIT;','SELECT 1/0;COMMIT;'),'division by zero');assert.equal(await hash(),manifest.original_source_md5);
 await sql(install);assert.equal(await hash(),manifest.candidate_source_md5);
 assert.deepEqual(await metadata(),beforeMetadata);assert.deepEqual(await tableState(),beforeTables);
 checks.push('Exact guarded proposal installs atomically; deliberate failure rolls back; existing ACL/owner/SECURITY/search_path and all source tables unchanged');
 const result=await snapshot();assert.equal(result.catalog.contract,'LP-HOJA-1');assert.equal(result.catalog.productions.length,5);
 assert.deepEqual(Object.keys(result).filter(k=>!['catalog','schedule'].includes(k)).sort(),Object.keys(baseline).sort());
 for(const k of Object.keys(baseline)){if(k!=='automaticOpening')assert.deepEqual(result[k],baseline[k],k);}
 const byKey=new Map(result.catalog.productions.map(p=>[p.key,p]));assert.equal(byKey.size,5);
 assert.equal(byKey.get('PLAN|PANELES_2').assignments.length,2);assert.equal(byKey.get('OTHER|PANELES_2').assignments.length,0);
 for(const p of byKey.values()){assert.equal(p.oficial.id_linea,'PANELES_2');for(const a of p.assignments){assert.equal(a.fecha,'2026-11-07');assert.equal(a.turno,1);assert.equal(a.source,'PROGRAMACION_LINEA');assert.equal(a.etapa,undefined);}}
 assert.equal(byKey.get('DONE|PANELES_2').oficial.saldo_ensamble,0);assert.equal(byKey.get('MISSING|PANELES_2').oficial.presente_ultimo_export,false);
 assert.equal(result.orders.length,0);assert.equal(result.turn.estado,'NO_ABIERTO');assert.equal(result.schedule.automaticExecutionEnabled,false);
 checks.push('Catalog works before any turn exists; exact key, zero balance and absent Export preserved; same-name keys not merged; split assignments retained; cancelled/other-turn/other-line excluded');
 const p=await value(`SELECT sgp_lp_operacion.periodo('2026-11-08',2) AS v`);assert.equal(Date.parse(p.end)-Date.parse(p.start),11*3600e3);assert.match(p.end,/2026-11-09/);
 assert.deepEqual(result.schedule.selectedPeriod,await value(`SELECT sgp_lp_operacion.periodo('2026-11-07',1) AS v`));assert.deepEqual(result.schedule.nextPeriod,await value(`SELECT sgp_lp_operacion.siguiente('2026-11-07',1) AS v`));
 if(result.schedule.currentPeriod){const now=Date.parse(result.schedule.serverTime);assert(now>=Date.parse(result.schedule.currentPeriod.start)&&now<Date.parse(result.schedule.currentPeriod.end));}
 checks.push('Server schedule reuses real periodo/siguiente including overnight Sunday; current period contains serverTime; no opening command or write');
 for(const token of ['ensamble','viewer'])assert.equal((await snapshot(token)).catalog.productions.length,5);
 assert.equal((await snapshot('empaque','EMPAQUE')).catalog.productions.length,5);
 await deny(`SET ROLE anon;SELECT public.sgp_lp_operacion_consultar('empaque','ENSAMBLE','PANELES_2','2026-11-07',1);`,'AMBITO');
 await deny(`SET ROLE anon;SELECT public.sgp_lp_operacion_consultar('ensamble','EMPAQUE','PANELES_2','2026-11-07',1);`,'AMBITO');
 for(const token of ['invalid','receiver'])await deny(`SET ROLE anon;SELECT public.sgp_lp_operacion_consultar(${lit(token)},'ENSAMBLE','PANELES_2','2026-11-07',1);`,'SESION');
 await deny(`SET ROLE anon;SELECT public.sgp_lp_operacion_consultar('leader','ENSAMBLE','FRAMES_2','2026-11-07',1);`,'AMBITO');
 await sql(`UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='leader');`);
 await deny(`SET ROLE anon;SELECT public.sgp_lp_operacion_consultar('leader','ENSAMBLE','PANELES_2','2026-11-07',1);`,'AMBITO');
 await sql(`UPDATE public.sgp_usuario_accesos SET permitido=true;UPDATE public.sgp_sesiones_app SET expira_en=now()-interval '1 second' WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='leader');`);
 await deny(`SET ROLE anon;SELECT public.sgp_lp_operacion_consultar('leader','ENSAMBLE','PANELES_2','2026-11-07',1);`,'SESION');
 await sql(`UPDATE public.sgp_sesiones_app SET expira_en=now()+interval '1 day';`);
 checks.push('Real captured authorization: supervisor cross-stage, unknown/expired session, receiver, FRAMES pilot and revoked individual access denied; CONSULTA remains read-only');
 await sql(`UPDATE sgp_lp_operacion.perfil_roles SET habilitado=false;INSERT INTO sgp_lp_operacion.permisos(usuario,etapa,key,valid_from,valid_until,duty) SELECT 'leader','ENSAMBLE',key_produccion,'2020-01-01','2100-01-01','READ' FROM public.sgp_producciones WHERE key_produccion IN('PLAN|PANELES_2','OTHER|PANELES_2');`);
 assert.deepEqual((await snapshot()).catalog.productions.map(p=>p.key),['OTHER|PANELES_2','PLAN|PANELES_2']);
 await sql(`UPDATE sgp_lp_operacion.permisos SET revoked_at=now() WHERE key='OTHER|PANELES_2';`);
 assert.deepEqual((await snapshot()).catalog.productions.map(p=>p.key),['PLAN|PANELES_2']);
 await deny('SET ROLE anon;SELECT * FROM sgp_lp_operacion.permisos;','permission denied');
 await deny('SET ROLE anon;SELECT * FROM public.sgp_producciones;','permission denied');
 checks.push('Legacy temporal scopes and revocation filter each key; no direct public/private table access added');
 await deny(install,'LP_HOJA_CONTRATO_CAMBIO');assert.equal(await hash(),manifest.candidate_source_md5);
 await sql(restore);assert.equal(await hash(),manifest.original_source_md5);assert.equal((await snapshot()).catalog,undefined);
 await deny(restore,'LP_HOJA_CONTRATO_CAMBIO');
 checks.push('Reinstall and stale rollback rejected; exact restoration returns original body and old response');
 const report={status:'PASS',engine:await value('SELECT version() AS v'),checks:checks.length,results:checks,limits:['Synthetic data only, in-process PostgreSQL WASM. No Supabase writes or live user session.','No concurrent transaction test; unchanged locking helpers retain prior evidence.','No UI/browser or new closure/import behavior tested.']};
 await writeFile(new URL('tests/lp01-hoja/catalog-test-results.json',ROOT),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await db.close();}

import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const ROOT=new URL('../../',import.meta.url),read=p=>readFile(new URL(p,ROOT),'utf8');
const db=new PGlite({extensions:{pgcrypto}});await db.waitReady;
const sql=q=>db.exec(q),value=async q=>(await db.query(q)).rows[0]?.v;
const identity='public.sgp_lp_operacion_consultar(text,text,text,date,integer)';
const lit=v=>"'"+String(v).replaceAll("'","''")+"'";
const results=[];
async function deny(q,pattern){await assert.rejects(()=>sql(q),pattern);await sql('ROLLBACK; RESET ROLE;');}
async function assemblyCall(token='leader'){return value(`SELECT public.sgp_lp_ensamble_turno_actual(${lit(token)}) AS v`);}
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

 await sql(await read('docs/sql-proposals/lp01-turno-horario/01_turno_horario_REVIEW.sql'));
 const source=await value("SELECT pg_get_functiondef('public.sgp_lp_ensamble_turno_actual(text)'::regprocedure) v");
 await sql(await read('docs/sql-proposals/lp01-turno-horario-empaque/01_horario_empaque_REVIEW.sql'));
 assert.equal(await value("SELECT pg_get_functiondef('public.sgp_lp_ensamble_turno_actual(text)'::regprocedure) v"),source);
 await sql(`UPDATE public.sgp_rol_accesos SET ventana='ensamble.operacion-ensamble' WHERE ventana='ensamble';
 UPDATE public.sgp_usuario_accesos SET ventana='ensamble.operacion-ensamble' WHERE ventana='ensamble';
 INSERT INTO public.sgp_rol_accesos SELECT rol,'ensamble.operacion-empaque',true FROM public.sgp_usuarios ON CONFLICT DO NOTHING;
 INSERT INTO public.sgp_usuario_accesos SELECT id_usuario,'ensamble.operacion-empaque',true FROM public.sgp_usuarios ON CONFLICT DO NOTHING;`);
 const call=token=>value(`SELECT public.sgp_lp_empaque_turno_actual(${lit(token)}) v`);
 assert.equal((await call('empaque')).state,'DISABLED');
 assert.equal(await value('SELECT turno_horario_ensamble v FROM sgp_lp_operacion.config'),false);
 results.push('additive installation false; Ensamble endpoint byte-identical and its flag untouched');
 await sql(`UPDATE sgp_lp_operacion.config SET escrituras=true,turno_horario_empaque=true,turno_horario_ensamble=true;
 CREATE SCHEMA qa_clock; CREATE TABLE qa_clock.t(v timestamptz);INSERT INTO qa_clock.t VALUES('2026-11-07 12:00Z');
 CREATE FUNCTION qa_clock.now() RETURNS timestamptz LANGUAGE sql AS $$SELECT v FROM qa_clock.t$$;`);
 const packing=await value("SELECT pg_get_functiondef('public.sgp_lp_empaque_turno_actual(text)'::regprocedure) v");
 // Synthetic deterministic clocks only. No clock parameter or helper in deployment.
 await sql(source.replace('observed:=clock_timestamp()','observed:=qa_clock.now()'));
 await sql(packing.replace('observed:=clock_timestamp()','observed:=qa_clock.now()'));
 await sql("INSERT INTO sgp_lp_operacion.turnos(etapa,linea,fecha,turno) VALUES('EMPAQUE','PANELES_2','2026-11-06',2)");
 await sql('BEGIN;SET LOCAL ROLE anon;');const first=await call('empaque');await sql('COMMIT;');
 assert.equal(first.created,true);assert.equal(first.stage,'EMPAQUE');assert.equal(first.currentPeriod.shift,1);
 assert.equal(await value('SELECT count(*)::int v FROM sgp_lp_operacion.aperturas_horario'),1);
 assert.equal(await value("SELECT estado v FROM sgp_lp_operacion.turnos WHERE fecha='2026-11-06'"),'ABIERTO');
 assert.equal((await call('leader')).created,false);
 await sql('BEGIN;SET LOCAL ROLE anon;');const other=await assemblyCall('ensamble');await sql('COMMIT;');assert.equal(other.created,true);
 assert.equal(await value('SELECT count(*)::int v FROM sgp_lp_operacion.aperturas_horario'),2);
 assert.equal(await value('SELECT count(*)::int v FROM sgp_lp_operacion.ordenes'),0);
 results.push('packing supervisor COMMIT under anon, prior open preserved, retry idempotent, Ensamble supervisor still opens own stage');
 await deny("SELECT public.sgp_lp_empaque_turno_actual('ensamble')",/AMBITO_DENEGADO|ROL_DENEGADO/);
 await deny("SELECT public.sgp_lp_ensamble_turno_actual('empaque')",/AMBITO_DENEGADO|ROL_DENEGADO/);
 await deny("SELECT public.sgp_lp_empaque_turno_actual('viewer')",/ROL_DENEGADO/);
 await sql("UPDATE public.sgp_usuario_accesos SET permitido=false WHERE ventana='ensamble.operacion-empaque' AND id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='empaque')");
 await deny("SELECT public.sgp_lp_empaque_turno_actual('empaque')",/AMBITO_DENEGADO/);
 results.push('cross-stage supervisors, viewer and revoked packing access rejected');
 await sql("UPDATE qa_clock.t SET v='2026-11-08 00:00Z'");
 await deny("BEGIN;SET LOCAL ROLE anon;SELECT public.sgp_lp_empaque_turno_actual('leader');RESET ROLE;UPDATE public.sgp_usuario_accesos SET permitido=false WHERE ventana='ensamble.operacion-empaque' AND id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='leader');COMMIT;",/PERMISO_REVOCADO/);
 assert.equal(await value("SELECT count(*)::int v FROM sgp_lp_operacion.turnos WHERE etapa='EMPAQUE' AND fecha='2026-11-07' AND turno=2"),0);
 results.push('packing permission revoked before deferred validation rolls back turn and audit');
 await sql('BEGIN;SET LOCAL ROLE anon;');const night=await call('leader');await sql('COMMIT;');assert.equal(night.currentPeriod.shift,2);assert.equal(night.currentPeriod.date,'2026-11-07');
 assert.equal(await value("SELECT has_function_privilege('anon','sgp_lp_operacion.confirmar_apertura_horario()','EXECUTE') v"),false);
 assert.equal(await value("SELECT has_schema_privilege('anon','sgp_lp_operacion','USAGE') v"),false);
 await sql(source);await sql(packing);
 assert.equal(await value("SELECT pg_get_functiondef('public.sgp_lp_ensamble_turno_actual(text)'::regprocedure) v"),source);
 results.push('night date correct, private trigger ACL intact and original source bodies restored');
 console.log(JSON.stringify({status:'PASS',checks:results,scope:'PGlite synthetic, no Supabase writes'},null,2));
 await writeFile(new URL('tests/lp01-turno-horario-empaque/results.json',ROOT),JSON.stringify({status:'PASS',checks:results,scope:'PGlite synthetic, no Supabase writes'},null,2)+'\n');
}finally{await db.close();}

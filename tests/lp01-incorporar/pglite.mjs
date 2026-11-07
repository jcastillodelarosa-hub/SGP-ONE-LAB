import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
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
 await sql(`ALTER TABLE public.sgp_linea_plan_asignaciones ADD COLUMN creado_por text;
 ALTER TABLE sgp_lp_operacion.auditoria ADD COLUMN rol_efectivo text,ADD COLUMN responsabilidad_servidor text;`);
 const originalBase=await read('tests/lp01-hoja/base-fixture.sql');
 // Pure balance guard copied unchanged from the known SQL01 baseline.
 await sql(`CREATE FUNCTION sgp_lp_operacion.saldo(k text,et text) RETURNS bigint LANGUAGE plpgsql SET search_path='' AS $$
DECLARE p jsonb;v bigint; BEGIN SELECT to_jsonb(x) INTO p FROM public.sgp_producciones x WHERE x.key_produccion=k;
 IF p->>'saldos_inicializados' IS DISTINCT FROM 'true' OR p->>'presente_ultimo_export' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'EXPORT_NO_VALIDADO'; END IF;
 IF (p->>CASE WHEN et='ENSAMBLE' THEN 'saldo_ensamble' ELSE 'saldo_empaque' END)::numeric <> trunc((p->>CASE WHEN et='ENSAMBLE' THEN 'saldo_ensamble' ELSE 'saldo_empaque' END)::numeric) THEN RAISE EXCEPTION 'SALDO_NO_ENTERO'; END IF;
 v:=(p->>CASE WHEN et='ENSAMBLE' THEN 'saldo_ensamble' ELSE 'saldo_empaque' END)::bigint;
 IF v IS NULL OR v<0 THEN RAISE EXCEPTION 'SALDO_OFICIAL_INVALIDO'; END IF; RETURN v; END $$;`);
 for(const f of ['puede_operar','admitir','confirmar_ambito','auditar_rol','sgp_lp_operacion_comando','sgp_lp_operacion_resultado'])await sql(await read('tests/lp01-incorporar/production-readonly/'+f+'.sql'));
 await sql(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_lp_operacion FROM PUBLIC,anon,authenticated,service_role;
 REVOKE ALL ON FUNCTION public.sgp_lp_operacion_comando(text,jsonb),public.sgp_lp_operacion_resultado(text,uuid) FROM PUBLIC;
 GRANT EXECUTE ON FUNCTION public.sgp_lp_operacion_comando(text,jsonb),public.sgp_lp_operacion_resultado(text,uuid) TO anon,authenticated,service_role;
 CREATE TRIGGER audit_role BEFORE INSERT ON sgp_lp_operacion.auditoria FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.auditar_rol();
 CREATE CONSTRAINT TRIGGER confirm_scope AFTER INSERT ON sgp_lp_operacion.auditoria DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.confirmar_ambito();
 INSERT INTO public.sgp_usuarios(usuario,nombre,rol) VALUES('coordinator','QA coordinator','COORDINADOR'),('admin','QA admin','ADMINISTRADOR');
 INSERT INTO public.sgp_sesiones_app SELECT id_usuario,encode(extensions.digest(usuario,'sha256'),'hex'),NULL,now()+interval '1 day' FROM public.sgp_usuarios WHERE usuario IN('coordinator','admin');
 INSERT INTO public.sgp_rol_accesos SELECT rol,'ensamble',true FROM public.sgp_usuarios WHERE usuario IN('coordinator','admin');
 INSERT INTO public.sgp_usuario_accesos SELECT id_usuario,'ensamble',true FROM public.sgp_usuarios WHERE usuario IN('coordinator','admin');
 UPDATE sgp_lp_operacion.config SET escrituras=true WHERE id;
 INSERT INTO sgp_lp_operacion.turnos(linea,etapa,fecha,turno) VALUES('PANELES_2','ENSAMBLE','2026-11-07',1);
 `);
 const command=(extra={})=>({op:'INCORPORAR',id:randomUUID(),stage:'ENSAMBLE',line:'PANELES_2',date:'2026-11-07',shift:1,key:'OTHER|PANELES_2',revision:0,quantity:4,observation:'QA motivo de incorporación',...extra});
 async function call(cmd,token='leader'){await sql('SET ROLE anon;');try{return await value(`SELECT public.sgp_lp_operacion_comando(${lit(token)},${lit(JSON.stringify(cmd))}::jsonb) AS v`);}finally{await sql('RESET ROLE;');}}
 async function reject(cmd,expected,token='leader'){let e;try{await call(cmd,token)}catch(error){e=error}assert(e,'Expected rejection');assert.match(e.message,new RegExp(expected));await sql('ROLLBACK;RESET ROLE;');}
 async function receipt(id,token='leader'){await sql('SET ROLE anon;');try{return await value(`SELECT public.sgp_lp_operacion_resultado(${lit(token)},${lit(id)}) AS v`);}finally{await sql('RESET ROLE;');}}
 const manifest=JSON.parse(await read('docs/sql-proposals/lp01-incorporar/manifest.json'));
 const install=await read('docs/sql-proposals/lp01-incorporar/01_incorporar_REVIEW.sql'),restore=await read('docs/sql-proposals/lp01-incorporar/02_restore_REVIEW.sql');
 const metadata=async()=>value(`SELECT jsonb_agg(jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl::text,'config',p.proconfig,'definer',p.prosecdef) ORDER BY p.oid) AS v FROM pg_proc p WHERE oid IN(${Object.keys(manifest.functions).map(s=>lit(s)+'::regprocedure').join(',')})`);
 const beforeMeta=await metadata();
 await deny(install.replace('COMMIT;','SELECT 1/0;COMMIT;'),'division by zero');
 assert.equal(await value(`SELECT count(*)::int AS v FROM information_schema.columns WHERE table_schema='sgp_lp_operacion' AND table_name='config' AND column_name='incorporar_ensamble'`),0);
 await sql(install);assert.deepEqual(await metadata(),beforeMeta);
 for(const [sig,pin]of Object.entries(manifest.functions))assert.equal(await value(`SELECT md5(prosrc) AS v FROM pg_proc WHERE oid=${lit(sig)}::regprocedure`),pin.candidate_source_md5);
 assert.equal(await value('SELECT incorporar_ensamble AS v FROM sgp_lp_operacion.config WHERE id'),false);
 await sql(await read('docs/sql-proposals/lp01-hoja/01_catalog_REVIEW.sql'));
 const discovery=await read('docs/sql-proposals/lp01-incorporar/03_discovery_REVIEW.sql'),restoreDiscovery=await read('docs/sql-proposals/lp01-incorporar/04_restore_discovery_REVIEW.sql');
 await sql(discovery);
 assert.deepEqual((await snapshot()).incorporation,{contract:'LP-INCORPORAR-1',enabled:false,canIncorporate:false,stage:'ENSAMBLE',line:'PANELES_2'});
 await reject(command(),'INCORPORAR_NO_HABILITADO');
 assert.equal(await value('SELECT count(*)::int AS v FROM sgp_lp_operacion.auditoria'),0);
 checks.push('Atomic install/rollback; existing function metadata preserved; default false blocks writes and creates no business/audit rows');
 // Activation occurs only in this in-memory synthetic database, never in the proposal.
 await sql('UPDATE sgp_lp_operacion.config SET incorporar_ensamble=true WHERE id');
 assert.equal((await snapshot()).incorporation.canIncorporate,true);
 assert.equal((await snapshot('ensamble')).incorporation.canIncorporate,true);
 assert.equal((await snapshot('viewer')).incorporation.canIncorporate,false);
 assert.equal((await snapshot('empaque','EMPAQUE')).incorporation.canIncorporate,false);
 await sql('UPDATE sgp_lp_operacion.config SET escrituras=false WHERE id');assert.equal((await snapshot()).incorporation.canIncorporate,false);await reject(command(),'ESCRITURA_NO_HABILITADA');await sql('UPDATE sgp_lp_operacion.config SET escrituras=true WHERE id');
 checks.push('Separate discovery contract fails closed with flag off, writes contained, consultation or another stage; only authorized pilot actors see canIncorporate');
 for(const token of ['viewer','empaque','receiver','invalid','coordinator','admin'])await reject(command(),'NO_HABILITADO|AMBITO|SESION',token);
 for(const extra of [{stage:'EMPAQUE'},{line:'FRAMES_2'},{key:'OTHER|FRAMES_2'}])await reject(command(extra),'SOLO_ENSAMBLE|AMBITO');
 await sql(`UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='leader');`);
 await reject(command(),'AMBITO');await sql('UPDATE public.sgp_usuario_accesos SET permitido=true');
 await sql(`UPDATE public.sgp_rol_accesos SET permitido=false WHERE rol='LIDER LINEA';`);await reject(command(),'AMBITO');await sql('UPDATE public.sgp_rol_accesos SET permitido=true');
 await sql(`UPDATE public.sgp_sesiones_app SET expira_en=now()-interval '1 second' WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='leader');`);await reject(command(),'SESION');await sql("UPDATE public.sgp_sesiones_app SET expira_en=now()+interval '1 day'");
 checks.push('Only leader/assembly supervisor candidates; wrong stage/line/role, individual or role revocation, expired/unknown sessions denied by real guards');
 for(const quantity of [0,-1,1.5,'4',2147483648])await reject(command({quantity}),'CANTIDAD_INVALIDA');
 await reject(command({quantity:11}),'CANTIDAD_SUPERA_SALDO');
 await reject(command({quantity:8}),'PROGRAMACION_SUPERA_SALDO'); // 3 already planned in another shift.
 await reject(command({observation:' '}),'MOTIVO');await reject(command({observation:'x'.repeat(2001)}),'MOTIVO');
 await reject(command({part:randomUUID()}),'CAMPOS_NO_PERMITIDOS');
 await reject(command({revision:1}),'CONFLICTO_REVISION_TURNO');await reject(command({turn_revision:1}),'CONFLICTO_REVISION_TURNO');
 await reject(command({date:'2026-11-06'}),'TURNO_NO_EXISTE');
 await sql("UPDATE sgp_lp_operacion.turnos SET estado='EN_REVISION'");await reject(command(),'TURNO_ABIERTO');await sql("UPDATE sgp_lp_operacion.turnos SET estado='CERRADO'");await reject(command(),'TURNO_ABIERTO');await sql("UPDATE sgp_lp_operacion.turnos SET estado='ABIERTO'");
 await reject(command({key:'MISSING|PANELES_2'}),'EXPORT_NO_VALIDADO');
 await reject(command({key:'DONE|PANELES_2'}),'CANTIDAD_SUPERA_SALDO');
 await reject(command({key:'OPEN|PANELES_2'}),'NO_PERTENECE_A_OTRAS');
 await reject(command({key:'PLAN|PANELES_2'}),'YA_INCORPORADA');
 await sql("UPDATE public.sgp_producciones SET activa='NO' WHERE key_produccion='OTHER|PANELES_2'");await reject(command(),'PRODUCCION_NO_DISPONIBLE');await sql("UPDATE public.sgp_producciones SET activa='SI'");
 checks.push('Rejects invalid quantity/reason/payload/CAS, missing/closed/review turn, absent/stale/zero Export, open/already planned/inactive orders and over-allocation against existing plan');
 const sourceBefore=await value('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) AS v FROM public.sgp_producciones p'),oldPlan=await value('SELECT jsonb_agg(to_jsonb(a) ORDER BY id) AS v FROM public.sgp_linea_plan_asignaciones a');
 const cmd=command({turn_revision:0}),created=await call(cmd);assert.equal(created.quantity,4);assert.equal(created.turnRevision,1);assert.equal(created.priority,3);
 assert.equal((await call(cmd)).duplicate,true);assert.deepEqual((await receipt(cmd.id)).result,created);
 await reject({...cmd,quantity:3},'IDEMPOTENCIA_REUTILIZADA');
 await reject(command({revision:1}),'YA_INCORPORADA');
 assert.equal(await value('SELECT count(*)::int AS v FROM sgp_lp_operacion.ordenes'),1);assert.equal(await value('SELECT count(*)::int AS v FROM sgp_lp_operacion.auditoria'),1);
 const order=await value('SELECT to_jsonb(o) AS v FROM sgp_lp_operacion.ordenes o');assert.equal(order.sale,null);assert.equal(order.ejecutado,0);assert.equal(order.parte,created.part);assert.equal(order.observacion,cmd.observation);
 const event=await value('SELECT to_jsonb(a) AS v FROM sgp_lp_operacion.auditoria a');assert.equal(event.operacion,'INCORPORAR');assert.equal(event.usuario,'leader');assert.equal(event.rol_efectivo,'LIDER LINEA');assert.deepEqual(event.payload,cmd);
 assert.deepEqual(await value('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) AS v FROM public.sgp_producciones p'),sourceBefore);
 assert.deepEqual(await value(`SELECT jsonb_agg(to_jsonb(a) ORDER BY id) AS v FROM public.sgp_linea_plan_asignaciones a WHERE id<>${lit(created.part)}`),oldPlan);
 checks.push('Atomic planner root + LP row + audited motive; appended priority; no SALE/execution/Export/other assignment changes; same request replays exactly, changed payload or duplicate enrollment denied');
 await sql(`INSERT INTO public.sgp_producciones SELECT 'SUP|PANELES_2','QA SUP',id_linea,sistema,reserva_al,cantidad,activa,estado_produccion,anio,semana_base,semana_actual,saldos_inicializados,presente_ultimo_export,saldo_ensamble,saldo_empaque,ensamblado,empacado,ultima_carga_diaria,ultima_vez_export FROM public.sgp_producciones WHERE key_produccion='OTHER|PANELES_2'`);
 const supCmd=command({key:'SUP|PANELES_2',revision:1,quantity:2}),sup=await call(supCmd,'ensamble');assert.equal(sup.turnRevision,2);assert.equal((await receipt(supCmd.id,'ensamble')).committed,true);
 let denied;try{await receipt(cmd.id,'ensamble')}catch(e){denied=e}assert(denied);assert.match(denied.message,/AMBITO/);
 await sql('UPDATE sgp_lp_operacion.config SET incorporar_ensamble=false WHERE id');assert.equal((await receipt(supCmd.id,'ensamble')).committed,true);
 await reject(command({key:'SUP|PANELES_2',revision:2}),'NO_HABILITADO');
 // Existing ordinary note command still functions with the feature disabled.
 const note={op:'NOTA',id:randomUUID(),stage:'ENSAMBLE',line:'PANELES_2',date:'2026-11-07',shift:1,key:'OTHER|PANELES_2',part:created.part,revision:0,turn_revision:2,observation:'QA existing note'};assert.equal((await call(note)).ok,true);
 checks.push('Assembly supervisor enrollment and own scoped receipt work; other-user receipt denied; feature containment blocks writes but preserves receipts; preexisting NOTA unchanged');
 const stateBeforeRestore=await value('SELECT jsonb_agg(to_jsonb(a) ORDER BY id) AS v FROM sgp_lp_operacion.auditoria a');
 await sql(restoreDiscovery);assert.equal((await snapshot()).incorporation,undefined);
 await sql(restore);assert.deepEqual(await metadata(),beforeMeta);assert.deepEqual(await value('SELECT jsonb_agg(to_jsonb(a) ORDER BY id) AS v FROM sgp_lp_operacion.auditoria a'),stateBeforeRestore);
 for(const [sig,pin]of Object.entries(manifest.functions))assert.equal(await value(`SELECT md5(prosrc) AS v FROM pg_proc WHERE oid=${lit(sig)}::regprocedure`),pin.before_source_md5);
 await reject(command({revision:3}),'COMANDO_INVALIDO');await deny(restore,'CUERPO_CAMBIO');
 checks.push('Contained rollback restores exact bodies/ACL and retains all planner/order/audit rows; stale rollback rejected');
 const report={status:'PASS',engine:await value('SELECT version() AS v'),groups:checks.length,results:checks,limits:['In-memory synthetic PostgreSQL WASM 18.6, not production17.11. No live writes or access activation.','Concurrent execution/locking has not been certified by this single-connection harness. SQL uses the existing lock order plus NOWAIT planner table lock; multi-session PG17 test required before activation.','Only ENSAMBLE/PANELES_2. No Empaque, automatic opening, authoritative close V2 or UI integration.']};
 await writeFile(new URL('tests/lp01-incorporar/results.json',ROOT),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await db.close();}

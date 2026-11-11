import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const schema=JSON.parse(read('tests/weekly-reprogramming/live-schema.json'));
const reader=JSON.parse(read('tests/weekly-reprogramming/live-reader.json'));
const exec=s=>db.exec(s),value=async s=>(await db.query(s)).rows[0]?.v;
const literal=v=>"'"+String(v).replaceAll("'","''")+"'";
let assertions=0;
const eq=(a,b)=>{assert.deepEqual(a,b);assertions++;};
const rejects=async (operation,pattern)=>{let error;try{await operation()}catch(e){error=e}assert(error);assert.match(error.message,pattern);assertions++;await exec('ROLLBACK;RESET ROLE;');};
const json=v=>literal(JSON.stringify(v))+'::jsonb';
const line=(id,line='PANELES_2',week=45)=>({key_produccion:`${id}|${line}`,id,id_linea:line,anio:2026,semana_base:week,semana_actual:week,produccion:`ORDER ${id}`,sistema:'S1',cantidad:8,ensamblado:7,empacado:6,saldo_ensamble:1,saldo_empaque:1,activa:'SI',reserva_al:'RES-A',fuente:`week-${week}.xlsx`,estado_produccion:'ABIERTA'});
const piece=(id,week=45)=>({id,key_produccion:`${id}|PANELES_2`,fila_origen:2,id_linea_origen:'PANELES_2',id_linea_destino:'PANELES_2',estado_relacion_produccion:'RELACIONADO',codigo_sap:'SAP-A',descripcion:'PROFILE',acabado:'WHITE',longitud:40,fabricacion:'E1',marca:'LEFT',semana:week,anio:2026,produccion:`ORDER ${id}`,cantidad:2,sistema:'S1',tipo_pieza:'PANEL',estado_clasificacion:'CLASIFICADO'});
const accessory=(id,week=45)=>({id,key_produccion:null,fila_origen:2,estado_relacion_produccion:'RELACIONADO',codigo_sap:'ACC-A',descripcion:'LOCK',cantidad:4,unidad:'UND',sistema:'S1',produccion:`ORDER ${id}`,linea:'PANELES 2',semana:week,anio:2026,fuente:`acc-${week}.xlsx`});
const glass=(id,week=45)=>({id,id_export:id,key_produccion:`${id}|PANELES_2`,fila_origen:2,estado_relacion_produccion:'RELACIONADO',produccion:`ORDER ${id}`,sistema:'S1',fuente:`glass-${week}.xlsx`,datos_origen:{id,'Cant.':8,'Sem prog.':week,'Orden Oves':'OVE-1'}});
const pkg=(week=47)=>({week,productions:[line('QA-OLD','PANELES_2',week),line('QA-OLD','FRAMES_2',week),line('QA-NEW','PANELES_2',week)],pieces:[piece('QA-OLD',week),piece('QA-OLD',week),piece('QA-NEW',week)],accessories:[accessory('QA-OLD',week),accessory('QA-NEW',week)],glass:[glass('QA-OLD',week),glass('QA-NEW',week)]});
const call=(p,token='admin')=>value(`SELECT public.sgp_cargar_paquete_semanal(${literal(token)},2026,${p.week},${json(p.productions)},${json(p.pieces)},${json(p.accessories)},${json(p.glass)}) AS v`);
const snap=()=>value(`SELECT jsonb_build_object('productions',(select jsonb_agg(p order by key_produccion) from public.sgp_producciones p),'base',(select jsonb_agg(b order by key_produccion) from public.sgp_base_semana b),'pieces',(select jsonb_agg(a order by id_pieza) from public.sgp_aluminio a),'accessories',(select jsonb_agg(a order by id_accesorio) from public.sgp_accesorios a),'glass',(select jsonb_agg(g order by id_vidrio) from public.sgp_vidrio g),'loads',(select jsonb_agg(l order by id_lote_carga) from public.sgp_lotes_carga l),'moves',(select jsonb_agg(m order by key_produccion) from sgp_carga_semanal.movimientos m)) AS v`);
async function insert(table,row){const cols=Object.keys(row);await exec(`INSERT INTO public.${table}(${cols.join(',')}) SELECT ${cols.join(',')} FROM jsonb_populate_record(NULL::public.${table},${json(row)})`);}
try {
 await exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA extensions; CREATE FUNCTION extensions.gen_random_uuid() RETURNS uuid LANGUAGE sql AS 'SELECT pg_catalog.gen_random_uuid()';
 CREATE FUNCTION extensions.digest(text,text) RETURNS bytea LANGUAGE sql IMMUTABLE AS $$SELECT decode(md5($1),'hex')$$;
 CREATE TABLE public.sgp_sesiones_actualizacion(id_sesion text PRIMARY KEY);
 CREATE TABLE public.sgp_usuarios(id_usuario text PRIMARY KEY,usuario text,activo boolean);
 CREATE TABLE public.sgp_sesiones_app(id_usuario text,token_hash text,revocado_en timestamptz,expira_en timestamptz);
 INSERT INTO public.sgp_usuarios VALUES('qa-user','QA ADMIN',true);
 INSERT INTO public.sgp_sesiones_app VALUES('qa-user',encode(extensions.digest('admin','sha256'),'hex'),null,now()+interval '1 day');
 CREATE FUNCTION public.sgp_validar_sesion_rol(p_token text,p_roles text[]) RETURNS text LANGUAGE plpgsql AS $$BEGIN IF p_token NOT IN('admin','coordinator') OR p_roles<>ARRAY['ADMINISTRADOR','COORDINADOR'] THEN RAISE EXCEPTION 'PERMISO_DENEGADO'; END IF; RETURN 'QA ADMIN'; END$$;`);
 for(const table of [...new Set(schema.columns.map(c=>c.table))]) {
  const columns=schema.columns.filter(c=>c.table===table).map(c=>`${c.name} ${c.type}${c.default?' DEFAULT '+c.default:''}${c.nullable==='NO'?' NOT NULL':''}`);
  await exec(`CREATE TABLE public.${table}(${columns.join(',')})`);
 }
 for(const [table,key] of Object.entries({sgp_producciones:'key_produccion',sgp_aluminio:'id_pieza',sgp_accesorios:'id_accesorio',sgp_vidrio:'id_vidrio'}))await exec(`ALTER TABLE public.${table} ADD PRIMARY KEY(${key}); ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
 for(const c of schema.constraints)await exec(`ALTER TABLE public.${c.table} ADD CONSTRAINT ${c.name} ${c.definition}`);
 await exec(`CREATE TABLE public.sgp_maestro_piezas(codigo_sap text,tipo_pieza text,activo text);INSERT INTO public.sgp_maestro_piezas VALUES('SAP-A','PANEL','SI');
 CREATE SCHEMA sgp_pdt_manual;
 CREATE TABLE public.sgp_aluminio_pendientes(id_pendiente uuid PRIMARY KEY,estado_repo text);
 CREATE TABLE public.sgp_aluminio_pendientes_historial(id_pendiente uuid,usuario text,tipo_evento text,observacion text,estado_anterior text,estado_nuevo text,datos_anteriores jsonb,datos_nuevos jsonb);
 CREATE TABLE sgp_pdt_manual.reportes(id_reporte uuid PRIMARY KEY,key_produccion text);
 CREATE TABLE sgp_pdt_manual.detalles(id_reporte uuid,id_pendiente uuid);
 CREATE TABLE sgp_pdt_manual.programacion_cambios(id_cambio uuid DEFAULT gen_random_uuid(),id_pendiente uuid,key_produccion text,anio_anterior integer,semana_anterior integer,anio_nuevo integer,semana_nueva integer,transaccion bigint DEFAULT txid_current(),UNIQUE(id_pendiente,transaccion));`);
 for(const fn of schema.functions)await exec(fn.definition+';');
 await exec(reader.definition+';');
 await exec(`CREATE TRIGGER trg_pdt_anio_inmutable BEFORE UPDATE OF anio ON public.sgp_producciones FOR EACH ROW EXECUTE FUNCTION sgp_pdt_manual.proteger_anio_programacion();
 CREATE CONSTRAINT TRIGGER trg_pdt_manual_auditar_programacion AFTER UPDATE ON public.sgp_producciones DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sgp_pdt_manual.auditar_programacion();
 REVOKE ALL ON FUNCTION public.sgp_cargar_paquete_semanal(text,integer,integer,jsonb,jsonb,jsonb,jsonb) FROM PUBLIC;
 GRANT EXECUTE ON FUNCTION public.sgp_cargar_paquete_semanal(text,integer,integer,jsonb,jsonb,jsonb,jsonb) TO anon,authenticated,service_role;`);
 const acl=await value("SELECT proacl::text AS v FROM pg_proc WHERE oid='public.sgp_cargar_paquete_semanal(text,integer,integer,jsonb,jsonb,jsonb,jsonb)'::regprocedure");
 await exec(read('docs/sql-proposals/weekly-reprogramming/01_install_REVIEW.sql'));

 eq(await value("SELECT proacl::text AS v FROM pg_proc WHERE oid='public.sgp_cargar_paquete_semanal(text,integer,integer,jsonb,jsonb,jsonb,jsonb)'::regprocedure"),acl);
 eq(await value("SELECT has_schema_privilege('anon','sgp_carga_semanal','USAGE') AS v"),false);
 eq(await value("SELECT bool_or(has_function_privilege('anon',oid,'EXECUTE')) AS v FROM pg_proc WHERE pronamespace='sgp_carga_semanal'::regnamespace"),false);
 await exec('SET ROLE anon');await rejects(()=>exec('SELECT * FROM sgp_carga_semanal.movimientos'),/permission denied/);
 await insert('sgp_lotes_carga',{id_lote_carga:'ORIGINAL',anio:2026,semana_base:45,estado:'APLICADO'});
 for(const l of ['PANELES_2','FRAMES_2']){await insert('sgp_producciones',{...line('QA-OLD',l),id_carga:'ORIGINAL'});await insert('sgp_base_semana',{key_produccion:`QA-OLD|${l}`,anio:2026,semana_base:45,id_carga:'ORIGINAL'});}
 for(const [id,row] of [['OLD-P1',piece('QA-OLD')],['OLD-P2',piece('QA-OLD')]])await insert('sgp_aluminio',{...row,id_pieza:id,id_carga:'ORIGINAL'});
 await insert('sgp_accesorios',{...accessory('QA-OLD'),id_accesorio:'OLD-A',id_carga:'ORIGINAL'});
 await insert('sgp_vidrio',{...glass('QA-OLD'),id_vidrio:'OLD-V',id_carga:'ORIGINAL'});
 await exec(`INSERT INTO public.sgp_aluminio_pendientes VALUES('00000000-0000-0000-0000-000000000001','PROCESADO');
 INSERT INTO sgp_pdt_manual.reportes VALUES('00000000-0000-0000-0000-000000000002','QA-OLD|PANELES_2');
 INSERT INTO sgp_pdt_manual.detalles VALUES('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001');`);
 const before=await snap();
 await rejects(()=>call(pkg(),'viewer'),/PERMISO_DENEGADO/);eq(await snap(),before);
 const duplicate=pkg();duplicate.productions.push(duplicate.productions[0]);await rejects(()=>call(duplicate),/PAQUETE_INVALIDO/);eq(await snap(),before);
 const mismatch=pkg();mismatch.pieces[0].cantidad=999;await rejects(()=>call(mismatch),/MATERIAL_REPROGRAMACION_DIFIERE/);eq(await snap(),before);
 const extra=pkg();extra.pieces.push(piece('QA-OLD',47));await rejects(()=>call(extra),/MATERIAL_REPROGRAMACION_DIFIERE/);eq(await snap(),before);
 const relation=pkg();relation.accessories[0].key_produccion='QA-OLD|FRAMES_2';await rejects(()=>call(relation),/MATERIAL_REPROGRAMACION_DIFIERE/);eq(await snap(),before);
 const unlinked=pkg();Object.assign(unlinked.pieces[0],{id:null,key_produccion:null,estado_relacion_produccion:'SIN_RELACION'});await rejects(()=>call(unlinked),/MATERIAL_REPROGRAMACION_SIN_RELACION/);eq(await snap(),before);
 const late=pkg();late.glass[1].fila_origen='not-integer';await rejects(()=>call(late),/invalid input syntax/);eq(await snap(),before);
 // Failure AFTER movement/base/new rows must roll the entire package back.
 await exec(`CREATE FUNCTION public.qa_reject_glass() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'QA_LATE_FAILURE'; END$$;
 CREATE TRIGGER qa_late BEFORE INSERT ON public.sgp_vidrio FOR EACH ROW EXECUTE FUNCTION public.qa_reject_glass();`);
 await rejects(()=>call(pkg()),/QA_LATE_FAILURE/);eq(await snap(),before);
 await exec('DROP TRIGGER qa_late ON public.sgp_vidrio');
 await exec('BEGIN;SET ROLE anon');const result=await call(pkg());await exec('COMMIT;RESET ROLE');
 eq(result.actualizados.programacion,2);eq(result.insertados.programacion,1);eq(result.reutilizados,{piezas:2,accesorios:1,vidrio:1});eq(result.insertados.total,4);
 const after=await snap();eq(after.productions.length,3);eq(after.base.length,3);eq(after.moves.length,2);
 for(const old of before.productions){const next=after.productions.find(p=>p.key_produccion===old.key_produccion);eq(next.semana_base,47);eq(next.semana_actual,47);const strip=p=>Object.fromEntries(Object.entries(p).filter(([k])=>!['semana_base','semana_actual','fecha_actualizacion'].includes(k)));eq(strip(next),strip(old));}
 for(const group of ['pieces','accessories','glass'])for(const old of before[group]){const idField={pieces:'id_pieza',accessories:'id_accesorio',glass:'id_vidrio'}[group];eq(after[group].find(n=>n[idField]===old[idField]),old);}
 eq(after.moves.map(m=>m.semana_base_anterior),[45,45]);eq(after.moves.map(m=>m.base_anterior.id_carga),['ORIGINAL','ORIGINAL']);
 eq(await value("SELECT count(*)::int AS v FROM sgp_pdt_manual.programacion_cambios"),1);
 eq(await value("SELECT datos_nuevos->>'semana' AS v FROM public.sgp_aluminio_pendientes_historial"),'47');
 eq(await value("SELECT estado_repo AS v FROM public.sgp_aluminio_pendientes"),'PROCESADO');
 const oldWeek=await value("SELECT public.sgp_consultar_piezas_semana('admin',2026,45) AS v");eq(oldWeek.piezas.length,0);
 const newWeek=await value("SELECT public.sgp_consultar_piezas_semana('admin',2026,47) AS v");eq(newWeek.piezas.reduce((s,r)=>s+Number(r.cantidad),0),6);
 await rejects(()=>call(pkg()),/SEMANA_YA_CARGADA/);eq(await snap(),after);
 // Missing input rows do not erase earlier material; later move also preserves old events.
 const later=pkg(48);later.productions=later.productions.slice(0,2);later.pieces=later.pieces.slice(0,1);later.accessories=later.accessories.slice(0,1);later.glass=later.glass.slice(0,1);
 await exec('BEGIN;SET ROLE authenticated');const again=await call(later,'coordinator');await exec('COMMIT;RESET ROLE');eq(again.reutilizados.piezas,1);eq(again.insertados.total,0);
 eq(await value("SELECT count(*)::int AS v FROM sgp_carga_semanal.movimientos"),4);
 eq(await value("SELECT count(*)::int AS v FROM public.sgp_aluminio WHERE key_produccion='QA-OLD|PANELES_2'"),2);
 const current=await snap();const cross=pkg(49);cross.productions.forEach(p=>p.anio=2027);cross.pieces.forEach(p=>p.anio=2027);cross.accessories.forEach(p=>p.anio=2027);
 await rejects(()=>value(`SELECT public.sgp_cargar_paquete_semanal('admin',2027,49,${json(cross.productions)},${json(cross.pieces)},${json(cross.accessories)},${json(cross.glass)}) AS v`),/REPROGRAMACION_ANIO_INMUTABLE/);eq(await snap(),current);
 const hashes=await value("SELECT jsonb_build_object('writer',md5(pg_get_functiondef('public.sgp_cargar_paquete_semanal(text,integer,integer,jsonb,jsonb,jsonb,jsonb)'::regprocedure)),'reader',md5(pg_get_functiondef('public.sgp_consultar_piezas_semana(text,integer,integer)'::regprocedure))) AS v");
 await rejects(()=>exec(read('docs/sql-proposals/weekly-reprogramming/01_install_REVIEW.sql')),/WEEKLY_BASELINE_CHANGED/);eq(await snap(),current);
 await exec(read('docs/sql-proposals/weekly-reprogramming/03_restore_code_REVIEW.sql'));eq(await snap(),current);
 eq(await value("SELECT md5(pg_get_functiondef('public.sgp_cargar_paquete_semanal(text,integer,integer,jsonb,jsonb,jsonb,jsonb)'::regprocedure)) AS v"),'53654295f422c940ac94b31e308f5164');
 eq(await value("SELECT md5(pg_get_functiondef('public.sgp_consultar_piezas_semana(text,integer,integer)'::regprocedure)) AS v"),'ffe9ac5216b49388f37440ad1e93a90d');
 eq(await value("SELECT proacl::text AS v FROM pg_proc WHERE oid='public.sgp_cargar_paquete_semanal(text,integer,integer,jsonb,jsonb,jsonb,jsonb)'::regprocedure"),acl);
 console.log(`PASS ${assertions} assertions: week moves, base upsert, two lines, balances, source IDs, history, PDT audit, multiset materials, reader, late rollback, repeat, roles, private ACL, cross-year guard.`);
 writeFileSync(new URL('results.json',import.meta.url),JSON.stringify({environment:'PGlite 0.5.16, synthetic fixtures, live-shaped schema',assertions,hashes,status:'PASS',limitations:['No production writes','No PostgreSQL multi-session test','No browser QA','No real spreadsheet load']},null,2)+'\n');
}finally{await db.close();}

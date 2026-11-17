import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const {PGlite}=await import(process.env.PGLITE_MODULE);const db=new PGlite();await db.waitReady;
const root='docs/sql-proposals/picking-reception-quantities/';
const read=n=>readFileSync(root+n,'utf8');
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
try{
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
CREATE SCHEMA sgp_picking_audit;CREATE SCHEMA sgp_mecanizado_parcial;CREATE SCHEMA sgp_picking_audit_areas;
CREATE TABLE public.sgp_usuarios(usuario text primary key,nombre text);
CREATE TABLE public.sgp_producciones(key_produccion text primary key,produccion text,sistema text,id_linea text,cantidad numeric,semana_actual integer,semana_base integer,anio integer);
CREATE TABLE public.sgp_prioridades(key_produccion text,reserva text,id_linea text);
CREATE TABLE public.sgp_mecanizado_programacion(id_programacion uuid primary key,reserva text,sistema text);
CREATE TABLE public.sgp_picking_entregas(id_entrega uuid primary key,id_programacion uuid,produccion text,usuario_entrega text,usuario_validacion text,fecha_validacion timestamptz,estado text);
CREATE TABLE sgp_mecanizado_parcial.partes(id_programacion uuid primary key,key_produccion text);
CREATE TABLE sgp_picking_audit.eventos(id_entrega uuid primary key,payload jsonb,respuesta jsonb,usuario text,fecha_recepcion date,turno_recepcion text,ejecutado_en timestamptz);
CREATE TABLE sgp_picking_audit.decisiones(id_faltante uuid primary key,id_pendiente uuid,id_entrega uuid,accion text,nuevo jsonb);
CREATE TABLE sgp_picking_audit_areas.revisiones(id_entrega uuid,area text,usuario text,fecha date,turno text,resultado text,ejecutado_en timestamptz,payload jsonb);
CREATE FUNCTION sgp_picking_audit_areas.esquema(uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT '{"areas":[{"id":"VERTICALES","nombre":"Verticales"},{"id":"ZOCALERO","nombre":"Zócalos"}]}'::jsonb$$;
CREATE FUNCTION sgp_picking_audit_areas.resumen(uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT '[]'::jsonb$$;
CREATE FUNCTION public.sgp_validar_sesion_rol(token text,roles text[]) RETURNS text LANGUAGE plpgsql AS $$BEGIN IF roles<>ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING'] OR token IS DISTINCT FROM 'ok' THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;RETURN 'user';END$$;
CREATE FUNCTION public.sgp_picking_reporte_recepciones_v1(p_token text,p_fecha_inicio date,p_fecha_fin date,p_turno text DEFAULT NULL,p_sistema text DEFAULT NULL,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;
REVOKE ALL ON FUNCTION public.sgp_picking_reporte_recepciones_v1(text,date,date,text,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_picking_reporte_recepciones_v1(text,date,date,text,text,integer,integer) TO anon,authenticated,service_role;
INSERT INTO public.sgp_usuarios VALUES('v','Synthetic V'),('z','Synthetic Z');
INSERT INTO public.sgp_mecanizado_programacion VALUES('${id(1)}','R1','S1'),('${id(2)}','R1','S1'),('${id(3)}','R3','S3');
INSERT INTO public.sgp_producciones VALUES('K1','DEMO-1','S1','L1',30,47,46,2026),('K2','DEMO-2','S1','L1',20,46,45,2026);
INSERT INTO public.sgp_prioridades VALUES('K1','R1','L1'),('K2','R1','L1');
`);
for(let n=1;n<=3;n++)await db.exec(`INSERT INTO public.sgp_picking_entregas VALUES('${id(n)}','${id(n)}','DEMO-${n}','v','z',now(),'VALIDADA');INSERT INTO sgp_picking_audit.eventos VALUES('${id(n)}','{"decisiones":[],"diferencias":[]}','{"ok":true,"id_entrega":"${id(n)}"}','z','2026-11-16','TURNO 1',now());`);
await db.exec(`INSERT INTO sgp_picking_audit_areas.revisiones VALUES('${id(1)}','VERTICALES','v','2026-11-16','TURNO 1','SIN_FALTANTES',now(),'{}'),('${id(1)}','ZOCALERO','z','2026-11-16','TURNO 1','SIN_FALTANTES',now(),'{}');`);
const originalReport=(await db.query("select pg_get_functiondef('public.sgp_picking_reporte_recepciones_v1(text,date,date,text,text,integer,integer)'::regprocedure) def")).rows[0].def;
for(const [file,sig] of [['area-names-review.sql','sgp_picking_audit_areas.resumen(uuid)'],['report-enrichment-review.sql','public.sgp_picking_reporte_recepciones_v1(text,date,date,text,text,integer,integer)']]){
 const checksum=(await db.query(`select md5(pg_get_functiondef('${sig}'::regprocedure)) hash`)).rows[0].hash;
 await db.exec(read(file).replace(/<> '[a-f0-9]{32}'/,`<> '${checksum}'`));
}
const query=()=>db.query(`select public.sgp_picking_reporte_recepciones_v1('ok','2026-11-16','2026-11-16') result`);
let result=(await query()).rows[0].result;assert.equal(result.total_rows,3);const one=result.rows.find(r=>r.produccion==='DEMO-1'),two=result.rows.find(r=>r.produccion==='DEMO-2'),three=result.rows.find(r=>r.produccion==='DEMO-3');
assert.equal(one.semana_programada,47);assert.equal(two.semana_programada,46);assert.equal(one.cantidad_programada,30);assert.equal(two.cantidad_programada,20);assert.equal(three.cantidad_programada,null);assert.equal(three.semana_programada,null);assert.equal(one.key_produccion,'K1');assert.equal(one.cantidad_ventanas_recibidas,null);assert.deepEqual(one.revisiones_areas.map(a=>a.revision.nombre),['Synthetic V','Synthetic Z']);
// Ambiguous same-name matches are unknown, never arbitrarily choose one.
await db.exec(`INSERT INTO public.sgp_producciones VALUES('K4','DEMO-1','S1','L1',999,9,9,2026);INSERT INTO public.sgp_prioridades VALUES('K4','R1','L1');`);result=(await query()).rows[0].result;assert.equal(result.rows.find(r=>r.produccion==='DEMO-1').cantidad_programada,null);
// Stable key on partial programming disambiguates but retains whole order quantity.
await db.exec(`INSERT INTO sgp_mecanizado_parcial.partes VALUES('${id(1)}','K1');`);result=(await query()).rows[0].result;assert.equal(result.rows.find(r=>r.produccion==='DEMO-1').cantidad_programada,30);
await assert.rejects(()=>db.query(`select public.sgp_picking_reporte_recepciones_v1('denied','2026-11-16','2026-11-16')`),/UNAUTHORIZED/);
await db.exec('SET ROLE anon');await query();await assert.rejects(()=>db.query('select * from public.sgp_usuarios'),/permission denied/);await db.exec('RESET ROLE');
// Duplicate priorities must not multiply report rows (EXISTS, not a join).
await db.exec("INSERT INTO public.sgp_prioridades VALUES('K2','R1','L1'),('K2','R1','L1')");
result=(await query()).rows[0].result;assert.equal(result.total_rows,3);assert.equal(result.rows.filter(r=>r.produccion==='DEMO-2').length,1);
// Invalid/missing historical snapshots must stay unknown, not complete.
await db.exec(`UPDATE sgp_picking_audit.eventos SET payload='{}' WHERE id_entrega='${id(2)}'`);
result=(await query()).rows[0].result;const invalid=result.rows.find(r=>r.produccion==='DEMO-2');assert.equal(invalid.pendientes_al_recibir,null);assert.equal(invalid.completa_al_recibir,null);
// CREATE OR REPLACE preserves owner and ACL. Guard rejects a changed definition atomically.
const signature='public.sgp_picking_reporte_recepciones_v1(text,date,date,text,text,integer,integer)';
const capture=async()=>(await db.query(`select pg_get_functiondef('${signature}'::regprocedure) def,proacl::text acl,proowner::text owner from pg_proc where oid='${signature}'::regprocedure`)).rows[0];
const before=await capture();
await assert.rejects(()=>db.exec(read('report-enrichment-review.sql')),/SOURCE_CHANGED_REVIEW_REQUIRED/);await db.exec('ROLLBACK');assert.deepEqual(await capture(),before);
// A failed rollout can restore the exact saved definition without grants or data edits.
const checksum=(await db.query(`select md5(pg_get_functiondef('${signature}'::regprocedure)) hash`)).rows[0].hash;
await db.exec(read('report-enrichment-review.sql').replace(/<> '[a-f0-9]{32}'/,`<> '${checksum}'`));assert.deepEqual(await capture(),before);
await db.exec('BEGIN;'+originalReport+'; COMMIT;');const restored=await capture();assert.equal(restored.def,originalReport);assert.equal(restored.acl,before.acl);assert.equal(restored.owner,before.owner);assert.deepEqual((await query()).rows[0].result,{});
console.log('SQL PASS: no fanout, missing snapshot unknown, changed-source guard and rollback/ACL preservation; exact week/quantity, absent/ambiguous order, canonical key, area names, unchanged receipt evidence and roles');
}finally{await db.close()}

import {readFileSync} from 'node:fs';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
try {
 await db.exec(readFileSync('tests/pdt-picking-simple/fixture.sql','utf8'));
 await db.exec(readFileSync('docs/sql-proposals/pdt/picking-simple/install.sql','utf8'));
 await db.exec(`CREATE FUNCTION public.sgp_mis_accesos(text) RETURNS TABLE(ventana text) LANGUAGE sql AS $$ SELECT 'picking'::text $$; CREATE TABLE public.sgp_usuarios(usuario text PRIMARY KEY,nombre text); CREATE TABLE public.sgp_producciones(key_produccion text,semana_actual integer,semana_base integer); CREATE FUNCTION public.sgp_sesion_actual(text) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('valida',true,'rol',$1) $$;`);
 await db.exec(readFileSync('tests/picking-pdt-flow/legacy-function-definitions.sql','utf8'));
 await db.exec(readFileSync('docs/sql-proposals/picking-pdt-flow/install-review.sql','utf8'));
 const before=(await db.query("select oid::regprocedure::text firma,pg_get_functiondef(oid) def,proacl::text acl,proowner from pg_proc where proname like 'sgp_pdt_picking_%' order by oid")).rows;
 await db.exec(readFileSync('docs/sql-proposals/picking-leader-delivery/install-review.sql','utf8'));
 const after=(await db.query("select oid::regprocedure::text firma,pg_get_functiondef(oid) def,proacl::text acl,proowner from pg_proc where proname like 'sgp_pdt_picking_%' order by oid")).rows;
 for(let i=0;i<before.length;i++){if(before[i].acl!==after[i].acl||before[i].proowner!==after[i].proowner)throw Error('ACL/owner changed');}
 await db.exec(readFileSync('tests/picking-pdt-flow/assertions.sql','utf8'));
 await db.exec(readFileSync('tests/picking-pdt-flow/leader.sql','utf8'));
 await db.exec(readFileSync('docs/sql-proposals/picking-leader-delivery/rollback.sql','utf8'));
 const restored=(await db.query("select oid::regprocedure::text firma,pg_get_functiondef(oid) def,proacl::text acl,proowner from pg_proc where proname like 'sgp_pdt_picking_%' order by oid")).rows;
 if(JSON.stringify(before)!==JSON.stringify(restored))throw Error('Rollback not exact');
 console.log('PASS exact rollback, ACL/owner, leader delivery, receipt denied, queue/notices capabilities and existing regression assertions');
} finally {await db.close();}

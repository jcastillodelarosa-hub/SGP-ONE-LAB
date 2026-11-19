import {readFileSync} from 'node:fs';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
try {
 await db.exec(readFileSync('tests/pdt-picking-simple/fixture.sql','utf8'));
 await db.exec(readFileSync('docs/sql-proposals/pdt/picking-simple/install.sql','utf8'));
 await db.exec(`CREATE FUNCTION public.sgp_mis_accesos(text) RETURNS TABLE(ventana text) LANGUAGE sql AS $$ SELECT 'picking'::text $$; CREATE TABLE public.sgp_usuarios(usuario text PRIMARY KEY,nombre text); CREATE TABLE public.sgp_producciones(key_produccion text,semana_actual integer,semana_base integer); CREATE FUNCTION public.sgp_sesion_actual(text) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('valida',true,'rol',$1) $$;`);
 await db.exec(readFileSync('tests/picking-pdt-flow/legacy-function-definitions.sql','utf8'));
 await db.exec(readFileSync('docs/sql-proposals/picking-pdt-flow/install-review.sql','utf8'));
 await db.exec(readFileSync('docs/sql-proposals/picking-leader-delivery/install-review.sql','utf8'));
 await db.exec(readFileSync('tests/picking-pdt-flow/assertions.sql','utf8'));
 await db.exec(readFileSync('tests/picking-pdt-flow/leader.sql','utf8'));
 const baseline=()=>db.query("select pg_get_functiondef(oid) def,proacl::text acl,proowner from pg_proc where oid='public.sgp_pdt_picking_movimiento_v1(text,uuid,text,integer,uuid,text)'::regprocedure");
 const before=(await baseline()).rows;
 await db.exec(readFileSync('docs/sql-proposals/picking-pdt-reception-shift/install-review.sql','utf8'));
 if(JSON.stringify(before)!==JSON.stringify((await baseline()).rows))throw Error('v1 writer definition, owner or ACL changed');
 await db.exec(readFileSync('tests/picking-pdt-flow/reception-shift.sql','utf8'));
 console.log('PASS date/shift receipt addition, roles, rollback on invalid dates, no historical backfill, idempotency and history');
} finally {await db.close();}

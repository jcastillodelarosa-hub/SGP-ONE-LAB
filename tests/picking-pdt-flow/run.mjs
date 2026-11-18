import {readFileSync} from 'node:fs';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
try {
 await db.exec(readFileSync('tests/pdt-picking-simple/fixture.sql','utf8'));
 await db.exec(readFileSync('docs/sql-proposals/pdt/picking-simple/install.sql','utf8'));
 await db.exec(`CREATE FUNCTION public.sgp_mis_accesos(text) RETURNS TABLE(ventana text) LANGUAGE sql AS $$ SELECT 'picking'::text $$; CREATE TABLE public.sgp_usuarios(usuario text PRIMARY KEY,nombre text); CREATE TABLE public.sgp_producciones(key_produccion text,semana_actual integer,semana_base integer); CREATE FUNCTION public.sgp_sesion_actual(text) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('valida',true,'rol',$1) $$;`);
 await db.exec(readFileSync('tests/picking-pdt-flow/legacy-function-definitions.sql','utf8'));
 await db.exec(readFileSync('docs/sql-proposals/picking-pdt-flow/install-review.sql','utf8'));
 await db.exec(readFileSync('tests/picking-pdt-flow/assertions.sql','utf8'));
 try { await db.exec(readFileSync('docs/sql-proposals/picking-pdt-flow/rollback-unused.sql','utf8'));throw Error('Used rollback accepted'); } catch(e){if(!String(e).includes('PDT_FLOW_USED_USE_CONTAINMENT'))throw e;await db.exec('ROLLBACK');}
 await db.exec(readFileSync('docs/sql-proposals/picking-pdt-flow/contain.sql','utf8'));
 const grants=await db.query("SELECT has_function_privilege('anon','public.sgp_pdt_picking_simple_v1(text,uuid,integer,uuid,text)','EXECUTE') a,has_function_privilege('authenticated','public.sgp_pdt_picking_movimiento_v1(text,uuid,text,integer,uuid,text)','EXECUTE') b");
 if(grants.rows[0].a||grants.rows[0].b)throw Error('Containment left write access');
 console.log('PASS installation, behavioral assertions, used rollback refusal, containment (synthetic PostgreSQL/PGlite)');
} finally {await db.close();}
const clean=new PGlite();
try {
 await clean.exec(readFileSync('tests/pdt-picking-simple/fixture.sql','utf8'));
 await clean.exec(readFileSync('docs/sql-proposals/pdt/picking-simple/install.sql','utf8'));
 await clean.exec(`CREATE FUNCTION public.sgp_mis_accesos(text) RETURNS TABLE(ventana text) LANGUAGE sql AS $$ SELECT 'picking'::text $$; CREATE TABLE public.sgp_usuarios(usuario text PRIMARY KEY,nombre text); CREATE TABLE public.sgp_producciones(key_produccion text,semana_actual integer,semana_base integer); CREATE FUNCTION public.sgp_sesion_actual(text) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('valida',true,'rol',$1) $$;`);
 await clean.exec(readFileSync('tests/picking-pdt-flow/legacy-function-definitions.sql','utf8'));
 await clean.exec(readFileSync('docs/sql-proposals/picking-pdt-flow/install-review.sql','utf8'));
 const beforeRestore=await clean.query('SELECT firma,md5(definition) hash,original_acl::text acl,original_owner owner FROM sgp_pdt_picking_flow.backup ORDER BY firma');
 await clean.exec(readFileSync('docs/sql-proposals/picking-pdt-flow/rollback-unused.sql','utf8'));
 for(const b of beforeRestore.rows){const restored=await clean.query('SELECT md5(pg_get_functiondef(oid)) hash,proacl::text acl,proowner owner FROM pg_proc WHERE oid=$1::regprocedure',[b.firma]);if(restored.rows[0].hash!==b.hash||restored.rows[0].acl!==b.acl||restored.rows[0].owner!==b.owner)throw Error('Exact function/ACL/owner rollback mismatch '+b.firma);}
 const {rows}=await clean.query("SELECT md5(pg_get_functiondef('sgp_pdt_picking_simple.completo(uuid)'::regprocedure)) hash");
 if(rows[0].hash!=='4fc8306277b30a407d19a655d55770eb')throw Error('Rollback did not restore exact previous completion');
 console.log('PASS unused rollback restores exact completion');
} finally {await clean.close();}

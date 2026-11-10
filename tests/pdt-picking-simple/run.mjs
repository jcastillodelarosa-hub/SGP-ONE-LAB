const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
import {readFileSync} from 'node:fs';
const db=new PGlite();
try {
 for(const file of ['tests/pdt-picking-simple/fixture.sql','docs/sql-proposals/pdt/picking-simple/install.sql','tests/pdt-picking-simple/assertions.sql']) {
  await db.exec(readFileSync(file,'utf8'));console.log(`PASS ${file}`);
 }
 // Rollback refuses to erase accepted quantities.
 try { await db.exec(readFileSync('docs/sql-proposals/pdt/picking-simple/rollback-unused.sql','utf8')); throw new Error('Rollback erased ledger'); }
 catch(e) { if(!String(e).includes('PDT_SIMPLE_USED_USE_CONTAINMENT')) throw e; await db.exec('ROLLBACK'); }
 await db.exec(readFileSync('docs/sql-proposals/pdt/picking-simple/contain.sql','utf8'));
 const {rows}=await db.query("SELECT has_function_privilege('anon','public.sgp_pdt_picking_simple_v1(text,uuid,integer,uuid,text)','EXECUTE') allowed");
 if(rows[0].allowed) throw new Error('Containment did not revoke writes');
 console.log('PASS used rollback refusal and containment');
} finally {await db.close()}
const clean=new PGlite();
try {
 await clean.exec(readFileSync('tests/pdt-picking-simple/fixture.sql','utf8'));
 await clean.exec(readFileSync('docs/sql-proposals/pdt/picking-simple/install.sql','utf8'));
 await clean.exec(readFileSync('docs/sql-proposals/pdt/picking-simple/rollback-unused.sql','utf8'));
 const {rows}=await clean.query("SELECT md5(pg_get_functiondef('public.sgp_pdt_cierre_acreditado(uuid)'::regprocedure)) hash");
 if(rows[0].hash!=='24e18c5a31ffd2b7f313078ac42721c5') throw new Error('Rollback did not restore exact original');
 console.log('PASS unused rollback restores exact original');
} finally { await clean.close(); }

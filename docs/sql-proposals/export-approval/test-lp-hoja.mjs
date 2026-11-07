import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.SGP_PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();await db.waitReady;
const baseline=await readFile(new URL('./lp-hoja-baseline.sql',import.meta.url),'utf8');
const patch=await readFile(new URL('./03_lp_hoja_REVIEW.sql',import.meta.url),'utf8');
await db.exec('create table public.sgp_producciones(key_produccion text primary key,excluida_export boolean not null default false);');
await db.exec(baseline);
const read=async()=> (await db.query("select prosrc,proowner,proacl,proconfig,prosecdef from pg_proc where proname='sgp_lp_operacion_consultar'")).rows[0];
const before=await read();await db.exec(patch);const after=await read();
for(const key of ['proowner','proacl','proconfig','prosecdef'])assert.deepEqual(after[key],before[key]);
assert.match(after.prosrc,/p.key_produccion=o.key WHERE NOT p.excluida_export/);
assert.match(after.prosrc,/WHERE p.id_linea=p_linea AND NOT p.excluida_export AND EXISTS/);
assert.match(after.prosrc,/'excluida_export',p.excluida_export/);
for(const [start,end] of [["'history',","'notifications',"],["'reports',",'-- LP-HOJA-1:'],['-- Time metadata','RETURN res||']]){
 const extract=s=>s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)));
 assert.equal(extract(after.prosrc),extract(before.prosrc));
}
await assert.rejects(db.exec(patch),/LP_HOJA_EXPORT_SOURCE_CHANGED/);await db.exec('ROLLBACK');
await db.exec("insert into sgp_producciones values ('active',false),('absent',true);create table incorporated(key text);insert into incorporated values ('active'),('absent');");
const orders=(await db.query('select p.key_produccion from incorporated o join sgp_producciones p on p.key_produccion=o.key where not p.excluida_export')).rows;
const catalog=(await db.query('select p.key_produccion from sgp_producciones p where not p.excluida_export')).rows;
assert.deepEqual(orders,catalog);assert.deepEqual(orders,[{key_produccion:'active'}]);
console.log('PASS: LP-HOJA exact-source patch compiles; orders/catalog predicates aligned; projection, ACL/security, history/reports/schedule preserved; stale source rejected. Endpoint runtime not exercised.');
await db.close();

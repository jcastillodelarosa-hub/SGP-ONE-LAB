import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const {PGlite}=await import(process.env.OPT_PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA sgp_opt_shared;
CREATE TABLE sgp_opt_shared.documents(id_documento uuid,sha256 text,manifest_sha256 text,id_aprobacion uuid);
CREATE TABLE sgp_opt_shared.approvals(id_aprobacion uuid,evidencia jsonb);
CREATE TABLE sgp_opt_shared.sources(id_documento uuid,consecutivo text);
CREATE TABLE sgp_opt_shared.pieces(id_documento uuid,id_pieza uuid);
CREATE TABLE sgp_opt_shared.assignments(id_pieza uuid,reserva text,sistema text,key_produccion text);
CREATE TABLE sgp_opt_shared.cuts(id_pieza uuid);
CREATE TABLE sgp_opt_shared.document_summaries(id_documento uuid,sha256 text,id_aprobacion uuid,manifest_sha256 text,evidence_sha256 text,summary jsonb);
CREATE FUNCTION sgp_opt_shared.actor(t text,w boolean) RETURNS text LANGUAGE plpgsql AS $$BEGIN IF t IS DISTINCT FROM 'valid' THEN RAISE EXCEPTION 'DENIED';END IF;RETURN 'actor';END$$;
CREATE FUNCTION sgp_opt_shared.validate_scope(s jsonb) RETURNS void LANGUAGE plpgsql AS $$BEGIN IF s->>'linea' IS DISTINCT FROM 'PANELES_2' THEN RAISE EXCEPTION 'SCOPE';END IF;END$$;
CREATE FUNCTION sgp_opt_shared.in_scope(k text,s jsonb) RETURNS boolean LANGUAGE sql AS $$SELECT k=s->>'key'$$;`);
const summary={contract:'OPT-DOCUMENT-SUMMARY-1',scope:'DOCUMENTO',cutRows:[{original:'PROFILE SUMMARY'}],materialRows:[{original:'MATERIAL SUMMARY'}],projectData:{reference:'FOREIGN ORDER SECRET'}};
for(let n=1;n<=3;n++){
 await db.query('INSERT INTO sgp_opt_shared.documents VALUES($1,$2,$3,$4)',[id(n),'a'.repeat(64),'b'.repeat(64),id(10+n)]);
 await db.query('INSERT INTO sgp_opt_shared.approvals VALUES($1,$2)',[id(10+n),n===1?{documentary_summary:summary}:{historical:'unchanged'}]);
 await db.query('INSERT INTO sgp_opt_shared.sources VALUES($1,$2)',[id(n),'SYNTH-'+n]);await db.query('INSERT INTO sgp_opt_shared.pieces VALUES($1,$2)',[id(n),id(20+n)]);
 await db.query('INSERT INTO sgp_opt_shared.assignments VALUES($1,$2,$3,$4)',[id(20+n),'RES','SYS','KEY']);
 if(n===2)await db.query("INSERT INTO sgp_opt_shared.document_summaries SELECT d.id_documento,d.sha256,d.id_aprobacion,d.manifest_sha256,encode(sha256(convert_to(a.evidencia::text,'UTF8')),'hex'),$1 FROM sgp_opt_shared.documents d JOIN sgp_opt_shared.approvals a USING(id_aprobacion) WHERE d.id_documento=$2",[summary,id(n)]);
}
const baseline=readFileSync(new URL('fixtures/document-summary-before-inline-guard.sql',import.meta.url),'utf8');await db.exec(baseline);
await db.exec("REVOKE ALL ON FUNCTION public.sgp_opt_resumen_documental_v1(text,jsonb,text,text) FROM PUBLIC,service_role;GRANT EXECUTE ON FUNCTION public.sgp_opt_resumen_documental_v1(text,jsonb,text,text) TO anon,authenticated;");
const config=async()=>(await db.query("SELECT proacl::text,proowner,prosecdef,proconfig FROM pg_proc WHERE oid='public.sgp_opt_resumen_documental_v1(text,jsonb,text,text)'::regprocedure")).rows;
const beforeConfig=await config();const read=async(t='valid',s={linea:'PANELES_2',key:'KEY'},r='RES',sys='SYS')=>(await db.query('SELECT public.sgp_opt_resumen_documental_v1($1,$2,$3,$4) r',[t,s,r,sys])).rows[0].r;
const snapshots=async()=>{const out={};for(const table of ['documents','approvals','sources','pieces','assignments','cuts','document_summaries'])out[table]=createHash('sha256').update(JSON.stringify((await db.query(`SELECT to_jsonb(t) r FROM sgp_opt_shared.${table} t ORDER BY to_jsonb(t)::text`)).rows)).digest('hex');return out;};
const oldRows=await read(),oldSnapshots=await snapshots();assert(JSON.stringify(oldRows).includes('FOREIGN ORDER SECRET'));
const guard=readFileSync(new URL('project_data_inline_guard_REVIEW.sql',import.meta.url),'utf8');await db.exec(guard);
const newRows=await read();assert(!JSON.stringify(newRows).includes('FOREIGN ORDER SECRET'));
const expected=structuredClone(oldRows);for(const d of expected.documents)if(d.summary)delete d.summary.projectData;assert.deepEqual(newRows,expected);
assert.deepEqual(await config(),beforeConfig);assert.deepEqual(await snapshots(),oldSnapshots);await db.exec(guard);assert.deepEqual(await read(),expected);
await assert.rejects(read(null),/DENIED/);await assert.rejects(read('bad'),/DENIED/);await assert.rejects(read('valid',{linea:'FRAMES_2',key:'KEY'}),/SCOPE/);
for(const args of [['valid',undefined,'OTHER'],['valid',undefined,undefined,'OTHER'],['valid',{linea:'PANELES_2',key:'OTHER'}]])assert.equal((await read(...args)).documents.length,0);
// Refuse replacing an unknown new definition, rather than overwrite concurrent work.
await db.exec(baseline.replace('DECLARE docs jsonb;','DECLARE docs jsonb; -- changed baseline'));
await assert.rejects(db.exec(guard),/READER_CHANGED/);await db.exec('ROLLBACK');
await db.close();console.log('PASS: inline and historical-sidecar bypass reproduced/closed, direct old RPC guarded, absent summary preserved, actor/scope unchanged, grants/owner/config and all table hashes unchanged; idempotent guard and unknown-definition refusal. Synthetic policies.');

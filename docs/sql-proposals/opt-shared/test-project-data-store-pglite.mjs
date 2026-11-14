import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.OPT_PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,sha=b=>createHash('sha256').update(b).digest('hex');
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA sgp_opt_shared;
CREATE TABLE sgp_opt_shared.documents(id_documento uuid PRIMARY KEY,sha256 text,manifest_sha256 text,id_aprobacion uuid);
CREATE TABLE sgp_opt_shared.approvals(id_aprobacion uuid,evidencia jsonb);
CREATE TABLE sgp_opt_shared.sources(id_documento uuid,consecutivo text);
CREATE TABLE sgp_opt_shared.pieces(id_documento uuid,id_pieza uuid);
CREATE TABLE sgp_opt_shared.assignments(id_pieza uuid,reserva text,sistema text,key_produccion text);
CREATE TABLE sgp_opt_shared.cuts(id_pieza uuid,actor text);
CREATE FUNCTION sgp_opt_shared.actor(t text,w boolean) RETURNS text LANGUAGE plpgsql AS $$BEGIN IF t IS DISTINCT FROM 'valid' THEN RAISE EXCEPTION 'DENIED';END IF;RETURN 'synthetic';END$$;
CREATE FUNCTION sgp_opt_shared.validate_scope(s jsonb) RETURNS void LANGUAGE plpgsql AS $$BEGIN IF s->>'linea' IS DISTINCT FROM 'PANELES_2' OR s->>'anio' IS DISTINCT FROM '2099' OR s->>'semana' IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'SCOPE';END IF;END$$;
CREATE FUNCTION sgp_opt_shared.in_scope(k text,s jsonb) RETURNS boolean LANGUAGE sql AS $$SELECT k=s->>'key'$$;`);
const batch=[];
for(let n=1;n<=3;n++){
 const pdf=Buffer.from('%PDF-synthetic-'+n),h=sha(pdf),manifest='a'.repeat(64),projectData={contract:'OPT-PROJECT-DATA-1',scope:'DOCUMENTO',rows:[{item:1,sourcePage:1,sourceId:'project-p1-item1',profile:'SYNTH',code:'FINISH A/\nFINISH B',length:'132 5/16"',reference:'SYNTHETIC FOREIGN ORDER '+ 'line '.repeat(90)+'FINAL',quantity:16}],totalQuantity:16};
 await db.query('INSERT INTO sgp_opt_shared.documents VALUES($1,$2,$3,$4)',[id(n),h,manifest,id(10+n)]);
 await db.query('INSERT INTO sgp_opt_shared.approvals VALUES($1,$2)',[id(10+n),{historical:'UNCHANGED',documentary_summary:{contract:'OPT-DOCUMENT-SUMMARY-1',scope:'DOCUMENTO',cutRows:[],materialRows:[],projectData}}]);
 await db.query('INSERT INTO sgp_opt_shared.sources VALUES($1,$2)',[id(n),'SYNTH-'+n]);
 await db.query('INSERT INTO sgp_opt_shared.pieces VALUES($1,$2)',[id(n),id(20+n)]);
 await db.query('INSERT INTO sgp_opt_shared.assignments VALUES($1,$2,$3,$4)',[id(20+n),'RES-'+n,'SYS','KEY-'+n]);
 if(n<=2)batch.push({id_documento:id(n),pdf_hex:pdf.toString('hex'),expected_sha256:h,expected_manifest_sha256:manifest,extractor_sha256:'b'.repeat(64),projectData});
}
await db.exec(readFileSync(new URL('document_summary_REVIEW.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('project_data_store_REVIEW.sql',import.meta.url),'utf8'));
const snapshot=async()=>{const out={};for(const t of ['documents','approvals','sources','pieces','assignments','cuts'])out[t]=sha(JSON.stringify((await db.query('SELECT to_jsonb(t) AS row FROM sgp_opt_shared.'+t+' t ORDER BY to_jsonb(t)::text')).rows));return out;};
const before=await snapshot();const run=b=>db.query('SELECT sgp_opt_shared.recover_project_data_reviewed($1) result',[b]);const count=async()=>(await db.query('SELECT count(*)::integer n FROM sgp_opt_shared.project_data_metadata')).rows[0].n;
// Batch second failure proves first insert is rolled back.
let bad=structuredClone(batch);bad[1].expected_sha256='c'.repeat(64);await assert.rejects(run(bad),/PDF_HASH/);assert.equal(await count(),0);
bad=structuredClone(batch);bad[1].expected_manifest_sha256='d'.repeat(64);await assert.rejects(run(bad),/DOCUMENT_CHANGED/);assert.equal(await count(),0);
for(const mutate of [x=>x.projectData.rows[0].quantity=0,x=>x.projectData.rows[0].length='1 1/0"',x=>x.projectData.rows[0].length='1 2/2"',x=>x.projectData.totalQuantity=17,x=>x.projectData.rows[0].reference='',x=>x.projectData.rows.push(x.projectData.rows[0])]){bad=structuredClone(batch);mutate(bad[1]);await assert.rejects(run(bad));assert.equal(await count(),0);}
assert.deepEqual((await run(batch)).rows[0].result,{inserted:2,duplicates:0});assert.deepEqual((await run(batch)).rows[0].result,{inserted:0,duplicates:2});assert.equal(await count(),2);
bad=structuredClone(batch);bad[0].projectData.rows[0].reference+=' CHANGED';await assert.rejects(run(bad),/REPLAY_MISMATCH/);
bad=structuredClone(batch);bad[0].extractor_sha256='c'.repeat(64);await assert.rejects(run(bad),/REPLAY_MISMATCH/);
await assert.rejects(db.exec('DELETE FROM sgp_opt_shared.project_data_metadata'),/IMMUTABLE/);await assert.rejects(db.exec('TRUNCATE sgp_opt_shared.project_data_metadata'),/IMMUTABLE/);
// Stored metadata isn't a registration or a disclosure capability, even if inline existed.
for(const role of ['anon','authenticated','service_role']){
 assert.equal((await db.query("SELECT has_function_privilege($1,'sgp_opt_shared.recover_project_data_reviewed(jsonb)','EXECUTE') p",[role])).rows[0].p,false);
 assert.equal((await db.query("SELECT has_table_privilege($1,'sgp_opt_shared.project_data_metadata','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') p",[role])).rows[0].p,false);
 await db.exec('SET ROLE '+role);await assert.rejects(run(batch),/permission denied/);await db.exec('RESET ROLE');
}
assert.deepEqual(await snapshot(),before);assert.equal(await count(),2);
const rls=(await db.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='sgp_opt_shared.project_data_metadata'::regclass")).rows[0];assert(rls.relrowsecurity&&rls.relforcerowsecurity);
await db.close();console.log('PASS: synthetic hash/snapshot, batch rollback, idempotence, mismatch, immutability, ACL/RLS; operational table hashes unchanged. Local synthetic fixtures, not live-policy acceptance.');
